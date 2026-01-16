/**
 * Script de Google Apps Script SOLO PARA LECTURA
 * 
 * Este script es para el documento de LECTURA - solo permite actualizar/leer datos
 * 
 * INSTRUCCIONES:
 * 1. Abre tu Google Sheet de LECTURA
 * 2. Ve a Extensiones > Apps Script
 * 3. Pega este código
 * 4. Configura las variables STRAPI_URL y STRAPI_TOKEN
 * 5. Guarda el proyecto
 * 6. Usa el menú "🔄 Strapi Sync" para actualizar las hojas
 */

// ============================================
// CONFIGURACIÓN
// ============================================

// ============================================
// CONFIGURACIÓN - IMPORTANTE: Configura estos valores
// ============================================

// Para desarrollo local, usa: 'http://localhost:1337'
// Para producción, usa: 'https://strapi.moraleja.cl'
const STRAPI_URL = 'https://strapi.moraleja.cl'; // URL de Strapi

// ⚠️ IMPORTANTE: Necesitas crear un API Token en producción
// 1. Ve a https://strapi.moraleja.cl/admin
// 2. Settings → API Tokens → Create new API Token
// 3. Name: "Google Sheets Integration"
// 4. Token duration: Unlimited (o el tiempo que necesites)
// 5. Token type: Full access (o Read-only si solo es para lectura)
// 6. Copia el token y pégalo aquí:
const STRAPI_TOKEN = 'TU_TOKEN_DE_PRODUCCION_AQUI'; // ⚠️ Reemplaza con tu token de producción

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
// FUNCIONES PRINCIPALES - SOLO LECTURA
// ============================================

/**
 * Actualiza la hoja actual desde Strapi
 * Solo actualiza la hoja donde estás actualmente
 */
function actualizarHojaActual() {
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
    SpreadsheetApp.getActiveSpreadsheet().toast('🔄 Actualizando ' + nombreHoja + '...', 'Procesando', 2);
    
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
        'La hoja "' + nombreHoja + '" se ha actualizado correctamente.'
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
 * Actualiza TODAS las hojas del documento desde Strapi
 * Itera sobre todas las hojas que tienen mapeo y las actualiza una por una
 */
function actualizarTodasLasHojas() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheetId = spreadsheet.getId();
  
  // Obtener todas las hojas que tienen mapeo
  const hojasConMapeo = [];
  const todasLasHojas = spreadsheet.getSheets();
  
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
  
  // Actualizar cada hoja
  hojasConMapeo.forEach(function(nombreHoja, index) {
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Actualizando ' + (index + 1) + '/' + hojasConMapeo.length + ': ' + nombreHoja,
        'Procesando',
        1
      );
      
      const collectionType = MAPEO_HOJA_A_COLLECTION_TYPE[nombreHoja];
      
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
      
      if (responseCode === 200) {
        exitosas++;
      } else {
        fallidas++;
        const errorText = response.getContentText();
        let errorMsg = 'Error ' + responseCode;
        try {
          const error = JSON.parse(errorText);
          errorMsg = error.message || error.error || errorMsg;
        } catch (e) {
          errorMsg = errorText || errorMsg;
        }
        errores.push(nombreHoja + ': ' + errorMsg);
      }
      
      // Pequeño delay entre actualizaciones
      Utilities.sleep(500);
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

/**
 * Crea el menú automáticamente cuando se abre el Google Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 Strapi Sync')
    .addItem('📖 Actualizar Hoja Actual', 'actualizarHojaActual')
    .addSeparator()
    .addItem('📚 Actualizar Todas las Hojas', 'actualizarTodasLasHojas')
    .addToUi();
}

