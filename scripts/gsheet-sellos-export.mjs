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
  'id_sello',
  'nombre_sello',
  'acronimo',
  'website',
  'id_editorial',
  'nombre_editorial',
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

async function fetchSellos() {
  console.log(LIMIT > 0 ? `📚 Obteniendo ${LIMIT} sellos...` : `📚 Obteniendo TODOS los sellos...`);
  const allSellos = [];
  let page = 1, totalSellos = null;
  while (true) {
    const url = `${STRAPI_URL}/api/sellos?pagination[page]=${page}&pagination[pageSize]=100&pagination[withCount]=true&sort[0]=id_sello:asc&populate=*`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    const sellos = data.data || [];
    const pagination = data.meta?.pagination;
    if (totalSellos === null && pagination?.total) {
      totalSellos = pagination.total;
      if (LIMIT === 0) console.log(`   📊 Total: ${totalSellos}`);
    }
    console.log(`   Página ${page}: ${sellos.length} sellos (total: ${allSellos.length + sellos.length}${totalSellos ? ` / ${totalSellos}` : ''})`);
    if (sellos.length === 0) break;
    allSellos.push(...sellos);
    if (LIMIT > 0 && allSellos.length >= LIMIT) { allSellos.splice(LIMIT); break; }
    if (pagination && page >= pagination.pageCount) break;
    page++;
  }
  // Filtrar duplicados por documentId e id
  const seenDocumentIds = new Set();
  const seenIds = new Set();
  const unique = [];
  const duplicates = [];
  
  for (const sello of allSellos) {
    const docId = (sello.documentId || '').toString().trim();
    const id = (sello.id || '').toString().trim();
    const nombre = sello.nombre_sello || 'Sin nombre';
    
    if (docId && seenDocumentIds.has(docId)) {
      duplicates.push({ tipo: 'documentId', id: docId, nombre });
      continue;
    }
    
    if (!docId && id && seenIds.has(id)) {
      duplicates.push({ tipo: 'id', id: id, nombre });
      continue;
    }
    
    if (docId) seenDocumentIds.add(docId);
    if (id) seenIds.add(id);
    unique.push(sello);
  }
  
  if (duplicates.length > 0) {
    console.warn(`\n⚠️  Se encontraron ${duplicates.length} sellos duplicados (filtrados automáticamente)`);
    duplicates.slice(0, 5).forEach(dup => {
      console.warn(`   - Duplicado por ${dup.tipo}: "${dup.id}" (Nombre: ${dup.nombre})`);
    });
    if (duplicates.length > 5) {
      console.warn(`   ... y ${duplicates.length - 5} duplicados más`);
    }
    console.warn(`   Se exportarán solo los primeros encontrados (${unique.length} únicos).\n`);
  }
  
  console.log(`✅ Se encontraron ${unique.length} sellos únicos (de ${allSellos.length} totales obtenidos)`);
  return unique;
}

function selloToRow(sello) {
  const getField = (f) => sello[f] || '';
  const getRelId = (r) => r ? (r.id || r.documentId || '') : '';
  const getRelName = (r) => r ? (r.nombre_editorial || '') : '';
  const docId = sello.documentId || sello.id || '';
  const url = `http://localhost:1337/admin/content-manager/collection-types/api::sello.sello/${docId}`;
  return [
    getField('id_sello'),
    getField('nombre_sello'),
    getField('acronimo') || '',
    getField('website') || '',
    getRelId(sello.editorial),
    getRelName(sello.editorial),
    docId,
    url,
  ];
}

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function exportToGoogleSheets(sheets, sellos) {
  console.log(`📊 Exportando ${sellos.length} sellos...`);
  const rows = sellos.map(selloToRow);
  const values = [COLUMNS, ...rows];
  console.log(`   ✅ ${values.length} filas preparadas`);
  const sheetName = 'Sellos';
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
  const soloLectura = [COLUMNS.indexOf('nombre_editorial'), COLUMNS.indexOf('documentId'), COLUMNS.indexOf('url')].filter(i => i !== -1);
  const requests = [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
    ...soloLectura.map(ci => ({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 0.95, blue: 0.8 } } }, fields: 'userEnteredFormat(backgroundColor)' } })),
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: COLUMNS.length } } } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
  ];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
  for (let i = 0; i < COLUMNS.length; i++) {
    if (!['documentId', 'url'].includes(COLUMNS[i])) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 } } }] } });
    } else {
      const ancho = Math.max(100, COLUMNS[i].length * 8);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: ancho }, fields: 'pixelSize' } }] } });
    }
  }
  const idCol = COLUMNS.indexOf('id_sello');
  if (idCol !== -1) {
    const letter = columnIndexToLetter(idCol);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addConditionalFormatRule: { rule: { ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: idCol, endColumnIndex: idCol + 1 }], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=SUMPRODUCT(--($${letter}$2:$${letter}$${totalRows}=${letter}2))>1` }] }, format: { backgroundColor: { red: 1.0, green: 0.85, blue: 0.85 }, textFormat: { foregroundColor: { red: 0.7, green: 0.1, blue: 0.1 }, bold: true } } } }, index: 0 } }] } });
  }
  console.log(`✅ ${sellos.length} sellos exportados`);
  console.log(`   URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

async function main() {
  try {
    console.log('=== Exportar Sellos a Google Sheets ===\n');
    console.log(`Strapi: ${STRAPI_URL}\n`);
    const sellos = await fetchSellos();
    if (sellos.length === 0) { console.log('⚠️  No hay sellos'); return; }
    const sheets = await initGoogleSheets();
    await exportToGoogleSheets(sheets, sellos);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
