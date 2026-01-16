#!/usr/bin/env node

/**
 * Script para importar editoriales desde CSV a Strapi
 * 
 * Formato CSV esperado:
 *   id_editorial,nombre_editorial,acronimo,logo,website
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

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
  
  // Si no tiene protocolo, agregar https://
  if (!website.match(/^https?:\/\//i)) {
    website = `https://${website}`;
  }
  
  // Remover espacios y caracteres inválidos al final
  website = website.replace(/\s+$/, '');
  
  return website;
}

async function descargarImagen(url) {
  if (!url || !url.trim()) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

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

async function subirLogoAStrapi(editorialId, imageData, originalUrl) {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();

    // Determinar extensión desde content-type o URL
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

    const filename = `editorial-${editorialId}-${Date.now()}.${extension}`;

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

async function buscarEditorialPorId(idEditorial) {
  try {
    // IMPORTANTE: Incluir populate=logo para obtener la imagen existente
    const response = await fetch(
      `${STRAPI_URL}/api/editoriales?filters[id_editorial][$eq]=${encodeURIComponent(String(idEditorial))}&populate=logo`,
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

async function crearOActualizarEditorial(editorialData) {
  const { id_editorial, nombre_editorial, acronimo, logo, website } = editorialData;

  if (!id_editorial || !nombre_editorial) {
    return { success: false, error: 'Faltan campos requeridos (id_editorial, nombre_editorial)' };
  }

  try {
    // Buscar si ya existe
    const existente = await buscarEditorialPorId(id_editorial);

    // Verificar si la editorial existente tiene logo
    let logoExistenteId = null;
    if (existente) {
      const logoData = existente.attributes?.logo?.data || existente.logo?.data || existente.logo;
      if (logoData) {
        logoExistenteId = logoData.id || logoData.documentId || logoData;
      }
    }

    const dataPayload = {
      id_editorial: String(id_editorial).trim(),
      nombre_editorial: nombre_editorial.trim(),
    };

    if (acronimo && acronimo.trim()) {
      dataPayload.acronimo = acronimo.trim();
    }

    const websiteFormateado = formatearWebsite(website);
    if (websiteFormateado) {
      dataPayload.website = websiteFormateado;
    }

    let logoId = null;
    if (logo && logo.trim()) {
      try {
        console.log(`      📥 Descargando logo desde: ${logo.substring(0, 60)}...`);
        const imageData = await descargarImagen(logo);
        if (imageData) {
          console.log(`      📤 Subiendo logo a Strapi...`);
          logoId = await subirLogoAStrapi(id_editorial, imageData, logo);
          console.log(`      ✅ Logo subido (ID: ${logoId})`);
          dataPayload.logo = logoId;
        }
      } catch (error) {
        console.log(`      ⚠️  No se pudo subir logo: ${error.message}`);
        // Si hay logo existente, preservarlo; si no, continuar sin logo
        if (logoExistenteId && existente) {
          dataPayload.logo = logoExistenteId;
        }
      }
    } else if (existente && logoExistenteId) {
      // Si no hay URL de logo en CSV pero la editorial tiene logo existente, preservarlo
      dataPayload.logo = logoExistenteId;
    }

    let result;
    if (existente) {
      // Actualizar existente
      const documentId = existente.documentId || existente.id;
      const updateResponse = await fetch(`${STRAPI_URL}/api/editoriales/${documentId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          data: dataPayload,
        }),
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
      }

      result = await updateResponse.json();
      return { success: true, action: 'updated', data: result.data };
    } else {
      // Crear nuevo
      const createResponse = await fetch(`${STRAPI_URL}/api/editoriales`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          data: dataPayload,
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`HTTP ${createResponse.status}: ${errorText.substring(0, 200)}`);
      }

      result = await createResponse.json();
      
      // Si se subió el logo después, asociarlo
      if (logoId && result.data) {
        const documentId = result.data.documentId || result.data.id;
        await fetch(`${STRAPI_URL}/api/editoriales/${documentId}`, {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify({
            data: { logo: logoId },
          }),
        });
      }

      return { success: true, action: 'created', data: result.data };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const csvFile = process.argv[2] || 'data/csv/import/editoriales2.csv';
  const csvPath = resolve(__dirname, '..', csvFile);

  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📚 Importando editoriales desde CSV');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Archivo: ${csvPath}`);
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const csvContent = readFileSync(csvPath, 'utf-8');
  const registros = parseCSV(csvContent);

  if (registros.length === 0) {
    console.error('❌ No se encontraron registros en el CSV');
    process.exit(1);
  }

  console.log(`📊 Procesando ${registros.length} editoriales\n`);

  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  for (let i = 0; i < registros.length; i++) {
    const registro = registros[i];
    const idEditorial = registro.id_editorial?.trim();
    const nombre = registro.nombre_editorial?.trim();

    process.stdout.write(`[${i + 1}/${registros.length}] ${nombre || idEditorial || 'Sin nombre'}... `);

    const resultado = await crearOActualizarEditorial(registro);

    if (resultado.success) {
      if (resultado.action === 'created') {
        console.log('✅ Creado');
        creados++;
      } else {
        console.log('✅ Actualizado');
        actualizados++;
      }
    } else {
      console.log(`❌ Error: ${resultado.error}`);
      errores++;
    }

    // Pequeña pausa para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   ✅ Creados: ${creados}`);
  console.log(`   🔄 Actualizados: ${actualizados}`);
  console.log(`   ❌ Errores: ${errores}`);
  console.log(`   📦 Total: ${registros.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);

