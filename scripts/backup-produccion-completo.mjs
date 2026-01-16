#!/usr/bin/env node

/**
 * Script para hacer backup completo de producción:
 * 1. Exporta todos los schemas (content types, components)
 * 2. Exporta todos los datos de cada collection type
 * 3. Guarda todo en un directorio timestamped
 * 
 * Uso:
 *   TOKEN_PROD=<token> node scripts/backup-produccion-completo.mjs
 * 
 * O con .env:
 *   node -r dotenv/config scripts/backup-produccion-completo.mjs
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const PROD_URL = process.env.STRAPI_URL || process.env.STRAPI_PROD_URL || 'https://strapi.moraleja.cl';
const PROD_TOKEN = process.env.TOKEN_PROD || process.env.STRAPI_PROD_TOKEN || process.env.IMPORT_TOKEN;

if (!PROD_TOKEN) {
  console.error('❌ Falta TOKEN_PROD o STRAPI_PROD_TOKEN');
  console.error('   Uso: TOKEN_PROD=<token> node scripts/backup-produccion-completo.mjs');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${PROD_TOKEN}`,
};

// Crear directorio de backup con timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupDir = resolve(__dirname, '..', 'backups', `backup-${timestamp}`);
mkdirSync(backupDir, { recursive: true });
mkdirSync(join(backupDir, 'schemas'), { recursive: true });
mkdirSync(join(backupDir, 'data'), { recursive: true });

console.log(`📦 Backup completo de producción`);
console.log(`   URL: ${PROD_URL}`);
console.log(`   Destino: ${backupDir}\n`);

/**
 * Obtener todos los content types desde la API de Strapi
 */
async function getContentTypes() {
  try {
    // En Strapi 5, los schemas están en el admin API
    // Intentamos obtenerlos desde el endpoint de content-types
    const res = await fetch(`${PROD_URL}/api/content-type-builder/content-types`, {
      headers: HEADERS,
    });

    if (!res.ok) {
      // Si no funciona, intentamos obtener desde la base de datos o listar manualmente
      console.warn('⚠️  No se pudieron obtener schemas desde API, usando lista manual');
      return null;
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.warn('⚠️  Error obteniendo schemas desde API:', error.message);
    return null;
  }
}

/**
 * Obtener todos los collection types disponibles
 * Lee los schemas y extrae el pluralName (que es el endpoint real)
 */
async function getAllCollectionTypes() {
  const schemasDir = resolve(__dirname, '..', 'src', 'api');
  const collectionTypes = [];
  
  try {
    const { readdirSync, statSync } = await import('fs');
    const dirs = readdirSync(schemasDir, { withFileTypes: true });
    
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      
      const schemaPath = resolve(schemasDir, dir.name, 'content-types', dir.name, 'schema.json');
      
      try {
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);
        
        if (schema.kind === 'collectionType' && schema.info?.pluralName) {
          collectionTypes.push({
            dirName: dir.name,
            pluralName: schema.info.pluralName,
            singularName: schema.info.singularName,
          });
        }
      } catch (error) {
        // Schema no existe o no es válido, continuar
      }
    }
  } catch (error) {
    console.warn('⚠️  Error leyendo schemas, usando lista manual:', error.message);
    // Fallback a lista manual si hay error
    return [
      { dirName: 'colegio', pluralName: 'colegios' },
      { dirName: 'persona', pluralName: 'personas' },
      { dirName: 'comuna', pluralName: 'comunas' },
      // ... agregar más si es necesario
    ];
  }
  
  return collectionTypes;
}

/**
 * Exportar todos los datos de un content type
 */
