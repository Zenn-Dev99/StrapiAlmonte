#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

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
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const STRAPI_URL = process.env.STRAPI_URL || process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || resolve(__dirname, '..', 'data', 'gsheets', 'credentials.json');
const DRY_RUN = process.env.DRY === '1';

if (!STRAPI_TOKEN || !SPREADSHEET_ID || !existsSync(CREDENTIALS_PATH)) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STRAPI_TOKEN}` };

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function fetchFromGoogleSheets(sheets) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Sellos!A:Z' });
  const rows = response.data.values || [];
  if (rows.length < 2) throw new Error('Hoja vacía');
  const headers = rows[0];
  const sellos = rows.slice(1).filter(r => {
    // Filtrar filas vacías - debe tener al menos nombre_sello
    const hasData = r.some(c => c && c.trim());
    if (!hasData) return false;
    // Verificar que tenga nombre_sello (requerido para crear/actualizar)
    const nombreIndex = headers.indexOf('nombre_sello');
    return nombreIndex !== -1 && r[nombreIndex] && r[nombreIndex].trim();
  }).map(r => {
    const obj = {}; headers.forEach((h, i) => { obj[h] = r[i] || ''; }); return obj;
  });
  
  const conDocumentId = sellos.filter(s => s.documentId && s.documentId.trim());
  const sinDocumentId = sellos.filter(s => !s.documentId || !s.documentId.trim());
  
  console.log(`   ${sellos.length} sellos encontrados`);
  console.log(`   - Con documentId (actualizar): ${conDocumentId.length}`);
  console.log(`   - Sin documentId (crear nuevo): ${sinDocumentId.length}`);
  return sellos;
}

async function validarRelacion(tipo, id) {
  if (!id || isNaN(id)) return false;
  const idNum = parseInt(id, 10);
  if (isNaN(idNum)) return false;
  try {
    const endpoint = tipo === 'editorial' ? 'editoriales' : `${tipo}s`;
    const response = await fetch(`${STRAPI_URL}/api/${endpoint}/${idNum}`, { headers: HEADERS });
    return response.ok;
  } catch { return false; }
}

async function obtenerMaxIdSello() {
  try {
    const response = await fetch(`${STRAPI_URL}/api/sellos?pagination[pageSize]=1&sort[0]=id_sello:desc`, {
      headers: HEADERS,
    });
    if (!response.ok) return 0;
    const data = await response.json();
    const sello = data.data?.[0];
    if (sello && sello.id_sello) {
      return parseInt(sello.id_sello, 10) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function crearOActualizarSello(selloData) {
  const payload = { data: {} };
  
  // Campos requeridos
  if (!selloData.nombre_sello || !selloData.nombre_sello.trim()) {
    throw new Error('nombre_sello es requerido');
  }
  payload.data.nombre_sello = selloData.nombre_sello.trim();
  
  // id_sello (generar automáticamente si no se proporciona y es nuevo)
  const documentId = selloData.documentId?.trim();
  const esNuevo = !documentId;
  
  if (selloData.id_sello) {
    const id = parseInt(selloData.id_sello, 10);
    if (!isNaN(id)) payload.data.id_sello = id;
  } else if (esNuevo) {
    // Generar ID automáticamente para nuevos registros
    const maxId = await obtenerMaxIdSello();
    payload.data.id_sello = maxId + 1;
    console.log(`   📝 Generando id_sello automático: ${payload.data.id_sello}`);
  }
  
  // Campos opcionales
  if (selloData.acronimo !== undefined) payload.data.acronimo = selloData.acronimo?.trim() || null;
  if (selloData.website !== undefined) payload.data.website = selloData.website?.trim() || null;
  
  // Relaciones
  if (selloData.id_editorial) {
    const id = parseInt(selloData.id_editorial, 10);
    if (!isNaN(id)) {
      const existe = await validarRelacion('editorial', id);
      if (existe) {
        payload.data.editorial = id;
      } else {
        console.warn(`   ⚠️  Editorial ID ${id} no existe`);
      }
    }
  }
  
  if (DRY_RUN) {
    if (esNuevo) {
      console.log(`   [DRY] Crearía nuevo sello:`, JSON.stringify(payload.data, null, 2));
    } else {
      console.log(`   [DRY] Actualizaría ${documentId}:`, JSON.stringify(payload.data, null, 2));
    }
    return { success: true, created: esNuevo };
  }
  
  let response;
  if (esNuevo) {
    // Crear nuevo registro
    response = await fetch(`${STRAPI_URL}/api/sellos`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
  } else {
    // Actualizar registro existente
    response = await fetch(`${STRAPI_URL}/api/sellos/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return { success: true, created: esNuevo, data: await response.json() };
}

async function main() {
  try {
    console.log('=== Importar Sellos desde Google Sheets ===\n');
    if (DRY_RUN) console.log('🔍 MODO DRY RUN\n');
    const sheets = await initGoogleSheets();
    const sellos = await fetchFromGoogleSheets(sheets);
    if (sellos.length === 0) { console.log('⚠️  No hay sellos'); return; }
    let success = 0, created = 0, updated = 0, errors = 0;
    for (const sello of sellos) {
      try {
        const result = await crearOActualizarSello(sello);
        success++;
        if (result.created) {
          created++;
          if (!DRY_RUN) {
            const docId = result.data?.data?.documentId || 'nuevo';
            console.log(`   ✅ CREADO: ${sello.nombre_sello} (${docId})`);
          }
        } else {
          updated++;
          if (!DRY_RUN) console.log(`   ✅ ACTUALIZADO: ${sello.documentId}`);
        }
      } catch (e) {
        errors++;
        const nombre = sello.nombre_sello || 'Sin nombre';
        const docId = sello.documentId || 'NUEVO';
        console.error(`   ❌ ${docId} (${nombre}): ${e.message}`);
      }
    }
    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Total procesados: ${success}`);
    if (created > 0) console.log(`   🆕 Creados: ${created}`);
    if (updated > 0) console.log(`   📝 Actualizados: ${updated}`);
    if (errors > 0) console.log(`   ❌ Errores: ${errors}`);
    if (DRY_RUN) console.log(`\n💡 Ejecuta sin DRY=1 para aplicar cambios`);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
