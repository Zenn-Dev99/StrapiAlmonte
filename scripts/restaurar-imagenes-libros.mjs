#!/usr/bin/env node

/**
 * Script para restaurar las imágenes de los libros desde el CSV
 * Solo actualiza libros que NO tienen imagen
 * 
 * Uso:
 *   node scripts/restaurar-imagenes-libros.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const CSV_PATH = resolve(__dirname, '..', 'data', 'csv', 'import', 'libros.csv');

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let inQuotes = false;
    let current = '';
    const values = [];

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']+|["']+$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']+|["']+$/g, ''));

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return data;
}

async function descargarImagen(url) {
  if (!url || !url.trim()) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Strapi-Importer/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(buffer),
      contentType,
      size: buffer.byteLength,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout descargando imagen');
    }
    throw error;
  }
}

async function subirPortadaAStrapi(libroId, imageData, originalUrl) {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();

    let extension = 'jpg';
    if (imageData.contentType) {
      if (imageData.contentType.includes('png')) extension = 'png';
      else if (imageData.contentType.includes('gif')) extension = 'gif';
      else if (imageData.contentType.includes('webp')) extension = 'webp';
    } else if (originalUrl) {
      const urlMatch = originalUrl.match(/\.(jpg|jpeg|png|gif|webp)/i);
      if (urlMatch) extension = urlMatch[1].toLowerCase();
    }

    const filename = `libro-${libroId}-${Date.now()}.${extension}`;

    form.append('files', imageData.buffer, {
      filename,
      contentType: imageData.contentType,
    });

    const uploadResponse = await fetch(`${STRAPI_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRAPI_TOKEN}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`HTTP ${uploadResponse.status}: ${errorText.substring(0, 200)}`);
    }

    const uploadResult = await uploadResponse.json();

    let imageId = null;
    if (Array.isArray(uploadResult)) {
      imageId = uploadResult[0]?.id;
    } else if (uploadResult.data) {
      imageId = Array.isArray(uploadResult.data) ? uploadResult.data[0]?.id : uploadResult.data?.id;
    } else {
      imageId = uploadResult.id;
    }

    if (!imageId) {
      throw new Error('No se pudo obtener el ID de la imagen subida');
    }

    return imageId;
  } catch (error) {
    throw new Error(`Error subiendo a Strapi: ${error.message}`);
  }
}

async function buscarLibroPorISBN(isbn) {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/libros?filters[isbn_libro][$eq]=${encodeURIComponent(String(isbn))}&populate=portada_libro`,
      { headers: HEADERS }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data?.[0] || null;
  } catch (error) {
    throw error;
  }
}

async function actualizarImagenLibro(libroData) {
  const { isbn_libro, 'Imagen del Libro': imagenLibro } = libroData;

  if (!isbn_libro || !imagenLibro || !imagenLibro.trim()) {
    return { success: false, skipped: true, reason: 'Sin ISBN o sin URL de imagen' };
  }

  try {
    // Buscar libro existente
    const existente = await buscarLibroPorISBN(isbn_libro.trim());
    if (!existente) {
      return { success: false, skipped: true, reason: `Libro con ISBN ${isbn_libro} no encontrado` };
    }

    // Verificar si ya tiene imagen
    const tieneImagen = existente.attributes?.portada_libro?.data !== null && 
                       existente.attributes?.portada_libro?.data !== undefined;
    
    if (tieneImagen) {
      return { success: false, skipped: true, reason: 'Ya tiene imagen' };
    }

    // Descargar y subir imagen
    console.log(`      📥 Descargando imagen para ${isbn_libro}...`);
    const imageData = await descargarImagen(imagenLibro.trim());
    if (!imageData) {
      return { success: false, error: 'No se pudo descargar la imagen' };
    }

    console.log(`      📤 Subiendo imagen a Strapi...`);
    const portadaId = await subirPortadaAStrapi(isbn_libro, imageData, imagenLibro);
    
    // Actualizar libro con la nueva imagen
    const documentId = existente.documentId || existente.id;
    const updateResponse = await fetch(`${STRAPI_URL}/api/libros/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          portada_libro: portadaId,
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
    }

    console.log(`      ✅ Imagen actualizada`);
    return { success: true, isbn: isbn_libro };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🖼️  Restaurando imágenes de libros desde CSV');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Archivo: ${CSV_PATH}`);
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!existsSync(CSV_PATH)) {
    console.error(`❌ Archivo no encontrado: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const libros = parseCSV(csvContent);

  if (libros.length === 0) {
    console.error('❌ No se encontraron libros en el CSV');
    process.exit(1);
  }

  console.log(`📊 Procesando ${libros.length} libros del CSV\n`);
  console.log('ℹ️  Solo se actualizarán libros que NO tienen imagen\n');

  let actualizados = 0;
  let yaTienenImagen = 0;
  let noEncontrados = 0;
  let errores = 0;
  let sinUrl = 0;

  for (let i = 0; i < libros.length; i++) {
    const libro = libros[i];
    const nombre = libro.nombre_libro || libro.isbn_libro || `Fila ${i + 1}`;
    
    process.stdout.write(`[${i + 1}/${libros.length}] ${nombre.substring(0, 50)}... `);

    const resultado = await actualizarImagenLibro(libro);

    if (resultado.success) {
      console.log('✅');
      actualizados++;
    } else if (resultado.skipped) {
      if (resultado.reason === 'Ya tiene imagen') {
        console.log('⏭️  Ya tiene imagen');
        yaTienenImagen++;
      } else if (resultado.reason?.includes('no encontrado')) {
        console.log('⚠️  No encontrado');
        noEncontrados++;
      } else {
        console.log(`⏭️  ${resultado.reason}`);
        sinUrl++;
      }
    } else {
      console.log(`❌ ${resultado.error || 'Error'}`);
      errores++;
    }

    // Pausa para no sobrecargar
    if ((i + 1) % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   ✅ Imágenes actualizadas: ${actualizados}`);
  console.log(`   ⏭️  Ya tenían imagen: ${yaTienenImagen}`);
  console.log(`   ⚠️  No encontrados: ${noEncontrados}`);
  console.log(`   ⏭️  Sin URL de imagen: ${sinUrl}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log(`   📦 Total procesados: ${libros.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

