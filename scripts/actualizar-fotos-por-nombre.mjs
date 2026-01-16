#!/usr/bin/env node

/**
 * Script para actualizar fotos buscando por nombre completo
 * (alternativa cuando id_autor no funciona)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  console.error('❌ Falta STRAPI_TOKEN');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

function construirNombreCompleto(nombres, primerApellido, segundoApellido) {
  const partes = [nombres, primerApellido, segundoApellido].filter(Boolean);
  return partes.join(' ').trim();
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

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

async function descargarImagen(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Strapi-Importer/1.0)' },
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

async function subirYAsociarFoto(autorId, imageData, originalUrl) {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    let extension = 'jpg';
    if (imageData.contentType.includes('png')) extension = 'png';
    else if (imageData.contentType.includes('gif')) extension = 'gif';
    else if (imageData.contentType.includes('webp')) extension = 'webp';
    
    try {
      const urlMatch = originalUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
      if (urlMatch) {
        extension = urlMatch[1].toLowerCase();
        if (extension === 'jpeg') extension = 'jpg';
      }
    } catch (e) {}

    const filename = `autor-${autorId}-${Date.now()}.${extension}`;
    form.append('files', imageData.buffer, { filename, contentType: imageData.contentType });

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
      throw new Error('No se pudo obtener el ID de la imagen');
    }

    // Actualizar autor (asegurar que se publique)
    const updateResponse = await fetch(`${STRAPI_URL}/api/autores/${autorId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          foto: imageId,
        },
        // Asegurar que se publique si está en modo draftAndPublish
        published: true,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Error asociando: HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
    }

    return imageId;
  } catch (error) {
    throw new Error(`Error subiendo: ${error.message}`);
  }
}

async function buscarAutorPorNombre(nombreCompleto) {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/autores?filters[nombre_completo_autor][$eq]=${encodeURIComponent(nombreCompleto)}`,
      { headers: HEADERS }
    );

    if (!response.ok) return null;

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
  const csvFile = process.argv[2] || 'data/csv/import/autores_strapi2.csv';
  const limit = 300;

  const csvPath = resolve(csvFile);
  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📸 Actualizando fotos de ${limit} autores (buscando por nombre)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Archivo: ${csvPath}`);
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const csvContent = readFileSync(csvPath, 'utf-8');
  const todosAutores = parseCSV(csvContent);

  const autoresConFoto = todosAutores
    .filter(a => {
      const nombres = a.nombres?.trim();
      const primerApellido = a.primer_apellido?.trim();
      return nombres && primerApellido && a.foto?.trim();
    })
    .slice(0, limit);

  console.log(`\n📊 Procesando ${autoresConFoto.length} autores\n`);

  let actualizados = 0;
  let noEncontrados = 0;
  let yaTienenFoto = 0;
  let errores = 0;

  for (let i = 0; i < autoresConFoto.length; i++) {
    const autor = autoresConFoto[i];
    const nombreCompleto = construirNombreCompleto(
      autor.nombres,
      autor.primer_apellido,
      autor.segundo_apellido
    );
    const fotoUrl = autor.foto.trim();

    process.stdout.write(`[${i + 1}/${autoresConFoto.length}] ${nombreCompleto}... `);

    const autorStrapi = await buscarAutorPorNombre(nombreCompleto);
    
    if (!autorStrapi) {
      console.log('❌ No encontrado');
      noEncontrados++;
      continue;
    }

    const autorId = autorStrapi.id;

    if (autorStrapi.attributes?.foto?.data) {
      console.log('ℹ️  Ya tiene foto');
      yaTienenFoto++;
      continue;
    }

    try {
      process.stdout.write('📥 ');
      const imageData = await descargarImagen(fotoUrl);
      process.stdout.write('📤 ');
      await subirYAsociarFoto(autorId, imageData, fotoUrl);
      console.log('✅');
      actualizados++;
    } catch (error) {
      console.log(`❌ ${error.message.substring(0, 50)}`);
      errores++;
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   ✅ Fotos actualizadas: ${actualizados}`);
  console.log(`   ℹ️  Ya tenían foto: ${yaTienenFoto}`);
  console.log(`   ❌ No encontrados: ${noEncontrados}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log(`   📦 Total procesados: ${autoresConFoto.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);

