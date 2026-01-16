#!/usr/bin/env node

/**
 * Script de prueba COMPLETA y DETALLADA para AUTOR solamente
 * 
 * Este script prueba cada operación paso a paso para identificar problemas exactos
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

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || '';

const WOO_CONFIGS = {
  woo_moraleja: {
    url: process.env.WOO_MORALEJA_URL || '',
    consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET || '',
  },
  woo_escolar: {
    url: process.env.WOO_ESCOLAR_URL || '',
    consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET || '',
  },
};

const STRAPI_HEADERS = {
  'Content-Type': 'application/json',
  ...(STRAPI_TOKEN && { Authorization: `Bearer ${STRAPI_TOKEN}` }),
};

function getWooAuth(config) {
  return Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
}

/**
 * Obtener o crear atributo Autor en WooCommerce
 */
async function getOrCreateAttribute(config) {
  const auth = getWooAuth(config);
  
  // Buscar atributo existente
  const searchResponse = await fetch(
    `${config.url}/wp-json/wc/v3/products/attributes?search=Autor`,
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (searchResponse.ok) {
    const attributes = await searchResponse.json();
    const existing = Array.isArray(attributes) 
      ? attributes.find((attr) => attr.name === 'Autor' || attr.slug === 'autor')
      : null;
    
    if (existing) {
      return existing;
    }
  }

  // Crear nuevo atributo
  const createResponse = await fetch(`${config.url}/wp-json/wc/v3/products/attributes`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Autor',
      slug: 'autor',
      type: 'select',
      order_by: 'name',
      has_archives: false,
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Error creando atributo: HTTP ${createResponse.status} ${errorText}`);
  }

  return await createResponse.json();
}

/**
 * Buscar término por slug exacto
 */
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

  // Filtrar por coincidencia exacta de slug
  return terms.filter(term => term.slug === slug);
}

/**
 * Buscar término por nombre (para verificar duplicados)
 */
async function getTermsByName(config, attributeId, name) {
  const auth = getWooAuth(config);
  const url = `${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms?search=${encodeURIComponent(name)}`;
  
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

  // Filtrar por coincidencia exacta de nombre
  const normalizedName = name.toLowerCase().trim();
  return terms.filter(term => term.name.toLowerCase().trim() === normalizedName);
}

/**
 * Obtener TODOS los términos del atributo (para debugging)
 */
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

/**
 * Crear autor en Strapi
 */
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

/**
 * Actualizar autor en Strapi
 */
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

/**
 * Obtener autor completo desde Strapi (incluye externalIds)
 */
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

/**
 * Eliminar autor en Strapi
 */
async function deleteAutor(documentId) {
  const response = await fetch(`${STRAPI_URL}/api/autores/${documentId}`, {
    method: 'DELETE',
    headers: STRAPI_HEADERS,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return true;
}

/**
 * Esperar con mensaje
 */
function wait(seconds, message = '') {
  return new Promise(resolve => {
    if (message) console.log(`   ⏳ ${message} (${seconds} segundos)...`);
    setTimeout(resolve, seconds * 1000);
  });
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const platformArg = args.find(arg => arg.startsWith('--platform='));
  const platform = platformArg ? platformArg.split('=')[1] : 'woo_moraleja';

  if (platform !== 'woo_moraleja' && platform !== 'woo_escolar') {
    console.error('❌ Plataforma inválida. Use: woo_moraleja o woo_escolar');
    process.exit(1);
  }

  const config = WOO_CONFIGS[platform];
  
  if (!config.url || !config.consumerKey || !config.consumerSecret) {
    console.error(`❌ Configuración incompleta para ${platform}`);
    process.exit(1);
  }

  console.log('🧪 PRUEBA COMPLETA Y DETALLADA: AUTOR');
  console.log('='.repeat(70));
  console.log(`Strapi URL: ${STRAPI_URL}`);
  console.log(`Plataforma: ${platform}`);
  console.log(`WooCommerce URL: ${config.url}`);
  console.log('='.repeat(70));
  console.log('');

  try {
    // Obtener o crear atributo
    console.log('📋 Paso 0: Obtener/Crear atributo "Autor" en WooCommerce');
    console.log('-'.repeat(70));
    const attribute = await getOrCreateAttribute(config);
    console.log(`✅ Atributo "Autor" (ID: ${attribute.id})`);
    console.log('');

    const timestamp = Date.now();
    const testName = `TEST_AUTOR_${timestamp}`;
    const testNameUpdated = `${testName}_UPDATED`;

    // ==========================================
    // PRUEBA 1: CREAR
    // ==========================================
    console.log('1️⃣  PRUEBA: CREAR AUTOR');
    console.log('='.repeat(70));
    console.log(`Nombre: "${testName}"`);
    console.log('');

    let autor = null;
    let autorDocumentId = null;

    try {
      // Crear en Strapi
      console.log('   📝 Creando autor en Strapi...');
      autor = await createAutor(testName);
      autorDocumentId = autor.documentId || autor.id;
      console.log(`   ✅ Autor creado en Strapi`);
      console.log(`      - documentId: ${autorDocumentId}`);
      console.log(`      - id: ${autor.id || 'N/A'}`);
      console.log('');

      // Esperar sincronización
      await wait(5, 'Esperando sincronización a WooCommerce');

      // Verificar en WooCommerce
      console.log('   🔍 Verificando en WooCommerce...');
      const termsBySlug = await getTermBySlug(config, attribute.id, autorDocumentId);
      const termsByName = await getTermsByName(config, attribute.id, testName);

      console.log(`      - Términos encontrados por slug "${autorDocumentId}": ${termsBySlug.length}`);
      console.log(`      - Términos encontrados por nombre "${testName}": ${termsByName.length}`);

      if (termsBySlug.length === 1) {
        const term = termsBySlug[0];
        console.log(`   ✅ Término sincronizado correctamente`);
        console.log(`      - Woo ID: ${term.id}`);
        console.log(`      - Nombre: "${term.name}"`);
        console.log(`      - Slug: "${term.slug}"`);
        console.log('');
      } else if (termsBySlug.length === 0) {
        console.log(`   ⚠️  Término NO encontrado por slug`);
        if (termsByName.length > 0) {
          console.log(`   ℹ️  Pero se encontraron ${termsByName.length} término(s) por nombre:`);
          termsByName.forEach(t => {
            console.log(`      - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
          });
        }
        console.log('');
      } else {
        console.log(`   ❌ MÚLTIPLES TÉRMINOS encontrados por slug (${termsBySlug.length}):`);
        termsBySlug.forEach(t => {
          console.log(`      - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
        });
        console.log('');
      }

      // Obtener autor completo para ver externalIds
      console.log('   📋 Obteniendo autor completo desde Strapi...');
      const autorCompleto = await getAutor(autorDocumentId);
      console.log(`      - externalIds: ${JSON.stringify(autorCompleto.externalIds || {})}`);
      console.log('');

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      console.log('');
      return;
    }

    // ==========================================
    // PRUEBA 2: ACTUALIZAR
    // ==========================================
    console.log('2️⃣  PRUEBA: ACTUALIZAR AUTOR');
    console.log('='.repeat(70));
    console.log(`Cambiando nombre: "${testName}" → "${testNameUpdated}"`);
    console.log('');

    try {
      // Verificar estado ANTES de actualizar
      console.log('   📊 Estado ANTES de actualizar:');
      const termsBefore = await getTermBySlug(config, attribute.id, autorDocumentId);
      console.log(`      - Términos por slug: ${termsBefore.length}`);
      termsBefore.forEach(t => {
        console.log(`        * ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
      });
      console.log('');

      // Actualizar en Strapi
      console.log('   📝 Actualizando autor en Strapi...');
      autor = await updateAutor(autorDocumentId, testNameUpdated);
      console.log(`   ✅ Autor actualizado en Strapi`);
      console.log(`      - Nombre actualizado: "${autor.nombre_completo_autor || autor.attributes?.nombre_completo_autor}"`);
      console.log('');

      // Esperar sincronización
      await wait(5, 'Esperando sincronización a WooCommerce');

      // Verificar en WooCommerce
      console.log('   🔍 Verificando en WooCommerce DESPUÉS de actualizar:');
      const termsAfter = await getTermBySlug(config, attribute.id, autorDocumentId);
      const termsByNameUpdated = await getTermsByName(config, attribute.id, testNameUpdated);
      const termsByNameOld = await getTermsByName(config, attribute.id, testName);

      console.log(`      - Términos por slug "${autorDocumentId}": ${termsAfter.length}`);
      termsAfter.forEach(t => {
        console.log(`        * ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
      });
      console.log(`      - Términos por nombre "${testNameUpdated}": ${termsByNameUpdated.length}`);
      console.log(`      - Términos por nombre "${testName}": ${termsByNameOld.length}`);

      if (termsAfter.length === 1) {
        const term = termsAfter[0];
        const isCorrectlyUpdated = term.name === testNameUpdated || term.name.toLowerCase().trim() === testNameUpdated.toLowerCase().trim();
        
        if (isCorrectlyUpdated && termsByNameOld.length === 0) {
          console.log(`   ✅ Actualización correcta: término actualizado sin duplicados`);
          console.log(`      - Woo ID: ${term.id}`);
          console.log(`      - Nombre actualizado: "${term.name}"`);
          console.log('');
        } else {
          console.log(`   ⚠️  Término encontrado pero puede haber problema:`);
          console.log(`      - Nombre actual: "${term.name}", Esperado: "${testNameUpdated}"`);
          if (termsByNameOld.length > 0) {
            console.log(`      - ⚠️  Términos con nombre antiguo aún existen: ${termsByNameOld.length}`);
          }
          console.log('');
        }
      } else if (termsAfter.length === 0) {
        console.log(`   ❌ Término NO encontrado por slug después de actualizar`);
        console.log('');
      } else {
        console.log(`   ❌ MÚLTIPLES TÉRMINOS encontrados por slug (${termsAfter.length}):`);
        termsAfter.forEach(t => {
          console.log(`      - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
        });
        console.log('');
      }

      // Obtener autor completo actualizado
      console.log('   📋 Obteniendo autor completo actualizado desde Strapi...');
      const autorCompletoUpdated = await getAutor(autorDocumentId);
      console.log(`      - externalIds: ${JSON.stringify(autorCompletoUpdated.externalIds || {})}`);
      console.log('');

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      console.log('');
    }

    // ==========================================
    // PRUEBA 3: ELIMINAR
    // ==========================================
    console.log('3️⃣  PRUEBA: ELIMINAR AUTOR');
    console.log('='.repeat(70));
    console.log(`Eliminando autor: "${testNameUpdated}"`);
    console.log('');

    try {
      // Verificar estado ANTES de eliminar
      console.log('   📊 Estado ANTES de eliminar:');
      const termsBeforeDelete = await getTermBySlug(config, attribute.id, autorDocumentId);
      console.log(`      - Términos por slug: ${termsBeforeDelete.length}`);
      termsBeforeDelete.forEach(t => {
        console.log(`        * ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
      });
      console.log('');

      // Obtener autor completo antes de eliminar (para ver externalIds)
      const autorBeforeDelete = await getAutor(autorDocumentId);
      console.log(`   📋 externalIds antes de eliminar: ${JSON.stringify(autorBeforeDelete.externalIds || {})}`);
      console.log('');

      // Eliminar en Strapi
      console.log('   🗑️  Eliminando autor en Strapi...');
      await deleteAutor(autorDocumentId);
      console.log(`   ✅ Autor eliminado en Strapi`);
      console.log('');

      // Esperar sincronización
      await wait(5, 'Esperando sincronización a WooCommerce');

      // Verificar en WooCommerce
      console.log('   🔍 Verificando en WooCommerce DESPUÉS de eliminar:');
      const termsAfterDelete = await getTermBySlug(config, attribute.id, autorDocumentId);
      const termsByNameAfterDelete = await getTermsByName(config, attribute.id, testNameUpdated);
      const termsByNameOldAfterDelete = await getTermsByName(config, attribute.id, testName);

      console.log(`      - Términos por slug "${autorDocumentId}": ${termsAfterDelete.length}`);
      console.log(`      - Términos por nombre "${testNameUpdated}": ${termsByNameAfterDelete.length}`);
      console.log(`      - Términos por nombre "${testName}": ${termsByNameOldAfterDelete.length}`);

      const totalFound = new Set([
        ...termsAfterDelete,
        ...termsByNameAfterDelete,
        ...termsByNameOldAfterDelete,
      ].map(t => t.id)).size;

      if (totalFound === 0) {
        console.log(`   ✅ Término eliminado correctamente de WooCommerce`);
        console.log('');
      } else {
        console.log(`   ❌ Término NO eliminado: ${totalFound} término(s) encontrado(s)`);
        if (termsAfterDelete.length > 0) {
          console.log(`      Términos por slug:`);
          termsAfterDelete.forEach(t => {
            console.log(`        - ID: ${t.id}, Nombre: "${t.name}", Slug: "${t.slug}"`);
          });
        }
        console.log('');
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      console.log('');
    }

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(70));
    console.log(`Atributo ID: ${attribute.id}`);
    console.log(`Autor de prueba: "${testName}" / "${testNameUpdated}"`);
    console.log(`documentId: ${autorDocumentId}`);
    console.log('');
    console.log('✅ Pruebas completadas. Revisa los resultados arriba.');
    console.log('');

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
