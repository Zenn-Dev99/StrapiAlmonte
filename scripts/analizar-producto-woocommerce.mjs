#!/usr/bin/env node

/**
 * Script para analizar la estructura real de un producto de WooCommerce
 * Muestra todos los campos, atributos, meta_data, etc. para entender el mapeo correcto
 * 
 * Uso:
 *   node scripts/analizar-producto-woocommerce.mjs moraleja 73
 *   node scripts/analizar-producto-woocommerce.mjs escolar 72
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde .env si existe
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
} catch (err) {
  console.warn('⚠️  No se encontró archivo .env, usando variables de entorno del sistema');
}

// Configuraciones de las tiendas
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

async function analizarProducto(storeKey, productId) {
  const store = STORES[storeKey];
  
  if (!store) {
    console.error(`❌ Tienda "${storeKey}" no encontrada. Usa: moraleja o escolar`);
    process.exit(1);
  }

  if (!store.consumerKey || !store.consumerSecret) {
    console.error(`❌ Faltan credenciales para ${store.name}`);
    console.error(`   Verifica las variables: WOO_${storeKey.toUpperCase()}_CONSUMER_KEY y WOO_${storeKey.toUpperCase()}_CONSUMER_SECRET`);
    process.exit(1);
  }

  const auth = Buffer.from(`${store.consumerKey}:${store.consumerSecret}`).toString('base64');
  const apiUrl = `${store.url}/wp-json/wc/v3/products/${productId}`;

  console.log(`\n🔍 Analizando producto ${productId} de ${store.name}...`);
  console.log(`📡 URL: ${apiUrl}\n`);

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
      console.error(`❌ Error ${response.status}: ${response.statusText}`);
      console.error(`   ${errorText}`);
      process.exit(1);
    }

    const product = await response.json();

    // Mostrar estructura completa
    console.log('═'.repeat(80));
    console.log('📦 ESTRUCTURA COMPLETA DEL PRODUCTO');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(product, null, 2));

    // Análisis detallado
    console.log('\n\n');
    console.log('═'.repeat(80));
    console.log('📊 ANÁLISIS DETALLADO');
    console.log('═'.repeat(80));

    // Campos básicos
    console.log('\n📝 CAMPOS BÁSICOS:');
    console.log(`   ID: ${product.id}`);
    console.log(`   Name: ${product.name}`);
    console.log(`   SKU: ${product.sku || '(vacío)'}`);
    console.log(`   Type: ${product.type}`);
    console.log(`   Status: ${product.status}`);
    console.log(`   Permalink: ${product.permalink}`);

    // Precios
    console.log('\n💰 PRECIOS:');
    console.log(`   Regular Price: ${product.regular_price || '(vacío)'}`);
    console.log(`   Sale Price: ${product.sale_price || '(vacío)'}`);
    console.log(`   Price: ${product.price || '(vacío)'}`);

    // Stock
    console.log('\n📦 STOCK:');
    console.log(`   Stock Quantity: ${product.stock_quantity ?? '(null)'}`);
    console.log(`   Manage Stock: ${product.manage_stock}`);
    console.log(`   Stock Status: ${product.stock_status}`);
    console.log(`   Backorders: ${product.backorders}`);

    // Descripciones
    console.log('\n📄 DESCRIPCIONES:');
    console.log(`   Description (longitud): ${product.description?.length || 0} caracteres`);
    console.log(`   Short Description (longitud): ${product.short_description?.length || 0} caracteres`);
    if (product.description) {
      console.log(`   Description (primeros 200 chars): ${product.description.substring(0, 200)}...`);
    }

    // Imágenes
    console.log('\n🖼️  IMÁGENES:');
    if (product.images && product.images.length > 0) {
      console.log(`   Total de imágenes: ${product.images.length}`);
      product.images.forEach((img, idx) => {
        console.log(`   [${idx + 1}] ${img.src}`);
        console.log(`       ID: ${img.id}, Name: ${img.name || '(sin nombre)'}`);
      });
    } else {
      console.log('   (sin imágenes)');
    }

    // Atributos
    console.log('\n🏷️  ATRIBUTOS:');
    if (product.attributes && product.attributes.length > 0) {
      console.log(`   Total de atributos: ${product.attributes.length}`);
      product.attributes.forEach((attr, idx) => {
        console.log(`   [${idx + 1}] ${attr.name || attr.slug || '(sin nombre)'}`);
        console.log(`       ID: ${attr.id || '(sin ID)'}`);
        console.log(`       Slug: ${attr.slug || '(sin slug)'}`);
        console.log(`       Visible: ${attr.visible}`);
        console.log(`       Variation: ${attr.variation}`);
        if (attr.options && attr.options.length > 0) {
          console.log(`       Options: ${JSON.stringify(attr.options)}`);
        }
        if (attr.option) {
          console.log(`       Option (seleccionado): ${attr.option}`);
        }
      });
    } else {
      console.log('   (sin atributos)');
    }

    // Brands (si existe)
    console.log('\n🏢 BRANDS/MARCAS:');
    if (product.brands && product.brands.length > 0) {
      console.log(`   Total de brands: ${product.brands.length}`);
      product.brands.forEach((brand, idx) => {
        console.log(`   [${idx + 1}] ${typeof brand === 'object' ? JSON.stringify(brand) : brand}`);
      });
    } else {
      console.log('   (sin brands - campo no existe o está vacío)');
    }

    // Categorías
    console.log('\n📂 CATEGORÍAS:');
    if (product.categories && product.categories.length > 0) {
      console.log(`   Total de categorías: ${product.categories.length}`);
      product.categories.forEach((cat, idx) => {
        console.log(`   [${idx + 1}] ${cat.name} (ID: ${cat.id}, Slug: ${cat.slug})`);
      });
    } else {
      console.log('   (sin categorías)');
    }

    // Tags
    console.log('\n🏷️  TAGS:');
    if (product.tags && product.tags.length > 0) {
      console.log(`   Total de tags: ${product.tags.length}`);
      product.tags.forEach((tag, idx) => {
        console.log(`   [${idx + 1}] ${tag.name} (ID: ${tag.id}, Slug: ${tag.slug})`);
      });
    } else {
      console.log('   (sin tags)');
    }

    // Meta Data
    console.log('\n🔑 META DATA:');
    if (product.meta_data && product.meta_data.length > 0) {
      console.log(`   Total de meta_data: ${product.meta_data.length}`);
      product.meta_data.forEach((meta, idx) => {
        console.log(`   [${idx + 1}] ${meta.key} = ${meta.value}`);
      });
      
      // Extraer campos importantes
      console.log('\n   📋 Campos extraídos de meta_data:');
      const isbn = product.meta_data.find(m => m.key === 'isbn')?.value;
      const ean = product.meta_data.find(m => m.key === 'ean')?.value;
      const numeroEdicion = product.meta_data.find(m => m.key === 'numero_edicion')?.value;
      const agnoEdicion = product.meta_data.find(m => m.key === 'agno_edicion')?.value;
      const idioma = product.meta_data.find(m => m.key === 'idioma')?.value;
      const tipoLibro = product.meta_data.find(m => m.key === 'tipo_libro')?.value;
      
      if (isbn) console.log(`      ISBN: ${isbn}`);
      if (ean) console.log(`      EAN: ${ean}`);
      if (numeroEdicion) console.log(`      Número Edición: ${numeroEdicion}`);
      if (agnoEdicion) console.log(`      Año Edición: ${agnoEdicion}`);
      if (idioma) console.log(`      Idioma: ${idioma}`);
      if (tipoLibro) console.log(`      Tipo Libro: ${tipoLibro}`);
      
    } else {
      console.log('   (sin meta_data)');
    }

    // Recomendaciones de mapeo
    console.log('\n\n');
    console.log('═'.repeat(80));
    console.log('💡 RECOMENDACIONES DE MAPEO');
    console.log('═'.repeat(80));

    console.log('\n📚 Campos básicos → Strapi Libro:');
    console.log(`   nombre_libro ← name: "${product.name}"`);
    console.log(`   isbn_libro ← sku: "${product.sku || '(vacío)'}"`);
    console.log(`   descripcion (blocks) ← description: "${product.description ? 'SÍ' : 'NO'} (${product.description?.length || 0} chars)"`);
    console.log(`   subtitulo_libro ← short_description: "${product.short_description ? 'SÍ' : 'NO'} (${product.short_description?.length || 0} chars)"`);

    console.log('\n🔗 Relaciones:');
    const autorAttr = product.attributes?.find(a => 
      a.name === 'book-author' || 
      a.name === 'Autor' || 
      a.slug === 'pa_book-author'
    );
    if (autorAttr) {
      console.log(`   autor_relacion ← attributes["${autorAttr.name}"].options: ${JSON.stringify(autorAttr.options)}`);
    } else {
      console.log('   autor_relacion ← NO ENCONTRADO EN ATRIBUTOS');
    }

    if (product.brands && product.brands.length > 0) {
      console.log(`   editorial ← brands: ${JSON.stringify(product.brands)}`);
    } else {
      // Buscar en meta_data
      const brandMeta = product.meta_data?.find(m => 
        m.key === 'brand' || 
        m.key === 'editorial' || 
        m.key === 'pa_brand'
      );
      if (brandMeta) {
        console.log(`   editorial ← meta_data["${brandMeta.key}"]: ${brandMeta.value}`);
      } else {
        console.log('   editorial ← NO ENCONTRADO (buscar en brands o meta_data)');
      }
    }

    console.log('\n📸 Imágenes:');
    if (product.images && product.images.length > 0) {
      console.log(`   portada_libro ← images[0].src: ${product.images[0].src}`);
      if (product.images.length > 1) {
        console.log(`   imagenes_interior ← images[1..${product.images.length - 1}] (${product.images.length - 1} imágenes)`);
      }
    } else {
      console.log('   (sin imágenes para mapear)');
    }

    console.log('\n💰 Precios y Stock:');
    console.log(`   precios (relation) ← regular_price: ${product.regular_price || '(vacío)'}`);
    if (product.sale_price) {
      console.log(`   precios (relation) ← sale_price: ${product.sale_price}`);
    }
    console.log(`   stocks (relation) ← stock_quantity: ${product.stock_quantity ?? '(null)'}`);

    console.log('\n');
    console.log('═'.repeat(80));
    console.log('✅ Análisis completado');
    console.log('═'.repeat(80));
    console.log('\n');

  } catch (error) {
    console.error(`❌ Error al obtener producto:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Ejecutar
const storeKey = process.argv[2];
const productId = process.argv[3];

if (!storeKey || !productId) {
  console.error('❌ Uso: node scripts/analizar-producto-woocommerce.mjs <tienda> <product_id>');
  console.error('   Ejemplo: node scripts/analizar-producto-woocommerce.mjs moraleja 73');
  console.error('   Ejemplo: node scripts/analizar-producto-woocommerce.mjs escolar 72');
  process.exit(1);
}

analizarProducto(storeKey, productId);







