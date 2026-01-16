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
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Obras!A:Z' });
  const rows = response.data.values || [];
  if (rows.length < 2) throw new Error('Hoja vacía');
  const headers = rows[0];
  const obras = rows.slice(1).filter(r => r.some(c => c && c.trim())).map(r => {
    const obj = {}; headers.forEach((h, i) => { obj[h] = r[i] || ''; }); return obj;
  }).filter(o => o.documentId && o.documentId.trim());
  console.log(`   ${obras.length} obras encontradas`);
  return obras;
}

async function actualizarObra(documentId, obraData) {
  const payload = { data: {} };
  if (obraData.codigo_obra) payload.data.codigo_obra = obraData.codigo_obra.trim();
  if (obraData.nombre_obra) payload.data.nombre_obra = obraData.nombre_obra.trim();
  if (obraData.descripcion !== undefined) payload.data.descripcion = obraData.descripcion?.trim() || null;
  if (DRY_RUN) { console.log(`   [DRY] Actualizaría ${documentId}:`, JSON.stringify(payload.data, null, 2)); return { success: true }; }
  const response = await fetch(`${STRAPI_URL}/api/obras/${documentId}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { success: true };
}

async function main() {
  try {
    console.log('=== Importar Obras desde Google Sheets ===\n');
    if (DRY_RUN) console.log('🔍 MODO DRY RUN\n');
    const sheets = await initGoogleSheets();
    const obras = await fetchFromGoogleSheets(sheets);
    if (obras.length === 0) { console.log('⚠️  No hay obras'); return; }
    let success = 0, errors = 0;
    for (const obra of obras) {
      try {
        await actualizarObra(obra.documentId.trim(), obra);
        success++;
        if (!DRY_RUN) console.log(`   ✅ ${obra.documentId}`);
      } catch (e) {
        errors++;
        console.error(`   ❌ ${obra.documentId}: ${e.message}`);
      }
    }
    console.log(`\n📊 ✅ ${success} | ❌ ${errors}`);
    if (DRY_RUN) console.log(`\n💡 Ejecuta sin DRY=1 para aplicar cambios`);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
