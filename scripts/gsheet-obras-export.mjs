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
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;

if (!STRAPI_TOKEN || !SPREADSHEET_ID || !existsSync(CREDENTIALS_PATH)) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STRAPI_TOKEN}` };

const COLUMNS = [
  'codigo_obra',
  'nombre_obra',
  'descripcion',
  'documentId',
  'url',
];

function columnIndexToLetter(index) {
  let result = ''; index++;
  while (index > 0) {
    index--; result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

async function fetchObras() {
  console.log(LIMIT > 0 ? `📚 Obteniendo ${LIMIT} obras...` : `📚 Obteniendo TODAS las obras...`);
  const allObras = [];
  let page = 1, totalObras = null;
  while (true) {
    const url = `${STRAPI_URL}/api/obras?pagination[page]=${page}&pagination[pageSize]=100&pagination[withCount]=true&sort[0]=nombre_obra:asc&populate=*`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    const obras = data.data || [];
    const pagination = data.meta?.pagination;
    if (totalObras === null && pagination?.total) {
      totalObras = pagination.total;
      if (LIMIT === 0) console.log(`   📊 Total: ${totalObras}`);
    }
    console.log(`   Página ${page}: ${obras.length} obras (total: ${allObras.length + obras.length}${totalObras ? ` / ${totalObras}` : ''})`);
    if (obras.length === 0) break;
    allObras.push(...obras);
    if (LIMIT > 0 && allObras.length >= LIMIT) { allObras.splice(LIMIT); break; }
    if (pagination && page >= pagination.pageCount) break;
    page++;
  }
  const seen = new Set(), unique = [];
  for (const obra of allObras) {
    const docId = (obra.documentId || obra.id || '').toString().trim();
    if (docId && !seen.has(docId)) { seen.add(docId); unique.push(obra); }
  }
  console.log(`✅ ${unique.length} obras únicas`);
  return unique;
}

function obraToRow(obra) {
  const getField = (f) => obra[f] || '';
  const docId = obra.documentId || obra.id || '';
  const url = `http://localhost:1337/admin/content-manager/collection-types/api::obra.obra/${docId}`;
  return [
    getField('codigo_obra'),
    getField('nombre_obra'),
    getField('descripcion') || '',
    docId,
    url,
  ];
}

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function exportToGoogleSheets(sheets, obras) {
  console.log(`📊 Exportando ${obras.length} obras...`);
  const rows = obras.map(obraToRow);
  const values = [COLUMNS, ...rows];
  console.log(`   ✅ ${values.length} filas preparadas`);
  const sheetName = 'Obras';
  let sheetId = null;
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existing = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    if (existing) {
      console.log(`   🗑️  Eliminando hoja existente...`);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ deleteSheet: { sheetId: existing.properties.sheetId } }] } });
    }
  } catch (e) {}
  const createRes = await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: sheetName, hidden: false } } }] } });
  sheetId = createRes.data.replies[0].addSheet.properties.sheetId;
  console.log(`   ✅ Hoja creada`);
  await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`, valueInputOption: 'RAW', requestBody: { values } });
  console.log(`   ✅ Datos escritos`);
  const totalRows = values.length;
  const soloLectura = [COLUMNS.indexOf('documentId'), COLUMNS.indexOf('url')].filter(i => i !== -1);
  const requests = [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
    ...soloLectura.map(ci => ({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 0.95, blue: 0.8 } } }, fields: 'userEnteredFormat(backgroundColor)' } })),
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: COLUMNS.length } } } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
  for (let i = 0; i < COLUMNS.length; i++) {
    if (!['documentId', 'url', 'descripcion'].includes(COLUMNS[i])) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 } } }] } });
    } else {
      const ancho = Math.max(100, COLUMNS[i].length * 8);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: ancho }, fields: 'pixelSize' } }] } });
    }
  }
  const codCol = COLUMNS.indexOf('codigo_obra');
  if (codCol !== -1) {
    const letter = columnIndexToLetter(codCol);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addConditionalFormatRule: { rule: { ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: codCol, endColumnIndex: codCol + 1 }], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=SUMPRODUCT(--($${letter}$2:$${letter}$${totalRows}=${letter}2))>1` }] }, format: { backgroundColor: { red: 1.0, green: 0.85, blue: 0.85 }, textFormat: { foregroundColor: { red: 0.7, green: 0.1, blue: 0.1 }, bold: true } } } }, index: 0 } }] } });
  }
  console.log(`✅ ${obras.length} obras exportadas`);
  console.log(`   URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

async function main() {
  try {
    console.log('=== Exportar Obras a Google Sheets ===\n');
    console.log(`Strapi: ${STRAPI_URL}\n`);
    const obras = await fetchObras();
    if (obras.length === 0) { console.log('⚠️  No hay obras'); return; }
    const sheets = await initGoogleSheets();
    await exportToGoogleSheets(sheets, obras);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
