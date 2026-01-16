#!/usr/bin/env node

/**
 * Script para importar sellos desde CSV a Strapi
 * 
 * Formato CSV esperado:
 *   id_sello,nombre_sello,logo,website,id_editorial
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

async function subirLogoAStrapi(selloId, imageData, originalUrl) {
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

async function buscarEditorialPorId(idEditorial) {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/editoriales?filters[id_editorial][$eq]=${encodeURIComponent(String(idEditorial))}`,
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

async function buscarSelloPorId(idSello) {
  try {
    // IMPORTANTE: Incluir populate=logo para obtener la imagen existente
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

async function crearOActualizarSello(selloData) {
  const { id_sello, nombre_sello, acronimo, logo, website, id_editorial } = selloData;

  if (!id_sello || !nombre_sello) {
    return { success: false, error: 'Faltan campos requeridos (id_sello, nombre_sello)' };
  }

  try {
    // Buscar si ya existe (con timeout)
    const existente = await Promise.race([
      buscarSelloPorId(id_sello),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout buscando sello')), 10000))
    ]).catch(() => null);

    // Buscar editorial si se proporciona id_editorial (con timeout)
    let editorialId = null;
    if (id_editorial && id_editorial.trim()) {
      try {
        const editorial = await Promise.race([
          buscarEditorialPorId(id_editorial.trim()),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout buscando editorial')), 10000))
        ]);
        if (editorial) {
          editorialId = editorial.documentId || editorial.id;
        } else {
          console.log(`      ⚠️  Editorial con id_editorial=${id_editorial} no encontrada`);
        }
      } catch (error) {
        console.log(`      ⚠️  Error buscando editorial ${id_editorial}: ${error.message}`);
      }
    }

    // Verificar si el sello existente tiene logo
    let logoExistenteId = null;
    if (existente) {
      const logoData = existente.attributes?.logo?.data || existente.logo?.data || existente.logo;
      if (logoData) {
        logoExistenteId = logoData.id || logoData.documentId || logoData;
      }
    }

    const dataPayload = {
      id_sello: String(id_sello).trim(),
      nombre_sello: nombre_sello.trim(),
    };

    if (acronimo && acronimo.trim()) {
      dataPayload.acronimo = acronimo.trim();
    }

    if (editorialId) {
      dataPayload.editorial = editorialId;
    }

    const websiteFormateado = formatearWebsite(website);
    if (websiteFormateado) {
      dataPayload.website = websiteFormateado;
    }

    let logoId = null;
    if (logo && logo.trim()) {
      try {
        console.log(`      📥 Descargando logo desde: ${logo.substring(0, 60)}...`);
        const imageData = await Promise.race([
          descargarImagen(logo),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout descargando logo')), 25000))
        ]);
        if (imageData) {
          console.log(`      📤 Subiendo logo a Strapi...`);
          logoId = await Promise.race([
            subirLogoAStrapi(id_sello, imageData, logo),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout subiendo logo')), 15000))
          ]);
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
      // Si no hay URL de logo en CSV pero el sello tiene logo existente, preservarlo
      dataPayload.logo = logoExistenteId;
    }

    let result;
    if (existente) {
      // Actualizar existente (con timeout)
      const documentId = existente.documentId || existente.id;
      const updateResponse = await Promise.race([
        fetch(`${STRAPI_URL}/api/sellos/${documentId}`, {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify({
            data: dataPayload,
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout actualizando sello')), 15000))
      ]);

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
      }

      result = await updateResponse.json();
      return { success: true, action: 'updated', data: result.data };
    } else {
      // Crear nuevo (con timeout)
      const createResponse = await Promise.race([
        fetch(`${STRAPI_URL}/api/sellos`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            data: dataPayload,
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout creando sello')), 15000))
      ]);

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`HTTP ${createResponse.status}: ${errorText.substring(0, 200)}`);
      }

      result = await createResponse.json();
      
      // Si se subió el logo después, asociarlo (con timeout)
      if (logoId && result.data) {
        const documentId = result.data.documentId || result.data.id;
        try {
          await Promise.race([
            fetch(`${STRAPI_URL}/api/sellos/${documentId}`, {
              method: 'PUT',
              headers: HEADERS,
              body: JSON.stringify({
                data: { logo: logoId },
              }),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout asociando logo')), 10000))
          ]);
        } catch (error) {
          console.log(`      ⚠️  No se pudo asociar logo: ${error.message}`);
        }
      }

      return { success: true, action: 'created', data: result.data };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const csvFile = process.argv[2] || 'data/csv/import/sellos3.csv';
  const csvPath = resolve(__dirname, '..', csvFile);

  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('🏷️  Importando sellos desde CSV');
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

  console.log(`📊 Procesando ${registros.length} sellos\n`);

  let creados = 0;
  let actualizados = 0;
  let errores = 0;

  for (let i = 0; i < registros.length; i++) {
    const registro = registros[i];
    const idSello = registro.id_sello?.trim();
    const nombre = registro.nombre_sello?.trim();

    process.stdout.write(`[${i + 1}/${registros.length}] ${nombre || idSello || 'Sin nombre'}... `);

    const resultado = await crearOActualizarSello(registro);

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

