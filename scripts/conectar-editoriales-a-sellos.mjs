#!/usr/bin/env node

/**
 * Script para conectar editoriales a sellos usando el CSV de sellos
 * 
 * Lee el CSV de sellos y conecta cada sello con su editorial correspondiente
 * usando el campo id_editorial del CSV
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
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10);

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

// Parsear CSV
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));

    if (values.length > 0 && values.some(v => v)) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }

  return data;
}

// Cache de entidades
const cache = {
  sellos: new Map(),
  editoriales: new Map(),
};

// Buscar entidad en Strapi
async function buscarEntidad(contentType, campo, valor) {
  if (!valor) return null;

  const cacheKey = `${contentType}_${campo}_${valor}`;
  if (cache[contentType] && cache[contentType].has(cacheKey)) {
    return cache[contentType].get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      [`filters[${campo}][$eq]`]: String(valor).trim(),
    });

    const response = await fetch(`${STRAPI_URL}/api/${contentType}?${params.toString()}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const entity = json?.data?.[0] || null;

    if (entity && cache[contentType]) {
      cache[contentType].set(cacheKey, entity);
    }

    return entity;
  } catch (error) {
    return null;
  }
}

// Conectar editorial a sello
async function conectarEditorialASello(selloData) {
  const idSello = selloData.id_sello?.trim();
  const idEditorial = selloData.id_editorial?.trim();

  if (!idSello) {
    return { success: false, reason: 'Sin id_sello' };
  }

  if (!idEditorial) {
    return { success: true, action: 'skip', reason: 'Sin id_editorial en CSV' };
  }

  // Buscar sello
  const sello = await buscarEntidad('sellos', 'id_sello', idSello);
  if (!sello) {
    return { success: false, reason: 'Sello no encontrado en Strapi' };
  }

  const selloId = sello.documentId || sello.id;
  const nombreSello = sello.attributes?.nombre_sello || sello.nombre_sello || 'Sin nombre';

  // Verificar si ya tiene editorial
  const editorialActual = sello.attributes?.editorial?.data || sello.editorial?.data || sello.editorial;
  if (editorialActual) {
    const idEditorialActual = editorialActual.attributes?.id_editorial || editorialActual.id_editorial;
    if (idEditorialActual === idEditorial) {
      return { success: true, action: 'skip', reason: 'Ya tiene la editorial correcta' };
    }
  }

  // Buscar editorial
  const editorial = await buscarEntidad('editoriales', 'id_editorial', idEditorial);
  if (!editorial) {
    return { success: false, reason: `Editorial con id_editorial=${idEditorial} no encontrada` };
  }

  const editorialId = editorial.documentId || editorial.id;
  const nombreEditorial = editorial.attributes?.nombre_editorial || editorial.nombre_editorial || 'Sin nombre';

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Conectaría sello "${nombreSello}" (${idSello}) con editorial "${nombreEditorial}" (${idEditorial})`);
    return { success: true, action: 'dry-run' };
  }

  // Actualizar sello
  try {
    const response = await fetch(`${STRAPI_URL}/api/sellos/${selloId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          editorial: editorialId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    return {
      success: true,
      action: 'updated',
      sello: nombreSello,
      editorial: nombreEditorial,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Procesar con concurrencia
async function procesarConConcurrencia(array, fn, concurrencia) {
  const resultados = [];
  
  for (let i = 0; i < array.length; i += concurrencia) {
    const lote = array.slice(i, i + concurrencia);
    const tareas = lote.map(item => fn(item));
    const resultadosLote = await Promise.all(tareas);
    resultados.push(...resultadosLote);
    
    // Pequeña pausa entre lotes
    if (i + concurrencia < array.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return resultados;
}

async function main() {
  console.log('🔗 CONECTANDO EDITORIALES A SELLOS');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Strapi URL: ${STRAPI_URL}`);
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (solo mostraría)' : 'ACTUALIZAR'}`);
  console.log(`Concurrencia: ${CONCURRENCY}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  const SELLOS_CSV = resolve(__dirname, '..', 'data', 'csv', 'import', 'sellos_notion.csv');

  if (!existsSync(SELLOS_CSV)) {
    console.error(`❌ Archivo no encontrado: ${SELLOS_CSV}`);
    process.exit(1);
  }

  const csvContent = readFileSync(SELLOS_CSV, 'utf-8');
  const sellosData = parseCSV(csvContent);

  console.log(`📄 Cargados ${sellosData.length} sellos del CSV\n`);

  const stats = {
    total: sellosData.length,
    actualizados: 0,
    omitidos: 0,
    errores: 0,
  };

  // Procesar sellos
  await procesarConConcurrencia(
    sellosData,
    async (sello) => {
      const resultado = await conectarEditorialASello(sello);
      
      if (resultado.success) {
        if (resultado.action === 'updated') {
          stats.actualizados++;
          if (stats.actualizados % 50 === 0) {
            console.log(`  [${stats.actualizados}/${stats.total}] Actualizados: ${resultado.sello} → ${resultado.editorial}`);
          }
        } else {
          stats.omitidos++;
        }
      } else {
        stats.errores++;
        if (stats.errores <= 10) {
          console.error(`  ❌ Error: ${resultado.reason || resultado.error}`);
        }
      }
    },
    CONCURRENCY
  );

  // Resumen
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN FINAL');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`📦 Total procesados: ${stats.total}`);
  console.log(`✅ Actualizados: ${stats.actualizados}`);
  console.log(`⏭️  Omitidos: ${stats.omitidos}`);
  console.log(`❌ Errores: ${stats.errores}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('💡 Ejecuta sin --dry-run para aplicar los cambios\n');
  } else {
    console.log('✅ Proceso completado\n');
  }
}

main();

