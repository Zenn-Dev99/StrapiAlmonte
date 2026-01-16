#!/usr/bin/env node

/**
 * Script para normalizar los campos website de las editoriales
 * Quita prefijos como https://, http://, www., etc.
 * 
 * Uso:
 *   node scripts/normalizar-websites-editoriales.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '..', 'strapi', '.env');
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

const STRAPI_URL = process.env.STRAPI_LOCAL_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

// Normalizar URL: quitar protocolos y www
function normalizarWebsite(url) {
  if (!url || !url.trim()) {
    return null;
  }

  let normalized = url.trim();

  // Quitar espacios al inicio y final
  normalized = normalized.trim();

  // Quitar protocolos
  normalized = normalized.replace(/^https?:\/\//i, '');
  
  // Quitar www.
  normalized = normalized.replace(/^www\./i, '');
  
  // Quitar barra final
  normalized = normalized.replace(/\/+$/, '');
  
  // Quitar espacios
  normalized = normalized.trim();

  // Si quedó vacío, retornar null
  if (!normalized) {
    return null;
  }

  return normalized;
}

// Obtener todas las editoriales
async function obtenerTodasLasEditoriales() {
  const editoriales = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const params = new URLSearchParams({
        'pagination[page]': String(page),
        'pagination[pageSize]': '100',
      });

      const response = await fetch(`${STRAPI_URL}/api/editoriales?${params.toString()}`, {
        headers: HEADERS,
      });

      if (!response.ok) {
        break;
      }

      const json = await response.json();
      const data = json?.data || [];
      
      if (data.length === 0) {
        hasMore = false;
      } else {
        editoriales.push(...data);
        const meta = json?.meta?.pagination;
        if (meta && page >= meta.pageCount) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (error) {
      console.error(`Error al obtener página ${page}:`, error.message);
      hasMore = false;
    }
  }

  return editoriales;
}

// Actualizar website de una editorial
async function actualizarWebsite(documentId, nuevoWebsite) {
  try {
    const response = await fetch(`${STRAPI_URL}/api/editoriales/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          website: nuevoWebsite,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    return true;
  } catch (error) {
    throw error;
  }
}

async function main() {
  console.log('🔄 Normalizando websites de editoriales');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Obtener todas las editoriales
  console.log('📖 Obteniendo todas las editoriales...');
  const editoriales = await obtenerTodasLasEditoriales();
  console.log(`   ✅ Encontradas ${editoriales.length} editoriales\n`);

  // 2. Procesar cada editorial
  let procesadas = 0;
  let actualizadas = 0;
  let sinCambios = 0;
  let errores = 0;

  console.log('🔄 Normalizando websites...\n');

  for (const editorial of editoriales) {
    procesadas++;
    const nombre = editorial.attributes?.nombre_editorial || editorial.nombre_editorial || 'Sin nombre';
    const websiteActual = editorial.attributes?.website || editorial.website || null;
    const documentId = editorial.documentId || editorial.id;

    // Normalizar website
    const websiteNormalizado = normalizarWebsite(websiteActual);

    // Si no hay cambios, saltar
    if (websiteNormalizado === websiteActual) {
      sinCambios++;
      continue;
    }

    // Si el website normalizado es null y el actual también, saltar
    if (!websiteNormalizado && !websiteActual) {
      sinCambios++;
      continue;
    }

    // Actualizar
    try {
      await actualizarWebsite(documentId, websiteNormalizado);
      actualizadas++;
      
      const cambio = websiteActual 
        ? `"${websiteActual.substring(0, 50)}${websiteActual.length > 50 ? '...' : ''}" → "${websiteNormalizado || '(vacío)'}"`
        : `(vacío) → "${websiteNormalizado}"`;
      
      console.log(`[${procesadas}] ${nombre.substring(0, 40)}... ✅ ${cambio}`);
      
      // Pequeña pausa para no sobrecargar
      if (procesadas % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      errores++;
      console.log(`[${procesadas}] ${nombre.substring(0, 40)}... ❌ Error: ${error.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   📦 Total procesadas: ${procesadas}`);
  console.log(`   ✅ Actualizadas: ${actualizadas}`);
  console.log(`   ⏭️  Sin cambios: ${sinCambios}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

