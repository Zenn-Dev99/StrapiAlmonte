#!/usr/bin/env node

/**
 * Script para actualizar los campos ID (id_autor, id_editorial, etc.) en todos los libros existentes
 * 
 * Este script pobla los campos ID desde las relaciones para poder identificar duplicados
 * 
 * Uso:
 *   node scripts/actualizar-ids-libros.mjs
 *   node scripts/actualizar-ids-libros.mjs --dry-run  # Solo mostraría sin actualizar
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
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10); // Reducido a 3 para evitar sobrecarga
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '2000', 10); // 2 segundos entre reintentos
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  console.error('   Configura en strapi/.env o exporta la variable');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

/**
 * Función helper para reintentos con backoff exponencial
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isConnectionError = error.message.includes('ECONNRESET') || 
                                error.message.includes('ETIMEDOUT') ||
                                error.message.includes('ECONNREFUSED');
      
      if (attempt === maxRetries || !isConnectionError) {
        throw error;
      }
      
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      console.log(`  ⚠️  Error de conexión, reintentando en ${backoffDelay}ms... (intento ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

/**
 * Obtiene un libro con todas sus relaciones pobladas
 */
async function obtenerLibroConRelaciones(libroId) {
  try {
    return await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
      
      try {
        // Popular relaciones - id_coleccion es privado, se obtendrá después si es necesario
        const populateParams = new URLSearchParams({
          'populate[autor_relacion][fields][0]': 'id_autor',
          'populate[editorial][fields][0]': 'id_editorial',
          'populate[sello][fields][0]': 'id_sello',
          'populate[coleccion]': 'true', // Solo la relación, sin campos (id_coleccion es privado)
          'populate[obra][fields][0]': 'codigo_obra',
        });
        
        const response = await fetch(
          `${STRAPI_URL}/api/libros/${libroId}?${populateParams.toString()}`,
          { 
            headers: HEADERS,
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Si es 400 o 404, el libro probablemente no existe o fue eliminado
          if (response.status === 400 || response.status === 404) {
            return null; // No es un error crítico, solo saltamos este libro
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();
        return json?.data || null;
      } catch (error) {
        clearTimeout(timeoutId);
        // Si el error es de abort o timeout, relanzar para reintento
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          throw error;
        }
        // Para otros errores, verificar si es un error de cliente (4xx)
        if (error.message.includes('HTTP 4')) {
          return null; // Libro no encontrado o inválido, no es crítico
        }
        throw error;
      }
    });
  } catch (error) {
    // Solo mostrar error si no es un 400/404 (libro no existe)
    if (!error.message.includes('HTTP 400') && !error.message.includes('HTTP 404')) {
      console.error(`❌ Error obteniendo libro ${libroId}:`, error.message);
    }
    return null;
  }
}

/**
 * Extrae los IDs de las relaciones
 */
function extraerIds(libro) {
  const ids = {
    id_autor: null,
    id_editorial: null,
    id_sello: null,
    id_coleccion: null,
    id_obra: null,
  };

  // Los datos vienen directamente en el objeto libro (no en attributes cuando se usa populate con fields)
  // Estructura: libro.autor_relacion = { id: ..., id_autor: "273" }
  const autorRel = libro.autor_relacion || libro.attributes?.autor_relacion;
  const editorial = libro.editorial || libro.attributes?.editorial;
  const sello = libro.sello || libro.attributes?.sello;
  const coleccion = libro.coleccion || libro.attributes?.coleccion;
  const obra = libro.obra || libro.attributes?.obra;

  // Extraer id_autor
  // Estructura cuando se usa populate con fields: { id: ..., id_autor: "273" }
  if (autorRel) {
    if (autorRel.data) {
      // Estructura anidada: { data: { id_autor: ... } }
      ids.id_autor = autorRel.data.id_autor || autorRel.data.attributes?.id_autor || null;
    } else {
      // Estructura directa: { id_autor: "273" }
      ids.id_autor = autorRel.id_autor || autorRel.attributes?.id_autor || null;
    }
  }

  // Extraer id_editorial
  if (editorial) {
    if (editorial.data) {
      ids.id_editorial = editorial.data.id_editorial || editorial.data.attributes?.id_editorial || null;
    } else {
      ids.id_editorial = editorial.id_editorial || editorial.attributes?.id_editorial || null;
    }
  }

  // Extraer id_sello
  if (sello) {
    if (sello.data) {
      ids.id_sello = sello.data.id_sello || sello.data.attributes?.id_sello || null;
    } else {
      ids.id_sello = sello.id_sello || sello.attributes?.id_sello || null;
    }
  }

  // Extraer id_coleccion (puede ser privado, intentar obtenerlo)
  if (coleccion) {
    if (coleccion.data) {
      // id_coleccion es privado, puede no estar disponible
      ids.id_coleccion = coleccion.data.id_coleccion || coleccion.data.attributes?.id_coleccion || null;
      // Si no está disponible, usar el ID de la relación como referencia
      if (!ids.id_coleccion && coleccion.data.id) {
        ids.id_coleccion = `REL-${coleccion.data.id}`;
      }
    } else {
      ids.id_coleccion = coleccion.id_coleccion || coleccion.attributes?.id_coleccion || null;
      // Si no está disponible, usar el ID de la relación
      if (!ids.id_coleccion && coleccion.id) {
        ids.id_coleccion = `REL-${coleccion.id}`;
      }
    }
  }

  // Extraer id_obra (codigo_obra)
  if (obra) {
    if (obra.data) {
      ids.id_obra = obra.data.codigo_obra || obra.data.attributes?.codigo_obra || null;
    } else {
      ids.id_obra = obra.codigo_obra || obra.attributes?.codigo_obra || null;
    }
  }

  return ids;
}

