/**
 * Template de Google Apps Script para botones en Google Sheets
 * 
 * INSTRUCCIONES:
 * 1. Abre tu Google Sheet
 * 2. Ve a Extensiones > Apps Script
 * 3. Pega este código
 * 4. Configura las variables STRAPI_URL y STRAPI_TOKEN
 * 5. Guarda el proyecto
 * 6. En cada hoja, inserta un botón que llame a la función correspondiente
 * 
 * FUNCIONES DISPONIBLES:
 * - actualizarDesdeStrapi() - Para documento de LECTURA
 * - cargarNuevosRegistros() - Para documento de CREACIÓN
 * - actualizarRegistros() - Para documento de EDICIÓN
 */

// ============================================
// CONFIGURACIÓN
// ============================================

// Para desarrollo local, usa: 'http://localhost:1337'
// Para producción, usa: 'https://strapi.moraleja.cl'
const STRAPI_URL = 'https://strapi.moraleja.cl'; // URL de Strapi (producción)
const STRAPI_TOKEN = '078bb83e2dd38e5e5bd2a5f3ae52eb8fe8c3ab952eb782564d1523d03163e4f4394ff223c52e1188dbafa462d06d78e54c1eadb0323ea121d7400ae040fe511272b128cb8da4540ae60468e05e1891c8ae515670ccf75ded20f423e7117e0815e1ddff72baf550f85a713b47ddac0e505778a9216b9014e6c7147d9a34e72ec3'; // Token de API

// Mapeo de nombres de hojas a collection types
const MAPEO_HOJA_A_COLLECTION_TYPE = {
  'Editoriales': 'api::editorial.editorial',
  'Libros': 'api::libro.libro',
  'Autores': 'api::autor.autor',
  'Obras': 'api::obra.obra',
  'Colecciones': 'api::coleccion.coleccion',
  'Sellos': 'api::sello.sello',
  'Colegios': 'api::colegio.colegio',
  'Niveles': 'api::nivel.nivel',
  'Cursos': 'api::curso.curso',
  'Asignaturas': 'api::asignatura.asignatura',
  'Personas': 'api::persona.persona',
  'Clientes': 'api::customer.customer',
  // Agregar más mapeos según sea necesario
};

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Actualiza la hoja actual desde Strapi (para documento de LECTURA)
 * Ejecuta automáticamente el script de exportación en el servidor
 */
function actualizarDesdeStrapi() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const nombreHoja = sheet.getName();
  
  const collectionType = MAPEO_HOJA_A_COLLECTION_TYPE[nombreHoja];
  if (!collectionType) {
    SpreadsheetApp.getUi().alert(
      '❌ Hoja no reconocida: ' + nombreHoja + '\n\n' +
      'Agrega el mapeo en el script de Apps Script.'
    );
    return;
  }
  
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  
  try {
    // Mostrar mensaje de progreso
    SpreadsheetApp.getActiveSpreadsheet().toast('🔄 Actualizando desde Strapi...', 'Procesando', 2);
    
    // Llamar al endpoint de Strapi que ejecuta el script
    const response = UrlFetchApp.fetch(STRAPI_URL + '/api/gsheet/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + STRAPI_TOKEN
      },
      payload: JSON.stringify({
        sheetName: nombreHoja,
        spreadsheetId: spreadsheetId
      }),
      muteHttpExceptions: true
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode === 200) {
      const result = JSON.parse(responseText);
      SpreadsheetApp.getUi().alert(
        '✅ ' + result.message + '\n\n' +
        'La hoja se ha actualizado correctamente.'
      );
      SpreadsheetApp.getActiveSpreadsheet().toast('✅ Actualización completada', 'Éxito', 3);
      
      // Recargar la hoja después de un breve delay
      Utilities.sleep(500);
      SpreadsheetApp.getActiveSpreadsheet().getRange('A1').activate();
    } else {
      let errorMessage = 'Error ' + responseCode;
      try {
        const error = JSON.parse(responseText);
        errorMessage = error.message || error.error || errorMessage;
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      
      SpreadsheetApp.getUi().alert(
        '❌ Error al actualizar:\n\n' + errorMessage + '\n\n' +
        'Verifica que:\n' +
        '1. Strapi esté corriendo\n' +
        '2. STRAPI_URL y STRAPI_TOKEN estén configurados correctamente\n' +
        '3. El script de exportación exista en el servidor'
      );
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Error al conectar con Strapi:\n\n' + error.toString() + '\n\n' +
      'Verifica que Strapi esté corriendo y accesible desde ' + STRAPI_URL
    );
  }
}

/**
 * Carga nuevos registros a Strapi (para documento de CREACIÓN)
 * Procesa solo las filas que NO tienen documentId
 */
