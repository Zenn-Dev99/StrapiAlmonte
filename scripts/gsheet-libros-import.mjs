#!/usr/bin/env node

/**
 * Script para importar libros desde Google Sheets a Strapi
 * 
 * Uso:
 *   npm run gsheet:libros:import
 * 
 * Variables de entorno:
 *   STRAPI_URL - URL de Strapi (default: http://localhost:1337)
 *   STRAPI_TOKEN - Token de API de Strapi
 *   GOOGLE_SHEETS_SPREADSHEET_ID - ID de la hoja de cálculo
 *   GOOGLE_SHEETS_CREDENTIALS_PATH - Ruta a credentials.json
 *   DRY - Si es "1", solo muestra lo que haría sin hacer cambios
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
const DRY_RUN = process.env.DRY === '1';

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

// Columnas esperadas (deben coincidir con las del export)
// Nota: Las columnas con "nombre_*" son solo informativas y se ignoran al importar
const COLUMNS = [
  'isbn_libro',
  'nombre_libro',
  'subtitulo_libro',
  'id_autor',
  'nombre_autor',        // Solo lectura - se ignora al importar
  'id_editorial',
  'nombre_editorial',    // Solo lectura - se ignora al importar
  'id_sello',
  'nombre_sello',        // Solo lectura - se ignora al importar
  'id_coleccion',
  'nombre_coleccion',    // Solo lectura - se ignora al importar
  'id_obra',
  'nombre_obra',         // Solo lectura - se ignora al importar
  'numero_edicion',
  'agno_edicion',
  'idioma',
  'tipo_libro',
  'estado_edicion',
  'descripcion',
  'documentId',
  'url',                 // Solo lectura - se ignora al importar
];

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function fetchFromGoogleSheets(sheets) {
  console.log('📥 Leyendo datos desde Google Sheets...');
  
  const sheetName = 'Libros';
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];
  
  if (rows.length < 2) {
    throw new Error('La hoja está vacía o solo tiene encabezados');
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Mapear filas a objetos usando los encabezados
  const libros = dataRows
    .filter(row => {
      // Filtrar filas vacías - verificar que tenga al menos documentId o nombre_libro
      const hasData = row.some(cell => cell && cell.trim());
      return hasData;
    })
    .map(row => {
      const libro = {};
      headers.forEach((header, index) => {
        libro[header] = row[index] || '';
      });
      return libro;
    })
    .filter(libro => {
      // Solo procesar si tiene documentId (necesario para actualizar)
      return libro.documentId && libro.documentId.trim();
    });

  console.log(`   Se encontraron ${libros.length} libros en la hoja\n`);
  return libros;
}

// Cache para relaciones validadas (evitar múltiples requests)
const relationCache = {
  autor: new Map(),
  editorial: new Map(),
  sello: new Map(),
  coleccion: new Map(),
  obra: new Map(),
  canal: new Map(),
};

/**
 * Validar que una relación exista en Strapi
 */
async function validarRelacion(tipo, id) {
  if (!id || isNaN(id)) return false;
  
  const idNum = parseInt(id, 10);
  if (isNaN(idNum)) return false;
  
  // Verificar cache
  if (relationCache[tipo]?.has(idNum)) {
    return relationCache[tipo].get(idNum);
  }
  
  try {
    const endpoint = tipo === 'canal' ? 'canales' : `${tipo}s`;
    const response = await fetch(`${STRAPI_URL}/api/${endpoint}/${idNum}`, {
      headers: HEADERS,
    });
    
    const existe = response.ok;
    
    // Guardar en cache
    if (!relationCache[tipo]) {
      relationCache[tipo] = new Map();
    }
    relationCache[tipo].set(idNum, existe);
    
    return existe;
  } catch (error) {
    // Error al validar - asumir que no existe
    if (!relationCache[tipo]) {
      relationCache[tipo] = new Map();
    }
    relationCache[tipo].set(idNum, false);
    return false;
  }
}

async function buscarCanalPorId(idStr) {
  if (!idStr || !idStr.trim()) return null;
  
  const id = parseInt(idStr.trim(), 10);
  if (isNaN(id)) return null;
  
  // Validar que existe usando la función de validación
  const existe = await validarRelacion('canal', id);
  if (!existe) return null;
  
  return id;
}

async function buscarCanalesPorIds(idsStr) {
  if (!idsStr || !idsStr.trim()) return [];
  
  // Separar por coma y limpiar
  const ids = idsStr
    .split(',')
    .map(id => id.trim())
    .filter(id => id);
  
  if (ids.length === 0) return [];
  
  const canalIds = [];
  for (const idStr of ids) {
    const id = parseInt(idStr, 10);
    if (!isNaN(id)) {
      // Intentar usar el ID directamente (puede ser documentId o id numérico)
      // En Strapi v5, para relaciones manyToMany usamos el ID numérico
      canalIds.push(id);
    } else {
      console.warn(`   ⚠️  ID de canal inválido: "${idStr}"`);
    }
  }
  
  return canalIds;
}

