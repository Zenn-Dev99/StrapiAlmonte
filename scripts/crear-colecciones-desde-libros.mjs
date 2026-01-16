#!/usr/bin/env node

/**
 * Script para crear colecciones/series desde libros existentes
 * 
 * Detecta series/colecciones basándose en patrones de nombres de libros:
 * - Libros del mismo autor con nombres que comparten un prefijo/base común
 * - Ejemplos: "Papelucho", "Papelucho historiador", "Papelucho perdido" → Colección "Papelucho"
 * - Ejemplos: "Harry Potter y la piedra filosofal", "Harry Potter y la cámara secreta" → Colección "Harry Potter"
 * 
 * Estrategia de detección:
 * 1. Extrae el nombre base de la serie del título (palabras comunes)
 * 2. Agrupa libros con el mismo autor y nombre base similar
 * 3. Crea una colección para cada grupo
 * 4. Conecta los libros a su colección correspondiente
 * 
 * Uso:
 *   node scripts/crear-colecciones-desde-libros.mjs
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

/**
 * Normaliza el nombre de un libro para comparación
 */
function normalizarNombre(nombre) {
  if (!nombre) return '';
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae el nombre base de una serie desde el título del libro
 * Estrategias:
 * 1. Busca nombres propios al inicio (ej: "Papelucho", "Harry Potter")
 * 2. Elimina palabras comunes de continuación (ej: "y la", "en", "de", etc.)
 * 3. Toma las primeras 1-3 palabras como nombre base
 */
function extraerNombreBaseSerie(titulo) {
  if (!titulo) return null;
  
  const nombreNormalizado = normalizarNombre(titulo);
  
  // Patrones comunes de series
  const patrones = [
    // Patrón educativo: "NombreSerie Level X" (ej: "Now I Know Level 5", "Think Level 3")
    /^([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+level\s+\d+/i,
    // Patrón educativo: "NombreSerie Stage X" (ej: "Active Maths Stage 5")
    /^([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+stage\s+\d+/i,
    // Patrón educativo: "NombreSerie Grade X" (ej: "Math Grade 5")
    /^([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+grade\s+\d+/i,
    // Patrón educativo: "NombreSerie Workbook" o "NombreSerie Student Book"
    /^([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+(?:workbook|student\s+book|pupil.*book|activity\s+book)/i,
    // Patrón: "Texto Preparación PAES..." (ej: "Texto Preparación PAES Matemática M1")
    /^(texto\s+preparaci[óo]n\s+[a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+m\d+/i,
    // Patrón: "NombreSerie y el/la..."
    /^([a-záéíóúñü]+\s+[a-záéíóúñü]+)\s+y\s+(el|la|los|las)/i,
    // Patrón: "NombreSerie en..."
    /^([a-záéíóúñü]+)\s+en\s+/i,
    // Patrón: "NombreSerie de..."
    /^([a-záéíóúñü]+)\s+de\s+/i,
    // Patrón: "NombreSerie Número" o "NombreSerie I/II/III"
    /^([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+(?:n[úu]mero|n[úu]m\.|vol\.|tomo|libro|parte|cap[íi]tulo)/i,
    // Patrón: "NombreSerie 1", "NombreSerie 2"
    /^([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s+\d+/,
    // Patrón: "NombreSerie: Subtítulo"
    /^([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)\s*[:]\s*/i,
  ];
  
  for (const patron of patrones) {
    const match = nombreNormalizado.match(patron);
    if (match && match[1]) {
      const base = match[1].trim();
      // Solo aceptar si tiene al menos 3 caracteres y no es muy largo (máximo 30 chars)
      if (base.length >= 3 && base.length <= 30) {
        return base;
      }
    }
  }
  
  // Si no encuentra patrón, intenta tomar las primeras palabras
  const palabras = nombreNormalizado.split(/\s+/);
  
  // Eliminar palabras comunes al inicio
  const palabrasComunes = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'];
  let inicio = 0;
  while (inicio < palabras.length && palabrasComunes.includes(palabras[inicio])) {
    inicio++;
  }
  
  // Tomar las primeras 2 palabras como nombre base (si hay suficientes)
  if (palabras.length - inicio >= 2) {
    const base = palabras.slice(inicio, inicio + 2).join(' ');
    if (base.length >= 3 && base.length <= 30) {
      return base;
    }
  }
  
  // Si solo hay una palabra significativa, usarla (si no es muy común)
  if (palabras.length - inicio >= 1) {
    const base = palabras[inicio];
    if (base && base.length >= 3 && base.length <= 20 && !palabrasComunes.includes(base)) {
      return base;
    }
  }
  
  return null;
}

/**
 * Obtiene todos los libros con autor y editorial populados
 */
async function obtenerLibros() {
  console.log('📚 Obteniendo todos los libros...');
  
  const libros = [];
  let page = 1;
  const pageSize = 100;
  
  while (true) {
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
      'populate[0]': 'autor_relacion',
      'populate[1]': 'editorial',
      'populate[2]': 'sello',
      'populate[3]': 'coleccion',
      'sort': 'id:asc',
    });
    
    const response = await fetch(`${STRAPI_URL}/api/libros?${params.toString()}`, {
      headers: HEADERS,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo libros: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
    }
    
    const json = await response.json();
    const paginatedLibros = json?.data || [];
    
    if (paginatedLibros.length === 0) {
      break;
    }
    
    libros.push(...paginatedLibros);
    console.log(`   Página ${page}: ${paginatedLibros.length} libros (Total: ${libros.length})`);
    
    const pagination = json?.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) {
      break;
    }
    
    page++;
  }
  
  console.log(`✅ Total de libros obtenidos: ${libros.length}\n`);
  return libros;
}

/**
 * Agrupa libros por serie detectada (nombre base + autor)
 */
function detectarSeries(libros) {
  console.log('🔍 Detectando series/colecciones en los libros...');
  
  const series = new Map();
  let librosSinAutor = 0;
  let librosConColeccion = 0;
  let librosSinSerieDetectada = 0;
  
  for (const libro of libros) {
    const nombre = libro.attributes?.nombre_libro || libro.nombre_libro || '';
    const autor = libro.attributes?.autor_relacion?.data || libro.autor_relacion;
    const coleccionExistente = libro.attributes?.coleccion?.data || libro.coleccion;
    
    // Solo procesar libros con autor
    if (!autor) {
      librosSinAutor++;
      continue;
    }
    
    // Si ya tiene colección, omitir
    if (coleccionExistente) {
      librosConColeccion++;
      continue;
    }
    
    // Extraer nombre base de la serie
    const nombreBase = extraerNombreBaseSerie(nombre);
    
    if (!nombreBase) {
      librosSinSerieDetectada++;
      continue;
    }
    
    const autorId = autor.documentId || autor.id;
    const clave = `${nombreBase.toLowerCase()}|||${autorId}`;
    
    if (!series.has(clave)) {
      series.set(clave, {
        nombreColeccion: nombreBase.charAt(0).toUpperCase() + nombreBase.slice(1), // Capitalizar primera letra
        nombreBase: nombreBase.toLowerCase(),
        autorId,
        autor: autor,
        libros: [],
      });
    }
    
    const libroId = libro.documentId || libro.id;
    const editorial = libro.attributes?.editorial?.data || libro.editorial;
    const sello = libro.attributes?.sello?.data || libro.sello;
    
    series.get(clave).libros.push({
      id: libroId,
      isbn: libro.attributes?.isbn_libro || libro.isbn_libro,
      nombre: nombre,
      autor: autor,
      editorial: editorial,
      sello: sello,
    });
  }
  
  console.log(`   Series detectadas: ${series.size}`);
  console.log(`   Libros sin autor (omitidos): ${librosSinAutor}`);
  console.log(`   Libros que ya tienen colección (omitidos): ${librosConColeccion}`);
  console.log(`   Libros sin serie detectada (omitidos): ${librosSinSerieDetectada}`);
  
  // Filtrar series que tienen solo 1 libro (no son series)
  const seriesConMultipleLibros = Array.from(series.values()).filter(s => s.libros.length > 1);
  console.log(`   Series con múltiples libros: ${seriesConMultipleLibros.length}\n`);
  
  return seriesConMultipleLibros;
}

/**
 * Obtiene la colección existente por nombre y autor (si existe)
 */
async function buscarColeccionExistente(nombreColeccion) {
  const params = new URLSearchParams({
    'filters[nombre_coleccion][$eq]': nombreColeccion,
    'pagination[limit]': '1',
  });
  
  const response = await fetch(`${STRAPI_URL}/api/colecciones?${params.toString()}`, {
    headers: HEADERS,
  });
  
  if (!response.ok) return null;
  
  const json = await response.json();
  const colecciones = json?.data || [];
  
  if (colecciones.length > 0) {
    return {
      id: colecciones[0].documentId || colecciones[0].id,
      nombre: colecciones[0].attributes?.nombre_coleccion || colecciones[0].nombre_coleccion,
    };
  }
  
  return null;
}

/**
 * Crea una colección
 */
async function crearColeccion(serie) {
  const nombreColeccion = serie.nombreColeccion;
  
  // Buscar si ya existe una colección con ese nombre
  const coleccionExistente = await buscarColeccionExistente(nombreColeccion);
  
  if (coleccionExistente) {
    return coleccionExistente.id;
  }
  
  // Determinar editorial y sello desde los libros (tomar la más común)
  const editoriales = new Map();
  const sellos = new Map();
  
  for (const libro of serie.libros) {
    if (libro.editorial) {
      const editorialId = libro.editorial.documentId || libro.editorial.id;
      editoriales.set(editorialId, (editoriales.get(editorialId) || 0) + 1);
    }
    if (libro.sello) {
      const selloId = libro.sello.documentId || libro.sello.id;
      sellos.set(selloId, (sellos.get(selloId) || 0) + 1);
    }
  }
  
  // Obtener editorial más común
  let editorialId = null;
  if (editoriales.size > 0) {
    const editorialMasComun = Array.from(editoriales.entries()).sort((a, b) => b[1] - a[1])[0];
    editorialId = editorialMasComun[0];
  }
  
  // Obtener sello más común
  let selloId = null;
  if (sellos.size > 0) {
    const selloMasComun = Array.from(sellos.entries()).sort((a, b) => b[1] - a[1])[0];
    selloId = selloMasComun[0];
  }
  
  const dataColeccion = {
    nombre_coleccion: nombreColeccion,
  };
  
  if (editorialId) {
    dataColeccion.editorial = editorialId;
  }
  
  if (selloId) {
    dataColeccion.sello = selloId;
  }
  
  const response = await fetch(`${STRAPI_URL}/api/colecciones`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ data: dataColeccion }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creando colección: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
  }
  
  const json = await response.json();
  const coleccionId = json.data.documentId || json.data.id;
  
  return coleccionId;
}

/**
 * Conecta un libro a una colección
 */
async function conectarLibroAColeccion(libroId, coleccionId) {
  const response = await fetch(`${STRAPI_URL}/api/libros/${libroId}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({
      data: {
        coleccion: coleccionId,
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error actualizando libro ${libroId}: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Creando colecciones/series desde libros existentes\n');
  console.log(`Strapi URL: ${STRAPI_URL}\n`);
  
  try {
    // 1. Obtener todos los libros
    const libros = await obtenerLibros();
    
    if (libros.length === 0) {
      console.log('⚠️  No hay libros para procesar');
      return;
    }
    
    // 2. Detectar series/colecciones
    const series = detectarSeries(libros);
    
    if (series.length === 0) {
      console.log('✅ No se detectaron series nuevas para crear.');
      return;
    }
    
    // 3. Crear colecciones y conectar libros
    console.log('📝 Creando colecciones y conectando libros...\n');
    
    let coleccionesCreadas = 0;
    let coleccionesReutilizadas = 0;
    let librosConectados = 0;
    let errores = 0;
    const tiempoInicio = Date.now();
    
    // Función para mostrar barra de progreso
    function mostrarProgreso(actual, total, nombreColeccion) {
      const porcentaje = Math.round((actual / total) * 100);
      const barrasCompletas = Math.round((porcentaje / 100) * 40);
      const barrasVacias = 40 - barrasCompletas;
      const barra = '█'.repeat(barrasCompletas) + '░'.repeat(barrasVacias);
      
      // Calcular tiempo transcurrido y estimado
      const tiempoTranscurrido = (Date.now() - tiempoInicio) / 1000; // en segundos
      const tiempoPorItem = tiempoTranscurrido / actual;
      const tiempoRestante = Math.round((total - actual) * tiempoPorItem);
      
      const minutos = Math.floor(tiempoRestante / 60);
      const segundos = tiempoRestante % 60;
      const tiempoTexto = minutos > 0 ? `${minutos}m ${segundos}s` : `${segundos}s`;
      
      // Limpiar línea anterior y mostrar nueva
      process.stdout.write(`\r📊 [${barra}] ${porcentaje}% (${actual}/${total}) | Tiempo restante: ~${tiempoTexto} | Actual: "${nombreColeccion.substring(0, 40)}"`);
    }
    
    for (let i = 0; i < series.length; i++) {
      const serie = series[i];
      
      // Mostrar progreso
      mostrarProgreso(i + 1, series.length, serie.nombreColeccion);
      
      try {
        // Crear o buscar colección existente
        const coleccionId = await crearColeccion(serie);
        
        // Verificar si fue creada o reutilizada
        const coleccionExistente = await buscarColeccionExistente(serie.nombreColeccion);
        if (coleccionExistente && coleccionExistente.id === coleccionId) {
          // Fue reutilizada (ya existía antes)
          if (i === 0 || !series[i - 1] || series[i - 1].nombreColeccion !== serie.nombreColeccion) {
            coleccionesReutilizadas++;
          }
        } else {
          coleccionesCreadas++;
        }
        
        // Conectar todos los libros del grupo a la colección
        for (const libro of serie.libros) {
          await conectarLibroAColeccion(libro.id, coleccionId);
          librosConectados++;
        }
        
        // Cada 10 colecciones o al final, mostrar detalle en nueva línea
        if ((i + 1) % 10 === 0 || i === series.length - 1) {
          process.stdout.write('\n');
          console.log(`   ✅ [${i + 1}/${series.length}] "${serie.nombreColeccion}" - ${serie.libros.length} libros`);
        }
        
      } catch (error) {
        errores++;
        process.stdout.write('\n');
        console.error(`❌ Error procesando serie "${serie.nombreColeccion}": ${error.message}`);
      }
      
      // Pequeña pausa para no sobrecargar la API
      if (i < series.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Nueva línea final para limpiar la barra de progreso
    process.stdout.write('\n');
    
    console.log('\n📊 Resumen:');
    console.log(`  ✨ Colecciones nuevas creadas: ${coleccionesCreadas}`);
    if (coleccionesReutilizadas > 0) {
      console.log(`  ♻️  Colecciones existentes reutilizadas: ${coleccionesReutilizadas}`);
    }
    console.log(`  ✅ Libros conectados a colecciones: ${librosConectados}`);
    if (errores > 0) {
      console.log(`  ❌ Errores: ${errores}`);
    }
    
    console.log('\n✅ Proceso completado');
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar
main();

