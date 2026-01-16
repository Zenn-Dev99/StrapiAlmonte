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
  'id_coleccion',
  'nombre_coleccion',
  'documentId_editorial',
  'nombre_editorial',
  'documentId_sello',
  'nombre_sello',
  'accion',
  'fecha_creacion',
  'fecha_edicion',
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

async function fetchColecciones() {
  console.log(LIMIT > 0 ? `📚 Obteniendo ${LIMIT} colecciones...` : `📚 Obteniendo TODAS las colecciones...`);
  const allColecciones = [];
  let page = 1, totalColecciones = null;
  while (true) {
    const url = `${STRAPI_URL}/api/colecciones?pagination[page]=${page}&pagination[pageSize]=100&pagination[withCount]=true&sort[0]=updatedAt:desc&populate=*`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    const colecciones = data.data || [];
    const pagination = data.meta?.pagination;
    if (totalColecciones === null && pagination?.total) {
      totalColecciones = pagination.total;
      if (LIMIT === 0) console.log(`   📊 Total: ${totalColecciones}`);
    }
    console.log(`   Página ${page}: ${colecciones.length} colecciones (total: ${allColecciones.length + colecciones.length}${totalColecciones ? ` / ${totalColecciones}` : ''})`);
    if (colecciones.length === 0) break;
    allColecciones.push(...colecciones);
    if (LIMIT > 0 && allColecciones.length >= LIMIT) { allColecciones.splice(LIMIT); break; }
    if (pagination && page >= pagination.pageCount) break;
    page++;
  }
  // Filtrar duplicados por documentId e id
  const seenDocumentIds = new Set();
  const seenIds = new Set();
  const unique = [];
  const duplicates = [];
  
  for (const coleccion of allColecciones) {
    const docId = (coleccion.documentId || '').toString().trim();
    const id = (coleccion.id || '').toString().trim();
    const nombre = coleccion.nombre_coleccion || 'Sin nombre';
    
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
    unique.push(coleccion);
  }
  
  if (duplicates.length > 0) {
    console.warn(`\n⚠️  Se encontraron ${duplicates.length} colecciones duplicadas (filtradas automáticamente)`);
    duplicates.slice(0, 5).forEach(dup => {
      console.warn(`   - Duplicado por ${dup.tipo}: "${dup.id}" (Nombre: ${dup.nombre})`);
    });
    if (duplicates.length > 5) {
      console.warn(`   ... y ${duplicates.length - 5} duplicados más`);
    }
    console.warn(`   Se exportarán solo los primeros encontrados (${unique.length} únicos).\n`);
  }
  
  console.log(`✅ Se encontraron ${unique.length} colecciones únicas (de ${allColecciones.length} totales obtenidas)`);
  
  // Ordenar por fecha_edicion descendente (más recientes primero)
  // Asegurar que el ordenamiento se aplique correctamente después de filtrar duplicados
  unique.sort((a, b) => {
    // Obtener updatedAt de diferentes formas posibles
    const getUpdatedAt = (item) => {
      if (item.updatedAt) return item.updatedAt;
      if (item.attributes?.updatedAt) return item.attributes.updatedAt;
      if (item.updated_at) return item.updated_at;
      return '';
    };
    
    const dateA = getUpdatedAt(a);
    const dateB = getUpdatedAt(b);
    
    // Si ambas tienen fecha, comparar
    if (dateA && dateB) {
      const timeA = new Date(dateA).getTime();
      const timeB = new Date(dateB).getTime();
      if (isNaN(timeA) || isNaN(timeB)) {
        // Si alguna fecha es inválida, usar ordenamiento secundario
        const idA = a.id_coleccion || a.id || 0;
        const idB = b.id_coleccion || b.id || 0;
        return idB - idA; // Descendente por ID
      }
      const diff = timeB - timeA; // Descendente (más reciente primero)
      // Si las fechas son iguales (o muy cercanas), usar ordenamiento secundario por ID
      if (Math.abs(diff) < 1000) { // Menos de 1 segundo de diferencia
        const idA = a.id_coleccion || a.id || 0;
        const idB = b.id_coleccion || b.id || 0;
        return idB - idA; // Descendente por ID como desempate
      }
      return diff;
    }
    
    // Si solo una tiene fecha, la que tiene fecha va primero
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    
    // Si ninguna tiene fecha, ordenar por ID descendente
    const idA = a.id_coleccion || a.id || 0;
    const idB = b.id_coleccion || b.id || 0;
    return idB - idA;
  });
  
  console.log(`   📅 Ordenadas por fecha_edicion descendente (más recientes primero)`);
  
  // Verificar que el ordenamiento funcionó (mostrar las primeras 3 fechas)
  if (unique.length > 0) {
    const getUpdatedAt = (item) => item.updatedAt || item.attributes?.updatedAt || item.updated_at || '';
    const primeras3 = unique.slice(0, 3).map(c => {
      const fecha = getUpdatedAt(c);
      return fecha ? new Date(fecha).toISOString().substring(0, 19) : 'Sin fecha';
    });
    console.log(`   🔍 Primeras 3 fechas: ${primeras3.join(', ')}`);
  }
  
  return unique;
}

