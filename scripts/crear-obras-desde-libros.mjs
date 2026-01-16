#!/usr/bin/env node

/**
 * Script para crear obras desde libros existentes
 * 
 * Crea una OBRA para cada combinación única de:
 * - Nombre (normalizado para agrupar variaciones)
 * - Autor
 * 
 * IMPORTANTE: Crea obras para TODOS los libros, incluso si solo tienen 1 edición.
 * Esto permite que luego se agreguen más ediciones/versiones de la misma obra.
 * 
 * Cada LIBRO es una edición/versión de una OBRA:
 * - Una obra puede tener múltiples ediciones (libros con diferentes ISBN)
 * - Cada edición mantiene su información histórica (editorial, año, etc.)
 * 
 * Crea una obra mínima con:
 * - codigo_obra: Código único generado (OB-000001, OB-000002, etc.)
 * - nombre_obra: Nombre del libro (sin normalizar, nombre original)
 * - autores: Autor(es) del libro
 * 
 * Uso:
 *   node scripts/crear-obras-desde-libros.mjs
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
 * - Convierte a minúsculas
 * - Elimina espacios extra
 * - Elimina signos de puntuación comunes
 */
function normalizarNombre(nombre) {
  if (!nombre) return '';
  return nombre
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Espacios múltiples a uno solo
    .replace(/[^\w\sáéíóúñü]/g, '') // Elimina puntuación (excepto letras y espacios)
    .trim();
}

/**
 * Obtiene todos los libros con autor populado
 */
async function obtenerLibros() {
  console.log('📚 Obteniendo todos los libros...');
  
  const libros = [];
  let page = 1;
  const pageSize = 100;
  
  while (true) {
    // Usar populate con formato de objeto para Strapi v5
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
      'populate[0]': 'autor_relacion',
      'populate[1]': 'obra',
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
 * Agrupa libros por nombre normalizado + autor
 * Crea grupos para TODOS los libros, incluso si solo tienen 1 edición
 */
function agruparLibros(libros) {
  console.log('🔄 Agrupando libros por nombre + autor...');
  
  const grupos = new Map();
  let librosSinAutor = 0;
  let librosConObra = 0;
  
  for (const libro of libros) {
    const nombre = libro.attributes?.nombre_libro || libro.nombre_libro || '';
    const autor = libro.attributes?.autor_relacion?.data || libro.autor_relacion;
    const obraExistente = libro.attributes?.obra?.data || libro.obra;
    
    // Solo procesar libros con autor
    if (!autor) {
      librosSinAutor++;
      continue;
    }
    
    // Si el libro ya tiene una obra, no lo incluimos en la agrupación
    if (obraExistente) {
      librosConObra++;
      continue;
    }
    
    const autorId = autor.documentId || autor.id;
    const nombreNormalizado = normalizarNombre(nombre);
    const clave = `${nombreNormalizado}|||${autorId}`;
    
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        nombre: nombre, // Guardamos el nombre original (sin normalizar)
        nombreNormalizado,
        autorId,
        autor: autor,
        libros: [],
      });
    }
    
    const libroId = libro.documentId || libro.id;
    grupos.get(clave).libros.push({
      id: libroId,
      isbn: libro.attributes?.isbn_libro || libro.isbn_libro,
      nombre: nombre,
      autor: autor,
    });
  }
  
  console.log(`   Grupos creados: ${grupos.size}`);
  console.log(`   Libros sin autor (omitidos): ${librosSinAutor}`);
  console.log(`   Libros que ya tienen obra (omitidos): ${librosConObra}`);
  console.log(`   Grupos con 1 edición: ${Array.from(grupos.values()).filter(g => g.libros.length === 1).length}`);
  console.log(`   Grupos con múltiples ediciones: ${Array.from(grupos.values()).filter(g => g.libros.length > 1).length}\n`);
  
  // Retornar TODOS los grupos, incluso los que tienen solo 1 libro
  return Array.from(grupos.values());
}

/**
 * Obtiene todas las obras existentes y mapea por nombre normalizado + autor
 */
async function obtenerObrasExistentes() {
  console.log('🔍 Verificando obras existentes...');
  
  const obrasExistentes = new Map();
  let page = 1;
  
  while (true) {
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': '100',
      'populate': 'autores',
    });
    
    const response = await fetch(`${STRAPI_URL}/api/obras?${params.toString()}`, {
      headers: HEADERS,
    });
    
    if (!response.ok) break;
    
    const json = await response.json();
    const obras = json?.data || [];
    
    for (const obra of obras) {
      const nombre = obra.attributes?.nombre_obra || obra.nombre_obra || '';
      const autores = obra.attributes?.autores?.data || obra.autores || [];
      
      // Crear clave para cada combinación de nombre + autor
      // Solo consideramos el primer autor para la clave (puede haber múltiples)
      if (autores.length > 0) {
        const nombreNormalizado = normalizarNombre(nombre);
        const autorId = autores[0].documentId || autores[0].id;
        const clave = `${nombreNormalizado}|||${autorId}`;
        
        if (!obrasExistentes.has(clave)) {
          obrasExistentes.set(clave, {
            id: obra.documentId || obra.id,
            codigo: obra.attributes?.codigo_obra || obra.codigo_obra,
            nombre: nombre,
            autorId: autorId,
          });
        }
      }
    }
    
    const pagination = json?.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) {
      break;
    }
    
    page++;
  }
  
  console.log(`   Obras existentes encontradas: ${obrasExistentes.size}\n`);
  return obrasExistentes;
}

