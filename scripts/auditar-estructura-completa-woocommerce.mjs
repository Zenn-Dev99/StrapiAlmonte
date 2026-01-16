#!/usr/bin/env node

/**
 * Script de auditoría COMPLETA de WooCommerce
 * Analiza TODO lo relacionado con productos:
 * - Atributos definidos (y sus términos)
 * - Brands (y sus atributos/metadata)
 * - Categorías (y sus atributos/metadata)
 * - Tags (y sus atributos/metadata)
 * - Reviews/Valoraciones
 * - Meta data de productos
 * 
 * Uso:
 *   node scripts/auditar-estructura-completa-woocommerce.mjs moraleja
 *   node scripts/auditar-estructura-completa-woocommerce.mjs escolar
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

// Helper para hacer requests autenticados
async function fetchWooAPI(store, endpoint, options = {}) {
  const auth = Buffer.from(`${store.consumerKey}:${store.consumerSecret}`).toString('base64');
  const apiUrl = `${store.url}/wp-json/wc/v3/${endpoint}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Endpoint no existe (ej: brands sin plugin)
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

// Obtener todos los productos (paginado)
async function fetchAllProducts(store) {
  const allProducts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const products = await fetchWooAPI(store, `products?per_page=100&page=${page}`);
    if (!products || products.length === 0) {
      hasMore = false;
    } else {
      allProducts.push(...products);
      hasMore = products.length === 100;
      page++;
    }
  }

  return allProducts;
}

// Obtener todos los atributos definidos
async function fetchAllAttributes(store) {
  const allAttributes = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const attributes = await fetchWooAPI(store, `products/attributes?per_page=100&page=${page}`);
    if (!attributes || attributes.length === 0) {
      hasMore = false;
    } else {
      allAttributes.push(...attributes);
      hasMore = attributes.length === 100;
      page++;
    }
  }

  return allAttributes;
}

// Obtener términos de un atributo
async function fetchAttributeTerms(store, attributeId) {
  const allTerms = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const terms = await fetchWooAPI(store, `products/attributes/${attributeId}/terms?per_page=100&page=${page}`);
    if (!terms || terms.length === 0) {
      hasMore = false;
    } else {
      allTerms.push(...terms);
      hasMore = terms.length === 100;
      page++;
    }
  }

  return allTerms;
}

// Obtener todas las categorías
async function fetchAllCategories(store) {
  const allCategories = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const categories = await fetchWooAPI(store, `products/categories?per_page=100&page=${page}`);
    if (!categories || categories.length === 0) {
      hasMore = false;
    } else {
      allCategories.push(...categories);
      hasMore = categories.length === 100;
      page++;
    }
  }

  return allCategories;
}

// Obtener todas las etiquetas
async function fetchAllTags(store) {
  const allTags = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const tags = await fetchWooAPI(store, `products/tags?per_page=100&page=${page}`);
    if (!tags || tags.length === 0) {
      hasMore = false;
    } else {
      allTags.push(...tags);
      hasMore = tags.length === 100;
      page++;
    }
  }

  return allTags;
}

// Obtener brands (si existe el plugin)
async function fetchAllBrands(store) {
  try {
    const brands = await fetchWooAPI(store, `products/brands`);
    return brands || [];
  } catch (error) {
    return []; // Plugin de brands no instalado
  }
}

// Obtener reviews de un producto
async function fetchProductReviews(store, productId) {
  try {
    const reviews = await fetchWooAPI(store, `products/${productId}/reviews`);
    return reviews || [];
  } catch (error) {
    return [];
  }
}

// Auditoría completa
async function auditarEstructuraCompleta(storeKey) {
  const store = STORES[storeKey];
  
  if (!store) {
    console.error(`❌ Tienda "${storeKey}" no encontrada`);
    process.exit(1);
  }

  if (!store.consumerKey || !store.consumerSecret) {
    console.error(`❌ Faltan credenciales para ${store.name}`);
    process.exit(1);
  }

  console.log(`\n🔍 Auditoría COMPLETA de estructura: ${store.name}\n`);
  console.log(`📡 Obteniendo datos...\n`);

  // 1. Obtener productos
  console.log(`   📦 Obteniendo productos...`);
  const products = await fetchAllProducts(store);
  console.log(`   ✅ ${products.length} productos obtenidos`);

  // 2. Obtener atributos definidos
  console.log(`   🏷️  Obteniendo atributos definidos...`);
  const attributes = await fetchAllAttributes(store);
  console.log(`   ✅ ${attributes.length} atributos definidos`);

  // 3. Obtener términos de cada atributo
  console.log(`   📋 Obteniendo términos de atributos...`);
  const attributesWithTerms = [];
  for (const attr of attributes) {
    const terms = await fetchAttributeTerms(store, attr.id);
    attributesWithTerms.push({
      ...attr,
      terms: terms || [],
      totalTerms: terms?.length || 0,
    });
  }
  console.log(`   ✅ Términos obtenidos para ${attributesWithTerms.length} atributos`);

  // 4. Obtener categorías
  console.log(`   📂 Obteniendo categorías...`);
  const categories = await fetchAllCategories(store);
  console.log(`   ✅ ${categories.length} categorías obtenidas`);

  // 5. Obtener tags
  console.log(`   🏷️  Obteniendo tags...`);
  const tags = await fetchAllTags(store);
  console.log(`   ✅ ${tags.length} tags obtenidos`);

  // 6. Obtener brands
  console.log(`   🏢 Obteniendo brands...`);
  const brands = await fetchAllBrands(store);
  console.log(`   ✅ ${brands.length} brands obtenidos`);

  // 7. Analizar uso en productos
  console.log(`   🔍 Analizando uso en productos...`);
  
  const atributosUsados = new Map(); // attribute_id -> {count, products}
  const metaDataMap = new Map();
  const categoriesUsadas = new Map();
  const tagsUsados = new Map();
  const brandsUsados = new Map();
  const reviewsCount = { total: 0, productosConReviews: 0 };

  products.forEach(product => {
    // Atributos usados en productos
    if (product.attributes && product.attributes.length > 0) {
      product.attributes.forEach(attr => {
        const attrId = attr.id;
        if (!atributosUsados.has(attrId)) {
          atributosUsados.set(attrId, {
            count: 0,
            products: new Set(),
            options: new Set(),
          });
        }
        const attrData = atributosUsados.get(attrId);
        attrData.count++;
        attrData.products.add(product.id);
        if (attr.options && attr.options.length > 0) {
          attr.options.forEach(opt => attrData.options.add(opt));
        }
      });
    }

    // Meta data
    if (product.meta_data && product.meta_data.length > 0) {
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

    // Categorías usadas
    if (product.categories && product.categories.length > 0) {
      product.categories.forEach(cat => {
        if (!categoriesUsadas.has(cat.id)) {
          categoriesUsadas.set(cat.id, {
            name: cat.name,
            slug: cat.slug,
            count: 0,
            products: new Set(),
          });
        }
        const catData = categoriesUsadas.get(cat.id);
        catData.count++;
        catData.products.add(product.id);
      });
    }

    // Tags usados
    if (product.tags && product.tags.length > 0) {
      product.tags.forEach(tag => {
        if (!tagsUsados.has(tag.id)) {
          tagsUsados.set(tag.id, {
            name: tag.name,
            slug: tag.slug,
            count: 0,
            products: new Set(),
          });
        }
        const tagData = tagsUsados.get(tag.id);
        tagData.count++;
        tagData.products.add(product.id);
      });
    }

    // Brands usados
    if (product.brands && product.brands.length > 0) {
      product.brands.forEach(brand => {
        const brandId = typeof brand === 'object' ? brand.id : brand;
        const brandName = typeof brand === 'object' ? (brand.name || brand.id) : brand;
        if (!brandsUsados.has(brandId)) {
          brandsUsados.set(brandId, {
            name: brandName,
            count: 0,
            products: new Set(),
          });
        }
        const brandData = brandsUsados.get(brandId);
        brandData.count++;
        brandData.products.add(product.id);
      });
    }
  });

  // 8. Obtener reviews de algunos productos (muestra)
  console.log(`   ⭐ Obteniendo reviews (muestra de 10 productos)...`);
  const sampleProducts = products.slice(0, 10);
  for (const product of sampleProducts) {
    const reviews = await fetchProductReviews(store, product.id);
    if (reviews && reviews.length > 0) {
      reviewsCount.total += reviews.length;
      reviewsCount.productosConReviews++;
    }
  }

  console.log(`   ✅ Análisis completado\n`);

  // Generar reporte
  const reporte = {
    tienda: store.name,
    fecha: new Date().toISOString(),
    resumen: {
      totalProductos: products.length,
      totalAtributosDefinidos: attributes.length,
      totalCategorias: categories.length,
      totalTags: tags.length,
      totalBrands: brands.length,
      productosConAtributos: Array.from(atributosUsados.values()).reduce((sum, a) => sum + a.count, 0),
      productosConMetaData: Array.from(metaDataMap.values()).filter(m => m.count > 0).length,
      productosConCategorias: categoriesUsadas.size,
      productosConTags: tagsUsados.size,
      productosConBrands: brandsUsados.size,
      reviews: {
        total: reviewsCount.total,
        productosConReviews: reviewsCount.productosConReviews,
        muestra: sampleProducts.length,
      },
    },
    atributos: {
      definidos: attributesWithTerms.map(attr => ({
        id: attr.id,
        name: attr.name,
        slug: attr.slug,
        type: attr.type,
        hasArchives: attr.has_archives,
        totalTerms: attr.totalTerms,
        terms: attr.terms.map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          count: t.count,
        })),
        usoEnProductos: atributosUsados.has(attr.id) ? {
          productos: atributosUsados.get(attr.id).count,
          porcentaje: ((atributosUsados.get(attr.id).count / products.length) * 100).toFixed(2) + '%',
          opcionesUsadas: Array.from(atributosUsados.get(attr.id).options),
        } : null,
      })),
    },
    categorias: categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      count: cat.count,
      parent: cat.parent,
      image: cat.image ? { src: cat.image.src } : null,
      usoEnProductos: categoriesUsadas.has(cat.id) ? {
        productos: categoriesUsadas.get(cat.id).count,
        porcentaje: ((categoriesUsadas.get(cat.id).count / products.length) * 100).toFixed(2) + '%',
      } : null,
    })),
    tags: tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      count: tag.count,
      usoEnProductos: tagsUsados.has(tag.id) ? {
        productos: tagsUsados.get(tag.id).count,
        porcentaje: ((tagsUsados.get(tag.id).count / products.length) * 100).toFixed(2) + '%',
      } : null,
    })),
    brands: brands.map(brand => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      count: brand.count,
      image: brand.image ? { src: brand.image.src } : null,
      usoEnProductos: brandsUsados.has(brand.id) ? {
        productos: brandsUsados.get(brand.id).count,
        porcentaje: ((brandsUsados.get(brand.id).count / products.length) * 100).toFixed(2) + '%',
      } : null,
    })),
    metaData: Array.from(metaDataMap.entries())
      .filter(([key]) => !key.startsWith('_')) // Filtrar campos técnicos
      .map(([key, data]) => ({
        key,
        productos: data.count,
        porcentaje: ((data.count / products.length) * 100).toFixed(2) + '%',
        valoresUnicos: Array.from(data.values).slice(0, 20),
        totalValores: data.values.size,
        ejemplos: data.examples,
      }))
      .sort((a, b) => b.productos - a.productos),
  };

  // Mostrar resumen en consola
  console.log('═'.repeat(80));
  console.log('📊 RESUMEN DE AUDITORÍA COMPLETA');
  console.log('═'.repeat(80));
  console.log(`\nTotal de productos: ${reporte.resumen.totalProductos}`);
  console.log(`Atributos definidos: ${reporte.resumen.totalAtributosDefinidos}`);
  console.log(`Categorías: ${reporte.resumen.totalCategorias}`);
  console.log(`Tags: ${reporte.resumen.totalTags}`);
  console.log(`Brands: ${reporte.resumen.totalBrands}`);
  console.log(`Reviews (muestra): ${reporte.resumen.reviews.total} en ${reporte.resumen.reviews.productosConReviews} productos`);

  console.log('\n\n🏷️  ATRIBUTOS DEFINIDOS:');
  console.log('─'.repeat(80));
  reporte.atributos.definidos.forEach((attr, idx) => {
    console.log(`\n[${idx + 1}] ${attr.name} (${attr.slug})`);
    console.log(`    Tipo: ${attr.type}`);
    console.log(`    Términos definidos: ${attr.totalTerms}`);
    if (attr.usoEnProductos) {
      console.log(`    ✅ Usado en ${attr.usoEnProductos.productos} productos (${attr.usoEnProductos.porcentaje})`);
      if (attr.usoEnProductos.opcionesUsadas.length > 0) {
        console.log(`    Opciones usadas: ${attr.usoEnProductos.opcionesUsadas.slice(0, 5).join(', ')}${attr.usoEnProductos.opcionesUsadas.length > 5 ? '...' : ''}`);
      }
    } else {
      console.log(`    ⚠️  NO usado en ningún producto`);
    }
  });

  console.log('\n\n📂 CATEGORÍAS:');
  console.log('─'.repeat(80));
  reporte.categorias.slice(0, 20).forEach((cat, idx) => {
    console.log(`\n[${idx + 1}] ${cat.name} (${cat.slug})`);
    console.log(`    Productos: ${cat.count}`);
    if (cat.usoEnProductos) {
      console.log(`    ✅ Usado en ${cat.usoEnProductos.productos} productos (${cat.usoEnProductos.porcentaje})`);
    }
    if (cat.parent) {
      console.log(`    Parent: ${cat.parent}`);
    }
  });

  console.log('\n\n🏷️  TAGS:');
  console.log('─'.repeat(80));
  reporte.tags.slice(0, 20).forEach((tag, idx) => {
    console.log(`\n[${idx + 1}] ${tag.name} (${tag.slug})`);
    console.log(`    Productos: ${tag.count}`);
    if (tag.usoEnProductos) {
      console.log(`    ✅ Usado en ${tag.usoEnProductos.productos} productos (${tag.usoEnProductos.porcentaje})`);
    }
  });

  if (reporte.brands.length > 0) {
    console.log('\n\n🏢 BRANDS:');
    console.log('─'.repeat(80));
    reporte.brands.forEach((brand, idx) => {
      console.log(`\n[${idx + 1}] ${brand.name} (${brand.slug})`);
      console.log(`    Productos: ${brand.count}`);
      if (brand.usoEnProductos) {
        console.log(`    ✅ Usado en ${brand.usoEnProductos.productos} productos (${brand.usoEnProductos.porcentaje})`);
      }
    });
  }

  console.log('\n\n🔑 META DATA IMPORTANTE:');
  console.log('─'.repeat(80));
  reporte.metaData.slice(0, 15).forEach((meta, idx) => {
    console.log(`\n[${idx + 1}] ${meta.key}`);
    console.log(`    Productos: ${meta.productos} (${meta.porcentaje})`);
    console.log(`    Valores únicos: ${meta.totalValores}`);
  });

  // Guardar reporte
  const reportPath = join(__dirname, '..', `auditoria-completa-woocommerce-${storeKey}-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(reporte, null, 2), 'utf-8');
  console.log('\n\n✅ Reporte completo guardado en:', reportPath);
  console.log('\n');
}

// Ejecutar
const storeKey = process.argv[2];

if (!storeKey) {
  console.error('❌ Uso: node scripts/auditar-estructura-completa-woocommerce.mjs <tienda>');
  console.error('   Ejemplo: node scripts/auditar-estructura-completa-woocommerce.mjs moraleja');
  console.error('   Ejemplo: node scripts/auditar-estructura-completa-woocommerce.mjs escolar');
  process.exit(1);
}

auditarEstructuraCompleta(storeKey).catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});






