#!/usr/bin/env node

/**
 * Script para exportar autores desde Strapi a Google Sheets
 */

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
  console.error('❌ Faltan variables de entorno o credentials.json');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STRAPI_TOKEN}` };

const COLUMNS = [
  'id_autor',
  'nombre_completo_autor',
  'nombres',
  'primer_apellido',
  'segundo_apellido',
  'website',
  'pais',
  'fecha_nacimiento',
  'fecha_muerte',
  'vivo_muerto',
  'tipo_autor',
  'resegna',
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

async function fetchAutores() {
  console.log(LIMIT > 0 ? `📚 Obteniendo ${LIMIT} autores...` : `📚 Obteniendo TODOS los autores...`);
  const allAutores = [];
  let page = 1, totalAutores = null;
  while (true) {
    const url = `${STRAPI_URL}/api/autores?pagination[page]=${page}&pagination[pageSize]=100&pagination[withCount]=true&sort[0]=nombre_completo_autor:asc&populate=*`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    const autores = data.data || [];
    const pagination = data.meta?.pagination;
    if (totalAutores === null && pagination?.total) {
      totalAutores = pagination.total;
      if (LIMIT === 0) console.log(`   📊 Total: ${totalAutores}`);
    }
    console.log(`   Página ${page}: ${autores.length} autores (total: ${allAutores.length + autores.length}${totalAutores ? ` / ${totalAutores}` : ''})`);
    if (autores.length === 0) break;
    allAutores.push(...autores);
    if (LIMIT > 0 && allAutores.length >= LIMIT) { allAutores.splice(LIMIT); break; }
    if (pagination && page >= pagination.pageCount) break;
    page++;
  }
  // Filtrar duplicados por documentId e id
  const seenDocumentIds = new Set();
  const seenIds = new Set();
  const unique = [];
  const duplicates = [];
  
  for (const autor of allAutores) {
    const docId = (autor.documentId || '').toString().trim();
    const id = (autor.id || '').toString().trim();
    const nombre = autor.nombre_completo_autor || 'Sin nombre';
    
    // Verificar duplicados por documentId primero (más confiable)
    if (docId && seenDocumentIds.has(docId)) {
      duplicates.push({ tipo: 'documentId', id: docId, nombre });
      continue;
    }
    
    // Verificar duplicados por id solo si no hay documentId
    if (!docId && id && seenIds.has(id)) {
      duplicates.push({ tipo: 'id', id: id, nombre });
      continue;
    }
    
    // Es único, agregarlo
    if (docId) seenDocumentIds.add(docId);
    if (id) seenIds.add(id);
    unique.push(autor);
  }
  
  if (duplicates.length > 0) {
    console.warn(`\n⚠️  Se encontraron ${duplicates.length} autores duplicados (filtrados automáticamente)`);
    duplicates.slice(0, 5).forEach(dup => {
      console.warn(`   - Duplicado por ${dup.tipo}: "${dup.id}" (Nombre: ${dup.nombre})`);
    });
    if (duplicates.length > 5) {
      console.warn(`   ... y ${duplicates.length - 5} duplicados más`);
    }
    console.warn(`   Se exportarán solo los primeros encontrados (${unique.length} únicos).\n`);
  }
  
  console.log(`✅ Se encontraron ${unique.length} autores únicos (de ${allAutores.length} totales obtenidos)`);
  return unique;
}

function autorToRow(autor) {
  const getField = (f) => autor[f] || '';
  const getResegna = () => {
    const r = autor.resegna;
    if (!r) return '';
    if (Array.isArray(r)) {
      return r.map(b => b.type === 'paragraph' && b.children ? b.children.map(c => c.text || '').join('') : '').filter(t => t).join('\n');
    }
    return typeof r === 'string' ? r : '';
  };
  const docId = autor.documentId || autor.id || '';
  const url = `http://localhost:1337/admin/content-manager/collection-types/api::autor.autor/${docId}`;
  return [
    getField('id_autor'),
    getField('nombre_completo_autor'),
    getField('nombres') || '',
    getField('primer_apellido') || '',
    getField('segundo_apellido') || '',
    getField('website') || '',
    getField('pais') || '',
    getField('fecha_nacimiento') || '',
    getField('fecha_muerte') || '',
    getField('vivo_muerto') !== undefined ? (getField('vivo_muerto') ? 'Sí' : 'No') : '',
    getField('tipo_autor') || '',
    getResegna(),
    docId,
    url,
  ];
}

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function exportToGoogleSheets(sheets, autores) {
  console.log(`📊 Exportando ${autores.length} autores...`);
  const rows = autores.map(autorToRow);
  const values = [COLUMNS, ...rows];
  console.log(`   ✅ ${values.length} filas preparadas`);
  const sheetName = 'Autores';
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
    if (!['documentId', 'url', 'resegna'].includes(COLUMNS[i])) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 } } }] } });
    } else {
      const ancho = Math.max(100, COLUMNS[i].length * 8);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: ancho }, fields: 'pixelSize' } }] } });
    }
  }
  const idCol = COLUMNS.indexOf('id_autor');
  if (idCol !== -1) {
    const letter = columnIndexToLetter(idCol);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addConditionalFormatRule: { rule: { ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: idCol, endColumnIndex: idCol + 1 }], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=SUMPRODUCT(--($${letter}$2:$${letter}$${totalRows}=${letter}2))>1` }] }, format: { backgroundColor: { red: 1.0, green: 0.85, blue: 0.85 }, textFormat: { foregroundColor: { red: 0.7, green: 0.1, blue: 0.1 }, bold: true } } } }, index: 0 } }] } });
  }
  console.log(`✅ ${autores.length} autores exportados`);
  console.log(`   URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

async function main() {
  try {
    console.log('=== Exportar Autores a Google Sheets ===\n');
    console.log(`Strapi: ${STRAPI_URL}\n`);
    const autores = await fetchAutores();
    if (autores.length === 0) { console.log('⚠️  No hay autores'); return; }
    const sheets = await initGoogleSheets();
    await exportToGoogleSheets(sheets, autores);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
