#!/usr/bin/env node

/**
 * Script para crear los 3 documentos de Google Sheets necesarios
 * 
 * Uso:
 *   node scripts/gsheet-crear-documentos.mjs
 * 
 * Variables de entorno:
 *   GOOGLE_SHEETS_CREDENTIALS_PATH - Ruta a credentials.json
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { getAllSheetNames } from './gsheet-mapeo-collection-types.mjs';

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

const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || resolve(__dirname, '..', 'data', 'gsheets', 'credentials.json');

if (!existsSync(CREDENTIALS_PATH)) {
  console.error(`❌ No se encontró credentials.json en: ${CREDENTIALS_PATH}`);
  process.exit(1);
}

/**
 * Inicializa Google Sheets API
 */
async function initGoogleSheets() {
  console.log('🔐 Autenticando con Google Sheets API...');
  
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file', // Permite crear archivos
    ],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const drive = google.drive({ version: 'v3', auth: authClient });

  return { sheets, drive };
}

/**
 * Crea un documento de Google Sheets con todas las hojas necesarias
 */
async function crearDocumento(sheets, drive, titulo, descripcion) {
  console.log(`\n📄 Creando documento: ${titulo}...`);
  
  try {
    // Crear el documento
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: titulo,
        },
      },
    });
    
    const spreadsheetId = spreadsheet.data.spreadsheetId;
    console.log(`   ✅ Documento creado: ${spreadsheetId}`);
    console.log(`   🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
    
    // Obtener todas las hojas necesarias
    const sheetNames = getAllSheetNames();
    
    // Eliminar la hoja por defecto
    const defaultSheetId = spreadsheet.data.sheets[0].properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteSheet: {
            sheetId: defaultSheetId,
          },
        }],
      },
    });
    
    // Crear todas las hojas necesarias
    console.log(`   📋 Creando ${sheetNames.length} hojas...`);
    const requests = sheetNames.map((sheetName, index) => ({
      addSheet: {
        properties: {
          title: sheetName,
          index: index,
        },
      },
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests,
      },
    });
    
    console.log(`   ✅ ${sheetNames.length} hojas creadas`);
    
    // Agregar descripción al documento en Drive
    await drive.files.update({
      fileId: spreadsheetId,
      requestBody: {
        description: descripcion,
      },
    });
    
    return {
      id: spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      titulo,
    };
  } catch (error) {
    console.error(`   ❌ Error al crear documento: ${error.message}`);
    throw error;
  }
}

/**
 * Crea una hoja de ejemplo con encabezados básicos
 */
async function crearHojaEjemplo(sheets, spreadsheetId, sheetName) {
  try {
    // Obtener el ID de la hoja
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) return;
    
    const sheetId = sheet.properties.sheetId;
    
    // Crear encabezados básicos según el tipo de documento
    const headers = [
      'documentId',
      'url',
      'fecha_creacion',
      'fecha_edicion',
      'estado',
    ];
    
    // Escribir encabezados
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    
    // Formatear encabezado
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        }],
      },
    });
  } catch (error) {
    // Ignorar errores al crear hoja de ejemplo
  }
}

async function main() {
  try {
    console.log('=== Crear Documentos de Google Sheets ===\n');
    
    const { sheets, drive } = await initGoogleSheets();
    
    const documentos = [
      {
        titulo: '📖 LECTURA - Estado Actual',
        descripcion: 'Documento de solo lectura con el estado actual de todos los collection types en Strapi. Actualizar desde Strapi usando los botones en cada hoja.',
      },
      {
        titulo: '➕ CREAR - Nuevos Registros',
        descripcion: 'Documento para crear nuevos registros. Agregar nuevas filas (sin documentId) y usar el botón "Cargar a Strapi" en cada hoja.',
      },
      {
        titulo: '✏️ EDITAR - Actualizar Registros',
        descripcion: 'Documento para editar registros existentes. Solo editar filas con documentId y usar el botón "Actualizar en Strapi" en cada hoja.',
      },
    ];
    
    const resultados = [];
    
    for (const doc of documentos) {
      const resultado = await crearDocumento(sheets, drive, doc.titulo, doc.descripcion);
      resultados.push(resultado);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESUMEN DE DOCUMENTOS CREADOS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    resultados.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.titulo}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   URL: ${doc.url}\n`);
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 PRÓXIMOS PASOS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1. Agrega estos IDs a tu .env:');
    console.log('');
    resultados.forEach((doc, index) => {
      const varName = index === 0 ? 'GOOGLE_SHEETS_SPREADSHEET_ID_LECTURA' :
                      index === 1 ? 'GOOGLE_SHEETS_SPREADSHEET_ID_CREAR' :
                      'GOOGLE_SHEETS_SPREADSHEET_ID_EDITAR';
      console.log(`   ${varName}=${doc.id}`);
    });
    console.log('');
    console.log('2. Configura Apps Script en cada documento:');
    console.log('   - Abre cada documento');
    console.log('   - Ve a Extensiones > Apps Script');
    console.log('   - Pega el código de scripts/gsheet-apps-script-template.js');
    console.log('   - Configura STRAPI_URL y STRAPI_TOKEN');
    console.log('   - Guarda el proyecto');
    console.log('');
    console.log('3. Agrega botones en cada hoja:');
    console.log('   - Documento LECTURA: botón con función "actualizarDesdeStrapi"');
    console.log('   - Documento CREAR: botón con función "cargarNuevosRegistros"');
    console.log('   - Documento EDITAR: botón con función "actualizarRegistros"');
    console.log('');
    console.log('🎉 ¡Listo!');
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

