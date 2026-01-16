#!/usr/bin/env node

/**
 * Script para conectar libros con autores, sellos y editoriales
 * usando solo las relaciones del CSV de Notion
 * 
 * Solo actualiza las relaciones, no añade información adicional
 * 
 * Uso:
 *   node scripts/conectar-libros-relaciones-notion.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

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

const STRAPI_URL = process.env.STRAPI_LOCAL_URL || process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

// Rutas de los CSVs
const LIBROS_CSV = resolve(__dirname, '..', 'data', 'csv', 'import', 'libros_notion.csv');
const SELLOS_CSV = resolve(__dirname, '..', 'data', 'csv', 'import', 'sellos_notion.csv');

// Parsear CSV
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));

    if (values.length > 0 && values.some(v => v)) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }

  return data;
}

// Cache de entidades
const cache = {
  libros: new Map(),
  autores: new Map(),
  sellos: new Map(),
  editoriales: new Map(),
};

// Cargar sellos para obtener mapeo id_sello -> id_editorial
let sellosData = [];
if (existsSync(SELLOS_CSV)) {
  const sellosContent = readFileSync(SELLOS_CSV, 'utf-8');
  sellosData = parseCSV(sellosContent);
  console.log(`📊 Cargados ${sellosData.length} sellos del CSV`);
}

// Mapa id_sello -> id_editorial
const selloEditorialMap = new Map();
for (const sello of sellosData) {
  if (sello.id_sello && sello.id_editorial) {
    selloEditorialMap.set(String(sello.id_sello).trim(), String(sello.id_editorial).trim());
  }
}

// Buscar entidad en Strapi por campo específico
async function buscarEntidad(contentType, campo, valor, populate = []) {
  if (!valor) return null;

  // Verificar cache
  const cacheKey = `${contentType}_${campo}_${valor}`;
  if (cache[contentType] && cache[contentType].has(cacheKey)) {
    return cache[contentType].get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      [`filters[${campo}][$eq]`]: String(valor).trim(),
    });

    if (populate.length > 0) {
      params.append('populate', populate.join(','));
    }

    const response = await fetch(`${STRAPI_URL}/api/${contentType}?${params.toString()}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const entity = data.data && data.data.length > 0 ? data.data[0] : null;

    // Guardar en cache
    if (entity && cache[contentType]) {
      cache[contentType].set(cacheKey, entity);
    }

    return entity;
  } catch (error) {
    return null;
  }
}

// Buscar libro por ISBN o id_libro
async function buscarLibro(isbn, idLibro) {
  // Intentar primero por ISBN si existe
  if (isbn && isbn.trim() && !isbn.startsWith('TEMP-')) {
    const libro = await buscarEntidad('libros', 'isbn_libro', isbn.trim());
    if (libro) return libro;
  }

  // Si no, buscar por id_libro usando un campo personalizado (si existe)
  // Nota: Necesitaríamos agregar un campo id_libro a los libros si no existe
  // Por ahora, intentamos buscar por ISBN generado desde id_libro
  return null;
}

// Buscar editorial por nombre
async function buscarEditorialPorNombre(nombreEditorial) {
  if (!nombreEditorial || !nombreEditorial.trim()) return null;

  const cacheKey = `editoriales_nombre_${nombreEditorial.trim().toLowerCase()}`;
  if (cache.editoriales && cache.editoriales.has(cacheKey)) {
    return cache.editoriales.get(cacheKey);
  }

  try {
    const params = new URLSearchParams({
      'filters[nombre_editorial][$eq]': nombreEditorial.trim(),
    });

    const response = await fetch(`${STRAPI_URL}/api/editoriales?${params.toString()}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const editorial = json?.data?.[0] || null;

    if (editorial && cache.editoriales) {
      cache.editoriales.set(cacheKey, editorial);
    }

    return editorial;
  } catch (error) {
    return null;
  }
}

// Actualizar relaciones de un libro
async function conectarRelaciones(libroNotion) {
  const idLibro = libroNotion.id_libro || '';
  const isbn = libroNotion.ISBN || '';
  const idAutor = libroNotion.id_autor || '';
  const idSello = libroNotion.id_sello2 || libroNotion.id_sello || '';
  const nombreEditorial = libroNotion['Nombre Editorial'] || libroNotion.nombre_editorial || '';

  if (!idLibro && !isbn) {
    return { success: false, reason: 'Sin id_libro ni ISBN' };
  }

  // Buscar libro en Strapi
  let libro = null;
  if (isbn && isbn.trim() && !isbn.startsWith('TEMP-')) {
    libro = await buscarEntidad('libros', 'isbn_libro', isbn.trim());
  }

  if (!libro) {
    return { success: false, reason: 'Libro no encontrado en Strapi' };
  }

  const libroId = libro.documentId || libro.id;
  const nombreLibro = libro.attributes?.nombre_libro || libro.nombre_libro || 'Sin nombre';

  // Preparar datos para actualizar
  const dataToUpdate = {};

  // Validar y filtrar valores inválidos
  function esValido(id) {
    if (!id || !String(id).trim()) return false;
    const idStr = String(id).trim();
    // Rechazar valores como "-10", "0", negativos, etc.
    if (idStr === '-10' || idStr === '0' || idStr === '-1' || idStr.startsWith('-')) return false;
    return true;
  }

  // Conectar autor si existe y es válido
  let autorEncontrado = null;
  if (esValido(idAutor)) {
    autorEncontrado = await buscarEntidad('autores', 'id_autor', String(idAutor).trim());
    if (autorEncontrado) {
      const autorId = autorEncontrado.documentId || autorEncontrado.id;
      dataToUpdate.autor_relacion = autorId;
      // Guardar id_autor también
      if (autorEncontrado.id_autor || autorEncontrado.attributes?.id_autor) {
        dataToUpdate.id_autor = autorEncontrado.id_autor || autorEncontrado.attributes?.id_autor;
      }
    }
  }

  // Conectar sello si existe y es válido
  let editorialDesdeSello = null;
  let idEditorialValue = null;
  if (esValido(idSello)) {
    const sello = await buscarEntidad('sellos', 'id_sello', String(idSello).trim());
    if (sello) {
      const selloId = sello.documentId || sello.id;
      dataToUpdate.sello = selloId;
      // Guardar id_sello también
      if (sello.id_sello || sello.attributes?.id_sello) {
        dataToUpdate.id_sello = sello.id_sello || sello.attributes?.id_sello;
      }

      // Si el sello tiene editorial, también conectarla
      const idEditorial = selloEditorialMap.get(String(idSello).trim());
      if (esValido(idEditorial)) {
        const editorial = await buscarEntidad('editoriales', 'id_editorial', String(idEditorial).trim());
        if (editorial) {
          editorialDesdeSello = editorial.documentId || editorial.id;
          dataToUpdate.editorial = editorialDesdeSello;
          // Guardar id_editorial también
          idEditorialValue = editorial.id_editorial || editorial.attributes?.id_editorial;
          if (idEditorialValue) {
            dataToUpdate.id_editorial = idEditorialValue;
          }
        }
      }
    }
  }

  // Si no hay editorial desde el sello, intentar buscar por nombre desde el CSV
  if (!editorialDesdeSello && nombreEditorial && nombreEditorial.trim()) {
    const editorial = await buscarEditorialPorNombre(nombreEditorial.trim());
    if (editorial) {
      const editorialId = editorial.documentId || editorial.id;
      dataToUpdate.editorial = editorialId;
      // Guardar id_editorial también
      const idEditorial = editorial.id_editorial || editorial.attributes?.id_editorial;
      if (idEditorial) {
        dataToUpdate.id_editorial = idEditorial;
      }
    }
  }


  // Si no hay nada que actualizar, saltar
  if (Object.keys(dataToUpdate).length === 0) {
    return { success: true, action: 'skip', reason: 'Sin relaciones para actualizar' };
  }

  // Actualizar libro en Strapi con reintentos
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${STRAPI_URL}/api/libros/${libroId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ data: dataToUpdate }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // Si es 500, intentar de nuevo
        if (response.status === 500 && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const relaciones = [];
      if (dataToUpdate.autor_relacion) relaciones.push('autor');
      if (dataToUpdate.sello) relaciones.push('sello');
      if (dataToUpdate.editorial) relaciones.push('editorial');

      return {
        success: true,
        action: 'updated',
        relaciones: relaciones,
        libro: nombreLibro,
      };
    } catch (error) {
      lastError = error;
      // Si es un error de abort o timeout, intentar de nuevo
      if ((error.name === 'AbortError' || error.message.includes('timeout')) && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      // Para otros errores, si es 500, intentar de nuevo
      if (error.message.includes('HTTP 500') && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      // Si no es recuperable o es el último intento, retornar error
      if (attempt === maxRetries) {
        return { success: false, error: error.message };
      }
    }
  }
  
  return { success: false, error: lastError?.message || 'Error desconocido' };
}

async function main() {
  console.log('🔗 Conectando relaciones de libros desde Notion');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log(`CSV: ${LIBROS_CSV}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!existsSync(LIBROS_CSV)) {
    console.error(`❌ No se encuentra el archivo: ${LIBROS_CSV}`);
    process.exit(1);
  }

  // Cargar CSV de libros
  const contenido = readFileSync(LIBROS_CSV, 'utf-8');
  const librosNotion = parseCSV(contenido);

  console.log(`📊 Encontrados ${librosNotion.length} libros en el CSV de Notion\n`);

  let procesados = 0;
  let actualizados = 0;
  let omitidos = 0;
  let errores = 0;

  for (const libroNotion of librosNotion) {
    procesados++;

    const idLibro = libroNotion.id_libro || '';
    const isbn = libroNotion.ISBN || '';
    const nombre = libroNotion['Título del libro'] || libroNotion.Título || idLibro || `Libro ${procesados}`;

    if (procesados % 100 === 0) {
      console.log(`📊 Procesados ${procesados}/${librosNotion.length} libros...`);
    }

    const resultado = await conectarRelaciones(libroNotion);

    if (resultado.success) {
      if (resultado.action === 'updated') {
        actualizados++;
        const relaciones = resultado.relaciones.join(', ');
        process.stdout.write(`[${procesados}] ${nombre.substring(0, 50)}... ✅ Conectado: ${relaciones}\n`);
      } else {
        omitidos++;
      }
    } else {
      errores++;
      if (resultado.reason !== 'Libro no encontrado en Strapi' && resultado.reason !== 'Sin id_libro ni ISBN') {
        console.log(`[${procesados}] ${nombre.substring(0, 50)}... ❌ ${resultado.error || resultado.reason}`);
      }
    }

    // Pequeña pausa cada 50 libros
    if (procesados % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   📦 Total procesados: ${procesados}`);
  console.log(`   ✅ Actualizados con relaciones: ${actualizados}`);
  console.log(`   ⏭️  Omitidos (sin relaciones): ${omitidos}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

