#!/usr/bin/env node

/**
 * Script para agregar todas las hojas necesarias a un documento existente
 * 
 * Uso:
 *   export GOOGLE_SHEETS_SPREADSHEET_ID="tu_id_documento"
 *   node scripts/gsheet-agregar-hojas.mjs
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

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || resolve(__dirname, '..', 'data', 'gsheets', 'credentials.json');

if (!SPREADSHEET_ID) {
  console.error('❌ Falta GOOGLE_SHEETS_SPREADSHEET_ID');
  console.error('   Exporta la variable: export GOOGLE_SHEETS_SPREADSHEET_ID="tu_id"');
  process.exit(1);
}

if (!existsSync(CREDENTIALS_PATH)) {
  console.error(`❌ No se encontró credentials.json en: ${CREDENTIALS_PATH}`);
  process.exit(1);
}

async function initGoogleSheets() {
  console.log('🔐 Autenticando con Google Sheets API...');
  
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function main() {
  try {
    console.log('=== Agregar Hojas a Documento de Google Sheets ===\n');
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);
    
    const sheets = await initGoogleSheets();
    
    // Obtener hojas existentes
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const hojasExistentes = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log(`📋 Hojas existentes: ${hojasExistentes.length}`);
    hojasExistentes.forEach(h => console.log(`   - ${h}`));
    
    // Obtener todas las hojas necesarias
    const todasLasHojas = getAllSheetNames();
    const hojasFaltantes = todasLasHojas.filter(h => !hojasExistentes.includes(h));
    
    if (hojasFaltantes.length === 0) {
      console.log('\n✅ Todas las hojas ya existen en el documento');
      return;
    }
    
    console.log(`\n📝 Hojas faltantes: ${hojasFaltantes.length}`);
    hojasFaltantes.forEach(h => console.log(`   - ${h}`));
    
    // Crear hojas faltantes
    console.log(`\n🔨 Creando ${hojasFaltantes.length} hojas...`);
    const requests = hojasFaltantes.map(sheetName => ({
      addSheet: {
        properties: {
          title: sheetName,
        },
      },
    }));
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests,
      },
    });
    
    console.log(`✅ ${hojasFaltantes.length} hojas creadas exitosamente`);
    console.log(`\n🔗 URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