/**
 * Actualiza un libro con los IDs extraídos
 */
async function actualizarLibro(libroId, ids, nombreLibro) {
  // Verificar si hay cambios
  const cambios = Object.entries(ids).filter(([_, valor]) => valor !== null).length;
  
  if (cambios === 0) {
    return { success: true, action: 'skip', reason: 'Sin IDs para actualizar' };
  }

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Actualizaría libro ${libroId} (${nombreLibro.substring(0, 50)}...)`);
    console.log(`    IDs a actualizar:`, ids);
    return { success: true, action: 'dry-run' };
  }

  try {
    const response = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
      
      try {
        // En Strapi v4, usar documentId (string) para actualizar
        if (!libroId || typeof libroId !== 'string') {
          throw new Error('documentId de libro inválido');
        }
        
        const res = await fetch(`${STRAPI_URL}/api/libros/${libroId}`, {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify({ data: ids }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText.substring(0, 200)}`);
        }
        
        return res;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    });

    return { success: true, action: 'updated', ids };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Procesa un libro individual (ya debe venir con relaciones pobladas)
 */
async function procesarLibro(libro, stats) {
  // El libro puede venir con estructura { id, attributes } o directamente como objeto
  const libroData = libro.attributes || libro;
  // En Strapi v4, usar documentId para actualizar (no id)
  const libroDocumentId = libro.documentId || libroData?.documentId;
  const libroId = libro.id || libroData?.id; // Solo para mostrar
  const nombreLibro = libroData?.nombre_libro || libro.nombre_libro || `ID: ${libroId}`;

  try {
    if (!libro || !libroDocumentId) {
      stats.errores++;
      return;
    }

    // Extraer IDs desde las relaciones
    // Los datos vienen directamente en el objeto libro cuando se usa populate con fields
    const ids = extraerIds(libro);

    // Debug: mostrar algunos ejemplos
    if (stats.actualizados < 3 && (libro.autor_relacion || libro.editorial)) {
      console.log(`\n🔍 DEBUG - Libro con relaciones:`);
      console.log(`  ID: ${libroId}, documentId: ${libroDocumentId}, Nombre: ${nombreLibro.substring(0, 40)}...`);
      console.log(`  autor_relacion:`, libro.autor_relacion ? 'Sí' : 'No');
      console.log(`  editorial:`, libro.editorial ? 'Sí' : 'No');
      console.log(`  IDs extraídos:`, ids);
    }

    // Verificar si necesita actualización
    const tieneCambios = Object.values(ids).some(valor => valor !== null);
    
    if (!tieneCambios) {
      stats.omitidos++;
      return;
    }

    // Actualizar libro usando documentId (requerido en Strapi v4)
    const resultado = await actualizarLibro(libroDocumentId, ids, nombreLibro);

    if (resultado.success) {
      if (resultado.action === 'updated') {
        stats.actualizados++;
        const idsActualizados = Object.entries(ids)
          .filter(([_, valor]) => valor !== null)
          .map(([key, _]) => key)
          .join(', ');
        
        // Mostrar cada actualización al principio para debug
        if (stats.actualizados <= 10) {
          console.log(`  ✅ [${stats.actualizados}] Actualizado: ${nombreLibro.substring(0, 50)}... (${idsActualizados})`);
        } else if (stats.actualizados % 100 === 0) {
          console.log(`  [${stats.actualizados}/${stats.total}] Actualizados: ${nombreLibro.substring(0, 40)}...`);
        }
      } else if (resultado.action === 'skip') {
        stats.omitidos++;
      }
    } else {
      stats.errores++;
      // Solo mostrar errores que no sean 404 (libros no encontrados es normal)
      if (!resultado.error.includes('HTTP 404')) {
        console.error(`  ❌ Error actualizando ${nombreLibro}: ${resultado.error}`);
      }
    }
  } catch (error) {
    stats.errores++;
    console.error(`  ❌ Error procesando ${nombreLibro}:`, error.message);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🔄 ACTUALIZANDO IDs EN LIBROS EXISTENTES');
  console.log('════════════════════════════════════════════════════════════════');
  console.log(`Strapi URL: ${STRAPI_URL}`);
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (solo mostraría)' : 'ACTUALIZAR'}`);
  console.log(`Concurrencia: ${CONCURRENCY}`);
  console.log('════════════════════════════════════════════════════════════════\n');

  const stats = {
    total: 0,
    actualizados: 0,
    omitidos: 0,
    errores: 0,
  };

  try {
    // Función para procesar con concurrencia controlada
    async function procesarConConcurrencia(array, fn, concurrencia) {
      const resultados = [];
      
      for (let i = 0; i < array.length; i += concurrencia) {
        const lote = array.slice(i, i + concurrencia);
        const tareas = lote.map(item => fn(item));
        const resultadosLote = await Promise.all(tareas);
        resultados.push(...resultadosLote);
      }
      
      return resultados;
    }

    // Obtener todos los libros (paginación)
    let page = 1;
    const pageSize = 100;
    const todosLosLibros = [];

    while (true) {
      console.log(`📄 Obteniendo página ${page}...`);
      
      // Construir query string con populate para obtener relaciones directamente
      // Popular relaciones básicas (algunos campos ID son privados, los obtendremos después)
      const params = new URLSearchParams({
        'pagination[page]': String(page),
        'pagination[pageSize]': String(pageSize),
        'sort[0]': 'id:asc',
      });
      
      // Popular relaciones - algunos campos ID son privados, los obtendremos individualmente si es necesario
      params.append('populate[autor_relacion][fields][0]', 'id_autor');
      params.append('populate[editorial][fields][0]', 'id_editorial');
      params.append('populate[sello][fields][0]', 'id_sello');
      // id_coleccion es privado, no se puede popular directamente
      params.append('populate[coleccion]', 'true'); // Solo la relación, sin campos
      params.append('populate[obra][fields][0]', 'codigo_obra');

      // Obtener libros con reintentos
      const response = await retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout
        
        try {
          const res = await fetch(`${STRAPI_URL}/api/libros?${params.toString()}`, {
            headers: HEADERS,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorText = await res.text();
            console.error(`❌ Error HTTP ${res.status}: ${errorText.substring(0, 500)}`);
            throw new Error(`HTTP ${res.status} al obtener libros`);
          }
          
          return res;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      });

      // Pequeña pausa entre páginas para no sobrecargar
      if (page > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const json = await response.json();
      const libros = json?.data || [];
      const pagination = json?.meta?.pagination || {};

      if (libros.length === 0) {
        console.log('✅ No hay más libros para procesar\n');
        break;
      }

      console.log(`   Encontrados ${libros.length} libros en esta página`);
      todosLosLibros.push(...libros);

      // Si no hay más páginas, salir
      if (!pagination.pageCount || page >= pagination.pageCount) {
        break;
      }

      page++;
    }

    console.log(`\n⏳ Procesando ${todosLosLibros.length} libros (concurrencia: ${CONCURRENCY})...\n`);
    stats.total = todosLosLibros.length;

    // Procesar con concurrencia controlada
    // Primero obtener cada libro con relaciones pobladas
    let librosNoEncontrados = 0;
    
    await procesarConConcurrencia(
      todosLosLibros,
      async (libro) => {
        // El libro viene de la lista paginada con estructura { id, attributes }
        const libroId = libro.id || libro.documentId;
        const libroData = libro.attributes || libro;
        
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificar si el libro tiene relaciones pobladas
        const tieneRelaciones = libroData.autor_relacion || libroData.editorial || 
                                libroData.sello || libroData.coleccion || libroData.obra;
        
        // Si no tiene relaciones, intentar obtenerlas
        let libroCompleto = libro;
        if (!tieneRelaciones && libroId) {
          libroCompleto = await obtenerLibroConRelaciones(libroId);
          // Si no se pudo obtener, usar el libro original
          if (!libroCompleto) {
            libroCompleto = libro;
          }
        }
        
        // Procesar el libro
        if (libroCompleto && libroId) {
          await procesarLibro(libroCompleto, stats);
        } else {
          // No tiene ID válido
          librosNoEncontrados++;
          if (librosNoEncontrados % 50 === 0) {
            console.log(`  ⚠️  ${librosNoEncontrados} libros sin ID válido hasta ahora...`);
          }
        }
      },
      CONCURRENCY
    );
    
    // Actualizar estadísticas
    stats.errores = librosNoEncontrados;

    // Resumen final
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('📊 RESUMEN FINAL');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`📦 Total procesados: ${stats.total}`);
    console.log(`✅ Actualizados: ${stats.actualizados}`);
    console.log(`⏭️  Omitidos (sin cambios): ${stats.omitidos}`);
    console.log(`❌ Errores: ${stats.errores}`);
    console.log('════════════════════════════════════════════════════════════════\n');

    if (DRY_RUN) {
      console.log('💡 Ejecuta sin --dry-run para aplicar los cambios\n');
    } else {
      console.log('✅ Proceso completado\n');
    }

  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main();

