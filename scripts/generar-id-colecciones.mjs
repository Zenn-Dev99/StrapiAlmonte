#!/usr/bin/env node

/**
 * Script para generar id_coleccion automáticamente para registros que no lo tienen
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '..', 'strapi', '.env');
if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    // Ignorar líneas vacías y comentarios
    if (!line.trim() || line.trim().startsWith('#')) return;
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remover comillas al inicio y final
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const STRAPI_URL = process.env.STRAPI_URL || process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;
const DRY_RUN = process.env.DRY === '1';

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

async function obtenerTodasLasColecciones() {
  console.log('📚 Obteniendo todas las colecciones...');
  const allColecciones = [];
  let page = 1;
  
  while (true) {
    const url = `${STRAPI_URL}/api/colecciones?pagination[page]=${page}&pagination[pageSize]=100&pagination[withCount]=true&sort[0]=id:asc&populate=*`;
    const response = await fetch(url, { headers: HEADERS });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    const colecciones = data.data || [];
    const pagination = data.meta?.pagination;
    
    console.log(`   Página ${page}: ${colecciones.length} colecciones`);
    
    if (colecciones.length === 0) break;
    
    allColecciones.push(...colecciones);
    
    if (pagination && page >= pagination.pageCount) break;
    page++;
  }
  
  console.log(`✅ Total obtenidas: ${allColecciones.length}\n`);
  return allColecciones;
}

async function generarIds(colecciones) {
  // Separar colecciones con y sin id_coleccion
  const conId = colecciones.filter(c => c.id_coleccion !== null && c.id_coleccion !== undefined);
  const sinId = colecciones.filter(c => c.id_coleccion === null || c.id_coleccion === undefined);
  
  console.log(`📊 Análisis:`);
  console.log(`   Con id_coleccion: ${conId.length}`);
  console.log(`   Sin id_coleccion: ${sinId.length}\n`);
  
  if (sinId.length === 0) {
    console.log('✅ Todas las colecciones ya tienen id_coleccion');
    return [];
  }
  
  // Obtener el máximo id_coleccion existente
  const idsExistentes = new Set(conId.map(c => c.id_coleccion).filter(id => id !== null && id !== undefined));
  const maxId = idsExistentes.size > 0 ? Math.max(...Array.from(idsExistentes)) : 0;
  
  console.log(`🔢 ID máximo existente: ${maxId}`);
  console.log(`📝 Generando IDs a partir de: ${maxId + 1}\n`);
  
  // Generar IDs secuenciales
  const actualizaciones = [];
  let siguienteId = maxId + 1;
  
  for (const coleccion of sinId) {
    // Asegurarse de que el ID no esté en uso
    while (idsExistentes.has(siguienteId)) {
      siguienteId++;
    }
    
    actualizaciones.push({
      documentId: coleccion.documentId || coleccion.id,
      idNumerico: coleccion.id, // Guardar también el ID numérico
      id_coleccion: siguienteId,
      nombre: coleccion.nombre_coleccion || 'Sin nombre',
    });
    
    idsExistentes.add(siguienteId);
    siguienteId++;
  }
  
  return actualizaciones;
}

async function actualizarColecciones(actualizaciones) {
  if (actualizaciones.length === 0) {
    return { success: 0, errors: 0 };
  }
  
  console.log(`🔄 Actualizando ${actualizaciones.length} colecciones...\n`);
  
  let success = 0;
  let errors = 0;
  const errores = [];
  
  for (const actualizacion of actualizaciones) {
    try {
      if (DRY_RUN) {
        console.log(`   [DRY RUN] ${actualizacion.documentId}: id_coleccion = ${actualizacion.id_coleccion} (${actualizacion.nombre})`);
        success++;
        continue;
      }
      
      // Usar el ID numérico directamente (más confiable que documentId para updates)
      const payload = {
        data: {
          id_coleccion: actualizacion.id_coleccion,
        },
      };
      
      // Intentar con ID numérico primero (más confiable)
      let response;
      let targetId = actualizacion.idNumerico || actualizacion.documentId;
      
      try {
        response = await fetch(`${STRAPI_URL}/api/colecciones/${targetId}`, {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          // Si falla y tenemos documentId diferente, intentar con documentId
          if (targetId === actualizacion.idNumerico && actualizacion.documentId && actualizacion.documentId !== targetId) {
            response = await fetch(`${STRAPI_URL}/api/colecciones/${actualizacion.documentId}`, {
              method: 'PUT',
              headers: HEADERS,
              body: JSON.stringify(payload),
            });
            if (!response.ok) {
              const errorText2 = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText2}`);
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        }
      } catch (fetchError) {
        if (fetchError.message.includes('fetch failed')) {
          throw fetchError;
        }
        throw new Error(`Error al actualizar ${targetId}: ${fetchError.message}`);
      }
      
      success++;
      if (success % 50 === 0) {
        console.log(`   ✅ ${success}/${actualizaciones.length} actualizadas...`);
      }
    } catch (error) {
      errors++;
      errores.push({
        documentId: actualizacion.documentId,
        nombre: actualizacion.nombre,
        error: error.message,
      });
      console.error(`   ❌ Error en ${actualizacion.documentId} (${actualizacion.nombre}): ${error.message}`);
    }
  }
  
  if (!DRY_RUN) {
    console.log(`\n✅ Actualizadas: ${success}`);
  }
  
  if (errors > 0) {
    console.log(`❌ Errores: ${errors}`);
    if (errores.length <= 10) {
      console.log('\n⚠️  Errores detallados:');
      errores.forEach(({ documentId, nombre, error }) => {
        console.log(`   - ${documentId} (${nombre}): ${error}`);
      });
    }
  }
  
  return { success, errors };
}

async function main() {
  try {
    console.log('=== Generar id_coleccion para Colecciones ===\n');
    if (DRY_RUN) {
      console.log('🔍 MODO DRY RUN - No se harán cambios reales\n');
    }
    console.log(`Strapi: ${STRAPI_URL}\n`);
    
    const colecciones = await obtenerTodasLasColecciones();
    const actualizaciones = await generarIds(colecciones);
    
    if (actualizaciones.length === 0) {
      console.log('✅ No hay nada que actualizar');
      return;
    }
    
    console.log(`📋 Se generarán ${actualizaciones.length} IDs:\n`);
    actualizaciones.slice(0, 10).forEach(act => {
      console.log(`   - ${act.documentId}: id_coleccion = ${act.id_coleccion} (${act.nombre})`);
    });
    if (actualizaciones.length > 10) {
      console.log(`   ... y ${actualizaciones.length - 10} más\n`);
    } else {
      console.log('');
    }
    
    const resultado = await actualizarColecciones(actualizaciones);
    
    console.log(`\n📊 Resumen final:`);
    console.log(`   ✅ Actualizadas: ${resultado.success}`);
    console.log(`   ❌ Errores: ${resultado.errors}`);
    
    if (DRY_RUN) {
      console.log(`\n💡 Para aplicar los cambios, ejecuta sin DRY=1`);
    }
    
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error fatal:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