function cargarNuevosRegistros() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const nombreHoja = sheet.getName();
  
  const collectionType = MAPEO_HOJA_A_COLLECTION_TYPE[nombreHoja];
  if (!collectionType) {
    SpreadsheetApp.getUi().alert('❌ Hoja no reconocida: ' + nombreHoja);
    return;
  }
  
  try {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      SpreadsheetApp.getUi().alert('⚠️ No hay datos para procesar');
      return;
    }
    
    const headers = data[0];
    const documentIdIndex = headers.indexOf('documentId');
    
    if (documentIdIndex === -1) {
      SpreadsheetApp.getUi().alert('❌ No se encontró la columna "documentId"');
      return;
    }
    
    const nuevasFilas = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const documentId = row[documentIdIndex];
      
      // Solo procesar filas sin documentId
      if (!documentId || documentId.toString().trim() === '') {
        const registro = {};
        headers.forEach((header, index) => {
          if (header !== 'documentId' && header !== 'url' && header !== 'accion') {
            registro[header] = row[index];
          }
        });
        nuevasFilas.push({ rowIndex: i + 1, data: registro });
      }
    }
    
    if (nuevasFilas.length === 0) {
      SpreadsheetApp.getUi().alert('⚠️ No hay nuevas filas para procesar');
      return;
    }
    
    const confirmacion = SpreadsheetApp.getUi().alert(
      '¿Cargar ' + nuevasFilas.length + ' nuevo(s) registro(s) a Strapi?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO
    );
    
    if (confirmacion !== SpreadsheetApp.getUi().Button.YES) {
      return;
    }
    
    // Llamar a tu endpoint de backend
    const response = UrlFetchApp.fetch('http://localhost:3000/api/gsheet/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + STRAPI_TOKEN
      },
      payload: JSON.stringify({
        sheetName: nombreHoja,
        collectionType: collectionType,
        registros: nuevasFilas
      })
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      SpreadsheetApp.getUi().alert('✅ ' + result.created + ' registro(s) creado(s) correctamente');
      // Recargar la hoja para ver los nuevos documentIds
      SpreadsheetApp.getActiveSpreadsheet().toast('Registros creados', 'Éxito', 3);
    } else {
      throw new Error('Error en la respuesta: ' + response.getResponseCode());
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error al cargar registros:\n\n' + error.message);
  }
}

/**
 * Actualiza registros existentes en Strapi (para documento de EDICIÓN)
 * Procesa solo las filas que SÍ tienen documentId
 */
function actualizarRegistros() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const nombreHoja = sheet.getName();
  
  const collectionType = MAPEO_HOJA_A_COLLECTION_TYPE[nombreHoja];
  if (!collectionType) {
    SpreadsheetApp.getUi().alert('❌ Hoja no reconocida: ' + nombreHoja);
    return;
  }
  
  try {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      SpreadsheetApp.getUi().alert('⚠️ No hay datos para procesar');
      return;
    }
    
    const headers = data[0];
    const documentIdIndex = headers.indexOf('documentId');
    const accionIndex = headers.indexOf('accion');
    
    if (documentIdIndex === -1) {
      SpreadsheetApp.getUi().alert('❌ No se encontró la columna "documentId"');
      return;
    }
    
    const filasParaActualizar = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const documentId = row[documentIdIndex];
      const accion = accionIndex !== -1 ? row[accionIndex] : '';
      
      // Solo procesar filas con documentId y sin acción especial
      if (documentId && documentId.toString().trim() !== '' && 
          (!accion || accion.toString().trim() === '')) {
        const registro = {};
        headers.forEach((header, index) => {
          if (header !== 'documentId' && header !== 'url' && header !== 'accion' && 
              header !== 'fecha_creacion' && header !== 'fecha_edicion') {
            registro[header] = row[index];
          }
        });
        filasParaActualizar.push({ 
          rowIndex: i + 1, 
          documentId: documentId.toString().trim(),
          data: registro 
        });
      }
    }
    
    if (filasParaActualizar.length === 0) {
      SpreadsheetApp.getUi().alert('⚠️ No hay filas para actualizar');
      return;
    }
    
    const confirmacion = SpreadsheetApp.getUi().alert(
      '¿Actualizar ' + filasParaActualizar.length + ' registro(s) en Strapi?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO
    );
    
    if (confirmacion !== SpreadsheetApp.getUi().Button.YES) {
      return;
    }
    
    // Llamar a tu endpoint de backend
    const response = UrlFetchApp.fetch('http://localhost:3000/api/gsheet/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + STRAPI_TOKEN
      },
      payload: JSON.stringify({
        sheetName: nombreHoja,
        collectionType: collectionType,
        registros: filasParaActualizar
      })
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      SpreadsheetApp.getUi().alert('✅ ' + result.updated + ' registro(s) actualizado(s) correctamente');
      SpreadsheetApp.getActiveSpreadsheet().toast('Registros actualizados', 'Éxito', 3);
    } else {
      throw new Error('Error en la respuesta: ' + response.getResponseCode());
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error al actualizar registros:\n\n' + error.message);
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Obtiene el collection type desde el nombre de la hoja
 */
function getCollectionType(sheetName) {
  return MAPEO_HOJA_A_COLLECTION_TYPE[sheetName] || null;
}

/**
 * Muestra un menú con todas las funciones disponibles
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 Strapi Sync')
    .addItem('📖 Actualizar desde Strapi', 'actualizarDesdeStrapi')
    .addItem('➕ Cargar Nuevos Registros', 'cargarNuevosRegistros')
    .addItem('✏️ Actualizar Registros', 'actualizarRegistros')
    .addToUi();
}

