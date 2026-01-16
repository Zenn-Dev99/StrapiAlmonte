#!/usr/bin/env node

/**
 * Script para importar autores desde CSV a Strapi
 * 
 * Uso:
 *   node scripts/importar-autores-csv.mjs <archivo.csv>
 * 
 * Formato CSV esperado (con encabezados):
 *   id_autor,nombre_completo_autor,biografia
 *   AUT-001,"Gabriel García Márquez","Escritor colombiano..."
 *   AUT-002,"Isabel Allende","Escritora chilena..."
 * 
 * O formato simple:
 *   nombre_completo_autor
 *   "Gabriel García Márquez"
 *   "Isabel Allende"
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
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
  console.error('   Configura en .env o exporta la variable');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

// Parsear CSV simple
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
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length > 0 && values.some(v => v)) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.replace(/^["']|["']$/g, '') || '';
      });
      data.push(row);
    }
  }

  return data;
}

/**
 * Construye el nombre completo automáticamente desde nombres y apellidos
 */
function construirNombreCompleto(nombres, primerApellido, segundoApellido) {
  const partes = [nombres, primerApellido, segundoApellido].filter(Boolean);
  return partes.join(' ').trim();
}

/**
 * Convierte texto plano a formato Strapi Blocks (Rich Text)
 */