async function exportContentTypeData(apiPath, outputFile) {
  let page = 1;
  const pageSize = 100;
  const allData = [];
  let total = 0;

  console.log(`   📥 Exportando ${apiPath}...`);

  while (true) {
    try {
      const url = `${PROD_URL}/api/${apiPath}?pagination[page]=${page}&pagination[pageSize]=${pageSize}&pagination[withCount]=true`;
      const res = await fetch(url, { headers: HEADERS });

      if (!res.ok) {
        if (res.status === 404) {
          console.log(`      ⚠️  No encontrado (404) - puede que no exista este content type`);
          break;
        }
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const data = json?.data || [];
      const meta = json?.meta?.pagination;

      if (!data.length) break;

      allData.push(...data);
      total += data.length;

      console.log(`      Página ${page}: ${data.length} registros (total: ${total})`);

      if (!meta || page >= meta.pageCount) break;
      page++;
    } catch (error) {
      console.error(`      ❌ Error en página ${page}:`, error.message);
      // Si es un error de conexión, intentar de nuevo con retry
      if (error.message.includes('Premature close') || error.message.includes('ECONNRESET')) {
        console.log(`      ⏳ Reintentando página ${page} en 2 segundos...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue; // Reintentar la misma página
      }
      // Si es otro error, guardar lo que tenemos y continuar
      if (allData.length > 0) {
        console.log(`      ⚠️  Guardando ${total} registros obtenidos hasta ahora...`);
        break;
      }
      break;
    }
  }

  if (allData.length > 0) {
    writeFileSync(outputFile, JSON.stringify(allData, null, 2), 'utf-8');
    console.log(`      ✅ ${total} registros guardados en ${outputFile}`);
  } else {
    console.log(`      ⚠️  Sin datos`);
  }

  return { count: total, file: outputFile };
}

/**
 * Copiar schemas locales (ya que están en el código)
 * Esto es más confiable que intentar obtenerlos desde la API
 */
async function backupSchemas() {
  console.log('\n📋 Copiando schemas desde código local...\n');

  const schemasDir = resolve(__dirname, '..', 'src', 'api');
  const componentsDir = resolve(__dirname, '..', 'src', 'components');
  const backupSchemasDir = join(backupDir, 'schemas');

  // Copiar content types
  const collectionTypes = await getAllCollectionTypes();
  let copied = 0;

  for (const ct of collectionTypes) {
    const dirName = typeof ct === 'string' ? ct : ct.dirName;
    // El path del schema es: src/api/{dirName}/content-types/{dirName}/schema.json
    const schemaPath = resolve(schemasDir, dirName, 'content-types', dirName, 'schema.json');
    
    try {
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      const backupPath = join(backupSchemasDir, `content-type-${dirName}.json`);
      writeFileSync(backupPath, schemaContent, 'utf-8');
      copied++;
    } catch (error) {
      // Schema no existe localmente, está bien (puede que no esté en el código)
      console.log(`      ⚠️  Schema no encontrado: ${dirName}`);
    }
  }

  // Copiar components
  try {
    const { readdirSync, statSync, copyFileSync } = await import('fs');
    const { join: pathJoin } = await import('path');
    
    function copyDir(src, dest) {
      mkdirSync(dest, { recursive: true });
      const entries = readdirSync(src, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = pathJoin(src, entry.name);
        const destPath = pathJoin(dest, entry.name);
        
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          copyFileSync(srcPath, destPath);
        }
      }
    }

    if (statSync(componentsDir).isDirectory()) {
      const backupComponentsDir = join(backupSchemasDir, 'components');
      copyDir(componentsDir, backupComponentsDir);
      console.log(`   ✅ Components copiados`);
    }
  } catch (error) {
    console.warn(`   ⚠️  No se pudieron copiar components: ${error.message}`);
  }

  console.log(`   ✅ ${copied} content types copiados\n`);
}

/**
 * Exportar todos los datos
 */
async function backupData() {
  console.log('📊 Exportando datos de producción...\n');

  const collectionTypes = await getAllCollectionTypes();
  const results = [];

  for (const ct of collectionTypes) {
    const apiPath = typeof ct === 'string' ? ct : ct.pluralName;
    const dirName = typeof ct === 'string' ? ct : ct.dirName;
    const outputFile = join(backupDir, 'data', `${dirName}.json`);
    
    try {
      const result = await exportContentTypeData(apiPath, outputFile);
      results.push({ contentType: dirName, apiPath, ...result });
    } catch (error) {
      console.error(`   ❌ Error exportando ${dirName}:`, error.message);
      results.push({ contentType: dirName, apiPath, error: error.message });
    }
  }

  return results;
}

/**
 * Crear archivo de resumen
 */
function createSummary(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    source: PROD_URL,
    backupDir: backupDir,
    contentTypes: results.map(r => ({
      name: r.contentType,
      count: r.count || 0,
      file: r.file ? r.file.replace(backupDir, '.') : null,
      error: r.error || null,
    })),
    totalRecords: results.reduce((sum, r) => sum + (r.count || 0), 0),
  };

  const summaryFile = join(backupDir, 'summary.json');
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2), 'utf-8');
  
  console.log('\n📄 Resumen del backup:');
  console.log(`   Total de content types: ${results.length}`);
  console.log(`   Total de registros: ${summary.totalRecords}`);
  console.log(`   Resumen guardado en: ${summaryFile}\n`);

  return summary;
}

/**
 * Función principal
 */
async function main() {
  try {
    // 1. Backup de schemas
    await backupSchemas();

    // 2. Backup de datos
    const results = await backupData();

    // 3. Crear resumen
    const summary = createSummary(results);

    console.log('✅ Backup completo finalizado!');
    console.log(`\n📁 Ubicación: ${backupDir}`);
    console.log(`\n💡 Para restaurar:`);
    console.log(`   1. Revisa los schemas en: ${join(backupDir, 'schemas')}`);
    console.log(`   2. Revisa los datos en: ${join(backupDir, 'data')}`);
    console.log(`   3. Usa los scripts de importación o strapi transfer para restaurar\n`);

  } catch (error) {
    console.error('\n❌ Error durante el backup:', error);
    process.exit(1);
  }
}

main();

