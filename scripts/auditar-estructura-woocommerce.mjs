#!/usr/bin/env node

/**
 * Script de auditoría completa de WooCommerce
 * Analiza todos los productos y genera un reporte de:
 * - Atributos utilizados
 * - Meta data utilizados
 * - Brands utilizados
 * - Frecuencia de uso
 * 
 * Uso:
 *   node scripts/auditar-estructura-woocommerce.mjs moraleja
 *   node scripts/auditar-estructura-woocommerce.mjs escolar
 */

import fetch from 'node-fetch';
import { readFileSync, writeFileSync } from 'fs';
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

async function fetchAllProducts(store, page = 1, allProducts = []) {
  const auth = Buffer.from(`${store.consumerKey}:${store.consumerSecret}`).toString('base64');
  const apiUrl = `${store.url}/wp-json/wc/v3/products?per_page=100&page=${page}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const products = await response.json();
    
    if (products.length === 0) {
      return allProducts;
    }

    allProducts.push(...products);

    // Si hay 100 productos, puede haber más páginas
    if (products.length === 100) {
      return fetchAllProducts(store, page + 1, allProducts);
    }

    return allProducts;
  } catch (error) {
    console.error(`Error en página ${page}:`, error.message);
    return allProducts;
  }
}

async function auditarEstructura(storeKey) {
  const store = STORES[storeKey];
  
  if (!store) {
    console.error(`❌ Tienda "${storeKey}" no encontrada`);
    process.exit(1);
  }

  if (!store.consumerKey || !store.consumerSecret) {
    console.error(`❌ Faltan credenciales para ${store.name}`);
    process.exit(1);
  }

  console.log(`\n🔍 Auditoría de estructura: ${store.name}\n`);
  console.log(`📡 Obteniendo todos los productos...\n`);

  const products = await fetchAllProducts(store);
  console.log(`✅ Obtenidos ${products.length} productos\n`);

  // Estructuras para análisis
  const atributosMap = new Map(); // name -> {count, options, examples}
  const metaDataMap = new Map(); // key -> {count, values, examples}
  const brandsSet = new Set();
  const categoriesMap = new Map();
  const tagsMap = new Map();
  
  let productosConAtributos = 0;
  let productosConBrands = 0;
  let productosConMetaData = 0;

  // Analizar cada producto
  products.forEach(product => {
    // Atributos
    if (product.attributes && product.attributes.length > 0) {
      productosConAtributos++;
      product.attributes.forEach(attr => {
        const name = attr.name || attr.slug || 'unknown';
        if (!atributosMap.has(name)) {
          atributosMap.set(name, {
            count: 0,
            options: new Set(),
            examples: [],
            slug: attr.slug,
          });
        }
        const attrData = atributosMap.get(name);
        attrData.count++;
        if (attr.options && attr.options.length > 0) {
          attr.options.forEach(opt => attrData.options.add(opt));
          if (attrData.examples.length < 5) {
            attrData.examples.push({
              productId: product.id,
              productName: product.name,
              options: attr.options,
            });
          }
        }
      });
    }

    // Brands
    if (product.brands && product.brands.length > 0) {
      productosConBrands++;
      product.brands.forEach(brand => {
        const brandName = typeof brand === 'object' ? (brand.name || brand.id) : brand;
        brandsSet.add(brandName);
      });
    }

    // Meta Data
    if (product.meta_data && product.meta_data.length > 0) {
      productosConMetaData++;
      product.meta_data.forEach(meta => {
        const key = meta.key;
        if (!metaDataMap.has(key)) {
          metaDataMap.set(key, {
            count: 0,
            values: new Set(),
            examples: [],
          });
        }
        const metaData = metaDataMap.get(key);
        metaData.count++;
        if (meta.value) {
          metaData.values.add(String(meta.value));
          if (metaData.examples.length < 3) {
            metaData.examples.push({
              productId: product.id,
              productName: product.name,
              value: meta.value,
            });
          }
        }
      });
    }

    // Categorías
    if (product.categories && product.categories.length > 0) {
      product.categories.forEach(cat => {
        if (!categoriesMap.has(cat.id)) {
          categoriesMap.set(cat.id, {
            name: cat.name,
            slug: cat.slug,
            count: 0,
          });
        }
        categoriesMap.get(cat.id).count++;
      });
    }

    // Tags
    if (product.tags && product.tags.length > 0) {
      product.tags.forEach(tag => {
        if (!tagsMap.has(tag.id)) {
          tagsMap.set(tag.id, {
            name: tag.name,
            slug: tag.slug,
            count: 0,
          });
        }
        tagsMap.get(tag.id).count++;
      });
    }
  });

  // Generar reporte
  const reporte = {
    tienda: store.name,
    fecha: new Date().toISOString(),
    resumen: {
      totalProductos: products.length,
      productosConAtributos,
      productosConBrands,
      productosConMetaData,
      porcentajeConAtributos: ((productosConAtributos / products.length) * 100).toFixed(2) + '%',
      porcentajeConBrands: ((productosConBrands / products.length) * 100).toFixed(2) + '%',
      porcentajeConMetaData: ((productosConMetaData / products.length) * 100).toFixed(2) + '%',
    },
    atributos: Array.from(atributosMap.entries()).map(([name, data]) => ({
      nombre: name,
      slug: data.slug,
      productos: data.count,
      porcentaje: ((data.count / products.length) * 100).toFixed(2) + '%',
      opcionesUnicas: Array.from(data.options).slice(0, 20), // Primeros 20
      totalOpciones: data.options.size,
      ejemplos: data.examples,
    })).sort((a, b) => b.productos - a.productos),
    brands: Array.from(brandsSet),
    metaData: Array.from(metaDataMap.entries())
      .filter(([key]) => !key.startsWith('_')) // Filtrar campos técnicos de WordPress
      .map(([key, data]) => ({
        key,
        productos: data.count,
        porcentaje: ((data.count / products.length) * 100).toFixed(2) + '%',
        valoresUnicos: Array.from(data.values).slice(0, 20), // Primeros 20
        totalValores: data.values.size,
        ejemplos: data.examples,
      })).sort((a, b) => b.productos - a.productos),
    categorias: Array.from(categoriesMap.values()).sort((a, b) => b.count - a.count),
    tags: Array.from(tagsMap.values()).sort((a, b) => b.count - a.count),
  };

  // Mostrar resumen en consola
  console.log('═'.repeat(80));
  console.log('📊 RESUMEN DE AUDITORÍA');
  console.log('═'.repeat(80));
  console.log(`\nTotal de productos: ${reporte.resumen.totalProductos}`);
  console.log(`Productos con atributos: ${reporte.resumen.productosConAtributos} (${reporte.resumen.porcentajeConAtributos})`);
  console.log(`Productos con brands: ${reporte.resumen.productosConBrands} (${reporte.resumen.porcentajeConBrands})`);
  console.log(`Productos con meta_data: ${reporte.resumen.productosConMetaData} (${reporte.resumen.porcentajeConMetaData})`);

  console.log('\n\n🏷️  ATRIBUTOS ENCONTRADOS:');
  console.log('─'.repeat(80));
  reporte.atributos.forEach((attr, idx) => {
    console.log(`\n[${idx + 1}] ${attr.nombre} (${attr.slug || 'sin slug'})`);
    console.log(`    Productos: ${attr.productos} (${attr.porcentaje})`);
    console.log(`    Opciones únicas: ${attr.totalOpciones}`);
    if (attr.opcionesUnicas.length > 0) {
      console.log(`    Primeras opciones: ${attr.opcionesUnicas.slice(0, 5).join(', ')}${attr.totalOpciones > 5 ? '...' : ''}`);
    }
  });

  console.log('\n\n🏢 BRANDS ENCONTRADOS:');
  console.log('─'.repeat(80));
  if (reporte.brands.length > 0) {
    reporte.brands.forEach((brand, idx) => {
      console.log(`[${idx + 1}] ${brand}`);
    });
  } else {
    console.log('(ninguno)');
  }

  console.log('\n\n🔑 META DATA IMPORTANTE (sin campos técnicos):');
  console.log('─'.repeat(80));
  reporte.metaData.forEach((meta, idx) => {
    console.log(`\n[${idx + 1}] ${meta.key}`);
    console.log(`    Productos: ${meta.productos} (${meta.porcentaje})`);
    console.log(`    Valores únicos: ${meta.totalValores}`);
    if (meta.valoresUnicos.length > 0 && meta.totalValores <= 10) {
      console.log(`    Valores: ${meta.valoresUnicos.join(', ')}`);
    } else if (meta.valoresUnicos.length > 0) {
      console.log(`    Primeros valores: ${meta.valoresUnicos.slice(0, 5).join(', ')}...`);
    }
  });

  // Guardar reporte en archivo JSON
  const reportPath = join(__dirname, '..', `auditoria-woocommerce-${storeKey}-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(reporte, null, 2), 'utf-8');
  console.log('\n\n✅ Reporte guardado en:', reportPath);

  // Generar recomendaciones de mapeo
  console.log('\n\n💡 RECOMENDACIONES DE MAPEO:');
  console.log('─'.repeat(80));
  
  console.log('\n📚 Atributos → Content Types:');
  reporte.atributos.forEach(attr => {
    if (attr.nombre === 'book-author' || attr.nombre === 'Autor') {
      console.log(`   ✅ ${attr.nombre} → Autor (autor_relacion)`);
    } else if (attr.nombre === 'editorial' || attr.nombre === 'Editorial') {
      console.log(`   ✅ ${attr.nombre} → Editorial (editorial)`);
    } else if (attr.nombre === 'sello' || attr.nombre === 'Sello') {
      console.log(`   ✅ ${attr.nombre} → Sello (sello)`);
    } else if (attr.nombre === 'coleccion' || attr.nombre === 'Coleccion') {
      console.log(`   ✅ ${attr.nombre} → Coleccion (coleccion)`);
    } else if (attr.nombre === 'obra' || attr.nombre === 'Obra') {
      console.log(`   ✅ ${attr.nombre} → Obra (obra)`);
    } else {
      console.log(`   ⚠️  ${attr.nombre} → ??? (verificar si necesita Content Type)`);
    }
  });

  console.log('\n🔑 Meta Data → Campos:');
  const camposImportantes = ['isbn', 'ean', 'numero_edicion', 'agno_edicion', 'idioma', 'tipo_libro', 'sello_id', 'coleccion_id', 'obra_id'];
  reporte.metaData.forEach(meta => {
    if (camposImportantes.includes(meta.key)) {
      console.log(`   ✅ ${meta.key} → Libro.${meta.key} (ya existe)`);
    } else if (meta.productos > 10) {
      console.log(`   ⚠️  ${meta.key} → ??? (usado en ${meta.porcentaje} de productos)`);
    }
  });

  console.log('\n');
}

// Ejecutar
const storeKey = process.argv[2];

if (!storeKey) {
  console.error('❌ Uso: node scripts/auditar-estructura-woocommerce.mjs <tienda>');
  console.error('   Ejemplo: node scripts/auditar-estructura-woocommerce.mjs moraleja');
  console.error('   Ejemplo: node scripts/auditar-estructura-woocommerce.mjs escolar');
  process.exit(1);
}

auditarEstructura(storeKey).catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});







