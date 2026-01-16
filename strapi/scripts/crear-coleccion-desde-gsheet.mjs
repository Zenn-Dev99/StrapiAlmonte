#!/usr/bin/env node

/**
 * Script para crear una nueva colección desde Google Sheets usando SQLite directamente
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '..', '.env');
if (readFileSync(envPath, 'utf-8').includes('GOOGLE_SHEETS_SPREADSHEET_ID')) {
  const env = readFileSync(envPath, 'utf-8');
  env.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1hiK975O9j5o7uE5DgE57mQ5y1XrWHkoYsng3EcUTwC0';
const CREDENTIALS_PATH = resolve(__dirname, '..', '..', 'data', 'gsheets', 'credentials.json');
const dbPath = resolve(__dirname, '..', '.tmp', 'data.db');

// Cargar variables de entorno
if (readFileSync(envPath, 'utf-8').includes('GOOGLE_SHEETS_SPREADSHEET_ID')) {
  const env = readFileSync(envPath, 'utf-8');
  env.split('\n').forEach(line => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

async function obtenerNuevaColeccion() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  
  // Primero obtener los headers
  const headersResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Colecciones!A1:Z1',
  });
  const headers = headersResponse.data.values?.[0] || [];
  
  // Luego obtener la fila 509
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Colecciones!A509:Z509',
  });
  
  const row = response.data.values?.[0] || [];
  
  const coleccion = {};
  headers.forEach((h, i) => { coleccion[h] = row[i] || ''; });
  
  return coleccion;
}

async function crearColeccion() {
  console.log('=== Crear nueva colección desde Google Sheets ===\n');
  
  const nuevaColeccion = await obtenerNuevaColeccion();
  
  if (!nuevaColeccion.nombre_coleccion || !nuevaColeccion.nombre_coleccion.trim()) {
    console.error('❌ No se encontró nombre_coleccion en la fila 509');
    process.exit(1);
  }
  
  console.log('📋 Datos de la nueva colección:');
  console.log(`   nombre_coleccion: ${nuevaColeccion.nombre_coleccion}`);
  console.log(`   id_coleccion: ${nuevaColeccion.id_coleccion || '(se generará automáticamente)'}`);
  console.log(`   id_editorial: ${nuevaColeccion.id_editorial || '(vacío)'}`);
  console.log(`   id_sello: ${nuevaColeccion.id_sello || '(vacío)'}\n`);
  
  const db = new Database(dbPath);
  
  try {
    // Obtener máximo id_coleccion
    const maxIdResult = db.prepare('SELECT MAX(id_coleccion) as max_id FROM colecciones WHERE id_coleccion IS NOT NULL').get();
    const maxId = maxIdResult?.max_id || 0;
    const nuevoIdColeccion = nuevaColeccion.id_coleccion ? parseInt(nuevaColeccion.id_coleccion, 10) : (maxId + 1);
    
    console.log(`🔢 ID máximo existente: ${maxId}`);
    console.log(`📝 Usando id_coleccion: ${nuevoIdColeccion}\n`);
    
    // Verificar que el id_coleccion no esté en uso
    const existe = db.prepare('SELECT id FROM colecciones WHERE id_coleccion = ?').get(nuevoIdColeccion);
    if (existe) {
      console.error(`❌ El id_coleccion ${nuevoIdColeccion} ya está en uso`);
      db.close();
      process.exit(1);
    }
    
    // Obtener IDs de relaciones si se proporcionaron
    let editorialId = null;
    if (nuevaColeccion.id_editorial) {
      const editorial = db.prepare('SELECT id FROM editoriales WHERE id_editorial = ?').get(parseInt(nuevaColeccion.id_editorial, 10));
      if (editorial) editorialId = editorial.id;
      else console.warn(`   ⚠️  Editorial ID ${nuevaColeccion.id_editorial} no existe`);
    }
    
    let selloId = null;
    if (nuevaColeccion.id_sello) {
      const sello = db.prepare('SELECT id FROM sellos WHERE id_sello = ?').get(parseInt(nuevaColeccion.id_sello, 10));
      if (sello) selloId = sello.id;
      else console.warn(`   ⚠️  Sello ID ${nuevaColeccion.id_sello} no existe`);
    }
    
    // Crear el registro
    const insert = db.prepare(`
      INSERT INTO colecciones (
        id_coleccion,
        nombre_coleccion,
        editorial_id,
        sello_id,
        created_at,
        updated_at,
        published_at
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `);
    
    const result = insert.run(
      nuevoIdColeccion,
      nuevaColeccion.nombre_coleccion.trim(),
      editorialId,
      selloId
    );
    
    const nuevoId = result.lastInsertRowid;
    console.log(`✅ Colección creada exitosamente`);
    console.log(`   ID en base de datos: ${nuevoId}`);
    console.log(`   id_coleccion: ${nuevoIdColeccion}`);
    console.log(`   nombre_coleccion: ${nuevaColeccion.nombre_coleccion}`);
    
    // Obtener el documentId generado
    const creada = db.prepare('SELECT document_id FROM colecciones WHERE id = ?').get(nuevoId);
    console.log(`   documentId: ${creada?.document_id || 'N/A'}\n`);
    
    db.close();
    
    console.log('💡 Ahora ejecuta la exportación para actualizar la hoja:');
    console.log('   npm run gsheet:colecciones:export');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    db.close();
    process.exit(1);
  }
}

crearColeccion();
