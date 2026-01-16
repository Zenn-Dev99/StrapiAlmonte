#!/usr/bin/env node

/**
 * Busca productos de WooCommerce que tengan atributos (Autor, Editorial, etc.)
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = join(__dirname, '..', '.env');
try {
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
} catch (err) {}

const STORES = {
  moraleja: {
    name: 'Moraleja',
    url: process.env.WOO_MORALEJA_URL || 'https://staging.moraleja.cl',
    consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY,
    consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET,
  },
  escolar: {
    name: 'Librería Escolar',
    url: process.env.WOO_ESCOLAR_URL || 'https://staging.escolar.cl',
    consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY,
    consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
  },
};

async function buscarProductosConAtributos(storeKey, limit = 50) {
  const store = STORES[storeKey];
  
  if (!store) {
    console.error(`❌ Tienda "${storeKey}" no encontrada`);
    process.exit(1);
  }

  if (!store.consumerKey || !store.consumerSecret) {
    console.error(`❌ Faltan credenciales para ${store.name}`);
    process.exit(1);
  }

  const auth = Buffer.from(`${store.consumerKey}:${store.consumerSecret}`).toString('base64');
  const apiUrl = `${store.url}/wp-json/wc/v3/products?per_page=${limit}&orderby=date&order=desc`;

  console.log(`\n🔍 Buscando productos con atributos en ${store.name}...\n`);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error ${response.status}: ${errorText}`);
      process.exit(1);
    }

    const products = await response.json();

    console.log(`📦 Encontrados ${products.length} productos\n`);

    const productosConAtributos = products.filter(p => 
      p.attributes && p.attributes.length > 0
    );

    const productosConBrands = products.filter(p => 
      p.brands && p.brands.length > 0
    );

    console.log(`🏷️  Productos con atributos: ${productosConAtributos.length}`);
    console.log(`🏢 Productos con brands: ${productosConBrands.length}\n`);

    if (productosConAtributos.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📋 PRODUCTOS CON ATRIBUTOS:');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      productosConAtributos.forEach((product, idx) => {
        console.log(`[${idx + 1}] Producto ID: ${product.id}`);
        console.log(`    Nombre: ${product.name}`);
        console.log(`    SKU: ${product.sku || '(vacío)'}`);
        console.log(`    Atributos (${product.attributes.length}):`);
        product.attributes.forEach(attr => {
          console.log(`      - ${attr.name || attr.slug || '(sin nombre)'}`);
          if (attr.options && attr.options.length > 0) {
            console.log(`        Options: ${JSON.stringify(attr.options)}`);
          }
        });
        console.log('');
      });
    }

    if (productosConBrands.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🏢 PRODUCTOS CON BRANDS:');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      productosConBrands.forEach((product, idx) => {
        console.log(`[${idx + 1}] Producto ID: ${product.id}`);
        console.log(`    Nombre: ${product.name}`);
        console.log(`    Brands: ${JSON.stringify(product.brands)}`);
        console.log('');
      });
    }

    // Buscar producto específico con "Autor" o "book-author"
    const productosConAutor = productosConAtributos.filter(p => 
      p.attributes.some(a => 
        a.name === 'book-author' || 
        a.name === 'Autor' || 
        a.slug === 'pa_book-author'
      )
    );

    if (productosConAutor.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('👤 PRODUCTOS CON ATRIBUTO "AUTOR":');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      const ejemplo = productosConAutor[0];
      console.log(`✅ Producto de ejemplo ID: ${ejemplo.id}`);
      console.log(`   Nombre: ${ejemplo.name}`);
      console.log(`   SKU: ${ejemplo.sku || '(vacío)'}`);
      console.log(`\n   Para analizar este producto en detalle, ejecuta:`);
      console.log(`   node scripts/analizar-producto-woocommerce.mjs ${storeKey} ${ejemplo.id}\n`);
    } else {
      console.log('⚠️  No se encontraron productos con atributo "Autor" o "book-author"\n');
    }

  } catch (error) {
    console.error(`❌ Error:`, error.message);
    process.exit(1);
  }
}

const storeKey = process.argv[2] || 'moraleja';
const limit = parseInt(process.argv[3]) || 50;

buscarProductosConAtributos(storeKey, limit);







