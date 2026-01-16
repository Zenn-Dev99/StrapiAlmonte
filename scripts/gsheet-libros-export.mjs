#!/usr/bin/env node

/**
 * Script para exportar 50 libros desde Strapi a Google Sheets
 * 
 * Uso:
 *   npm run gsheet:libros:export
 * 
 * Variables de entorno:
 *   STRAPI_URL - URL de Strapi (default: http://localhost:1337)
 *   STRAPI_TOKEN - Token de API de Strapi
 *   GOOGLE_SHEETS_SPREADSHEET_ID - ID de la hoja de cálculo
 *   GOOGLE_SHEETS_CREDENTIALS_PATH - Ruta a credentials.json
 *   LIMIT - Número de libros a exportar (default: 50)
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
// Si LIMIT no se especifica o es 0, exportar todos los libros
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

if (!SPREADSHEET_ID) {
  console.error('❌ Falta GOOGLE_SHEETS_SPREADSHEET_ID');
  console.error('   Configúralo en .env o como variable de entorno');
  process.exit(1);
}

if (!existsSync(CREDENTIALS_PATH)) {
  console.error(`❌ No se encontró credentials.json en: ${CREDENTIALS_PATH}`);
  console.error('   Revisa backend/data/gsheets/README.md para configurar Google Sheets API');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

// Columnas que exportaremos (campos editables en Google Sheets)
// Orden: campos editables primero, luego documentId y url al final
const COLUMNS = [
  'isbn_libro',          // ISBN (requerido, único)
  'nombre_libro',        // Nombre (requerido)
  'subtitulo_libro',     // Subtítulo
  'id_autor',            // ID del autor (para edición)
  'nombre_autor',        // Nombre del autor (read-only, informativo)
  'id_editorial',        // ID de editorial (para edición)
  'nombre_editorial',    // Nombre de editorial (read-only, informativo)
  'id_sello',            // ID de sello (para edición)
  'nombre_sello',        // Nombre de sello (read-only, informativo)
  'id_coleccion',        // ID de colección (para edición)
  'nombre_coleccion',    // Nombre de colección (read-only, informativo)
  'id_obra',             // ID de obra (para edición)
  'nombre_obra',         // Nombre de obra (read-only, informativo)
  'numero_edicion',      // Número de edición
  'agno_edicion',        // Año de edición
  'idioma',              // Enum: Español, Inglés, Francés, Alemán, Otro
  'tipo_libro',          // Enum: Plan Lector, Texto Curricular, etc.
  'estado_edicion',      // Enum: Vigente, Stock Limitado, Descatalogado
  'descripcion',         // Descripción (rich text)
  'fecha_creacion',      // Fecha de creación (read-only, para ordenar)
  'documentId',          // ID de Strapi (al final, NO EDITAR)
  'url',                 // URL de acceso rápido a Strapi (al final, NO EDITAR)
];

// Opciones de los campos enum (para documentación en README)
const ENUM_OPTIONS = {
  idioma: ['Español', 'Inglés', 'Francés', 'Alemán', 'Otro'],
  tipo_libro: ['Plan Lector', 'Texto Curricular', 'Texto PAES', 'Texto Complementario', 'Otro'],
  estado_edicion: ['Vigente', 'Stock Limitado', 'Descatalogado'],
};

/**
 * Convertir índice de columna (0-based) a letra de columna de Google Sheets (A, B, ..., Z, AA, AB, ...)
 */
