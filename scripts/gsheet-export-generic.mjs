#!/usr/bin/env node

/**
 * Script genérico para exportar cualquier collection type desde Strapi a Google Sheets
 * 
 * Uso:
 *   node scripts/gsheet-export-generic.mjs <collection-type> <sheet-name>
 *   node scripts/gsheet-export-generic.mjs api::editorial.editorial Editoriales
 * 
 * O usar el mapeo automático:
 *   node scripts/gsheet-export-generic.mjs Editoriales
 * 
 * Variables de entorno:
 *   STRAPI_URL - URL de Strapi
 *   STRAPI_TOKEN - Token de API
 *   GOOGLE_SHEETS_SPREADSHEET_ID - ID del documento (LECTURA)
 *   GOOGLE_SHEETS_CREDENTIALS_PATH - Ruta a credentials.json
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { getCollectionTypeFromSheetName, getPluralNameFromSheetName, getSheetNameFromCollectionType } from './gsheet-mapeo-collection-types.mjs';

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

/**
 * Obtiene el schema de un collection type para determinar las columnas
 */
async function getCollectionTypeSchema(collectionType) {
  try {
    // Intentar obtener desde la API de Strapi (si está disponible)
    const response = await fetch(`${STRAPI_URL}/api/content-type-builder/content-types/${collectionType}`, {
      headers: HEADERS,
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    // Si falla, continuar sin schema
  }
  
  return null;
}

/**
 * Obtiene todos los registros de un collection type
 */
async function fetchAllRecords(collectionType, pluralName) {
  console.log(`📚 Obteniendo registros de ${collectionType}...`);
  
  const allRecords = [];
  const pageSize = 100;
  let page = 1;
  let totalRecords = null;

  // Determinar el ordenamiento correcto según el collection type
  // Para Editoriales, usar id_editorial:asc para activar el controlador personalizado
  // que maneja correctamente la paginación obteniendo todos los registros de una vez
  let sortField = 'documentId:asc';
  if (collectionType === 'api::editorial.editorial') {
    sortField = 'id_editorial:asc';
  }

  while (true) {
    // NO usar populate=* porque causa duplicados en paginación con relaciones oneToMany/manyToMany
    // Usar populate específico solo para relaciones simples (manyToOne, oneToOne)
    // Las relaciones oneToMany se pueden obtener después si es necesario
    // Usar publicationState=preview para obtener todos los registros (publicados y no publicados)
    // IMPORTANTE: Para Editoriales, usar id_editorial:asc activa el controlador personalizado
    // que obtiene todos los registros de una vez y los ordena numéricamente (ver gsheet-editoriales-export.mjs)
    const url = `${STRAPI_URL}/api/${pluralName}?pagination[page]=${page}&pagination[pageSize]=${pageSize}&pagination[withCount]=true&sort[0]=${sortField}&publicationState=preview`;
    
    const response = await fetch(url, {
      headers: HEADERS,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const records = data.data || [];
    const pagination = data.meta?.pagination;
    
    if (totalRecords === null && pagination?.total) {
      totalRecords = pagination.total;
      console.log(`   📊 Total de registros: ${totalRecords}`);
    }
    
    console.log(`   Página ${page}: ${records.length} registros`);

    if (records.length === 0) {
      break;
    }

    allRecords.push(...records);

    if (pagination && page >= pagination.pageCount) {
      break;
    }

    page++;
  }

  // Filtrar duplicados por documentId (priorizar el primero encontrado)
  const seenDocumentIds = new Set();
  const uniqueRecords = [];
  const duplicates = [];
  
  for (const record of allRecords) {
    const documentId = record.documentId || record.id || '';
    const docIdStr = String(documentId).trim();
    
    if (!docIdStr) {
      // Si no tiene documentId, incluir de todas formas (puede ser un registro nuevo)
      uniqueRecords.push(record);
      continue;
    }
    
    if (seenDocumentIds.has(docIdStr)) {
      duplicates.push({ documentId: docIdStr, nombre: record.nombre_editorial || record.nombre || record.nombre_libro || 'Sin nombre' });
      continue;
    }
    
    seenDocumentIds.add(docIdStr);
    uniqueRecords.push(record);
  }
  
  if (duplicates.length > 0) {
    console.log(`⚠️  Se encontraron ${duplicates.length} registros duplicados (filtrados automáticamente)`);
    
    // Agrupar duplicados por documentId para mostrar resumen
    const dupsPorDocId = {};
    duplicates.forEach(dup => {
      if (!dupsPorDocId[dup.documentId]) dupsPorDocId[dup.documentId] = [];
      dupsPorDocId[dup.documentId].push(dup);
    });
    
    const topDuplicados = Object.entries(dupsPorDocId)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5);
    
    if (topDuplicados.length > 0) {
      console.log(`   Top duplicados:`);
      topDuplicados.forEach(([docId, dups]) => {
        console.log(`   - documentId ${docId}: ${dups.length} duplicados (${dups[0].nombre})`);
      });
    }
    
    console.log(`   Se exportarán solo los primeros encontrados (${uniqueRecords.length} únicos).`);
  }
  
  console.log(`✅ Se encontraron ${uniqueRecords.length} registros únicos (de ${allRecords.length} totales obtenidas)`);
  return uniqueRecords;
}

/**
 * Convierte un registro a fila de hoja de cálculo
 * Extrae todos los campos del registro
 */
function recordToRow(record) {
  const row = [];
  
  // Obtener todos los atributos del registro
  const attributes = record.attributes || record;
  
  // Ordenar campos: primero los principales, luego metadata
  const fieldOrder = [
    // IDs y nombres principales
    'id', 'documentId',
    // Campos comunes
    'nombre', 'nombre_editorial', 'nombre_libro', 'nombre_completo', 'titulo',
    // IDs específicos
    'id_editorial', 'id_coleccion', 'isbn_libro', 'rbd', 'rut',
    // Otros campos comunes
    'acronimo', 'website', 'email', 'telefono', 'descripcion', 'nota',
    // Fechas
    'fecha', 'fecha_creacion', 'fecha_edicion', 'createdAt', 'updatedAt',
    // Estado y acciones
    'estado', 'activo', 'accion',
    // Metadata
    'publishedAt', 'url'
  ];
  
  const allFields = new Set([...fieldOrder, ...Object.keys(attributes)]);
  const orderedFields = [...fieldOrder, ...Array.from(allFields).filter(f => !fieldOrder.includes(f))];
  
  for (const field of orderedFields) {
    if (!attributes.hasOwnProperty(field)) {
      row.push('');
      continue;
    }
    
    const value = attributes[field];
    
    if (value === null || value === undefined) {
      row.push('');
    } else if (typeof value === 'object') {
      // Si es una relación, mostrar el ID o nombre
      if (value.data) {
        if (Array.isArray(value.data)) {
          row.push(value.data.map(item => item.id || item.documentId || item.nombre || item.nombre_editorial || '').join(', '));
        } else {
          row.push(value.data.id || value.data.documentId || value.data.nombre || value.data.nombre_editorial || '');
        }
      } else if (value.id || value.documentId) {
        row.push(value.id || value.documentId);
      } else {
        row.push(JSON.stringify(value).substring(0, 100));
      }
    } else if (value instanceof Date) {
      row.push(value.toISOString());
    } else {
      row.push(String(value));
    }
  }
  
  // Agregar documentId y URL al final si no están
  if (!attributes.documentId && record.documentId) {
    row.push(record.documentId);
  } else if (!attributes.documentId) {
    row.push(record.id || '');
  }
  
  if (!attributes.url) {
    const docId = record.documentId || record.id || '';
    const collectionName = collectionType.split('::')[1].split('.')[0];
    row.push(`http://localhost:1337/admin/content-manager/collection-types/api::${collectionName}.${collectionName}/${docId}`);
  }
  
  return row;
}

/**
 * Obtiene los encabezados de columnas desde los registros
 */
function getHeadersFromRecords(records, collectionType) {
  if (records.length === 0) {
    return ['documentId', 'url'];
  }
  
  const allFields = new Set();
  
  records.forEach(record => {
    const attrs = record.attributes || record;
    Object.keys(attrs).forEach(key => allFields.add(key));
  });
  
  const fieldOrder = [
    'id', 'documentId',
    'nombre', 'nombre_editorial', 'nombre_libro', 'nombre_completo', 'titulo',
    'id_editorial', 'id_coleccion', 'isbn_libro', 'rbd', 'rut',
    'acronimo', 'website', 'email', 'telefono', 'descripcion', 'nota',
    'fecha', 'fecha_creacion', 'fecha_edicion', 'createdAt', 'updatedAt',
    'estado', 'activo', 'accion',
    'publishedAt', 'url'
  ];
  
  const orderedFields = [...fieldOrder, ...Array.from(allFields).filter(f => !fieldOrder.includes(f))];
  
  // Asegurar que documentId y url estén al final
  const finalFields = orderedFields.filter(f => f !== 'documentId' && f !== 'url');
  finalFields.push('documentId', 'url');
  
  return finalFields;
}

/**
 * Inicializa Google Sheets API
 */
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

/**
 * Exporta datos a Google Sheets
 */
async function exportToGoogleSheets(sheets, sheetName, records, collectionType, pluralName) {
  console.log(`📊 Exportando ${records.length} registros a la hoja "${sheetName}"...`);

  if (records.length === 0) {
    console.log('   ⚠️  No hay registros para exportar');
    return;
  }

  const headers = getHeadersFromRecords(records, collectionType);
  const rows = records.map(record => {
    const attrs = record.attributes || record;
    return headers.map(header => {
      if (header === 'url') {
        const docId = record.documentId || record.id || '';
        const collectionName = collectionType.split('::')[1]?.split('.')[0] || pluralName;
        return `http://localhost:1337/admin/content-manager/collection-types/api::${collectionName}.${collectionName}/${docId}`;
      }
      const value = attrs[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        if (value.data) {
          if (Array.isArray(value.data)) {
            return value.data.map(item => item.id || item.documentId || item.nombre || item.nombre_editorial || '').join(', ');
          }
          return value.data.id || value.data.documentId || value.data.nombre || value.data.nombre_editorial || '';
        }
        return JSON.stringify(value).substring(0, 100);
      }
      if (value instanceof Date) return value.toISOString();
      return String(value);
    });
  });

  const values = [headers, ...rows];
  
  console.log(`   ✅ Datos preparados: ${values.length} filas (1 encabezado + ${rows.length} registros)`);
  console.log(`   📝 Columnas: ${headers.length}`);

  try {
    // Obtener información del spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    let sheetId = null;
    const existingSheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    
    if (existingSheet) {
      // La hoja ya existe, solo actualizar los datos (preserva botones y formato)
      sheetId = existingSheet.properties.sheetId;
      console.log(`   📝 Actualizando hoja existente "${sheetName}" (preservando botones y formato)...`);
      
      // Limpiar datos existentes (pero mantener la hoja)
      // Obtener el rango actual de datos
      try {
        const currentData = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:Z`,
        });
        
        if (currentData.data.values && currentData.data.values.length > 0) {
          // Limpiar solo los datos, no la hoja completa
          const lastRow = currentData.data.values.length;
          const lastCol = Math.max(...currentData.data.values.map(row => row.length), headers.length);
          
          // Limpiar el rango de datos
          await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1:${String.fromCharCode(64 + lastCol)}${lastRow}`,
          });
        }
      } catch (error) {
        // Si no hay datos, continuar
        console.log(`   ℹ️  No hay datos previos para limpiar`);
      }
    } else {
      // La hoja no existe, crearla
      console.log(`   📝 Creando nueva hoja "${sheetName}"...`);
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
    }

    // Escribir datos
    console.log(`   📝 Escribiendo ${values.length} filas...`);
    const updateResponse = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });
    console.log(`   ✅ Datos escritos: ${updateResponse.data.updatedCells || 'N/A'} celdas actualizadas`);

    // Formatear encabezado (solo si la hoja es nueva o si no hay botones en la fila 1)
    // Aplicar formato solo a las celdas de datos, no a toda la fila para preservar botones
    const formatRequests = [
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: headers.length, // Solo hasta donde hay columnas de datos
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      },
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: values.length,
              startColumnIndex: 0,
              endColumnIndex: headers.length,
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
    ];
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: formatRequests,
      },
    });

    console.log(`✅ Exportación completada!`);
    console.log(`   ${records.length} registros exportados a la hoja "${sheetName}"`);
  } catch (error) {
    console.error('❌ Error al exportar a Google Sheets:', error.message);
    throw error;
  }
}

