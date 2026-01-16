#!/usr/bin/env node

/**
 * Script para crear o actualizar el sello "Editorial Fonts" con id_sello = "2"
 * 
 * Uso:
 *   node scripts/crear-sello-editorial-fonts.mjs
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

// Buscar sello por nombre o id_sello
async function buscarSello(filtro, valor) {
  try {
    const params = new URLSearchParams({
      [`filters[${filtro}][$eq]`]: String(valor).trim(),
    });
    params.append('populate', 'editorial');

    const response = await fetch(`${STRAPI_URL}/api/sellos?${params.toString()}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json?.data?.[0] || null;
  } catch (error) {
    console.error(`Error al buscar sello:`, error);
    return null;
  }
}

// Buscar editorial por nombre
async function buscarEditorialPorNombre(nombre) {
  try {
    const params = new URLSearchParams({
      'filters[nombre_editorial][$eq]': nombre.trim(),
    });

    const response = await fetch(`${STRAPI_URL}/api/editoriales?${params.toString()}`, {
      headers: HEADERS,
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return json?.data?.[0] || null;
  } catch (error) {
    return null;
  }
}

// Verificar si id_sello = "2" está ocupado
async function verificarIdSelloOcupado(idSello) {
  const sello = await buscarSello('id_sello', idSello);
  return sello;
}

// Actualizar id_sello directamente en la base de datos
async function actualizarIdSelloDirecto(documentId, nuevoId) {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { resolve } = await import('path');
    
    const __dirname = dirname(__filename);
    const strapiNodeModules = resolve(__dirname, '..', 'strapi', 'node_modules');
    const Database = require(resolve(strapiNodeModules, 'better-sqlite3'));
    
    const dbPath = resolve(__dirname, '..', 'strapi', '.tmp', 'data.db');
    const db = new Database(dbPath);
    
    const stmt = db.prepare('UPDATE sellos SET id_sello = ? WHERE document_id = ?');
    const result = stmt.run(nuevoId, documentId);
    
    db.close();
    
    if (result.changes === 0) {
      throw new Error(`No se encontró el sello con documentId: ${documentId}`);
    }
    
    return { success: true, changes: result.changes };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
      throw new Error('better-sqlite3 no está instalado en strapi/node_modules');
    }
    throw error;
  }
}

// Crear o actualizar sello
async function crearOActualizarSello() {
  console.log('🔄 Creando/Actualizando sello "Editorial Fonts"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const nombreSello = 'Editorial Fonts';
  const idSelloDeseado = '2';
  const acronimo = 'Font';
  const website = 'editorialfonts.cl';

  // 1. Buscar si el sello ya existe
  console.log(`📖 Buscando sello "${nombreSello}"...`);
  let selloExistente = await buscarSello('nombre_sello', nombreSello);
  
  if (selloExistente) {
    const idSelloActual = selloExistente.attributes?.id_sello || selloExistente.id_sello;
    const documentId = selloExistente.documentId || selloExistente.id;
    console.log(`   ✅ Encontrado: "${nombreSello}" (id_sello: ${idSelloActual}, documentId: ${documentId})`);
    
    // Si ya tiene id_sello = "2", no hacer nada
    if (idSelloActual === idSelloDeseado) {
      console.log(`   ✅ Ya tiene id_sello = "${idSelloDeseado}". No se requiere actualización.`);
      return;
    }
    
    // Verificar si id_sello = "2" está ocupado
    console.log(`\n🔍 Verificando si id_sello = "${idSelloDeseado}" está disponible...`);
    const selloConId2 = await verificarIdSelloOcupado(idSelloDeseado);
    
    if (selloConId2) {
      const nombreOcupado = selloConId2.attributes?.nombre_sello || selloConId2.nombre_sello;
      const documentIdOcupado = selloConId2.documentId || selloConId2.id;
      console.log(`   ⚠️  id_sello = "${idSelloDeseado}" está ocupado por: "${nombreOcupado}"`);
      
      // Obtener un ID disponible para el sello que ocupa el lugar
      let page = 1;
      const idsUsados = new Set();
      
      while (true) {
        const response = await fetch(`${STRAPI_URL}/api/sellos?pagination[page]=${page}&pagination[pageSize]=100`, {
          headers: HEADERS,
        });
        
        if (!response.ok) break;
        
        const json = await response.json();
        const sellos = json?.data || [];
        
        if (sellos.length === 0) break;
        
        for (const sello of sellos) {
          const idSello = sello.attributes?.id_sello || sello.id_sello;
          if (idSello) {
            idsUsados.add(String(idSello));
          }
        }
        
        const meta = json?.meta?.pagination;
        if (!meta || page >= meta.pageCount) break;
        page++;
      }
      
      // Encontrar un ID disponible
      let nuevoIdParaOcupado = null;
      for (let i = 100; i <= 1000; i++) {
        if (!idsUsados.has(String(i))) {
          nuevoIdParaOcupado = String(i);
          break;
        }
      }
      
      if (!nuevoIdParaOcupado) {
        nuevoIdParaOcupado = String(idsUsados.size + 100);
      }
      
      console.log(`   🔄 Moviendo "${nombreOcupado}" a id_sello = "${nuevoIdParaOcupado}"...`);
      try {
        await actualizarIdSelloDirecto(documentIdOcupado, nuevoIdParaOcupado);
        console.log(`   ✅ "${nombreOcupado}" ahora tiene id_sello = "${nuevoIdParaOcupado}"`);
      } catch (error) {
        console.error(`   ❌ Error al mover sello:`, error.message);
        process.exit(1);
      }
    }
    
    // Actualizar id_sello a "2"
    console.log(`\n🔄 Actualizando id_sello de "${idSelloActual}" a "${idSelloDeseado}"...`);
    try {
      await actualizarIdSelloDirecto(documentId, idSelloDeseado);
      console.log(`   ✅ "Editorial Fonts" ahora tiene id_sello = "${idSelloDeseado}"`);
    } catch (error) {
      console.error(`   ❌ Error al actualizar:`, error.message);
      process.exit(1);
    }
  } else {
    // 2. Buscar editorial "Editorial Fonts" (o crearla si no existe)
    console.log(`\n📖 Buscando editorial "Editorial Fonts"...`);
    let editorial = await buscarEditorialPorNombre('Editorial Fonts');
    
    if (!editorial) {
      console.log(`   ⚠️  No se encontró la editorial "Editorial Fonts"`);
      console.log(`   🆕 Creando editorial "Editorial Fonts"...`);
      
      // Obtener un id_editorial disponible
      let nuevoIdEditorial = null;
      let page = 1;
      const idsUsados = new Set();
      
      // Obtener todos los id_editorial existentes
      while (true) {
        const response = await fetch(`${STRAPI_URL}/api/editoriales?pagination[page]=${page}&pagination[pageSize]=100`, {
          headers: HEADERS,
        });
        
        if (!response.ok) break;
        
        const json = await response.json();
        const editoriales = json?.data || [];
        
        if (editoriales.length === 0) break;
        
        for (const editorial of editoriales) {
          const idEditorial = editorial.attributes?.id_editorial || editorial.id_editorial;
          if (idEditorial) {
            idsUsados.add(String(idEditorial));
          }
        }
        
        const meta = json?.meta?.pagination;
        if (!meta || page >= meta.pageCount) break;
        page++;
      }
      
      // Encontrar el primer ID numérico disponible empezando desde 1
      for (let i = 1; i <= 1000; i++) {
        if (!idsUsados.has(String(i))) {
          nuevoIdEditorial = String(i);
          break;
        }
      }
      
      if (!nuevoIdEditorial) {
        nuevoIdEditorial = String(idsUsados.size + 1);
      }
      
      try {
        const createResponse = await fetch(`${STRAPI_URL}/api/editoriales`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            data: {
              id_editorial: nuevoIdEditorial,
              nombre_editorial: 'Editorial Fonts',
              acronimo: 'Font',
              website: 'editorialfonts.cl',
            },
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`HTTP ${createResponse.status}: ${errorText.substring(0, 200)}`);
        }

        const createJson = await createResponse.json();
        editorial = createJson?.data;
        console.log(`   ✅ Editorial creada: "Editorial Fonts" (id_editorial: ${nuevoIdEditorial})`);
      } catch (error) {
        console.error(`   ❌ Error al crear editorial:`, error.message);
        process.exit(1);
      }
    } else {
      console.log(`   ✅ Encontrada: "Editorial Fonts" (documentId: ${editorial.documentId || editorial.id})`);
    }
    
    const editorialId = editorial.documentId || editorial.id;
    
    // 3. Verificar si id_sello = "2" está ocupado
    console.log(`\n🔍 Verificando si id_sello = "${idSelloDeseado}" está disponible...`);
    const selloConId2 = await verificarIdSelloOcupado(idSelloDeseado);
    
    if (selloConId2) {
      const nombreOcupado = selloConId2.attributes?.nombre_sello || selloConId2.nombre_sello;
      const documentIdOcupado = selloConId2.documentId || selloConId2.id;
      console.log(`   ⚠️  id_sello = "${idSelloDeseado}" está ocupado por: "${nombreOcupado}"`);
      
      // Obtener un ID disponible para el sello que ocupa el lugar
      let page = 1;
      const idsUsados = new Set();
      
      while (true) {
        const response = await fetch(`${STRAPI_URL}/api/sellos?pagination[page]=${page}&pagination[pageSize]=100`, {
          headers: HEADERS,
        });
        
        if (!response.ok) break;
        
        const json = await response.json();
        const sellos = json?.data || [];
        
        if (sellos.length === 0) break;
        
        for (const sello of sellos) {
          const idSello = sello.attributes?.id_sello || sello.id_sello;
          if (idSello) {
            idsUsados.add(String(idSello));
          }
        }
        
        const meta = json?.meta?.pagination;
        if (!meta || page >= meta.pageCount) break;
        page++;
      }
      
      // Encontrar un ID disponible
      let nuevoIdParaOcupado = null;
      for (let i = 100; i <= 1000; i++) {
        if (!idsUsados.has(String(i))) {
          nuevoIdParaOcupado = String(i);
          break;
        }
      }
      
      if (!nuevoIdParaOcupado) {
        nuevoIdParaOcupado = String(idsUsados.size + 100);
      }
      
      console.log(`   🔄 Moviendo "${nombreOcupado}" a id_sello = "${nuevoIdParaOcupado}"...`);
      try {
        await actualizarIdSelloDirecto(documentIdOcupado, nuevoIdParaOcupado);
        console.log(`   ✅ "${nombreOcupado}" ahora tiene id_sello = "${nuevoIdParaOcupado}"`);
      } catch (error) {
        console.error(`   ❌ Error al mover sello:`, error.message);
        process.exit(1);
      }
    }
    
    // 4. Crear el sello
    console.log(`\n🆕 Creando sello "${nombreSello}" con id_sello = "${idSelloDeseado}"...`);
    try {
      const response = await fetch(`${STRAPI_URL}/api/sellos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          data: {
            id_sello: idSelloDeseado,
            nombre_sello: nombreSello,
            acronimo: acronimo,
            website: website,
            editorial: editorialId,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const json = await response.json();
      const selloCreado = json?.data;
      console.log(`   ✅ Sello creado exitosamente: "${nombreSello}" (id_sello: ${idSelloDeseado})`);
    } catch (error) {
      console.error(`   ❌ Error al crear sello:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Proceso completado:');
  console.log(`   📖 Sello: "${nombreSello}"`);
  console.log(`   🆔 id_sello: "${idSelloDeseado}"`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

crearOActualizarSello().catch(console.error);

