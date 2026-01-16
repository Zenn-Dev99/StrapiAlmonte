#!/usr/bin/env node

/**
 * Script para importar libros desde CSV a Strapi
 * 
 * Formato CSV esperado:
 *   id_libro,isbn_libro,sku,nombre_libro,Imagen del Libro,id_autor,id_sello,...
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

async function subirPortadaAStrapi(libroId, imageData, originalUrl) {
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

async function buscarAutorPorId(idAutor) {
  try {
    const response = await fetch(
      `${STRAPI_URL}/api/autores?filters[id_autor][$eq]=${encodeURIComponent(String(idAutor))}`,
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
    const response = await fetch(
      `${STRAPI_URL}/api/sellos?filters[id_sello][$eq]=${encodeURIComponent(String(idSello))}`,
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

async function buscarLibroPorISBN(isbn) {
  try {
    // IMPORTANTE: Incluir populate=portada_libro para obtener la imagen existente
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

async function crearOActualizarLibro(libroData) {
  const { id_libro, isbn_libro, sku, nombre_libro, 'Imagen del Libro': imagenLibro, id_autor, id_sello } = libroData;

  // Validar campos requeridos
  if (!nombre_libro || !nombre_libro.trim()) {
    return { success: false, error: 'Falta nombre_libro (requerido)' };
  }

  // Si no hay ISBN, generar uno temporal o saltar
  let isbn = isbn_libro?.trim();
  if (!isbn) {
    // Generar ISBN temporal basado en id_libro
    isbn = `TEMP-${id_libro || Date.now()}`;
    console.log(`      ⚠️  Sin ISBN, usando temporal: ${isbn}`);
  }

  try {
    // Buscar si ya existe por ISBN
    const existente = await Promise.race([
      buscarLibroPorISBN(isbn),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]).catch(() => null);

    // Buscar autor (puede tener múltiples separados por coma, tomar el primero)
    let autorId = null;
    if (id_autor && id_autor.trim()) {
      const idsAutor = id_autor.split(',').map(id => id.trim()).filter(id => id);
      if (idsAutor.length > 0) {
        try {
          const autor = await Promise.race([
            buscarAutorPorId(idsAutor[0]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
          ]);
          if (autor) {
            autorId = autor.documentId || autor.id;
          } else {
            console.log(`      ⚠️  Autor con id_autor=${idsAutor[0]} no encontrado`);
          }
        } catch (error) {
          console.log(`      ⚠️  Error buscando autor ${idsAutor[0]}: ${error.message}`);
        }
      }
    }

    // Buscar sello
    let selloId = null;
    if (id_sello && id_sello.trim()) {
      try {
        const sello = await Promise.race([
          buscarSelloPorId(id_sello.trim()),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        if (sello) {
          selloId = sello.documentId || sello.id;
        } else {
          console.log(`      ⚠️  Sello con id_sello=${id_sello} no encontrado`);
        }
      } catch (error) {
        console.log(`      ⚠️  Error buscando sello ${id_sello}: ${error.message}`);
      }
    }

    // Verificar si el libro existente tiene portada (con populate)
    let portadaExistenteId = null;
    if (existente) {
      // Intentar obtener la portada desde diferentes estructuras de respuesta
      const portadaData = existente.attributes?.portada_libro?.data || 
                         existente.portada_libro?.data ||
                         existente.portada_libro;
      if (portadaData) {
        portadaExistenteId = portadaData.id || portadaData.documentId || portadaData;
      }
    }

    const dataPayload = {
      isbn_libro: isbn,
      nombre_libro: nombre_libro.trim(),
    };

    if (autorId) {
      dataPayload.autor_relacion = autorId;
    }

    if (selloId) {
      dataPayload.sello = selloId;
    }

    // Descargar y subir portada SOLO si hay URL en el CSV
    let portadaId = null;
    if (imagenLibro && imagenLibro.trim()) {
      try {
        console.log(`      📥 Descargando portada desde: ${imagenLibro.substring(0, 60)}...`);
        const imageData = await Promise.race([
          descargarImagen(imagenLibro),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout descargando portada')), 25000))
        ]);
        if (imageData) {
          console.log(`      📤 Subiendo portada a Strapi...`);
          portadaId = await Promise.race([
            subirPortadaAStrapi(id_libro || isbn, imageData, imagenLibro),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout subiendo portada')), 15000))
          ]);
          console.log(`      ✅ Portada subida (ID: ${portadaId})`);
          dataPayload.portada_libro = portadaId;
        }
      } catch (error) {
        console.log(`      ⚠️  No se pudo subir portada: ${error.message}`);
        // Si hay portada existente, preservarla; si no, continuar sin portada
        if (portadaExistenteId && existente) {
          // Preservar la portada existente
          dataPayload.portada_libro = portadaExistenteId;
        }
      }
    } else if (existente && portadaExistenteId) {
      // Si no hay URL de imagen en CSV pero el libro tiene portada existente, preservarla
      dataPayload.portada_libro = portadaExistenteId;
    }

    let result;
    if (existente) {
      // Actualizar existente
      const documentId = existente.documentId || existente.id;
      
      const updateResponse = await Promise.race([
        fetch(`${STRAPI_URL}/api/libros/${documentId}`, {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify({
            data: dataPayload,
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout actualizando libro')), 15000))
      ]);

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
      }

      result = await updateResponse.json();
      return { success: true, action: 'updated', data: result.data };
    } else {
      // Crear nuevo
      const createResponse = await Promise.race([
        fetch(`${STRAPI_URL}/api/libros`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            data: dataPayload,
          }),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout creando libro')), 15000))
      ]);

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`HTTP ${createResponse.status}: ${errorText.substring(0, 200)}`);
      }

      result = await createResponse.json();
      
      // Si se subió la portada después, asociarla
      if (portadaId && result.data) {
        const documentId = result.data.documentId || result.data.id;
        try {
          await Promise.race([
            fetch(`${STRAPI_URL}/api/libros/${documentId}`, {
              method: 'PUT',
              headers: HEADERS,
              body: JSON.stringify({
                data: { portada_libro: portadaId },
              }),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout asociando portada')), 10000))
          ]);
        } catch (error) {
          console.log(`      ⚠️  No se pudo asociar portada: ${error.message}`);
        }
      }

      return { success: true, action: 'created', data: result.data };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  const csvFile = process.argv[2] || 'data/csv/import/libros.csv';
  const csvPath = resolve(__dirname, '..', csvFile);

  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📚 Importando libros desde CSV');
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

  console.log(`📊 Procesando ${registros.length} libros\n`);

  let creados = 0;
  let actualizados = 0;
  let errores = 0;
  let sinIsbn = 0;

  for (let i = 0; i < registros.length; i++) {
    const registro = registros[i];
    const nombre = registro.nombre_libro?.trim();
    const isbn = registro.isbn_libro?.trim();

    process.stdout.write(`[${i + 1}/${registros.length}] ${nombre || 'Sin nombre'}... `);

    const resultado = await crearOActualizarLibro(registro);

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
      if (resultado.error.includes('ISBN')) {
        sinIsbn++;
      }
    }

    // Pequeña pausa para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   ✅ Creados: ${creados}`);
  console.log(`   🔄 Actualizados: ${actualizados}`);
  console.log(`   ❌ Errores: ${errores}`);
  if (sinIsbn > 0) {
    console.log(`   ⚠️  Sin ISBN (usando temporal): ${sinIsbn}`);
  }
  console.log(`   📦 Total: ${registros.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(console.error);