function columnIndexToLetter(index) {
  let result = '';
  index++; // Convertir a 1-based
  while (index > 0) {
    index--;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

async function fetchLibros() {
  if (LIMIT > 0) {
    console.log(`📚 Obteniendo ${LIMIT} libros desde Strapi...`);
  } else {
    console.log(`📚 Obteniendo TODOS los libros desde Strapi...`);
  }
  
  const allLibros = [];
  const pageSize = 100; // Tamaño de página estándar
  let page = 1;
  let totalLibros = null; // Total de libros en Strapi (se obtiene de la primera respuesta)

  while (true) {
    // Usar la misma sintaxis exacta que backup-produccion-completo.mjs que funciona
    const url = `${STRAPI_URL}/api/libros?pagination[page]=${page}&pagination[pageSize]=${pageSize}&pagination[withCount]=true&sort[0]=id:asc&populate=*`;
    
    const response = await fetch(url, {
      headers: HEADERS,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const libros = data.data || [];
    const pagination = data.meta?.pagination;
    
    // Guardar el total en la primera página
    if (totalLibros === null && pagination?.total) {
      totalLibros = pagination.total;
      if (LIMIT === 0) {
        console.log(`   📊 Total de libros en Strapi: ${totalLibros}`);
      }
    }
    
    console.log(`   Página ${page}: ${libros.length} libros (total acumulado: ${allLibros.length + libros.length}${totalLibros ? ` / ${totalLibros}` : ''})`);

    if (libros.length === 0) {
      break;
    }

    allLibros.push(...libros);

    // Verificar si hemos alcanzado el límite (si LIMIT > 0)
    if (LIMIT > 0 && allLibros.length >= LIMIT) {
      // Si hay límite, tomar solo los primeros LIMIT libros
      allLibros.splice(LIMIT);
      break;
    }

    // Verificar si hay más páginas
    if (pagination && page >= pagination.pageCount) {
      break;
    }

    page++;
  }

  // Filtrar duplicados por documentId (más confiable que ISBN)
  const seenDocumentIds = new Set();
  const seenIsbns = new Set();
  const uniqueLibros = [];
  const duplicates = [];
  
  for (const libro of allLibros) {
    const documentId = (libro.documentId || libro.id || '').toString().trim();
    const isbn = (libro.isbn_libro || libro.attributes?.isbn_libro || '').toString().trim();
    const nombre = libro.nombre_libro || libro.attributes?.nombre_libro || 'Sin nombre';
    
    // Verificar duplicados por documentId primero (más confiable)
    if (documentId && seenDocumentIds.has(documentId)) {
      duplicates.push({ tipo: 'documentId', id: documentId, isbn, nombre });
      continue;
    }
    
    // Verificar duplicados por ISBN solo si no hay documentId
    if (!documentId && isbn && seenIsbns.has(isbn)) {
      duplicates.push({ tipo: 'ISBN', id: isbn, documentId, nombre });
      continue;
    }
    
    // Es único, agregarlo
    if (documentId) seenDocumentIds.add(documentId);
    if (isbn) seenIsbns.add(isbn);
    uniqueLibros.push(libro);
  }
  
  if (duplicates.length > 0) {
    console.warn(`\n⚠️  Se encontraron ${duplicates.length} libros duplicados (filtrados automáticamente)`);
    // Solo mostrar los primeros 5 duplicados para no saturar la salida
    const duplicatesToShow = duplicates.slice(0, 5);
    duplicatesToShow.forEach(dup => {
      console.warn(`   - Duplicado por ${dup.tipo}: "${dup.id}" (ISBN: ${dup.isbn || 'N/A'}, Nombre: ${dup.nombre})`);
    });
    if (duplicates.length > 5) {
      console.warn(`   ... y ${duplicates.length - 5} duplicados más`);
    }
    console.warn(`   Se exportarán solo los primeros encontrados (${uniqueLibros.length} únicos).\n`);
  }
  
  console.log(`✅ Se encontraron ${uniqueLibros.length} libros únicos (de ${allLibros.length} totales obtenidos)`);
  return uniqueLibros;
}

function libroToRow(libro) {
  // En Strapi v5, cuando se usa populate específico, los campos están
  // directamente en el objeto libro, NO en attributes
  
  // Función helper para obtener valor de campo
  const getField = (field) => libro[field] || '';
  
  // Función helper para obtener ID de relación
  const getRelationId = (rel) => {
    if (!rel) return '';
    // Las relaciones vienen directamente como objetos
    // Usar el ID numérico (id) o documentId
    return rel.id || rel.documentId || '';
  };
  
  // Función helper para obtener nombre de relación
  const getRelationName = (rel) => {
    if (!rel) return '';
    // Autor usa nombre_completo_autor
    if (rel.nombre_completo_autor) return rel.nombre_completo_autor;
    // Editorial, sello, obra, colección usan sus respectivos campos
    if (rel.nombre_editorial) return rel.nombre_editorial;
    if (rel.nombre_sello) return rel.nombre_sello;
    if (rel.nombre_obra) return rel.nombre_obra;
    if (rel.nombre_coleccion) return rel.nombre_coleccion;
    return '';
  };
  
  // Función helper para obtener canales (manyToMany)
  // Exportamos IDs separados por coma (más confiable que nombres)
  const getCanales = () => {
    const canales = libro.canales;
    if (!canales || !Array.isArray(canales) || canales.length === 0) return '';
    // Extraer IDs de canales y unirlos con coma
    return canales
      .map(canal => canal.id || canal.documentId || '')
      .filter(id => id)
      .join(', ');
  };
  
  // Función helper para obtener nombres de canales (informativos)
  const getCanalesNombres = () => {
    const canales = libro.canales;
    if (!canales || !Array.isArray(canales) || canales.length === 0) return '';
    // Extraer nombres de canales y unirlos con coma
    return canales
      .map(canal => canal.name || canal.nombre_canal || canal.nombre || '')
      .filter(nombre => nombre)
      .join(', ');
  };
  
  // Función helper para obtener descripción (blocks/rich text)
  const getDescripcion = () => {
    const descripcion = libro.descripcion;
    if (!descripcion) return '';
    // Si es un array de blocks, extraer texto
    if (Array.isArray(descripcion)) {
      return descripcion
        .map(block => {
          if (block.type === 'paragraph' && block.children) {
            return block.children.map(child => child.text || '').join('');
          }
          return '';
        })
        .filter(text => text)
        .join('\n');
    }
    // Si es string, devolverlo directamente
    if (typeof descripcion === 'string') return descripcion;
    return '';
  };
  
  const documentId = libro.documentId || libro.id || '';
  
  // Función helper para obtener URL de portada
  const getPortadaUrl = () => {
    const portada = libro.portada || libro.portada_libro;
    if (!portada) return '';
    // Si es un objeto con url o data.url
    if (typeof portada === 'object') {
      return portada.url || portada.data?.url || '';
    }
    // Si es string, devolverlo directamente
    if (typeof portada === 'string') return portada;
    return '';
  };
  
  // Función helper para obtener fecha de creación
  const getFechaCreacion = () => {
    // En Strapi v5, createdAt puede estar en diferentes lugares
    const createdAt = libro.createdAt || libro.attributes?.createdAt || '';
    if (!createdAt) return '';
    // Formatear como fecha ISO para que Google Sheets la reconozca y pueda ordenar
    // Si ya es una fecha ISO, devolverla tal cual
    if (typeof createdAt === 'string') {
      // Si es una fecha ISO completa, devolverla
      if (createdAt.includes('T')) {
        return createdAt;
      }
      // Si es solo fecha, añadir hora
      if (createdAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return `${createdAt}T00:00:00.000Z`;
      }
      return createdAt;
    }
    // Si es un objeto Date, convertirlo a ISO
    if (createdAt instanceof Date) {
      return createdAt.toISOString();
    }
    return '';
  };
  
  // Orden correcto: campos editables primero, fecha_creacion, luego documentId y url al final
  const url = `http://localhost:1337/admin/content-manager/collection-types/api::libro.libro/${documentId}`;
  
  return [
    getField('isbn_libro'),
    getField('nombre_libro'),
    getField('subtitulo_libro') || '',
    getRelationId(libro.autor_relacion),  // id_autor
    getRelationName(libro.autor_relacion),  // nombre_autor (read-only)
    getRelationId(libro.editorial),  // id_editorial
    getRelationName(libro.editorial),  // nombre_editorial (read-only)
    getRelationId(libro.sello),  // id_sello
    getRelationName(libro.sello),  // nombre_sello (read-only)
    getRelationId(libro.coleccion),  // id_coleccion
    getRelationName(libro.coleccion),  // nombre_coleccion (read-only)
    getRelationId(libro.obra),  // id_obra
    getRelationName(libro.obra),  // nombre_obra (read-only)
    getField('numero_edicion') || '',
    getField('agno_edicion') || '',
    getField('idioma') || '',
    getField('tipo_libro') || '',
    getField('estado_edicion') || 'Vigente',
    getDescripcion(),  // descripcion
    getFechaCreacion(),  // fecha_creacion (read-only)
    documentId,  // documentId al final
    url,  // url al final
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

async function createReadmeSheet(sheets) {
  console.log('📝 Creando hoja de documentación README...');
  
  const readmeData = [
    ['📚 GUÍA DE USO - LIBROS STRAPI', ''],
    ['', ''],
    ['COLUMNAS EDITABLES', ''],
    ['', ''],
    ['Columna', 'Tipo', 'Requerido', 'Descripción', 'Valores Permitidos'],
    ['isbn_libro', 'String', 'SÍ', 'ISBN del libro (único)', 'Cualquier texto válido'],
    ['nombre_libro', 'String', 'SÍ', 'Nombre del libro', 'Cualquier texto válido'],
    ['subtitulo_libro', 'String', 'No', 'Subtítulo del libro', 'Cualquier texto válido'],
    ['id_autor', 'Number', 'No', 'ID del autor (para edición)', 'ID numérico del autor'],
    ['nombre_autor', 'String', 'NO EDITAR', 'Nombre del autor (informativo)', 'No editar - se actualiza automáticamente'],
    ['id_editorial', 'Number', 'No', 'ID de editorial (para edición)', 'ID numérico de la editorial'],
    ['nombre_editorial', 'String', 'NO EDITAR', 'Nombre de editorial (informativo)', 'No editar - se actualiza automáticamente'],
    ['id_sello', 'Number', 'No', 'ID de sello (para edición)', 'ID numérico del sello'],
    ['nombre_sello', 'String', 'NO EDITAR', 'Nombre de sello (informativo)', 'No editar - se actualiza automáticamente'],
    ['id_coleccion', 'Number', 'No', 'ID de colección (para edición)', 'ID numérico de la colección'],
    ['nombre_coleccion', 'String', 'NO EDITAR', 'Nombre de colección (informativo)', 'No editar - se actualiza automáticamente'],
    ['id_obra', 'Number', 'No', 'ID de obra (para edición)', 'ID numérico de la obra'],
    ['nombre_obra', 'String', 'NO EDITAR', 'Nombre de obra (informativo)', 'No editar - se actualiza automáticamente'],
    ['numero_edicion', 'Integer', 'No', 'Número de edición', 'Número entero (ej: 1, 2, 3)'],
    ['agno_edicion', 'Integer', 'No', 'Año de edición', 'Año (ej: 2024, 2025)'],
    ['idioma', 'Enum', 'No', 'Idioma del libro', `Opciones: ${ENUM_OPTIONS.idioma.join(', ')}`],
    ['tipo_libro', 'Enum', 'No', 'Tipo de libro', `Opciones: ${ENUM_OPTIONS.tipo_libro.join(', ')}`],
    ['estado_edicion', 'Enum', 'No', 'Estado de edición', `Opciones: ${ENUM_OPTIONS.estado_edicion.join(', ')}`],
    ['descripcion', 'String', 'No', 'Descripción del libro (rich text)', 'Texto largo con formato'],
    ['fecha_creacion', 'DateTime', 'NO EDITAR', 'Fecha de creación del registro (para ordenar)', 'No editar - se actualiza automáticamente'],
    ['documentId', 'String', 'NO EDITAR', 'ID único de Strapi (usado para identificar)', 'No editar - se actualiza automáticamente'],
    ['url', 'String', 'NO EDITAR', 'URL de acceso rápido a Strapi', 'No editar - enlace al admin de Strapi'],
    ['', ''],
    ['VALORES PERMITIDOS - ENUMERACIONES', ''],
    ['', ''],
    ['Campo', 'Valores Permitidos'],
    ['idioma', 'Español'],
    ['', 'Inglés'],
    ['', 'Francés'],
    ['', 'Alemán'],
    ['', 'Otro'],
    ['', ''],
    ['tipo_libro', 'Plan Lector'],
    ['', 'Texto Curricular'],
    ['', 'Texto PAES'],
    ['', 'Texto Complementario'],
    ['', 'Otro'],
    ['', ''],
    ['estado_edicion', 'Vigente'],
    ['', 'Stock Limitado'],
    ['', 'Descatalogado'],
    ['', ''],
    ['RELACIONES - IMPORTANTE', ''],
    ['', ''],
    ['Las relaciones se editan usando IDs (id_autor, id_editorial, etc.).', ''],
    ['Las columnas de nombres (nombre_autor, nombre_editorial, etc.) son solo informativas (read-only).', ''],
    ['', ''],
    ['⚠️ IMPORTANTE:', ''],
    ['• Para editar relaciones: cambia el ID (id_autor, id_editorial, id_sello, id_coleccion, id_obra)', ''],
    ['• Los IDs deben ser números válidos que existan en Strapi', ''],
    ['• Las columnas de nombres (nombre_autor, nombre_editorial, etc.) son read-only - NO las edites', ''],
    ['• Para campos enum (idioma, tipo_libro, estado_edicion): usa EXACTAMENTE los valores listados arriba', ''],
    ['• Para ver los IDs disponibles, consulta Strapi Admin:', ''],
    ['  - Autores: http://localhost:1337/admin/content-manager/collection-types/api::autor.autor', ''],
    ['  - Editoriales: http://localhost:1337/admin/content-manager/collection-types/api::editorial.editorial', ''],
    ['  - Sellos: http://localhost:1337/admin/content-manager/collection-types/api::sello.sello', ''],
    ['  - Obras: http://localhost:1337/admin/content-manager/collection-types/api::obra.obra', ''],
    ['  - Colecciones: http://localhost:1337/admin/content-manager/collection-types/api::coleccion.coleccion', ''],
    ['', ''],
    ['EJEMPLOS', ''],
    ['', ''],
    ['isbn_libro', 'nombre_libro', 'subtitulo_libro', 'id_autor', 'nombre_autor', 'id_editorial', 'nombre_editorial', 'idioma', 'tipo_libro', 'documentId'],
    ['978-1234567890', 'El Quijote', 'Primera parte', '1', 'Miguel de Cervantes', '5', 'Editorial Planeta', 'Español', 'Plan Lector', 'abc123'],
    ['978-0987654321', 'Cien años de soledad', '', '2', 'Gabriel García Márquez', '6', 'Editorial Sudamericana', 'Español', 'Texto Complementario', 'def456'],
    ['', ''],
    ['NOTAS', ''],
    ['', ''],
    ['• ⚠️ NO edites las columnas marcadas como "NO EDITAR" (nombres informativos, documentId, url)', ''],
    ['• Los campos requeridos (isbn_libro, nombre_libro) deben tener valor', ''],
    ['• isbn_libro debe ser único - no puede haber dos libros con el mismo ISBN', ''],
    ['• Para relaciones (autor, editorial, sello, colección, obra): edita el ID (id_autor, id_editorial, etc.)', ''],
    ['• Las columnas de nombres (nombre_autor, nombre_editorial, etc.) son solo informativas y se actualizan automáticamente', ''],
    ['• Para importar cambios: npm run gsheet:libros:import', ''],
    ['• Para probar sin hacer cambios: npm run gsheet:libros:import:dry', ''],
  ];

  try {
    // Intentar obtener la hoja, si no existe, crearla
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'README!A1',
      });
    } catch (error) {
      // La hoja no existe, crearla
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: 'README',
              },
            },
          }],
        },
      });
    }

    // Limpiar y escribir datos
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'README!A:Z',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'README!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: readmeData,
      },
    });

    // Formatear encabezados principales
    const sheetId = await getSheetId(sheets, 'README');
    if (sheetId !== null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
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
                      fontSize: 16,
                    },
                    backgroundColor: {
                      red: 0.2,
                      green: 0.4,
                      blue: 0.8,
                    },
                  },
                },
                fields: 'userEnteredFormat(textFormat,backgroundColor)',
              },
            },
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 4,
                  endRowIndex: 5,
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
          ],
        },
      });
    }

    console.log('   ✅ Hoja README creada');
  } catch (error) {
    console.warn(`   ⚠️  Error creando hoja README: ${error.message}`);
  }
}

