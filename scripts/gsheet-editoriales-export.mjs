#!/usr/bin/env node

/**
 * Script para exportar editoriales desde Strapi a Google Sheets
 * 
 * Uso:
 *   npm run gsheet:editoriales:export
 * 
 * Variables de entorno:
 *   STRAPI_URL - URL de Strapi (default: http://localhost:1337)
 *   STRAPI_TOKEN - Token de API de Strapi
 *   GOOGLE_SHEETS_SPREADSHEET_ID - ID de la hoja de cálculo
 *   GOOGLE_SHEETS_CREDENTIALS_PATH - Ruta a credentials.json
 *   LIMIT - Número de editoriales a exportar (default: 0 = todos)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

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

const STRAPI_URL = process.env.STRAPI_URL || process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || resolve(__dirname, '..', 'data', 'gsheets', 'credentials.json');
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

if (!SPREADSHEET_ID) {
  console.error('❌ Falta GOOGLE_SHEETS_SPREADSHEET_ID');
  process.exit(1);
}

if (!existsSync(CREDENTIALS_PATH)) {
  console.error(`❌ No se encontró credentials.json en: ${CREDENTIALS_PATH}`);
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

// Columnas que exportaremos
const COLUMNS = [
  'id_editorial',        // ID único (requerido, único)
  'nombre_editorial',    // Nombre (requerido)
  'acronimo',            // Acrónimo
  'website',             // Sitio web
  'accion',              // Acción a realizar (eliminar, publicar, despublicar)
  'fecha_creacion',      // Fecha de creación (read-only)
  'fecha_edicion',       // Fecha de última edición (read-only)
  'documentId',          // ID de Strapi (al final, NO EDITAR)
  'url',                 // URL de acceso rápido a Strapi (al final, NO EDITAR)
];

function columnIndexToLetter(index) {
  let result = '';
  index++;
  while (index > 0) {
    index--;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

async function fetchEditoriales() {
  if (LIMIT > 0) {
    console.log(`📚 Obteniendo ${LIMIT} editoriales desde Strapi...`);
  } else {
    console.log(`📚 Obteniendo TODAS las editoriales desde Strapi...`);
  }
  
  const allEditoriales = [];
  const pageSize = 100;
  let page = 1;
  let totalEditoriales = null;

  while (true) {
    // Usar ordenamiento estable por id_editorial para evitar duplicados en paginación
    const url = `${STRAPI_URL}/api/editoriales?pagination[page]=${page}&pagination[pageSize]=${pageSize}&pagination[withCount]=true&sort[0]=id_editorial:asc&populate=*`;
    
    const response = await fetch(url, {
      headers: HEADERS,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const editoriales = data.data || [];
    const pagination = data.meta?.pagination;
    
    if (totalEditoriales === null && pagination?.total) {
      totalEditoriales = pagination.total;
      if (LIMIT === 0) {
        console.log(`   📊 Total de editoriales en Strapi: ${totalEditoriales}`);
      }
    }
    
    console.log(`   Página ${page}: ${editoriales.length} editoriales (total acumulado: ${allEditoriales.length + editoriales.length}${totalEditoriales ? ` / ${totalEditoriales}` : ''})`);

    if (editoriales.length === 0) {
      break;
    }

    allEditoriales.push(...editoriales);

    if (LIMIT > 0 && allEditoriales.length >= LIMIT) {
      allEditoriales.splice(LIMIT);
      break;
    }

    if (pagination && page >= pagination.pageCount) {
      break;
    }

    page++;
  }

  // Filtrar duplicados por documentId e id_editorial
  const seenDocumentIds = new Set();
  const seenIds = new Set();
  const uniqueEditoriales = [];
  const duplicates = [];
  
  for (const editorial of allEditoriales) {
    const documentId = (editorial.documentId || '').toString().trim();
    const id = (editorial.id || '').toString().trim();
    const idEditorial = (editorial.id_editorial || '').toString().trim();
    const nombre = editorial.nombre_editorial || 'Sin nombre';
    
    // Priorizar documentId sobre id
    if (documentId && seenDocumentIds.has(documentId)) {
      duplicates.push({ tipo: 'documentId', id: documentId, idEditorial, nombre });
      continue;
    }
    
    // Solo verificar id_editorial si no hay documentId
    if (!documentId && idEditorial && seenIds.has(idEditorial)) {
      duplicates.push({ tipo: 'id_editorial', id: idEditorial, documentId, nombre });
      continue;
    }
    
    // Si no tiene documentId ni id_editorial, verificar por id interno
    if (!documentId && !idEditorial && id && seenIds.has(id)) {
      duplicates.push({ tipo: 'id', id: id, nombre });
      continue;
    }
    
    if (documentId) seenDocumentIds.add(documentId);
    if (idEditorial) seenIds.add(idEditorial);
    if (id) seenIds.add(id);
    uniqueEditoriales.push(editorial);
  }
  
  if (duplicates.length > 0) {
    console.warn(`\n⚠️  Se encontraron ${duplicates.length} editoriales duplicadas (filtradas automáticamente)`);
    
    // Agrupar duplicados por tipo para entender mejor el problema
    const dupsPorTipo = {};
    duplicates.forEach(dup => {
      if (!dupsPorTipo[dup.tipo]) dupsPorTipo[dup.tipo] = [];
      dupsPorTipo[dup.tipo].push(dup);
    });
    
    Object.keys(dupsPorTipo).forEach(tipo => {
      console.warn(`   - ${dupsPorTipo[tipo].length} duplicados por ${tipo}`);
      if (dupsPorTipo[tipo].length <= 10) {
        dupsPorTipo[tipo].forEach(dup => {
          console.warn(`     "${dup.id}" (${dup.nombre || 'Sin nombre'})`);
        });
      } else {
        dupsPorTipo[tipo].slice(0, 5).forEach(dup => {
          console.warn(`     "${dup.id}" (${dup.nombre || 'Sin nombre'})`);
        });
        console.warn(`     ... y ${dupsPorTipo[tipo].length - 5} más`);
      }
    });
    
    console.warn(`   Se exportarán solo los primeros encontrados (${uniqueEditoriales.length} únicos).\n`);
  }
  
  console.log(`✅ Se encontraron ${uniqueEditoriales.length} editoriales únicas (de ${allEditoriales.length} totales obtenidas)`);
  
  // Ordenar por fecha_edicion descendente (más recientes primero)
  uniqueEditoriales.sort((a, b) => {
    const getUpdatedAt = (item) => {
      if (item.updatedAt) return item.updatedAt;
      if (item.attributes?.updatedAt) return item.attributes.updatedAt;
      if (item.updated_at) return item.updated_at;
      return '';
    };
    
    const dateA = getUpdatedAt(a);
    const dateB = getUpdatedAt(b);
    
    if (dateA && dateB) {
      const timeA = new Date(dateA).getTime();
      const timeB = new Date(dateB).getTime();
      if (isNaN(timeA) || isNaN(timeB)) {
        const idA = a.id_editorial || a.id || 0;
        const idB = b.id_editorial || b.id || 0;
        return idB - idA;
      }
      const diff = timeB - timeA;
      if (Math.abs(diff) < 1000) {
        const idA = a.id_editorial || a.id || 0;
        const idB = b.id_editorial || b.id || 0;
        return idB - idA;
      }
      return diff;
    }
    
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    
    const idA = a.id_editorial || a.id || 0;
    const idB = b.id_editorial || b.id || 0;
    return idB - idA;
  });
  
  console.log(`   📅 Ordenadas por fecha_edicion descendente (más recientes primero)`);
  
  if (uniqueEditoriales.length > 0) {
    const getUpdatedAt = (item) => item.updatedAt || item.attributes?.updatedAt || item.updated_at || '';
    const primeras3 = uniqueEditoriales.slice(0, 3).map(e => {
      const fecha = getUpdatedAt(e);
      return fecha ? new Date(fecha).toISOString().substring(0, 19) : 'Sin fecha';
    });
    console.log(`   🔍 Primeras 3 fechas: ${primeras3.join(', ')}`);
  }
  
  return uniqueEditoriales;
}

function editorialToRow(editorial) {
  const getField = (field) => editorial[field] || '';
  
  const getFechaCreacion = () => {
    const createdAt = editorial.createdAt || editorial.attributes?.createdAt || '';
    if (!createdAt) return '';
    if (typeof createdAt === 'string') {
      if (createdAt.includes('T')) return createdAt;
      if (createdAt.match(/^\d{4}-\d{2}-\d{2}$/)) return `${createdAt}T00:00:00.000Z`;
      return createdAt;
    }
    if (createdAt instanceof Date) return createdAt.toISOString();
    return '';
  };
  
  const getFechaEdicion = () => {
    const updatedAt = editorial.updatedAt || editorial.attributes?.updatedAt || '';
    if (!updatedAt) return '';
    if (typeof updatedAt === 'string') {
      if (updatedAt.includes('T')) return updatedAt;
      if (updatedAt.match(/^\d{4}-\d{2}-\d{2}$/)) return `${updatedAt}T00:00:00.000Z`;
      return updatedAt;
    }
    if (updatedAt instanceof Date) return updatedAt.toISOString();
    return '';
  };
  
  const documentId = editorial.documentId || editorial.id || '';
  const url = `http://localhost:1337/admin/content-manager/collection-types/api::editorial.editorial/${documentId}`;
  
  return [
    getField('id_editorial'),
    getField('nombre_editorial'),
    getField('acronimo') || '',
    getField('website') || '',
    '', // accion - vacío por defecto
    getFechaCreacion(),
    getFechaEdicion(),
    documentId,
    url,
  ];
}

async function initGoogleSheets() {
  console.log('🔐 Autenticando con Google Sheets API...');
  
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  return sheets;
}

async function exportToGoogleSheets(sheets, editoriales) {
  console.log(`📊 Exportando ${editoriales.length} editoriales a Google Sheets...`);

  const rows = editoriales.map(editorialToRow);
  const values = [
    COLUMNS,
    ...rows,
  ];
  
  console.log(`   ✅ Datos preparados: ${values.length} filas (1 encabezado + ${rows.length} editoriales)`);
  if (rows.length > 0) {
    console.log(`   📝 Primera fila de datos: ${rows[0].slice(0, 3).join(', ')}...`);
  }

  const sheetName = 'Editoriales';
  
  try {
    let sheetId = null;
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      
      const existingSheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (existingSheet) {
        console.log(`   🗑️  Eliminando hoja "${sheetName}" existente...`);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              deleteSheet: {
                sheetId: existingSheet.properties.sheetId,
              },
            }],
          },
        });
        console.log(`   ✅ Hoja "${sheetName}" eliminada`);
      }
    } catch (error) {
      console.warn(`   ⚠️  Error al eliminar hoja existente: ${error.message}`);
    }
    
    try {
      console.log(`   📝 Creando hoja "${sheetName}" limpia...`);
      const createResponse = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
                hidden: false,
              },
            },
          }],
        },
      });
      sheetId = createResponse.data.replies[0].addSheet.properties.sheetId;
      console.log(`   ✅ Hoja "${sheetName}" creada`);
    } catch (error) {
      console.warn(`   ⚠️  Error al crear hoja: ${error.message}`);
      throw error;
    }

    console.log(`   📝 Escribiendo ${values.length} filas en la hoja "${sheetName}"...`);
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });
    console.log(`   ✅ Datos escritos: ${updateResponse.data.updatedCells || 'N/A'} celdas actualizadas`);

    const totalRows = values.length;
    if (sheetId !== null) {
      const soloLecturaColumns = [
        COLUMNS.indexOf('fecha_creacion'),
        COLUMNS.indexOf('fecha_edicion'),
        COLUMNS.indexOf('documentId'),
        COLUMNS.indexOf('url'),
      ].filter(idx => idx !== -1);
      
      const accionColIndex = COLUMNS.indexOf('accion');
      
      const requests = [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
                backgroundColor: {
                  red: 0.9,
                  green: 0.9,
                  blue: 0.9,
                },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        ...soloLecturaColumns.map(colIndex => ({
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: colIndex,
              endColumnIndex: colIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: {
                  red: 1.0,
                  green: 0.95,
                  blue: 0.8,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor)',
          },
        })),
        {
          setBasicFilter: {
            filter: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: totalRows,
                startColumnIndex: 0,
                endColumnIndex: COLUMNS.length,
              },
            },
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId: sheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // Formato especial para columna "accion"
        ...(accionColIndex !== -1 ? [{
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: accionColIndex,
              endColumnIndex: accionColIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.95, blue: 1.0 },
                textFormat: { italic: true, fontSize: 9 },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        }] : []),
      ];
      
      // Añadir validación de datos (dropdown) para la columna "accion"
      if (accionColIndex !== -1) {
        requests.push({
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1,
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
              strict: false,
            },
          },
        });
      }
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests,
        },
      });
      
      // Auto-ajustar columnas
      const dimensionRequests = [];
      for (let i = 0; i < COLUMNS.length; i++) {
        if (!['fecha_creacion', 'fecha_edicion', 'documentId', 'url'].includes(COLUMNS[i])) {
          dimensionRequests.push({
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: i,
                endIndex: i + 1,
              },
            },
          });
        } else {
          const titulo = COLUMNS[i];
          const ancho = Math.max(100, titulo.length * 8);
          dimensionRequests.push({
            updateDimensionProperties: {
              range: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: i,
                endIndex: i + 1,
              },
              properties: {
                pixelSize: ancho,
              },
              fields: 'pixelSize',
            },
          });
        }
      }
      
      if (dimensionRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: dimensionRequests,
          },
        });
      }
      
      // Formato condicional para id_editorial duplicados
      const idColumnIndex = COLUMNS.indexOf('id_editorial');
      if (idColumnIndex !== -1) {
        const idColumnLetter = columnIndexToLetter(idColumnIndex);
        const conditionalFormatRequest = {
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: totalRows,
                startColumnIndex: idColumnIndex,
                endColumnIndex: idColumnIndex + 1,
              }],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{
                    userEnteredValue: `=SUMPRODUCT(--($${idColumnLetter}$2:$${idColumnLetter}$${totalRows}=${idColumnLetter}2))>1`,
                  }],
                },
                format: {
                  backgroundColor: {
                    red: 1.0,
                    green: 0.85,
                    blue: 0.85,
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 0.7,
                      green: 0.1,
                      blue: 0.1,
                    },
                    bold: true,
                  },
                },
              },
            },
            index: 0,
          },
        };
        
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [conditionalFormatRequest],
          },
        });
      }
    }

    console.log(`✅ Exportación completada!`);
    console.log(`   ${editoriales.length} editoriales exportadas a la hoja "${sheetName}"`);
    console.log(`   URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
  } catch (error) {
    console.error('❌ Error al exportar a Google Sheets:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('=== Exportar Editoriales a Google Sheets ===\n');
    console.log(`Strapi: ${STRAPI_URL}`);
    console.log(`Límite: ${LIMIT === 0 ? 'TODAS' : LIMIT} editoriales`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);

    const editoriales = await fetchEditoriales();
    
    if (editoriales.length === 0) {
      console.log('⚠️  No se encontraron editoriales para exportar');
      return;
    }

    console.log(`✅ Se encontraron ${editoriales.length} editoriales\n`);

    const sheets = await initGoogleSheets();
    await exportToGoogleSheets(sheets, editoriales);

    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

