#!/usr/bin/env node

/**
 * Script para restaurar las imágenes de los sellos desde el CSV
 * Solo actualiza sellos que NO tienen imagen
 * 
 * Uso:
 *   node scripts/restaurar-imagenes-sellos.mjs
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

const CSV_PATH = resolve(__dirname, '..', 'data', 'csv', 'import', 'sellos3.csv');

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

function formatearWebsite(url) {
  if (!url || !url.trim()) return null;
  
  let website = url.trim();
  
  if (!website.match(/^https?:\/\//i)) {
    website = `https://${website}`;
  }
  
  website = website.replace(/\s+$/, '');
  
  return website;
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

async function subirLogoAStrapi(selloId, imageData, originalUrl) {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();

    let extension = 'jpg';
    if (imageData.contentType) {
      if (imageData.contentType.includes('png')) extension = 'png';
      else if (imageData.contentType.includes('gif')) extension = 'gif';
      else if (imageData.contentType.includes('webp')) extension = 'webp';
      else if (imageData.contentType.includes('svg')) extension = 'svg';
    } else if (originalUrl) {
      const urlMatch = originalUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)/i);
      if (urlMatch) extension = urlMatch[1].toLowerCase();
    }

    const filename = `sello-${selloId}-${Date.now()}.${extension}`;

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

async function buscarSelloPorId(idSello) {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/sellos?filters[id_sello][$eq]=${encodeURIComponent(String(idSello))}&populate=logo`,
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

async function actualizarImagenSello(selloData) {
  const { id_sello, nombre_sello, logo } = selloData;

  if (!id_sello || !logo || !logo.trim()) {
    return { success: false, skipped: true, reason: 'Sin id_sello o sin URL de logo' };
  }

  try {
    // Buscar sello existente
    const existente = await buscarSelloPorId(id_sello.trim());
    if (!existente) {
      return { success: false, skipped: true, reason: `Sello con id_sello ${id_sello} no encontrado` };
    }

    // Verificar si ya tiene logo
    const tieneLogo = existente.attributes?.logo?.data !== null && 
                     existente.attributes?.logo?.data !== undefined;
    
    if (tieneLogo) {
      return { success: false, skipped: true, reason: 'Ya tiene logo' };
    }

    // Descargar y subir logo
    console.log(`      📥 Descargando logo para ${nombre_sello}...`);
    const imageData = await descargarImagen(logo.trim());
    if (!imageData) {
      return { success: false, error: 'No se pudo descargar el logo' };
    }

    console.log(`      📤 Subiendo logo a Strapi...`);
    const logoId = await subirLogoAStrapi(id_sello, imageData, logo);
    
    // Actualizar sello con el nuevo logo
    const documentId = existente.documentId || existente.id;
    const updateResponse = await fetch(`${STRAPI_URL}/api/sellos/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          logo: logoId,
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
    }

    console.log(`      ✅ Logo actualizado`);
    return { success: true, id_sello };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🖼️  Restaurando logos de sellos desde CSV');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Archivo: ${CSV_PATH}`);
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!existsSync(CSV_PATH)) {
    console.error(`❌ Archivo no encontrado: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const sellos = parseCSV(csvContent);

  if (sellos.length === 0) {
    console.error('❌ No se encontraron sellos en el CSV');
    process.exit(1);
  }

  console.log(`📊 Procesando ${sellos.length} sellos del CSV\n`);
  console.log('ℹ️  Solo se actualizarán sellos que NO tienen logo\n');

  let actualizados = 0;
  let yaTienenLogo = 0;
  let noEncontrados = 0;
  let errores = 0;
  let sinUrl = 0;

  for (let i = 0; i < sellos.length; i++) {
    const sello = sellos[i];
    const nombre = sello.nombre_sello || sello.id_sello || `Fila ${i + 1}`;
    
    process.stdout.write(`[${i + 1}/${sellos.length}] ${nombre.substring(0, 50)}... `);

    const resultado = await actualizarImagenSello(sello);

    if (resultado.success) {
      console.log('✅');
      actualizados++;
    } else if (resultado.skipped) {
      if (resultado.reason === 'Ya tiene logo') {
        console.log('⏭️  Ya tiene logo');
        yaTienenLogo++;
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
  console.log(`   ✅ Logos actualizados: ${actualizados}`);
  console.log(`   ⏭️  Ya tenían logo: ${yaTienenLogo}`);
  console.log(`   ⚠️  No encontrados: ${noEncontrados}`);
  console.log(`   ⏭️  Sin URL de logo: ${sinUrl}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log(`   📦 Total procesados: ${sellos.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);