/**
 * Obtiene el siguiente código de obra disponible
 */
async function obtenerSiguienteCodigoObra() {
  // Obtener todas las obras existentes
  let page = 1;
  const codigosExistentes = new Set();
  
  while (true) {
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': '100',
      'fields[0]': 'codigo_obra',
    });
    
    const response = await fetch(`${STRAPI_URL}/api/obras?${params.toString()}`, {
      headers: HEADERS,
    });
    
    if (!response.ok) break;
    
    const json = await response.json();
    const obras = json?.data || [];
    
    for (const obra of obras) {
      const codigo = obra.attributes?.codigo_obra || obra.codigo_obra;
      if (codigo) {
        codigosExistentes.add(codigo);
      }
    }
    
    const pagination = json?.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) {
      break;
    }
    
    page++;
  }
  
  // Encontrar el siguiente número disponible
  let numero = 1;
  while (codigosExistentes.has(`OB-${numero.toString().padStart(6, '0')}`)) {
    numero++;
  }
  
  return `OB-${numero.toString().padStart(6, '0')}`;
}

/**
 * Crea una obra desde un grupo de libros
 */
async function crearObra(grupo, codigoObra) {
  const nombreObra = grupo.nombre;
  const autorId = grupo.autor.documentId || grupo.autor.id;
  
  const dataObra = {
    codigo_obra: codigoObra,
    nombre_obra: nombreObra,
    autores: [autorId],
  };
  
  const response = await fetch(`${STRAPI_URL}/api/obras`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ data: dataObra }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creando obra: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
  }
  
  const json = await response.json();
  const obraId = json.data.documentId || json.data.id;
  
  return obraId;
}

/**
 * Actualiza un libro para conectarlo con una obra
 */
async function conectarLibroAObra(libroId, obraId) {
  const response = await fetch(`${STRAPI_URL}/api/libros/${libroId}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({
      data: {
        obra: obraId,
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
  console.log('🚀 Creando obras desde libros existentes\n');
  console.log(`Strapi URL: ${STRAPI_URL}\n`);
  
  try {
    // 1. Obtener todos los libros
    const libros = await obtenerLibros();
    
    if (libros.length === 0) {
      console.log('⚠️  No hay libros para procesar');
      return;
    }
    
    // 2. Obtener obras existentes para evitar duplicados
    const obrasExistentes = await obtenerObrasExistentes();
    
    // 3. Agrupar libros por nombre + autor
    const grupos = agruparLibros(libros);
    
    if (grupos.length === 0) {
      console.log('✅ No hay libros nuevos para procesar. Todos ya tienen obra asignada.');
      return;
    }
    
    // 4. Obtener el siguiente código de obra disponible
    console.log('🔍 Obteniendo siguiente código de obra disponible...');
    const siguienteCodigo = await obtenerSiguienteCodigoObra();
    console.log(`   Siguiente código disponible: ${siguienteCodigo}\n`);
    
    // 5. Crear obras y conectar libros
    console.log('📝 Creando obras y conectando libros...\n');
    
    let obrasCreadas = 0;
    let obrasReutilizadas = 0;
    let librosConectados = 0;
    let errores = 0;
    let codigoActual = parseInt(siguienteCodigo.replace('OB-', ''));
    
    for (let i = 0; i < grupos.length; i++) {
      const grupo = grupos[i];
      const nombreNormalizado = grupo.nombreNormalizado;
      const clave = `${nombreNormalizado}|||${grupo.autorId}`;
      
      try {
        let obraId;
        let codigoObra;
        
        // Verificar si ya existe una obra para este grupo
        if (obrasExistentes.has(clave)) {
          const obraExistente = obrasExistentes.get(clave);
          obraId = obraExistente.id;
          codigoObra = obraExistente.codigo;
          obrasReutilizadas++;
          console.log(`♻️  [${i + 1}/${grupos.length}] Reutilizando obra existente ${codigoObra}: "${grupo.nombre}"`);
        } else {
          // Crear nueva obra
          codigoObra = `OB-${codigoActual.toString().padStart(6, '0')}`;
          obraId = await crearObra(grupo, codigoObra);
          obrasCreadas++;
          codigoActual++;
          console.log(`✨ [${i + 1}/${grupos.length}] Nueva obra ${codigoObra}: "${grupo.nombre}"`);
        }
        
        // Conectar todos los libros del grupo a la obra
        for (const libro of grupo.libros) {
          await conectarLibroAObra(libro.id, obraId);
          librosConectados++;
        }
        
        const edicionesTexto = grupo.libros.length === 1 
          ? '1 edición' 
          : `${grupo.libros.length} ediciones`;
        console.log(`   ${edicionesTexto} conectadas (ISBNs: ${grupo.libros.map(l => l.isbn).slice(0, 3).join(', ')}${grupo.libros.length > 3 ? '...' : ''})`);
        
      } catch (error) {
        errores++;
        console.error(`❌ Error procesando grupo "${grupo.nombre}": ${error.message}`);
      }
      
      // Pequeña pausa para no sobrecargar la API
      if (i < grupos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n📊 Resumen:');
    console.log(`  ✨ Obras nuevas creadas: ${obrasCreadas}`);
    if (obrasReutilizadas > 0) {
      console.log(`  ♻️  Obras existentes reutilizadas: ${obrasReutilizadas}`);
    }
    console.log(`  ✅ Libros conectados a obras: ${librosConectados}`);
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

