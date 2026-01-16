#!/usr/bin/env node

/**
 * Script para verificar el mapeo de campos entre Strapi y WooCommerce
 * Compara identificadores (SKU, ISBN, EAN) entre ambos sistemas
 * 
 * Uso:
 *   node scripts/verificar-mapeo-woo.mjs <libro-id>
 *   node scripts/verificar-mapeo-woo.mjs --all
 */

import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;

const STORES = {
  moraleja: {
    name: 'Moraleja',
    url: process.env.WOO_MORALEJA_URL,
    key: process.env.WOO_MORALEJA_CONSUMER_KEY,
    secret: process.env.WOO_MORALEJA_CONSUMER_SECRET,
  },
  escolar: {
    name: 'Librería Escolar',
    url: process.env.WOO_ESCOLAR_URL,
    key: process.env.WOO_ESCOLAR_CONSUMER_KEY,
    secret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
  },
};

/**
 * Obtener libro de Strapi
 */
async function getLibroFromStrapi(libroId) {
  const url = `${STRAPI_URL}/api/libros/${libroId}?populate=canales`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${STRAPI_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Strapi error: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

/**
 * Obtener producto de WooCommerce por SKU
 */
async function getProductFromWoo(store, sku) {
  if (!store.url || !store.key || !store.secret) {
    return null;
  }

  const auth = Buffer.from(`${store.key}:${store.secret}`).toString('base64');
  const url = `${store.url.replace(/\/$/, '')}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}`;
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  const products = await res.json();
  return Array.isArray(products) && products.length > 0 ? products[0] : null;
}

/**
 * Verificar mapeo de un libro
 */
async function verifyLibro(libroId) {
  console.log(`\n🔍 Verificando libro ID: ${libroId}`);
  console.log('━'.repeat(60));

  try {
    const libro = await getLibroFromStrapi(libroId);
    
    if (!libro) {
      console.error('❌ Libro no encontrado en Strapi');
      return;
    }

    const attrs = libro.attributes || libro;
    const isbn = attrs.isbn_libro;
    const ean = attrs.ean_libro;
    const externalIds = attrs.externalIds || {};

    console.log(`\n📚 Strapi - Libro:`);
    console.log(`   ID: ${libro.id}`);
    console.log(`   Nombre: ${attrs.nombre_libro}`);
    console.log(`   ISBN: ${isbn || '❌ No tiene'}`);
    console.log(`   EAN: ${ean || '❌ No tiene'}`);
    console.log(`   External IDs:`, externalIds);

    // Verificar en cada tienda
    for (const [storeKey, store] of Object.entries(STORES)) {
      if (!store.url || !store.key || !store.secret) {
        console.log(`\n⚠️  ${store.name}: No configurada`);
        continue;
      }

      const wooId = externalIds[`woo_${storeKey}`];
      
      console.log(`\n📦 ${store.name}:`);
      
      if (!wooId) {
        console.log(`   ⚠️  No tiene externalId (no sincronizado)`);
        continue;
      }

      // Buscar por externalId
      const auth = Buffer.from(`${store.key}:${store.secret}`).toString('base64');
      const res = await fetch(`${store.url.replace(/\/$/, '')}/wp-json/wc/v3/products/${wooId}`, {
        headers: { 'Authorization': `Basic ${auth}` },
      });

      if (!res.ok) {
        console.log(`   ❌ Producto no encontrado (ID: ${wooId})`);
        continue;
      }

      const wooProduct = await res.json();
      
      console.log(`   ✅ Producto encontrado (ID: ${wooProduct.id})`);
      console.log(`   SKU: ${wooProduct.sku || '❌ No tiene'}`);
      
      // Verificar meta_data
      const metaData = wooProduct.meta_data || [];
      const isbnMeta = metaData.find((m: any) => m.key === 'isbn');
      const eanMeta = metaData.find((m: any) => m.key === 'ean');
      
      console.log(`   Meta data:`);
      console.log(`     - ISBN: ${isbnMeta?.value || '❌ No tiene'}`);
      console.log(`     - EAN: ${eanMeta?.value || '❌ No tiene'}`);
      
      // Verificar consistencia
      console.log(`\n   🔄 Verificación de mapeo:`);
      
      if (wooProduct.sku === isbn) {
        console.log(`     ✅ SKU = ISBN: Correcto`);
      } else {
        console.log(`     ⚠️  SKU (${wooProduct.sku}) ≠ ISBN (${isbn})`);
      }
      
      if (isbnMeta && isbnMeta.value === isbn) {
        console.log(`     ✅ meta_data.isbn = ISBN: Correcto`);
      } else if (isbnMeta) {
        console.log(`     ⚠️  meta_data.isbn (${isbnMeta.value}) ≠ ISBN (${isbn})`);
      }
      
      if (ean && eanMeta && eanMeta.value === ean) {
        console.log(`     ✅ meta_data.ean = EAN: Correcto`);
      } else if (ean && !eanMeta) {
        console.log(`     ⚠️  EAN en Strapi pero no en WooCommerce`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Verificar todos los libros sincronizados
 */
async function verifyAll() {
  console.log('🔍 Verificando todos los libros sincronizados...\n');

  const url = `${STRAPI_URL}/api/libros?pagination[pageSize]=100&populate=canales`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${STRAPI_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.error('❌ Error obteniendo libros:', res.status);
    return;
  }

  const json = await res.json();
  const libros = json.data || [];

  console.log(`📚 Total de libros: ${libros.length}\n`);

  let sincronizados = 0;
  let conProblemas = 0;

  for (const libro of libros) {
    const attrs = libro.attributes || libro;
    const externalIds = attrs.externalIds || {};
    
    const tieneWoo = externalIds.woo_moraleja || externalIds.woo_escolar;
    
    if (tieneWoo) {
      sincronizados++;
      // Verificar solo los que tienen problemas potenciales
      if (!attrs.isbn_libro) {
        console.log(`⚠️  Libro ${libro.id}: Sin ISBN pero tiene externalIds`);
        conProblemas++;
      }
    }
  }

  console.log(`✅ Libros sincronizados: ${sincronizados}`);
  console.log(`⚠️  Libros con problemas: ${conProblemas}`);
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (!STRAPI_TOKEN) {
    console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
    return;
  }

  if (args.includes('--all')) {
    await verifyAll();
  } else if (args[0]) {
    await verifyLibro(args[0]);
  } else {
    console.log('Uso:');
    console.log('  node scripts/verificar-mapeo-woo.mjs <libro-id>');
    console.log('  node scripts/verificar-mapeo-woo.mjs --all');
  }
}

main().catch(console.error);