function coleccionToRow(coleccion) {
  const getField = (f) => coleccion[f] || '';
  const getRelDocumentId = (r) => r ? (r.documentId || '') : '';
  const getRelName = (r) => r ? (r.nombre_editorial || r.nombre_sello || '') : '';
  
  // Función helper para obtener fecha de creación
  const getFechaCreacion = () => {
    const createdAt = coleccion.createdAt || coleccion.attributes?.createdAt || '';
    if (!createdAt) return '';
    if (typeof createdAt === 'string') {
      if (createdAt.includes('T')) return createdAt;
      if (createdAt.match(/^\d{4}-\d{2}-\d{2}$/)) return `${createdAt}T00:00:00.000Z`;
      return createdAt;
    }
    if (createdAt instanceof Date) return createdAt.toISOString();
    return '';
  };
  
  // Función helper para obtener fecha de edición
  const getFechaEdicion = () => {
    const updatedAt = coleccion.updatedAt || coleccion.attributes?.updatedAt || '';
    if (!updatedAt) return '';
    if (typeof updatedAt === 'string') {
      if (updatedAt.includes('T')) return updatedAt;
      if (updatedAt.match(/^\d{4}-\d{2}-\d{2}$/)) return `${updatedAt}T00:00:00.000Z`;
      return updatedAt;
    }
    if (updatedAt instanceof Date) return updatedAt.toISOString();
    return '';
  };
  
  const docId = coleccion.documentId || coleccion.id || '';
  const url = `http://localhost:1337/admin/content-manager/collection-types/api::coleccion.coleccion/${docId}`;
  return [
    getField('id_coleccion'),
    getField('nombre_coleccion'),
    getRelDocumentId(coleccion.editorial),
    getRelName(coleccion.editorial),
    getRelDocumentId(coleccion.sello),
    getRelName(coleccion.sello),
    '', // accion - vacío por defecto, el usuario puede marcar "eliminar" o "delete"
    getFechaCreacion(),
    getFechaEdicion(),
    docId,
    url,
  ];
}

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function exportToGoogleSheets(sheets, colecciones) {
  console.log(`📊 Exportando ${colecciones.length} colecciones...`);
  const rows = colecciones.map(coleccionToRow);
  const values = [COLUMNS, ...rows];
  console.log(`   ✅ ${values.length} filas preparadas`);
  const sheetName = 'Colecciones';
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
      const soloLectura = [COLUMNS.indexOf('nombre_editorial'), COLUMNS.indexOf('nombre_sello'), COLUMNS.indexOf('fecha_creacion'), COLUMNS.indexOf('fecha_edicion'), COLUMNS.indexOf('documentId'), COLUMNS.indexOf('url')].filter(i => i !== -1);
  const accionColIndex = COLUMNS.indexOf('accion');
  const requests = [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } }, fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
    ...soloLectura.map(ci => ({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: ci, endColumnIndex: ci + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 0.95, blue: 0.8 } } }, fields: 'userEnteredFormat(backgroundColor)' } })),
    // Formato especial para columna "accion" (azul claro, texto pequeño)
    ...(accionColIndex !== -1 ? [{ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: accionColIndex, endColumnIndex: accionColIndex + 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.9, green: 0.95, blue: 1.0 }, textFormat: { italic: true, fontSize: 9 } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } }] : []),
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: totalRows, startColumnIndex: 0, endColumnIndex: COLUMNS.length } } } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
  ];
  // Añadir validación de datos (dropdown) para la columna "accion"
  if (accionColIndex !== -1) {
    requests.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1, // Empezar desde la fila 2 (después del encabezado)
          endRowIndex: totalRows,
          startColumnIndex: accionColIndex,
          endColumnIndex: accionColIndex + 1,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: [
              { userEnteredValue: '' },
              { userEnteredValue: 'eliminar' },
              { userEnteredValue: 'publicar' },
              { userEnteredValue: 'despublicar' },
            ],
          },
          showCustomUi: true,
          strict: false, // Permitir valores que no estén en la lista (por si acaso)
        },
      },
    });
  }
  
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
      for (let i = 0; i < COLUMNS.length; i++) {
        if (!['fecha_creacion', 'fecha_edicion', 'documentId', 'url'].includes(COLUMNS[i])) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 } } }] } });
    } else {
      const ancho = Math.max(100, COLUMNS[i].length * 8);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: ancho }, fields: 'pixelSize' } }] } });
    }
  }
  const idCol = COLUMNS.indexOf('id_coleccion');
  if (idCol !== -1) {
    const letter = columnIndexToLetter(idCol);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addConditionalFormatRule: { rule: { ranges: [{ sheetId, startRowIndex: 1, endRowIndex: totalRows, startColumnIndex: idCol, endColumnIndex: idCol + 1 }], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=SUMPRODUCT(--($${letter}$2:$${letter}$${totalRows}=${letter}2))>1` }] }, format: { backgroundColor: { red: 1.0, green: 0.85, blue: 0.85 }, textFormat: { foregroundColor: { red: 0.7, green: 0.1, blue: 0.1 }, bold: true } } } }, index: 0 } }] } });
  }
  console.log(`✅ ${colecciones.length} colecciones exportadas`);
  console.log(`   URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
}

async function main() {
  try {
    console.log('=== Exportar Colecciones a Google Sheets ===\n');
    console.log(`Strapi: ${STRAPI_URL}\n`);
    const colecciones = await fetchColecciones();
    if (colecciones.length === 0) { console.log('⚠️  No hay colecciones'); return; }
    const sheets = await initGoogleSheets();
    await exportToGoogleSheets(sheets, colecciones);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
