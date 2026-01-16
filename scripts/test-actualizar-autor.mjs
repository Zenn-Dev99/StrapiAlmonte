#!/usr/bin/env node

/**
 * Script específico para testear SOLO la actualización de autores
 * Verifica directamente en WooCommerce qué pasa cuando se actualiza
 */

import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || '';

const WOO_CONFIG = {
  url: process.env.WOO_MORALEJA_URL || 'https://staging.moraleja.cl',
  consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY || '',
  consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET || '',
};

const STRAPI_HEADERS = {
  'Content-Type': 'application/json',
  ...(STRAPI_TOKEN && { Authorization: `Bearer ${STRAPI_TOKEN}` }),
};

function getWooAuth(config) {
  return Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
}

async function getTermById(config, attributeId, termId) {
  const auth = getWooAuth(config);
  try {
    const url = `${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms/${termId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return null; // No existe
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

async function getTermBySlug(config, attributeId, slug) {
  const auth = getWooAuth(config);
  const url = `${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms?slug=${encodeURIComponent(slug)}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return [];
  }

  const terms = await response.json();
  if (!Array.isArray(terms)) {
    return [];
  }

  return terms.filter(term => term.slug === slug);
}

async function getAllTerms(config, attributeId) {
  const auth = getWooAuth(config);
  const allTerms = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      break;
    }

    const terms = await response.json();
    if (!Array.isArray(terms) || terms.length === 0) {
      break;
    }

    allTerms.push(...terms);

    if (terms.length < perPage) {
      break;
    }
    page++;
  }

  return allTerms;
}

