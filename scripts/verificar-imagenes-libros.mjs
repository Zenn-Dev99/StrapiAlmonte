#!/usr/bin/env node

/**
 * Script para verificar el estado de las imágenes de los libros
 * 
 * Uso:
 *   node scripts/verificar-imagenes-libros.mjs
 */

import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function verificarImagenesLibros() {
  console.log('🔍 Verificando imágenes de libros...\n');
  console.log(`Strapi: ${STRAPI_URL}\n`);

  let totalLibros = 0;
  let conImagen = 0;
  let sinImagen = 0;
  let pagina = 1;
  const pageSize = 100;

  try {
    while (true) {
      const params = new URLSearchParams({
        'pagination[page]': String(pagina),
        'pagination[pageSize]': String(pageSize),
        'populate': 'portada_libro',
      });

      const response = await fetch(`${STRAPI_URL}/api/libros?${params.toString()}`, {
        headers: HEADERS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const libros = data.data || [];
      const pagination = data.meta?.pagination || {};

      if (libros.length === 0) break;

      for (const libro of libros) {
        totalLibros++;
        const tieneImagen = libro.attributes?.portada_libro?.data !== null && 
                           libro.attributes?.portada_libro?.data !== undefined;
        
        if (tieneImagen) {
          conImagen++;
        } else {
          sinImagen++;
        }

        // Mostrar progreso cada 100 libros
        if (totalLibros % 100 === 0) {
          process.stdout.write(`\r📊 Procesados: ${totalLibros} (Con imagen: ${conImagen}, Sin imagen: ${sinImagen})`);
        }
      }

      if (pagina >= pagination.pageCount) break;
      pagina++;
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen:');
    console.log(`   📦 Total libros: ${totalLibros}`);
    console.log(`   ✅ Con imagen: ${conImagen} (${Math.round((conImagen/totalLibros)*100)}%)`);
    console.log(`   ❌ Sin imagen: ${sinImagen} (${Math.round((sinImagen/totalLibros)*100)}%)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarImagenesLibros();

