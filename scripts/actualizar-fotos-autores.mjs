#!/usr/bin/env node

/**
 * Script para actualizar las fotos de autores existentes desde CSV
 * 
 * Uso:
 *   node scripts/actualizar-fotos-autores.mjs <archivo.csv>
 * 
 * Este script:
 * - Lee el CSV con id_autor y foto (URL)
 * - Busca cada autor en Strapi por id_autor
 * - Si existe y tiene URL de foto, descarga y asocia la imagen
 * - NO crea nuevos autores, solo actualiza fotos
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = resolve(__dirname, '..', '.env');
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

/**
 * Parsea CSV simple (separado por comas, maneja comillas)
 */
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parsear headers
  const headerLine = lines[0];
  const headers = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  headers.push(current.trim());

  const data = [];

  // Parsear cada línea
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = [];
    current = '';
    inQuotes = false;
    
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

/**
 * Descarga una imagen desde una URL
 */
async function descargarImagen(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Strapi-Importer/1.0)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    if (!contentType.startsWith('image/')) {
      throw new Error(`No es una imagen válida: ${contentType}`);
    }

    const buffer = await response.arrayBuffer();
    
    return {
      buffer: Buffer.from(buffer),
      contentType,
      size: buffer.byteLength,
    };
  } catch (error) {
    throw new Error(`Error descargando imagen: ${error.message}`);
  }
}

/**
 * Sube una imagen a Strapi y la asocia al autor
 */
async function subirYAsociarFoto(autorId, imageData, originalUrl) {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    let extension = 'jpg';
    if (imageData.contentType.includes('png')) extension = 'png';
    else if (imageData.contentType.includes('gif')) extension = 'gif';
    else if (imageData.contentType.includes('webp')) extension = 'webp';
    else if (imageData.contentType.includes('jpeg')) extension = 'jpg';
    
    try {
      const urlMatch = originalUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
      if (urlMatch) {
        extension = urlMatch[1].toLowerCase();
        if (extension === 'jpeg') extension = 'jpg';
      }
    } catch (e) {
      // Ignorar
    }
    
    const filename = `autor-${autorId}-${Date.now()}.${extension}`;
    
    form.append('files', imageData.buffer, {
      filename,
      contentType: imageData.contentType,
    });

    // Subir a Strapi
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
    
    // Obtener el ID de la imagen
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

    // Actualizar el autor para asociar la imagen
    const updateResponse = await fetch(`${STRAPI_URL}/api/autores/${autorId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          foto: imageId,
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Error asociando imagen: HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
    }

    return imageId;
  } catch (error) {
    throw new Error(`Error subiendo a Strapi: ${error.message}`);
  }
}

/**
 * Busca un autor por id_autor
 */
async function buscarAutorPorId(idAutor) {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/autores?filters[id_autor][$eq]=${encodeURIComponent(idAutor)}`,
      { headers: HEADERS }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function main() {
  const csvFile = process.argv[2];

  if (!csvFile) {
    console.error('❌ Falta el archivo CSV');
    console.error('');
    console.error('Uso: node scripts/actualizar-fotos-autores.mjs <archivo.csv>');
    process.exit(1);
  }

  const csvPath = resolve(csvFile);
  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📸 Actualizando fotos de autores desde CSV');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Archivo: ${csvPath}`);
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const csvContent = readFileSync(csvPath, 'utf-8');
  const autores = parseCSV(csvContent);

  if (autores.length === 0) {
    console.error('❌ No se encontraron datos en el CSV');
    process.exit(1);
  }

  console.log(`\n📊 Encontrados ${autores.length} registros en el CSV\n`);

  let actualizados = 0;
  let noEncontrados = 0;
  let sinFoto = 0;
  let errores = 0;
  let yaTienenFoto = 0;

  for (let i = 0; i < autores.length; i++) {
    const autor = autores[i];
    const idAutor = autor.id_autor?.trim();
    const fotoUrl = autor.foto?.trim();
    const nombre = autor.nombres && autor.primer_apellido 
      ? `${autor.nombres} ${autor.primer_apellido}`.trim()
      : idAutor || `Registro ${i + 1}`;

    process.stdout.write(`[${i + 1}/${autores.length}] ${nombre}... `);

    if (!idAutor) {
      console.log('⚠️  Sin id_autor');
      noEncontrados++;
      continue;
    }

    if (!fotoUrl) {
      console.log('⚠️  Sin URL de foto');
      sinFoto++;
      continue;
    }

    // Buscar autor en Strapi
    const autorStrapi = await buscarAutorPorId(idAutor);
    
    if (!autorStrapi) {
      console.log('❌ No encontrado en Strapi');
      noEncontrados++;
      continue;
    }

    const autorId = autorStrapi.id;
    const nombreCompleto = autorStrapi.attributes?.nombre_completo_autor || nombre;

    // Verificar si ya tiene foto
    if (autorStrapi.attributes?.foto?.data) {
      console.log('ℹ️  Ya tiene foto');
      yaTienenFoto++;
      continue;
    }

    // Descargar y subir foto
    try {
      process.stdout.write('📥 Descargando... ');
      const imageData = await descargarImagen(fotoUrl);
      
      process.stdout.write('📤 Subiendo... ');
      await subirYAsociarFoto(autorId, imageData, fotoUrl);
      
      console.log(`✅ Foto actualizada`);
      actualizados++;
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      errores++;
    }

    // Pequeña pausa
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   ✅ Fotos actualizadas: ${actualizados}`);
  console.log(`   ℹ️  Ya tenían foto: ${yaTienenFoto}`);
  console.log(`   ⚠️  Sin URL de foto: ${sinFoto}`);
  console.log(`   ❌ No encontrados: ${noEncontrados}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log(`   📦 Total procesados: ${autores.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);