async function actualizarLibro(documentId, libroData) {
  const payload = {
    data: {},
  };

  // Campos simples
  if (libroData.isbn_libro) payload.data.isbn_libro = libroData.isbn_libro.trim();
  if (libroData.nombre_libro) payload.data.nombre_libro = libroData.nombre_libro.trim();
  if (libroData.subtitulo_libro !== undefined) {
    payload.data.subtitulo_libro = libroData.subtitulo_libro?.trim() || null;
  }
  if (libroData.idioma) payload.data.idioma = libroData.idioma;
  if (libroData.tipo_libro) payload.data.tipo_libro = libroData.tipo_libro;
  if (libroData.estado_edicion) payload.data.estado_edicion = libroData.estado_edicion;
  if (libroData.numero_edicion) {
    const num = parseInt(libroData.numero_edicion, 10);
    payload.data.numero_edicion = isNaN(num) ? null : num;
  }
  if (libroData.agno_edicion) {
    const anio = parseInt(libroData.agno_edicion, 10);
    payload.data.agno_edicion = isNaN(anio) ? null : anio;
  }

  // Descripción (blocks/rich text)
  if (libroData.descripcion !== undefined && libroData.descripcion !== '') {
    // Convertir texto plano a formato blocks de Strapi
    const texto = libroData.descripcion.trim();
    if (texto) {
      // Crear estructura de blocks simple (párrafos)
      const parrafos = texto.split('\n').filter(p => p.trim());
      payload.data.descripcion = parrafos.map(parrafo => ({
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: parrafo.trim(),
          },
        ],
      }));
    } else {
      payload.data.descripcion = null;
    }
  }

  // Relaciones (usar IDs directamente - más confiable que nombres)
  // Validar que existan antes de agregarlas al payload
  const warnings = [];
  
  if (libroData.id_autor) {
    const idAutor = parseInt(libroData.id_autor, 10);
    if (!isNaN(idAutor)) {
      const existe = await validarRelacion('autor', idAutor);
      if (existe) {
        payload.data.id_autor = idAutor;
        payload.data.autor_relacion = idAutor;
      } else {
        warnings.push(`Autor ID ${idAutor} no existe en Strapi`);
      }
    }
  }

  if (libroData.id_editorial) {
    const idEditorial = parseInt(libroData.id_editorial, 10);
    if (!isNaN(idEditorial)) {
      const existe = await validarRelacion('editorial', idEditorial);
      if (existe) {
        payload.data.id_editorial = idEditorial;
        payload.data.editorial = idEditorial;
      } else {
        warnings.push(`Editorial ID ${idEditorial} no existe en Strapi`);
      }
    }
  }

  if (libroData.id_sello) {
    const idSello = parseInt(libroData.id_sello, 10);
    if (!isNaN(idSello)) {
      const existe = await validarRelacion('sello', idSello);
      if (existe) {
        payload.data.id_sello = idSello;
        payload.data.sello = idSello;
      } else {
        warnings.push(`Sello ID ${idSello} no existe en Strapi`);
      }
    }
  }

  if (libroData.id_obra) {
    const idObra = parseInt(libroData.id_obra, 10);
    if (!isNaN(idObra)) {
      const existe = await validarRelacion('obra', idObra);
      if (existe) {
        payload.data.id_obra = idObra;
        payload.data.obra = idObra;
      } else {
        warnings.push(`Obra ID ${idObra} no existe en Strapi`);
      }
    }
  }

  if (libroData.id_coleccion) {
    const idColeccion = parseInt(libroData.id_coleccion, 10);
    if (!isNaN(idColeccion)) {
      const existe = await validarRelacion('coleccion', idColeccion);
      if (existe) {
        payload.data.id_coleccion = idColeccion;
        payload.data.coleccion = idColeccion;
      } else {
        warnings.push(`Colección ID ${idColeccion} no existe en Strapi`);
      }
    }
  }

  // Mostrar warnings si hay relaciones inválidas
  if (warnings.length > 0) {
    warnings.forEach(warning => {
      console.warn(`   ⚠️  ${warning}`);
    });
  }

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Actualizaría libro ${documentId}:`, JSON.stringify(payload.data, null, 2));
    if (warnings.length > 0) {
      console.log(`   ⚠️  [DRY RUN] Advertencias: ${warnings.join(', ')}`);
    }
    return { success: true, dry: true, warnings };
  }

  try {
    const response = await fetch(`${STRAPI_URL}/api/libros/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return { success: true, warnings };
  } catch (error) {
    return { success: false, error: error.message, warnings };
  }
}

async function main() {
  try {
    console.log('=== Importar Libros desde Google Sheets ===\n');
    console.log(`Strapi: ${STRAPI_URL}`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
    console.log(`DRY RUN: ${DRY_RUN ? 'SÍ' : 'NO'}\n`);

    const sheets = await initGoogleSheets();
    const libros = await fetchFromGoogleSheets(sheets);

    let updated = 0;
    let errors = 0;
    let skipped = 0;
    let warnings = 0;
    const processedIds = new Set(); // Evitar procesar el mismo libro múltiples veces

    for (const libro of libros) {
      const documentId = libro.documentId;
      
      if (!documentId) {
        console.warn(`⚠️  Fila sin documentId, saltando...`);
        skipped++;
        continue;
      }

      // Evitar procesar el mismo libro múltiples veces
      if (processedIds.has(documentId)) {
        skipped++;
        continue;
      }
      processedIds.add(documentId);

      if (!libro.nombre_libro || !libro.nombre_libro.trim()) {
        console.warn(`⚠️  Libro ${documentId} sin nombre_libro, saltando...`);
        skipped++;
        continue;
      }

      console.log(`📝 Procesando: ${libro.nombre_libro} (${documentId})...`);

      const result = await actualizarLibro(documentId, libro);
      
      if (result.success) {
        updated++;
        if (result.warnings && result.warnings.length > 0) {
          warnings += result.warnings.length;
        }
        if (!result.dry) {
          console.log(`   ✅ Actualizado`);
        }
      } else {
        errors++;
        console.error(`   ❌ Error: ${result.error}`);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ↷ Saltados: ${skipped}`);
    console.log(`   ⚠️  Advertencias: ${warnings}`);
    console.log(`   ❌ Errores: ${errors}`);

    if (DRY_RUN) {
      console.log('\n💡 Esto fue un DRY RUN. Para aplicar cambios, ejecuta sin DRY=1');
    }

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

