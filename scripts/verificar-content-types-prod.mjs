#!/usr/bin/env node

/**
 * Script para verificar qué content types tienen datos en producción
 * Útil para verificar si el backup exportó todo correctamente
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

const PROD_URL = process.env.STRAPI_URL || process.env.STRAPI_PROD_URL || 'https://strapi.moraleja.cl';
const PROD_TOKEN = process.env.TOKEN_PROD || process.env.STRAPI_PROD_TOKEN || process.env.IMPORT_TOKEN;

if (!PROD_TOKEN) {
  console.error('❌ Falta TOKEN_PROD');
  process.exit(1);
}

const HEADERS = {
  'Authorization': `Bearer ${PROD_TOKEN}`,
};

// Content types importantes a verificar
const IMPORTANT_CTS = [
  'libros', 'obras', 'editoriales', 'sellos', 'colecciones', 'autores', 'canales'
];

/**
 * Verificar un content type
 */
async function checkContentType(pluralName) {
  try {
    const url = `${PROD_URL}/api/${pluralName}?pagination[pageSize]=1`;
    const res = await fetch(url, { headers: HEADERS });

    if (!res.ok) {
      if (res.status === 404) {
        return { exists: false, count: 0, error: '404 Not Found' };
      }
      const errorText = await res.text();
      return { exists: false, count: 0, error: `HTTP ${res.status}: ${errorText.substring(0, 100)}` };
    }

    const data = await res.json();
    const meta = data.meta?.pagination;
    const count = meta?.total || 0;

    return {
      exists: true,
      count,
      pageCount: meta?.pageCount || 0,
    };
  } catch (error) {
    return {
      exists: false,
      count: 0,
      error: error.message,
    };
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🔍 Verificando content types en producción...\n');
  console.log(`URL: ${PROD_URL}\n`);

  const results = [];

  // Verificar content types importantes
  console.log('📚 Content Types Importantes:\n');
  for (const ct of IMPORTANT_CTS) {
    process.stdout.write(`   Verificando ${ct}... `);
    const result = await checkContentType(ct);
    results.push({ name: ct, ...result });

    if (result.exists) {
      if (result.count > 0) {
        console.log(`✅ ${result.count} registros`);
      } else {
        console.log(`⚠️  0 registros (vacío)`);
      }
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
  }

  // Verificar otros content types del backup
  console.log('\n📊 Comparando con backup...\n');
  
  const backupSummaryPath = join(__dirname, '..', 'backups', 'backup-2025-11-17T23-20-11', 'summary.json');
  if (existsSync(backupSummaryPath)) {
    const summary = JSON.parse(readFileSync(backupSummaryPath, 'utf-8'));
    
    console.log('Content Types con diferencias:\n');
    
    for (const ct of IMPORTANT_CTS) {
      const backupCt = summary.contentTypes.find(c => c.name === ct.replace(/s$/, '') || c.name === ct);
      const prodResult = results.find(r => r.name === ct);
      
      if (backupCt && prodResult) {
        const backupCount = backupCt.count || 0;
        const prodCount = prodResult.count || 0;
        
        if (backupCount !== prodCount) {
          console.log(`   ⚠️  ${ct}:`);
          console.log(`      Backup: ${backupCount} registros`);
          console.log(`      Producción: ${prodCount} registros`);
          if (prodCount > 0 && backupCount === 0) {
            console.log(`      ❌ FALTA EXPORTAR: Hay ${prodCount} registros en producción que no se exportaron!`);
          }
        } else if (prodCount > 0) {
          console.log(`   ✅ ${ct}: ${prodCount} registros (coincide)`);
        }
      }
    }
  }

  // Resumen
  console.log('\n📋 Resumen:\n');
  const withData = results.filter(r => r.count > 0);
  const withoutData = results.filter(r => r.count === 0 && r.exists);
  const withErrors = results.filter(r => !r.exists);

  console.log(`   ✅ Con datos: ${withData.length}`);
  console.log(`   ⚠️  Vacíos: ${withoutData.length}`);
  console.log(`   ❌ Errores: ${withErrors.length}`);

  if (withData.length > 0) {
    console.log('\n   Content types con datos:');
    withData.forEach(r => {
      console.log(`      - ${r.name}: ${r.count} registros`);
    });
  }

  if (withoutData.length > 0) {
    console.log('\n   Content types vacíos:');
    withoutData.forEach(r => {
      console.log(`      - ${r.name}`);
    });
  }

  if (withErrors.length > 0) {
    console.log('\n   Content types con errores:');
    withErrors.forEach(r => {
      console.log(`      - ${r.name}: ${r.error}`);
    });
  }
}

main().catch(console.error);

