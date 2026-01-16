#!/usr/bin/env node

/**
 * Script para verificar los websites de las editoriales
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

async function main() {
  console.log('🔍 Verificando websites de editoriales');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Obtener algunas editoriales
  const response = await fetch(`${STRAPI_URL}/api/editoriales?pagination[pageSize]=20&sort=id_editorial:asc`, {
    headers: HEADERS,
  });

  if (!response.ok) {
    console.error('❌ Error al obtener editoriales');
    process.exit(1);
  }

  const json = await response.json();
  const editoriales = json?.data || [];

  console.log(`📊 Mostrando primeras ${editoriales.length} editoriales:\n`);

  for (const editorial of editoriales) {
    const nombre = editorial.attributes?.nombre_editorial || editorial.nombre_editorial || 'Sin nombre';
    const website = editorial.attributes?.website || editorial.website || null;
    console.log(`${nombre.substring(0, 40).padEnd(40)} → ${website || '(vacío)'}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

