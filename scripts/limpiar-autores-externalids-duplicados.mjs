#!/usr/bin/env node

/**
 * Script para limpiar autores con externalIds duplicados
 * Identifica autores que comparten los mismos externalIds y los limpia
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

if (!STRAPI_TOKEN) {
  console.error('❌ Error: STRAPI_API_TOKEN no está configurado');
  process.exit(1);
}

const STRAPI_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

async function fetchStrapiAPI(endpoint, options = {}) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: STRAPI_HEADERS,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function getAllAutores() {
  console.log('📋 Obteniendo todos los autores...');
  const autores = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const response = await fetchStrapiAPI(
      `/autores?pagination[page]=${page}&pagination[pageSize]=${pageSize}&sort=id:asc`
    );

    if (!response.data || response.data.length === 0) {
      break;
    }

    autores.push(...response.data);
    console.log(`   ✅ Página ${page}: ${response.data.length} autores`);

    if (response.data.length < pageSize) {
      break;
    }
    page++;
  }

  console.log(`\n📊 Total de autores obtenidos: ${autores.length}\n`);
  return autores;
}

function encontrarDuplicados(autores) {
  console.log('🔍 Analizando externalIds duplicados...\n');

  const externalIdsMap = new Map(); // externalId -> array de autores que lo usan
  const documentIdMap = new Map(); // documentId -> array de autores

  for (const autor of autores) {
    const externalIds = autor.externalIds || {};
    const documentId = autor.documentId;

    // Agrupar por documentId
    if (documentId) {
      if (!documentIdMap.has(documentId)) {
        documentIdMap.set(documentId, []);
      }
      documentIdMap.get(documentId).push(autor);
    }

    // Agrupar por externalIds
    for (const [platform, wooId] of Object.entries(externalIds)) {
      if (wooId) {
        const key = `${platform}:${wooId}`;
        if (!externalIdsMap.has(key)) {
          externalIdsMap.set(key, []);
        }
        externalIdsMap.get(key).push({ autor, platform, wooId });
      }
    }
  }

  // Encontrar externalIds compartidos (más de un autor)
  const externalIdsDuplicados = [];
  for (const [key, lista] of externalIdsMap.entries()) {
    if (lista.length > 1) {
      externalIdsDuplicados.push({ key, lista });
    }
  }

  // Encontrar documentIds duplicados (draft/publish)
  const documentIdsDuplicados = [];
  for (const [documentId, lista] of documentIdMap.entries()) {
    if (lista.length > 1) {
      documentIdsDuplicados.push({ documentId, lista });
    }
  }

  return { externalIdsDuplicados, documentIdsDuplicados };
}

function mostrarDuplicados(externalIdsDuplicados, documentIdsDuplicados) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 ANÁLISIS DE DUPLICADOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (externalIdsDuplicados.length > 0) {
    console.log(`⚠️  EXTERNAL IDs DUPLICADOS (${externalIdsDuplicados.length} casos):\n`);
    for (const { key, lista } of externalIdsDuplicados) {
      const [platform, wooId] = key.split(':');
      console.log(`   🔴 ${platform} - Woo ID: ${wooId}`);
      for (const { autor } of lista) {
        console.log(`      - Autor ID: ${autor.id}, DocumentID: ${autor.documentId}, Nombre: "${autor.nombre_completo_autor || 'sin nombre'}"`);
      }
      console.log('');
    }
  } else {
    console.log('✅ No hay externalIds duplicados\n');
  }

  if (documentIdsDuplicados.length > 0) {
    console.log(`⚠️  DOCUMENT IDs DUPLICADOS (${documentIdsDuplicados.length} casos - draft/publish):\n`);
    for (const { documentId, lista } of documentIdsDuplicados) {
      console.log(`   🔴 DocumentID: ${documentId}`);
      for (const autor of lista) {
        console.log(`      - Autor ID: ${autor.id}, Nombre: "${autor.nombre_completo_autor || 'sin nombre'}", Published: ${autor.publishedAt ? 'Sí' : 'No'}`);
      }
      console.log('');
    }
  } else {
    console.log('✅ No hay documentIds duplicados\n');
  }

  return externalIdsDuplicados.length > 0 || documentIdsDuplicados.length > 0;
}

async function limpiarDuplicados(externalIdsDuplicados, documentIdsDuplicados) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧹 LIMPIEZA DE DUPLICADOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let eliminados = 0;

  // Limpiar documentIds duplicados (mantener solo el publicado, si existe)
  for (const { documentId, lista } of documentIdsDuplicados) {
    if (lista.length <= 1) continue;

    // Ordenar: primero los publicados, luego por ID (mayor = más reciente)
    lista.sort((a, b) => {
      if (a.publishedAt && !b.publishedAt) return -1;
      if (!a.publishedAt && b.publishedAt) return 1;
      return b.id - a.id; // Mayor ID primero (más reciente)
    });

    const mantener = lista[0];
    const eliminar = lista.slice(1);

    console.log(`📝 DocumentID: ${documentId}`);
    console.log(`   ✅ Mantener: Autor ID ${mantener.id} - "${mantener.nombre_completo_autor || 'sin nombre'}" (Published: ${mantener.publishedAt ? 'Sí' : 'No'})`);

    for (const autor of eliminar) {
      console.log(`   🗑️  Eliminar: Autor ID ${autor.id} - "${autor.nombre_completo_autor || 'sin nombre'}"`);
      
      try {
        await fetch(`${STRAPI_URL}/api/autores/${autor.documentId}?locale=*`, {
          method: 'DELETE',
          headers: STRAPI_HEADERS,
        });
        eliminados++;
        console.log(`      ✅ Eliminado`);
      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
      }
    }
    console.log('');
  }

  // Limpiar externalIds duplicados (mantener solo el más reciente)
  const procesados = new Set();
  for (const { key, lista } of externalIdsDuplicados) {
    // Evitar procesar el mismo externalId múltiples veces
    if (procesados.has(key)) continue;
    procesados.add(key);

    if (lista.length <= 1) continue;

    // Ordenar por ID (mayor = más reciente)
    lista.sort((a, b) => b.autor.id - a.autor.id);

    const mantener = lista[0].autor;
    const eliminar = lista.slice(1).map(item => item.autor);

    // Verificar que no sean el mismo autor
    const realmenteEliminar = eliminar.filter(a => a.id !== mantener.id);

    if (realmenteEliminar.length === 0) continue;

    const [platform, wooId] = key.split(':');
    console.log(`📝 ${platform} - Woo ID: ${wooId}`);
    console.log(`   ✅ Mantener: Autor ID ${mantener.id} - "${mantener.nombre_completo_autor || 'sin nombre'}"`);

    for (const autor of realmenteEliminar) {
      // Limpiar solo el externalId específico, no eliminar el autor completo
      console.log(`   🧹 Limpiar externalId ${platform} del Autor ID ${autor.id} - "${autor.nombre_completo_autor || 'sin nombre'}"`);
      
      try {
        const externalIdsActuales = autor.externalIds || {};
        const externalIdsLimpios = { ...externalIdsActuales };
        delete externalIdsLimpios[platform];

        await fetch(`${STRAPI_URL}/api/autores/${autor.documentId}`, {
          method: 'PUT',
          headers: STRAPI_HEADERS,
          body: JSON.stringify({
            data: {
              externalIds: externalIdsLimpios,
            },
          }),
        });
        console.log(`      ✅ ExternalId ${platform} eliminado del autor ${autor.id}`);
      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log(`\n✅ Limpieza completada. Total eliminados/limpiados: ${eliminados}`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧹 LIMPIEZA DE AUTORES CON EXTERNALIDS DUPLICADOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // 1. Obtener todos los autores
    const autores = await getAllAutores();

    // 2. Encontrar duplicados
    const { externalIdsDuplicados, documentIdsDuplicados } = encontrarDuplicados(autores);

    // 3. Mostrar duplicados
    const hayDuplicados = mostrarDuplicados(externalIdsDuplicados, documentIdsDuplicados);

    if (!hayDuplicados) {
      console.log('✅ No hay duplicados para limpiar. Todo está correcto.\n');
      return;
    }

    // 4. Preguntar si limpiar
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('⚠️  ATENCIÓN: Este script va a:');
    console.log('   1. Eliminar autores duplicados con mismo documentId (mantiene el publicado)');
    console.log('   2. Limpiar externalIds duplicados (mantiene el más reciente)');
    console.log('\n¿Deseas continuar? (escribe "SI" para confirmar)');
    
    // Para scripts, usar variable de entorno
    const confirmar = process.env.CONFIRMAR_LIMPIEZA === 'true';
    
    if (!confirmar) {
      console.log('\n❌ Limpieza cancelada. Para ejecutar, establece CONFIRMAR_LIMPIEZA=true');
      console.log('   Ejemplo: CONFIRMAR_LIMPIEZA=true node scripts/limpiar-autores-externalids-duplicados.mjs\n');
      return;
    }

    // 5. Limpiar duplicados
    await limpiarDuplicados(externalIdsDuplicados, documentIdsDuplicados);

    console.log('\n✅ Proceso completado.\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
