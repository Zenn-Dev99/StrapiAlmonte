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
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Autores!A:Z' });
  const rows = response.data.values || [];
  if (rows.length < 2) throw new Error('Hoja vacía');
  const headers = rows[0];
  const autores = rows.slice(1).filter(r => r.some(c => c && c.trim())).map(r => {
    const obj = {}; headers.forEach((h, i) => { obj[h] = r[i] || ''; }); return obj;
  }).filter(a => a.documentId && a.documentId.trim());
  console.log(`   ${autores.length} autores encontrados`);
  return autores;
}

async function actualizarAutor(documentId, autorData) {
  const payload = { data: {} };
  if (autorData.id_autor) { const id = parseInt(autorData.id_autor, 10); if (!isNaN(id)) payload.data.id_autor = id; }
  if (autorData.nombre_completo_autor) payload.data.nombre_completo_autor = autorData.nombre_completo_autor.trim();
  if (autorData.nombres !== undefined) payload.data.nombres = autorData.nombres?.trim() || null;
  if (autorData.primer_apellido !== undefined) payload.data.primer_apellido = autorData.primer_apellido?.trim() || null;
  if (autorData.segundo_apellido !== undefined) payload.data.segundo_apellido = autorData.segundo_apellido?.trim() || null;
  if (autorData.website !== undefined) payload.data.website = autorData.website?.trim() || null;
  if (autorData.pais) payload.data.pais = autorData.pais;
  if (autorData.fecha_nacimiento) payload.data.fecha_nacimiento = autorData.fecha_nacimiento || null;
  if (autorData.fecha_muerte) payload.data.fecha_muerte = autorData.fecha_muerte || null;
  if (autorData.vivo_muerto !== undefined) payload.data.vivo_muerto = autorData.vivo_muerto === 'Sí' || autorData.vivo_muerto === true || autorData.vivo_muerto === 'true';
  if (autorData.tipo_autor) payload.data.tipo_autor = autorData.tipo_autor;
  if (autorData.resegna !== undefined && autorData.resegna) {
    const texto = autorData.resegna.trim();
    if (texto) {
      payload.data.resegna = texto.split('\n').filter(p => p.trim()).map(p => ({ type: 'paragraph', children: [{ type: 'text', text: p.trim() }] }));
    } else {
      payload.data.resegna = null;
    }
  }
  if (DRY_RUN) { console.log(`   [DRY] Actualizaría ${documentId}:`, JSON.stringify(payload.data, null, 2)); return { success: true }; }
  const response = await fetch(`${STRAPI_URL}/api/autores/${documentId}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { success: true };
}

async function main() {
  try {
    console.log('=== Importar Autores desde Google Sheets ===\n');
    if (DRY_RUN) console.log('🔍 MODO DRY RUN\n');
    const sheets = await initGoogleSheets();
    const autores = await fetchFromGoogleSheets(sheets);
    if (autores.length === 0) { console.log('⚠️  No hay autores'); return; }
    let success = 0, errors = 0;
    for (const autor of autores) {
      try {
        await actualizarAutor(autor.documentId.trim(), autor);
        success++;
        if (!DRY_RUN) console.log(`   ✅ ${autor.documentId}`);
      } catch (e) {
        errors++;
        console.error(`   ❌ ${autor.documentId}: ${e.message}`);
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