async function main() {
  try {
    const sheetName = process.argv[2];
    const collectionTypeArg = process.argv[3];

    if (!sheetName) {
      console.error('❌ Falta el nombre de la hoja');
      console.error('');
      console.error('Uso:');
      console.error('  node scripts/gsheet-export-generic.mjs <nombre-hoja>');
      console.error('  node scripts/gsheet-export-generic.mjs Editoriales');
      console.error('');
      console.error('O con collection type explícito:');
      console.error('  node scripts/gsheet-export-generic.mjs <nombre-hoja> <collection-type>');
      process.exit(1);
    }

    // Determinar collection type y pluralName
    let collectionType = collectionTypeArg;
    let pluralName = null;
    
    if (!collectionType) {
      collectionType = getCollectionTypeFromSheetName(sheetName);
      pluralName = getPluralNameFromSheetName(sheetName);
      if (!collectionType || !pluralName) {
        console.error(`❌ No se encontró mapeo para la hoja "${sheetName}"`);
        console.error('   Agrega el mapeo en scripts/gsheet-mapeo-collection-types.mjs');
        process.exit(1);
      }
    } else {
      // Si se proporciona collectionType explícitamente, necesitamos obtener el pluralName
      const sheetNameFromType = getSheetNameFromCollectionType(collectionType);
      if (sheetNameFromType) {
        pluralName = getPluralNameFromSheetName(sheetNameFromType);
      } else {
        // Fallback: intentar derivar del collectionType
        const parts = collectionType.split('::')[1]?.split('.');
        pluralName = parts ? parts[0] + 's' : null; // Fallback simple
      }
    }

    if (!pluralName) {
      console.error(`❌ No se pudo determinar el pluralName para ${collectionType}`);
      process.exit(1);
    }

    console.log('=== Exportar Collection Type a Google Sheets ===\n');
    console.log(`Hoja: ${sheetName}`);
    console.log(`Collection Type: ${collectionType}`);
    console.log(`Plural Name: ${pluralName}`);
    console.log(`Strapi: ${STRAPI_URL}`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);

    const records = await fetchAllRecords(collectionType, pluralName);
    
    if (records.length === 0) {
      console.log('⚠️  No se encontraron registros para exportar');
      return;
    }

    const sheets = await initGoogleSheets();
    await exportToGoogleSheets(sheets, sheetName, records, collectionType, pluralName);

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