function textoABlocks(texto) {
  if (!texto || !texto.trim()) return null;
  
  // Limpiar comillas dobles al inicio y final
  const textoLimpio = texto.trim().replace(/^["']+|["']+$/g, '');
  
  // Convertir saltos de línea a párrafos
  const parrafos = textoLimpio.split(/\n\n+/).filter(p => p.trim());
  
  if (parrafos.length === 0) return null;
  
  // Crear estructura de Blocks de Strapi
  const blocks = parrafos.map(parrafo => ({
    type: 'paragraph',
    children: [
      {
        type: 'text',
        text: parrafo.trim().replace(/\n/g, ' '),
      }
    ]
  }));
  
  return blocks;
}

async function importarAutor(autorData) {
  const url = `${STRAPI_URL}/api/autores`;

  // Extraer campos del CSV
  const nombres = (autorData.nombres || '').trim();
  const primerApellido = (autorData.primer_apellido || '').trim();
  const segundoApellido = (autorData.segundo_apellido || '').trim();
  const idAutor = (autorData.id_autor || '').trim();
  const fotoUrl = (autorData.foto || '').trim();
  const website = (autorData.website || '').trim();
  const resegna = (autorData.resegna || '').trim();
  const tipoAutor = (autorData.tipo_autor || '').trim();

  // Construir nombre completo automáticamente
  let nombreCompleto = '';
  if (autorData.nombre_completo_autor) {
    // Si ya viene el nombre completo, usarlo
    nombreCompleto = autorData.nombre_completo_autor.trim();
  } else if (nombres || primerApellido || segundoApellido) {
    // Construir desde campos separados
    nombreCompleto = construirNombreCompleto(nombres, primerApellido, segundoApellido);
  } else if (autorData.nombre && autorData.apellidos) {
    nombreCompleto = `${autorData.nombre} ${autorData.apellidos}`.trim();
  } else if (autorData.nombre) {
    nombreCompleto = autorData.nombre.trim();
  } else if (autorData.autor) {
    nombreCompleto = autorData.autor.trim();
  }

  // Caso especial: Si solo tenemos id_autor y tipo_autor, actualizar el existente
  if (!nombreCompleto && idAutor && tipoAutor) {
    // Buscar autor existente por id_autor y solo actualizar tipo_autor
    try {
      const existingResponse = await fetch(`${url}?filters[id_autor][$eq]=${encodeURIComponent(idAutor)}`, {
        method: 'GET',
        headers: HEADERS,
      });
      
      if (existingResponse.ok) {
        const existing = await existingResponse.json();
        if (existing.data && existing.data.length > 0) {
          const autorExistente = existing.data[0];
          const autorId = autorExistente.documentId || autorExistente.id;
          
          // Solo actualizar tipo_autor
          const updateResponse = await fetch(`${url}/${autorId}`, {
            method: 'PUT',
            headers: HEADERS,
            body: JSON.stringify({
              data: {
                tipo_autor: tipoAutor === 'Persona' || tipoAutor === 'Empresa' ? tipoAutor : undefined,
              },
            }),
          });
          
          if (updateResponse.ok) {
            console.log(`   ✅ Actualizado tipo_autor: ${idAutor} -> ${tipoAutor}`);
            return { success: true, action: 'updated_tipo', id: autorId };
          } else {
            const errorText = await updateResponse.text();
            throw new Error(`HTTP ${updateResponse.status}: ${errorText}`);
          }
        } else {
          return { success: false, error: `Autor con id_autor=${idAutor} no encontrado para actualizar tipo_autor` };
        }
      }
    } catch (error) {
      return { success: false, error: `Error buscando/autor: ${error.message}` };
    }
  }

  if (!nombreCompleto && !idAutor) {
    return { success: false, error: 'Nombre vacío y sin id_autor - se requiere nombres, nombre_completo_autor o id_autor' };
  }

  // Preparar datos según el schema de Strapi
  const data = {
    data: {
      nombre_completo_autor: nombreCompleto,
    },
  };

  // Agregar campos separados
  if (nombres) data.data.nombres = nombres;
  if (primerApellido) data.data.primer_apellido = primerApellido;
  if (segundoApellido) data.data.segundo_apellido = segundoApellido;

  // Agregar id_autor
  if (idAutor) {
    data.data.id_autor = String(idAutor);
  } else if (autorData.id) {
    data.data.id_autor = `AUT-${String(autorData.id).padStart(4, '0')}`;
  }

  // Agregar website
  if (website) {
    // Limpiar URL (remover espacios, comillas)
    const urlLimpia = website.replace(/^["']+|["']+$/g, '').trim();
    if (urlLimpia && (urlLimpia.startsWith('http://') || urlLimpia.startsWith('https://'))) {
      data.data.website = urlLimpia;
    } else if (urlLimpia && !urlLimpia.startsWith('http')) {
      // Agregar https:// si no tiene protocolo
      data.data.website = `https://${urlLimpia}`;
    }
  }

  // Agregar resegna (biografía) como Blocks
  if (resegna) {
    const blocks = textoABlocks(resegna);
    if (blocks) {
      data.data.resegna = blocks;
    }
  }

  // Agregar tipo_autor (Persona o Empresa)
  if (tipoAutor && (tipoAutor === 'Persona' || tipoAutor === 'Empresa')) {
    data.data.tipo_autor = tipoAutor;
  }

  // Nota: La foto (URL) se manejará después de crear el autor
  // porque requiere subir la imagen a Strapi primero

  // Verificar si ya existe por id_autor
  if (data.data.id_autor) {
    try {
      const existing = await fetch(`${url}?filters[id_autor][$eq]=${encodeURIComponent(data.data.id_autor)}`, {
        method: 'GET',
        headers: HEADERS,
      }).then(res => res.json());

      if (existing.data && existing.data.length > 0) {
        console.log(`   ⚠️  Autor ya existe: ${data.data.nombre_completo_autor} (${data.data.id_autor})`);
        return { success: false, reason: 'exists', id: existing.data[0].id };
      }
    } catch (error) {
      // Continuar si hay error al verificar
    }
  }

  // También verificar por nombre completo (puede haber duplicados con diferente ID)
  try {
    const existing = await fetch(`${url}?filters[nombre_completo_autor][$eq]=${encodeURIComponent(data.data.nombre_completo_autor)}`, {
      method: 'GET',
      headers: HEADERS,
    }).then(res => res.json());

    if (existing.data && existing.data.length > 0) {
      // Si ya existe pero no tiene id_autor, actualizar con el id_autor del CSV
      if (data.data.id_autor && !existing.data[0].attributes?.id_autor) {
        try {
          await fetch(`${url}/${existing.data[0].id}`, {
            method: 'PUT',
            headers: HEADERS,
            body: JSON.stringify({ data: { id_autor: data.data.id_autor } }),
          });
          console.log(`   ✅ Actualizado id_autor: ${data.data.nombre_completo_autor} (${data.data.id_autor})`);
        } catch (error) {
          // Continuar si hay error
        }
      }
      console.log(`   ⚠️  Autor ya existe: ${data.data.nombre_completo_autor}`);
      return { success: false, reason: 'exists', id: existing.data[0].id };
    }
  } catch (error) {
    // Continuar si hay error al verificar
  }


  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    // En Strapi v5, usar documentId si está disponible, sino id
    const autorId = result.data.documentId || result.data.id;
    
    // Si hay foto URL, intentar descargarla y subirla
    if (fotoUrl && fotoUrl.trim()) {
      try {
        await subirFotoAutor(autorId, fotoUrl);
      } catch (fotoError) {
        // No fallar si la foto no se puede subir, solo advertir
        console.log(`      ⚠️  Foto no subida: ${fotoError.message}`);
      }
    }

    console.log(`   ✅ Creado: ${nombreCompleto}${idAutor ? ` (${idAutor})` : ''}`);
    return { success: true, id: autorId, data: result.data };
  } catch (error) {
    console.error(`   ❌ Error: ${nombreCompleto} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Descarga una imagen desde una URL
 */
async function descargarImagen(url) {
  try {
    console.log(`      📥 Descargando imagen desde: ${url.substring(0, 60)}...`);
    
    // Usar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos
    
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
    const contentLength = response.headers.get('content-length');
    
    if (!contentType.startsWith('image/')) {
      throw new Error(`No es una imagen válida: ${contentType}`);
    }

    const buffer = await response.arrayBuffer();
    
    console.log(`      ✅ Imagen descargada (${Math.round(buffer.byteLength / 1024)}KB, ${contentType})`);
    
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
async function subirImagenAStrapi(autorId, imageData, originalUrl) {
  try {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    
    // Obtener extensión del archivo desde content-type o URL
    let extension = 'jpg';
    if (imageData.contentType.includes('png')) extension = 'png';
    else if (imageData.contentType.includes('gif')) extension = 'gif';
    else if (imageData.contentType.includes('webp')) extension = 'webp';
    else if (imageData.contentType.includes('jpeg')) extension = 'jpg';
    
    // Intentar obtener extensión desde URL
    try {
      const urlMatch = originalUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
      if (urlMatch) {
        extension = urlMatch[1].toLowerCase();
        if (extension === 'jpeg') extension = 'jpg';
      }
    } catch (e) {
      // Ignorar si no se puede parsear la URL
    }
    
    const filename = `autor-${autorId}-${Date.now()}.${extension}`;
    
    form.append('files', imageData.buffer, {
      filename,
      contentType: imageData.contentType,
    });

    console.log(`      📤 Subiendo imagen a Strapi (${filename})...`);

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
    
    // Obtener el ID de la imagen subida
    // La respuesta puede ser un array o un objeto con data
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

    console.log(`      ✅ Imagen subida (ID: ${imageId}), asociando al autor...`);

    // Actualizar el autor para asociar la imagen
    const updateResponse = await fetch(`${STRAPI_URL}/api/autores/${autorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STRAPI_TOKEN}`,
      },
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

    console.log(`      ✅ Imagen asociada exitosamente al autor`);
    
    return { imageId, uploadResult };
  } catch (error) {
    throw new Error(`Error subiendo a Strapi: ${error.message}`);
  }
}

/**
 * Intenta descargar y subir una foto desde URL a Strapi
 * Nota: Esto requiere que la URL sea accesible públicamente
 */
async function subirFotoAutor(autorId, fotoUrl) {
  try {
    if (!fotoUrl || !fotoUrl.trim()) {
      throw new Error('URL de foto vacía');
    }

    const urlLimpia = fotoUrl.trim();
    
    if (!urlLimpia.startsWith('http://') && !urlLimpia.startsWith('https://')) {
      throw new Error(`URL inválida: ${urlLimpia.substring(0, 50)}`);
    }

    // Paso 1: Descargar la imagen
    const imageData = await descargarImagen(urlLimpia);
    
    // Paso 2: Subir a Strapi
    const result = await subirImagenAStrapi(autorId, imageData, urlLimpia);
    
    return result;
  } catch (error) {
    throw error;
  }
}

async function main() {
  const csvFile = process.argv[2];

  if (!csvFile) {
    console.error('❌ Falta el archivo CSV');
    console.error('');
    console.error('Uso: node scripts/importar-autores-csv.mjs <archivo.csv>');
    console.error('');
  console.error('Formato CSV esperado:');
  console.error('  id_autor,nombres,primer_apellido,segundo_apellido,foto,website,resegna');
  console.error('  1,"Isabel","Allende",,"https://...","https://isabelallende.com","Biografía..."');
  console.error('');
  console.error('El campo nombre_completo_autor se construye automáticamente desde:');
  console.error('  nombres + primer_apellido + segundo_apellido');
    process.exit(1);
  }

  const csvPath = resolve(csvFile);
  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📚 Importando Autores desde CSV');
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

  console.log(`\n📊 Encontrados ${autores.length} autores en el CSV\n`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < autores.length; i++) {
    const autor = autores[i];
    process.stdout.write(`[${i + 1}/${autores.length}] `);
    
    const result = await importarAutor(autor);
    
    if (result.success) {
      success++;
    } else if (result.reason === 'exists') {
      skipped++;
    } else {
      errors++;
    }

    // Pequeña pausa para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log(`   ✅ Creados: ${success}`);
  console.log(`   ⚠️  Ya existían: ${skipped}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📦 Total: ${autores.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (success > 0) {
    console.log('\n💡 Próximo paso: Sincronizar a WooCommerce');
    console.log('   node scripts/sincronizar-autores-editoriales-woo.mjs');
  }
}

main().catch(console.error);