async function createAutor(nombre) {
  const response = await fetch(`${STRAPI_URL}/api/autores`, {
    method: 'POST',
    headers: STRAPI_HEADERS,
    body: JSON.stringify({
      data: {
        nombre_completo_autor: nombre,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result.data;
}

async function updateAutor(documentId, nombre) {
  const response = await fetch(`${STRAPI_URL}/api/autores/${documentId}`, {
    method: 'PUT',
    headers: STRAPI_HEADERS,
    body: JSON.stringify({
      data: {
        nombre_completo_autor: nombre,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result.data;
}

async function getAutor(documentId) {
  const response = await fetch(`${STRAPI_URL}/api/autores/${documentId}`, {
    method: 'GET',
    headers: STRAPI_HEADERS,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result.data;
}

async function wait(seconds, message = '') {
  if (message) console.log(`   ⏳ ${message} (${seconds} segundos)...`);
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function main() {
  console.log('🔍 TEST ESPECÍFICO: ACTUALIZACIÓN DE AUTOR');
  console.log('='.repeat(70));
  console.log(`Strapi URL: ${STRAPI_URL}`);
  console.log(`WooCommerce URL: ${WOO_CONFIG.url}`);
  console.log('='.repeat(70));
  console.log('');

  const ATTRIBUTE_ID = 8; // ID del atributo Autor
  const timestamp = Date.now();
  const testName = `TEST_UPDATE_${timestamp}`;
  const testNameUpdated = `${testName}_UPDATED`;

  try {
    // Paso 1: Crear autor
    console.log('1️⃣  CREANDO AUTOR');
    console.log('-'.repeat(70));
    console.log(`   Nombre: "${testName}"`);
    
    const autor = await createAutor(testName);
    const documentId = autor.documentId || autor.id;
    console.log(`   ✅ Autor creado`);
    console.log(`      - documentId: ${documentId}`);
    console.log(`      - id: ${autor.id || 'N/A'}`);
    console.log('');

    // Esperar sincronización
    await wait(5, 'Esperando sincronización inicial');

    // Obtener autor con externalIds
    const autorCompleto = await getAutor(documentId);
    const wooId = autorCompleto.externalIds?.woo_moraleja;
    console.log(`   📋 externalIds: ${JSON.stringify(autorCompleto.externalIds || {})}`);
    console.log(`   📋 Woo ID (moraleja): ${wooId || 'NO ENCONTRADO'}`);
    console.log('');

    if (!wooId) {
      console.log('❌ No se encontró Woo ID después de crear, no podemos continuar');
      return;
    }

    // Paso 2: Verificar término ANTES de actualizar
    console.log('2️⃣  VERIFICANDO TÉRMINO ANTES DE ACTUALIZAR');
    console.log('-'.repeat(70));
    
    const termBefore = await getTermById(WOO_CONFIG, ATTRIBUTE_ID, wooId);
    if (termBefore) {
      console.log(`   ✅ Término existe por ID ${wooId}:`);
      console.log(`      - ID: ${termBefore.id}`);
      console.log(`      - Nombre: "${termBefore.name}"`);
      console.log(`      - Slug: "${termBefore.slug}"`);
      console.log(`      - Descripción: "${termBefore.description || 'N/A'}"`);
    } else {
      console.log(`   ❌ Término NO existe por ID ${wooId}`);
    }

    const termsBySlugBefore = await getTermBySlug(WOO_CONFIG, ATTRIBUTE_ID, documentId);
    console.log(`   📋 Términos por slug "${documentId}": ${termsBySlugBefore.length}`);
    if (termsBySlugBefore.length > 0) {
      termsBySlugBefore.forEach(t => {
        console.log(`      - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
      });
    }
    console.log('');

    // Paso 3: ACTUALIZAR
    console.log('3️⃣  ACTUALIZANDO AUTOR');
    console.log('-'.repeat(70));
    console.log(`   Cambiando nombre: "${testName}" → "${testNameUpdated}"`);
    
    await updateAutor(documentId, testNameUpdated);
    console.log(`   ✅ Autor actualizado en Strapi`);
    console.log('');

    // Esperar sincronización
    await wait(5, 'Esperando sincronización después de actualizar');

    // Paso 4: Verificar término DESPUÉS de actualizar
    console.log('4️⃣  VERIFICANDO TÉRMINO DESPUÉS DE ACTUALIZAR');
    console.log('-'.repeat(70));
    
    // Verificar por ID (más directo)
    console.log(`   🔍 Verificando por ID ${wooId}...`);
    const termAfterById = await getTermById(WOO_CONFIG, ATTRIBUTE_ID, wooId);
    if (termAfterById) {
      console.log(`   ✅ Término EXISTE por ID:`);
      console.log(`      - ID: ${termAfterById.id}`);
      console.log(`      - Nombre: "${termAfterById.name}"`);
      console.log(`      - Slug: "${termAfterById.slug}"`);
      console.log(`      - Descripción: "${termAfterById.description || 'N/A'}"`);
      
      // Verificar si se actualizó correctamente
      if (termAfterById.name === testNameUpdated) {
        console.log(`   ✅ Nombre actualizado correctamente`);
      } else {
        console.log(`   ⚠️  Nombre NO coincide: esperado "${testNameUpdated}", actual "${termAfterById.name}"`);
      }
      
      if (termAfterById.slug === documentId) {
        console.log(`   ✅ Slug se mantiene correcto (documentId)`);
      } else {
        console.log(`   ⚠️  Slug cambió: esperado "${documentId}", actual "${termAfterById.slug}"`);
      }
    } else {
      console.log(`   ❌ Término NO EXISTE por ID ${wooId}`);
      console.log(`   ⚠️  El término fue ELIMINADO o el ID cambió`);
    }
    console.log('');

    // Verificar por slug
    console.log(`   🔍 Verificando por slug "${documentId}"...`);
    const termsBySlugAfter = await getTermBySlug(WOO_CONFIG, ATTRIBUTE_ID, documentId);
    console.log(`   📋 Términos por slug: ${termsBySlugAfter.length}`);
    if (termsBySlugAfter.length > 0) {
      termsBySlugAfter.forEach(t => {
        console.log(`      - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
      });
    } else {
      console.log(`   ❌ No se encontraron términos por slug`);
    }
    console.log('');

    // Verificar por nombre (antiguo y nuevo)
    console.log(`   🔍 Verificando por nombres...`);
    const allTerms = await getAllTerms(WOO_CONFIG, ATTRIBUTE_ID);
    const termsWithOldName = allTerms.filter(t => 
      t.name.toLowerCase().trim() === testName.toLowerCase().trim()
    );
    const termsWithNewName = allTerms.filter(t => 
      t.name.toLowerCase().trim() === testNameUpdated.toLowerCase().trim()
    );
    
    console.log(`   📋 Términos con nombre antiguo "${testName}": ${termsWithOldName.length}`);
    termsWithOldName.forEach(t => {
      console.log(`      - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
    });
    
    console.log(`   📋 Términos con nombre nuevo "${testNameUpdated}": ${termsWithNewName.length}`);
    termsWithNewName.forEach(t => {
      console.log(`      - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
    });
    console.log('');

    // Paso 5: Verificar externalIds en Strapi
    console.log('5️⃣  VERIFICANDO EXTERNALIDS EN STRAPI');
    console.log('-'.repeat(70));
    const autorActualizado = await getAutor(documentId);
    console.log(`   📋 externalIds: ${JSON.stringify(autorActualizado.externalIds || {})}`);
    console.log(`   📋 Woo ID (moraleja): ${autorActualizado.externalIds?.woo_moraleja || 'NO ENCONTRADO'}`);
    console.log('');

    // Resumen
    console.log('📊 RESUMEN');
    console.log('='.repeat(70));
    console.log(`documentId: ${documentId}`);
    console.log(`Woo ID original: ${wooId}`);
    console.log(`Término existe por ID después de actualizar: ${termAfterById ? 'SÍ' : 'NO'}`);
    if (termAfterById) {
      console.log(`Nombre actualizado: ${termAfterById.name === testNameUpdated ? 'SÍ ✅' : 'NO ❌'}`);
      console.log(`Slug se mantiene: ${termAfterById.slug === documentId ? 'SÍ ✅' : 'NO ❌'}`);
    }
    console.log(`Términos por slug: ${termsBySlugAfter.length}`);
    console.log(`Términos con nombre nuevo: ${termsWithNewName.length}`);
    console.log(`Términos con nombre antiguo: ${termsWithOldName.length}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
