#!/usr/bin/env node

/**
 * Script para COMPLETAR datos en WooCommerce desde Strapi
 * 
 * Este script sincroniza todos los datos estructurados de Strapi a WooCommerce:
 * - Atributos (Autor, Editorial, Sello, Colección)
 * - Brands (Editorial como brand)
 * - Meta data completa (ISBN, EAN, número edición, año edición, idioma, etc.)
 * - Categorías (si se configuran)
 * - Tags (si se configuran)
 * 
 * Uso:
 *   node scripts/completar-datos-woocommerce-desde-strapi.mjs moraleja
 *   node scripts/completar-datos-woocommerce-desde-strapi.mjs escolar
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
    strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
    strapiToken: process.env.STRAPI_API_TOKEN,
  },
  escolar: {
    name: 'Librería Escolar',
    url: process.env.WOO_ESCOLAR_URL || 'https://staging.escolar.cl',
    consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY,
    consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
    strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
    strapiToken: process.env.STRAPI_API_TOKEN,
  },
};

const PLATFORM_MAP = {
  moraleja: 'woo_moraleja',
  escolar: 'woo_escolar',
};

// Helper para hacer requests autenticados a WooCommerce
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
      const errorText = await response.text();
      throw new Error(`WooCommerce API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Helper para hacer requests a Strapi
async function fetchStrapiAPI(store, endpoint, options = {}) {
  const apiUrl = `${store.strapiUrl}/api/${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (store.strapiToken) {
    headers['Authorization'] = `Bearer ${store.strapiToken}`;
  }

  try {
    const response = await fetch(apiUrl, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Strapi API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Obtener o crear atributo en WooCommerce
async function getOrCreateAttribute(store, attributeName, slug) {
  // Buscar atributo existente
  const attributes = await fetchWooAPI(store, `products/attributes?search=${encodeURIComponent(attributeName)}`);
  let attribute = attributes.find(attr => attr.name === attributeName || attr.slug === slug);

  if (!attribute) {
    // Crear atributo
    attribute = await fetchWooAPI(store, 'products/attributes', {
      method: 'POST',
      body: {
        name: attributeName,
        slug: slug,
        type: 'select',
        has_archives: true,
      },
    });
    console.log(`   ✅ Atributo "${attributeName}" creado (ID: ${attribute.id})`);
  } else {
    console.log(`   ✅ Atributo "${attributeName}" encontrado (ID: ${attribute.id})`);
  }

  return attribute;
}

// Obtener o crear término de atributo
async function getOrCreateAttributeTerm(store, attributeId, termName) {
  // Buscar término existente
  const terms = await fetchWooAPI(store, `products/attributes/${attributeId}/terms?search=${encodeURIComponent(termName)}`);
  let term = terms.find(t => t.name === termName);

  if (!term) {
    // Crear término
    const slug = termName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    term = await fetchWooAPI(store, `products/attributes/${attributeId}/terms`, {
      method: 'POST',
      body: {
        name: termName,
        slug: slug,
      },
    });
    console.log(`      ✅ Término "${termName}" creado (ID: ${term.id})`);
  } else {
    console.log(`      ✅ Término "${termName}" encontrado (ID: ${term.id})`);
  }

  return term;
}

// Obtener o crear brand en WooCommerce
async function getOrCreateBrand(store, brandName) {
  try {
    // Buscar brand existente
    const brands = await fetchWooAPI(store, `products/brands?search=${encodeURIComponent(brandName)}`);
    let brand = brands.find(b => b.name === brandName);

    if (!brand) {
      // Crear brand
      const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      brand = await fetchWooAPI(store, 'products/brands', {
        method: 'POST',
        body: {
          name: brandName,
          slug: slug,
        },
      });
      console.log(`   ✅ Brand "${brandName}" creado (ID: ${brand.id})`);
    } else {
      console.log(`   ✅ Brand "${brandName}" encontrado (ID: ${brand.id})`);
    }

    return brand;
  } catch (error) {
    if (error.message.includes('404')) {
      console.log(`   ⚠️  Plugin de brands no instalado, saltando brands`);
      return null;
    }
    throw error;
  }
}

// Sincronizar un libro completo a WooCommerce
async function syncLibroCompleto(store, libro, platform) {
  const wooId = libro.externalIds?.[platform];
  
  if (!wooId) {
    console.log(`   ⚠️  Libro "${libro.nombre_libro}" no tiene ID de WooCommerce, saltando...`);
    return null;
  }

  console.log(`\n📚 Sincronizando: ${libro.nombre_libro} (WooCommerce ID: ${wooId})`);

  const updateData = {
    meta_data: [],
    attributes: [],
    brands: [],
  };

  // 1. META DATA
  console.log(`   📝 Actualizando meta_data...`);
  if (libro.isbn_libro) {
    updateData.meta_data.push({ key: 'isbn', value: String(libro.isbn_libro) });
  }
  if (libro.ean_libro) {
    updateData.meta_data.push({ key: 'ean', value: String(libro.ean_libro) });
  }
  if (libro.numero_edicion) {
    updateData.meta_data.push({ key: 'numero_edicion', value: String(libro.numero_edicion) });
  }
  if (libro.agno_edicion) {
    updateData.meta_data.push({ key: 'agno_edicion', value: String(libro.agno_edicion) });
  }
  if (libro.idioma) {
    updateData.meta_data.push({ key: 'idioma', value: String(libro.idioma) });
  }
  if (libro.tipo_libro) {
    updateData.meta_data.push({ key: 'tipo_libro', value: String(libro.tipo_libro) });
  }

  // 2. ATRIBUTOS
  console.log(`   🏷️  Actualizando atributos...`);

  // Autor
  if (libro.autor_relacion) {
    const autorAttr = await getOrCreateAttribute(store, 'Autor', 'autor');
    const autorTerm = await getOrCreateAttributeTerm(store, autorAttr.id, libro.autor_relacion.nombre_completo_autor);
    updateData.attributes.push({
      id: autorAttr.id,
      name: 'Autor',
      options: [libro.autor_relacion.nombre_completo_autor],
      visible: true,
      variation: false,
    });
  }

  // Editorial
  if (libro.editorial) {
    const editorialAttr = await getOrCreateAttribute(store, 'Editorial', 'editorial');
    const editorialTerm = await getOrCreateAttributeTerm(store, editorialAttr.id, libro.editorial.nombre_editorial);
    updateData.attributes.push({
      id: editorialAttr.id,
      name: 'Editorial',
      options: [libro.editorial.nombre_editorial],
      visible: true,
      variation: false,
    });

    // También como brand
    if (libro.editorial.nombre_editorial) {
      const brand = await getOrCreateBrand(store, libro.editorial.nombre_editorial);
      if (brand) {
        updateData.brands.push({ id: brand.id });
      }
    }
  }

  // Sello
  if (libro.sello) {
    const selloAttr = await getOrCreateAttribute(store, 'Sello', 'sello');
    const selloTerm = await getOrCreateAttributeTerm(store, selloAttr.id, libro.sello.nombre_sello);
    updateData.attributes.push({
      id: selloAttr.id,
      name: 'Sello',
      options: [libro.sello.nombre_sello],
      visible: true,
      variation: false,
    });
  }

  // Colección
  if (libro.coleccion) {
    const coleccionAttr = await getOrCreateAttribute(store, 'Colección', 'coleccion');
    const coleccionTerm = await getOrCreateAttributeTerm(store, coleccionAttr.id, libro.coleccion.nombre_coleccion);
    updateData.attributes.push({
      id: coleccionAttr.id,
      name: 'Colección',
      options: [libro.coleccion.nombre_coleccion],
      visible: true,
      variation: false,
    });
  }

  // 3. ACTUALIZAR PRODUCTO EN WOOCOMMERCE
  try {
    const updatedProduct = await fetchWooAPI(store, `products/${wooId}`, {
      method: 'PUT',
      body: updateData,
    });

    console.log(`   ✅ Producto actualizado en WooCommerce`);
    return updatedProduct;
  } catch (error) {
    console.error(`   ❌ Error actualizando producto:`, error.message);
    return null;
  }
}

// Función principal
async function completarDatos(storeKey) {
  const store = STORES[storeKey];
  const platform = PLATFORM_MAP[storeKey];
  
  if (!store) {
    console.error(`❌ Tienda "${storeKey}" no encontrada`);
    process.exit(1);
  }

  if (!store.consumerKey || !store.consumerSecret) {
    console.error(`❌ Faltan credenciales de WooCommerce para ${store.name}`);
    process.exit(1);
  }

  if (!store.strapiUrl) {
    console.error(`❌ Falta STRAPI_URL en variables de entorno`);
    process.exit(1);
  }

  console.log(`\n🚀 Completando datos en WooCommerce desde Strapi`);
  console.log(`   Tienda: ${store.name}`);
  console.log(`   Platform: ${platform}\n`);

  // Obtener todos los libros de Strapi que tienen este canal
  console.log(`📡 Obteniendo libros de Strapi...`);
  
  let libros = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchStrapiAPI(store, `libros?pagination[page]=${page}&pagination[pageSize]=100&populate=deep,3`);
      const data = response.data || [];
      libros.push(...data);
      
      hasMore = data.length === 100;
      page++;
    } catch (error) {
      console.error(`❌ Error obteniendo libros:`, error.message);
      // Intentar sin populate deep
      try {
        const response = await fetchStrapiAPI(store, `libros?pagination[page]=${page}&pagination[pageSize]=100&populate=*`);
        const data = response.data || [];
        libros.push(...data);
        hasMore = data.length === 100;
        page++;
      } catch (err2) {
        console.error(`❌ Error:`, err2.message);
        hasMore = false;
      }
    }
  }

  console.log(`✅ ${libros.length} libros obtenidos\n`);

  // Filtrar solo los que tienen externalIds para esta plataforma
  const librosConWooId = libros.filter(libro => {
    const extIds = libro.externalIds || {};
    return extIds[platform];
  });

  console.log(`📊 Libros con ID de WooCommerce (${platform}): ${librosConWooId.length}\n`);

  // Sincronizar cada libro
  let successCount = 0;
  let errorCount = 0;

  for (const libro of librosConWooId) {
    try {
      const result = await syncLibroCompleto(store, libro, platform);
      if (result) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Error sincronizando libro ${libro.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n\n✅ Sincronización completada:`);
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  console.log(`   📊 Total: ${librosConWooId.length}\n`);
}

// Ejecutar
const storeKey = process.argv[2];

if (!storeKey) {
  console.error('❌ Uso: node scripts/completar-datos-woocommerce-desde-strapi.mjs <tienda>');
  console.error('   Ejemplo: node scripts/completar-datos-woocommerce-desde-strapi.mjs moraleja');
  console.error('   Ejemplo: node scripts/completar-datos-woocommerce-desde-strapi.mjs escolar');
  process.exit(1);
}

completarDatos(storeKey).catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});