async function exportToGoogleSheets(sheets, libros) {
  console.log(`📊 Exportando ${libros.length} libros a Google Sheets...`);

  // Preparar datos: encabezados + filas
  const rows = libros.map(libroToRow);
  const values = [
    COLUMNS, // Encabezados
    ...rows,
  ];
  
  console.log(`   ✅ Datos preparados: ${values.length} filas (1 encabezado + ${rows.length} libros)`);
  if (rows.length > 0) {
    console.log(`   📝 Primera fila de datos: ${rows[0].slice(0, 3).join(', ')}...`);
  }

  // Limpiar hoja existente y escribir nuevos datos
  const sheetName = 'Libros';
  
  try {
    // ELIMINAR la hoja "Libros" si existe para evitar colores residuales
    // Luego la recrearemos limpia
    let sheetId = null;
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });
      
      const existingSheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (existingSheet) {
        console.log(`   🗑️  Eliminando hoja "${sheetName}" existente para evitar colores residuales...`);
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
    
    // Crear la hoja "Libros" limpia
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

    // Formatear encabezados (negrita, colores) y agregar filtros
    // No necesitamos limpiar formatos porque la hoja es nueva y está limpia
    const totalRows = values.length; // Incluye encabezado + datos
    if (sheetId !== null) {
      // Identificar índices de columnas de solo lectura (nombres informativos, fecha_creacion y documentId/url)
      const soloLecturaColumns = [
        COLUMNS.indexOf('nombre_autor'),
        COLUMNS.indexOf('nombre_editorial'),
        COLUMNS.indexOf('nombre_sello'),
        COLUMNS.indexOf('nombre_coleccion'),
        COLUMNS.indexOf('nombre_obra'),
        COLUMNS.indexOf('fecha_creacion'),
        COLUMNS.indexOf('documentId'),
        COLUMNS.indexOf('url'),
      ].filter(idx => idx !== -1); // Filtrar -1 (no encontrado)
      
      const requests = [
        // Formatear todos los encabezados (negrita, fondo gris)
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
        // Colorear columnas de solo lectura (amarillo claro)
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
                  blue: 0.8,  // Amarillo claro
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor)',
          },
        })),
        // Agregar filtros
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
        // Congelar la fila 1 (encabezados)
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
          requests,
        },
      });
      
      // Ajustar ancho de columnas
      // Columnas que NO deben auto-ajustarse (textos largos)
      const columnasAnchoFijo = ['descripcion', 'documentId', 'url']; // Columnas con textos largos
      const columnasAnchoFijoIndices = columnasAnchoFijo
        .map(col => COLUMNS.indexOf(col))
        .filter(idx => idx !== -1);
      
      // Calcular ancho basado en el título para columnas de ancho fijo
      const anchosFijos = columnasAnchoFijoIndices.map(colIndex => {
        const titulo = COLUMNS[colIndex];
        // Ancho aproximado: ~1.2 píxeles por carácter (mínimo 100 píxeles)
        const ancho = Math.max(100, titulo.length * 8);
        return { colIndex, ancho };
      });
      
      // Auto-ajustar columnas que NO están en la lista de ancho fijo
      const columnasAutoAjuste = [];
      for (let i = 0; i < COLUMNS.length; i++) {
        if (!columnasAnchoFijoIndices.includes(i)) {
          columnasAutoAjuste.push(i);
        }
      }
      
      const dimensionRequests = [];
      
      // Auto-ajustar columnas normales
      if (columnasAutoAjuste.length > 0) {
        // Agrupar columnas consecutivas para optimizar requests
        columnasAutoAjuste.forEach(colIndex => {
          dimensionRequests.push({
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: colIndex,
                endIndex: colIndex + 1,
              },
            },
          });
        });
      }
      
      // Establecer ancho fijo para columnas de texto largo
      anchosFijos.forEach(({ colIndex, ancho }) => {
        dimensionRequests.push({
          updateDimensionProperties: {
            range: {
              sheetId: sheetId,
              dimension: 'COLUMNS',
              startIndex: colIndex,
              endIndex: colIndex + 1,
            },
            properties: {
              pixelSize: ancho,
            },
            fields: 'pixelSize',
          },
        });
      });
      
      if (dimensionRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: dimensionRequests,
          },
        });
      }
      
      // No necesitamos eliminar reglas previas porque la hoja es nueva y está limpia
      // Agregar formato condicional SOLO para la columna isbn_libro cuando hay duplicados
      // IMPORTANTE: Solo se aplica a la celda del ISBN, NO a toda la fila
      const isbnColumnIndex = COLUMNS.indexOf('isbn_libro');
      if (isbnColumnIndex !== -1) {
        // Convertir índice de columna a letra (A, B, C, ..., Z, AA, AB, ...)
        const isbnColumnLetter = columnIndexToLetter(isbnColumnIndex);
        
        // Fórmula que cuenta cuántas veces aparece el ISBN en toda la columna
        // Si es > 1, significa que está duplicado
        // IMPORTANTE: El rango solo incluye la columna del ISBN, no toda la fila
        const conditionalFormatRequest = {
          addConditionalFormatRule: {
            rule: {
              ranges: [
                {
                  sheetId: sheetId,
                  startRowIndex: 1, // Empezar desde la fila 2 (después del encabezado)
                  endRowIndex: totalRows, // Hasta la última fila
                  startColumnIndex: isbnColumnIndex, // SOLO la columna del ISBN (columna A)
                  endColumnIndex: isbnColumnIndex + 1, // SOLO la columna del ISBN (columna A)
                },
              ],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [
                    {
                      // La API de Google Sheets NO acepta COUNTIF en formato condicional
                      // Usamos SUMPRODUCT que es compatible con la API
                      // Versión simplificada: cuenta ocurrencias en toda la columna
                      // La referencia ${isbnColumnLetter}2 es relativa y se ajusta para cada fila
                      userEnteredValue: `=SUMPRODUCT(--($${isbnColumnLetter}$2:$${isbnColumnLetter}$${totalRows}=${isbnColumnLetter}2))>1`,
                    },
                  ],
                },
                format: {
                  backgroundColor: {
                    red: 1.0,
                    green: 0.85,
                    blue: 0.85, // Rojo claro para destacar
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 0.7,
                      green: 0.1,
                      blue: 0.1, // Rojo oscuro para el texto
                    },
                    bold: true, // Texto en negrita para mayor visibilidad
                  },
                },
              },
            },
            index: 0, // Agregar como primera regla
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
    console.log(`   ${libros.length} libros exportados a la hoja "${sheetName}"`);
    console.log(`   URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
  } catch (error) {
    console.error('❌ Error al exportar a Google Sheets:', error.message);
    throw error;
  }
}

async function getSheetId(sheets, sheetName) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    return sheet?.properties?.sheetId || null;
  } catch (error) {
    console.warn(`   ⚠️  No se pudo obtener sheetId: ${error.message}`);
    return null;
  }
}

async function main() {
  try {
    console.log('=== Exportar Libros a Google Sheets ===\n');
    console.log(`Strapi: ${STRAPI_URL}`);
    console.log(`Límite: ${LIMIT} libros`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);

    const libros = await fetchLibros();
    
    if (libros.length === 0) {
      console.log('⚠️  No se encontraron libros para exportar');
      return;
    }

    console.log(`✅ Se encontraron ${libros.length} libros\n`);

    const sheets = await initGoogleSheets();
    await createReadmeSheet(sheets);
    await exportToGoogleSheets(sheets, libros);

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

