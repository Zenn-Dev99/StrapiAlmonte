/**
 * Script de Google Apps Script - LECTURA DIRECTA
 * 
 * Este script llama DIRECTAMENTE a la API de Strapi y escribe en Google Sheets
 * NO requiere endpoint intermedio en Strapi
 * 
 * INSTRUCCIONES:
 * 1. Abre tu Google Sheet de LECTURA
 * 2. Ve a Extensiones > Apps Script
 * 3. Reemplaza TODO el código con este
 * 4. Configura STRAPI_URL y STRAPI_TOKEN
 * 5. Guarda el proyecto
 * 6. Usa el menú "🔄 Strapi Sync" para actualizar las hojas
 */

// ============================================
// CONFIGURACIÓN
// ============================================

const STRAPI_URL = 'https://strapi.moraleja.cl'; // URL de Strapi
const STRAPI_TOKEN = 'TU_TOKEN_DE_PRODUCCION_AQUI'; // ⚠️ Reemplaza con tu token

// Mapeo de nombres de hojas a collection types y plural names
const MAPEO_HOJA_A_COLLECTION_TYPE = {
  'Editoriales': { uid: 'api::editorial.editorial', pluralName: 'editoriales' },
  'Libros': { uid: 'api::libro.libro', pluralName: 'libros' },
  'Autores': { uid: 'api::autor.autor', pluralName: 'autores' },
  'Obras': { uid: 'api::obra.obra', pluralName: 'obras' },
  'Colecciones': { uid: 'api::coleccion.coleccion', pluralName: 'colecciones' },
  'Sellos': { uid: 'api::sello.sello', pluralName: 'sellos' },
  'Colegios': { uid: 'api::colegio.colegio', pluralName: 'colegios' },
  'Niveles': { uid: 'api::nivel.nivel', pluralName: 'niveles' },
  'Cursos': { uid: 'api::curso.curso', pluralName: 'cursos' },
  'Asignaturas': { uid: 'api::asignatura.asignatura', pluralName: 'asignaturas' },
  'Personas': { uid: 'api::persona.persona', pluralName: 'personas' },
  'Clientes': { uid: 'api::customer.customer', pluralName: 'customers' },
  // Agregar más según sea necesario
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtiene todos los registros de Strapi con paginación
 */
function fetchAllRecordsFromStrapi(pluralName) {
  const allRecords = [];
  const pageSize = 100;
  let page = 1;
  let totalRecords = null;
  
  // Determinar el ordenamiento específico para Editoriales
  let sortParam = 'sort[0]=documentId:asc';
  if (pluralName === 'editoriales') {
    sortParam = 'sort[0]=id_editorial:asc'; // Activa el controlador personalizado
  }
  
  while (true) {
    const url = `${STRAPI_URL}/api/${pluralName}?pagination[page]=${page}&pagination[pageSize]=${pageSize}&pagination[withCount]=true&${sortParam}&publicationState=preview`;
    
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${STRAPI_TOKEN}`,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true
      });
      
      const statusCode = response.getResponseCode();
      if (statusCode !== 200) {
        const errorText = response.getContentText();
        throw new Error(`Error ${statusCode}: ${errorText}`);
      }
      
      const data = JSON.parse(response.getContentText());
      const records = data.data || [];
      const pagination = data.meta?.pagination;
      
      if (totalRecords === null && pagination?.total) {
        totalRecords = pagination.total;
        console.log(`Total de registros: ${totalRecords}`);
      }
      
      console.log(`Página ${page}: ${records.length} registros`);
      
      if (records.length === 0) {
        break;
      }
      
      allRecords.push(...records);
      
      if (pagination && page >= pagination.pageCount) {
        break;
      }
      
      page++;
    } catch (error) {
      console.error(`Error en página ${page}:`, error);
      throw error;
    }
  }
  
  // Filtrar duplicados por documentId
  const seenDocumentIds = new Set();
  const uniqueRecords = [];
  
  for (const record of allRecords) {
    const documentId = record.documentId || record.id || '';
    const docIdStr = String(documentId).trim();
    
    if (!docIdStr || !seenDocumentIds.has(docIdStr)) {
      if (docIdStr) {
        seenDocumentIds.add(docIdStr);
      }
      uniqueRecords.push(record);
    }
  }
  
  console.log(`Registros únicos: ${uniqueRecords.length} (de ${allRecords.length} totales)`);
  return uniqueRecords;
}

/**
 * Aplana un objeto anidado para convertirlo en fila de hoja
 */
function flattenRecord(record) {
  const flattened = {};
  
  function flatten(obj, prefix = '') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value === null || value === undefined) {
          flattened[newKey] = '';
        } else if (Array.isArray(value)) {
          flattened[newKey] = value.map(item => {
            if (typeof item === 'object' && item !== null) {
              if (item.id) return item.id;
              if (item.attributes) return item.attributes.nombre || item.attributes.nombre_editorial || item.attributes.nombre_libro || item.id || '';
              return JSON.stringify(item);
            }
            return String(item);
          }).join(', ');
        } else if (typeof value === 'object') {
          if (value.data) {
            // Relación Strapi
            if (Array.isArray(value.data)) {
              flattened[newKey] = value.data.map(item => {
                if (item.attributes) {
                  return item.attributes.nombre || item.attributes.nombre_editorial || item.attributes.nombre_libro || item.id || '';
                }
                return item.id || '';
              }).join(', ');
            } else if (value.data.attributes) {
              flattened[newKey] = value.data.attributes.nombre || value.data.attributes.nombre_editorial || value.data.attributes.nombre_libro || value.data.id || '';
            } else {
              flattened[newKey] = value.data.id || '';
            }
          } else if (value.id) {
            flattened[newKey] = value.id;
          } else {
            flatten(value, newKey);
          }
        } else {
          flattened[newKey] = value;
        }
      }
    }
  }
  
  // Procesar attributes si existe (formato Strapi v4)
  if (record.attributes) {
    flattened.id = record.id || record.documentId || '';
    flatten(record.attributes);
  } else {
    flattened.id = record.id || record.documentId || '';
    flatten(record);
  }
  
  return flattened;
}

/**
 * Obtiene todas las columnas únicas de los registros
 */
function getAllColumns(records) {
  const columns = new Set();
  records.forEach(record => {
    const flat = flattenRecord(record);
    Object.keys(flat).forEach(key => columns.add(key));
  });
  return Array.from(columns).sort();
}

/**
 * Escribe los datos en la hoja
 */
function writeDataToSheet(sheet, records) {
  if (records.length === 0) {
    sheet.clear();
    return;
  }
  
  // Obtener columnas
  const columns = getAllColumns(records);
  
  // Crear matriz de datos
  const data = [columns]; // Header
  
  records.forEach(record => {
    const flat = flattenRecord(record);
    const row = columns.map(col => {
      const value = flat[col];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
    data.push(row);
  });
  
  // Limpiar hoja y escribir datos
  sheet.clear();
  if (data.length > 0) {
    const range = sheet.getRange(1, 1, data.length, columns.length);
    range.setValues(data);
    
    // Formatear header
    const headerRange = sheet.getRange(1, 1, 1, columns.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
    headerRange.setFrozenRows(1);
  }
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Actualiza la hoja actual desde Strapi
 */
function actualizarHojaActual() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const nombreHoja = sheet.getName();
  
  const collectionInfo = MAPEO_HOJA_A_COLLECTION_TYPE[nombreHoja];
  if (!collectionInfo) {
    SpreadsheetApp.getUi().alert(
      '❌ Hoja no reconocida: ' + nombreHoja + '\n\n' +
      'Agrega el mapeo en MAPEO_HOJA_A_COLLECTION_TYPE del script.'
    );
    return;
  }
  
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('🔄 Obteniendo datos de Strapi...', 'Procesando', 2);
    
    // Obtener datos de Strapi
    const records = fetchAllRecordsFromStrapi(collectionInfo.pluralName);
    
    SpreadsheetApp.getActiveSpreadsheet().toast('📝 Escribiendo en la hoja...', 'Procesando', 2);
    
    // Escribir en la hoja
    writeDataToSheet(sheet, records);
    
    SpreadsheetApp.getUi().alert(
      '✅ Actualización completada\n\n' +
      `Se importaron ${records.length} registros de "${nombreHoja}"`
    );
    SpreadsheetApp.getActiveSpreadsheet().toast('✅ Actualización completada', 'Éxito', 3);
    
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Error al actualizar:\n\n' + error.toString() + '\n\n' +
      'Verifica que:\n' +
      '1. STRAPI_URL y STRAPI_TOKEN estén configurados correctamente\n' +
      '2. El token tenga permisos de lectura\n' +
      '3. Strapi esté accesible'
    );
  }
}

/**
 * Actualiza TODAS las hojas del documento
 */
function actualizarTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const todasLasHojas = spreadsheet.getSheets();
  
  const hojasConMapeo = [];
  todasLasHojas.forEach(function(sheet) {
    const nombreHoja = sheet.getName();
    if (MAPEO_HOJA_A_COLLECTION_TYPE[nombreHoja]) {
      hojasConMapeo.push(nombreHoja);
    }
  });
  
  if (hojasConMapeo.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ No se encontraron hojas con mapeo configurado.');
    return;
  }
  
  const confirmacion = SpreadsheetApp.getUi().alert(
    '¿Actualizar ' + hojasConMapeo.length + ' hoja(s) desde Strapi?\n\n' +
    'Hojas: ' + hojasConMapeo.join(', '),
    SpreadsheetApp.getUi().ButtonSet.YES_NO
  );
  
  if (confirmacion !== SpreadsheetApp.getUi().Button.YES) {
    return;
  }
  
  let exitosas = 0;
  let fallidas = 0;
  const errores = [];
  
  hojasConMapeo.forEach(function(nombreHoja, index) {
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Actualizando ' + (index + 1) + '/' + hojasConMapeo.length + ': ' + nombreHoja,
        'Procesando',
        1
      );
      
      const sheet = spreadsheet.getSheetByName(nombreHoja);
      const collectionInfo = MAPEO_HOJA_A_COLLECTION_TYPE[nombreHoja];
      
      const records = fetchAllRecordsFromStrapi(collectionInfo.pluralName);
      writeDataToSheet(sheet, records);
      
      exitosas++;
      Utilities.sleep(500); // Pequeño delay entre actualizaciones
      
    } catch (error) {
      fallidas++;
      errores.push(nombreHoja + ': ' + error.toString());
    }
  });
  
  // Mostrar resultado final
  let mensaje = '✅ Actualización completada\n\n';
  mensaje += 'Exitosas: ' + exitosas + '\n';
  mensaje += 'Fallidas: ' + fallidas;
  
  if (errores.length > 0) {
    mensaje += '\n\nErrores:\n' + errores.slice(0, 5).join('\n');
    if (errores.length > 5) {
      mensaje += '\n... y ' + (errores.length - 5) + ' más';
    }
  }
  
  SpreadsheetApp.getUi().alert(mensaje);
  SpreadsheetApp.getActiveSpreadsheet().toast('Actualización completada', 'Éxito', 3);
}

// ============================================
// MENÚ AUTOMÁTICO
// ============================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 Strapi Sync')
    .addItem('📖 Actualizar Hoja Actual', 'actualizarHojaActual')
    .addSeparator()
    .addItem('📚 Actualizar Todas las Hojas', 'actualizarTodasLasHojas')
    .addToUi();
}

