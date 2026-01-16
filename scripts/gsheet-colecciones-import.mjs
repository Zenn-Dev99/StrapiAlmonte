#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

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
      if (!process.env[key]) process.env[key] = value;
    }
  });
}

const STRAPI_URL = process.env.STRAPI_URL || process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || resolve(__dirname, '..', 'data', 'gsheets', 'credentials.json');
const DRY_RUN = process.env.DRY === '1';

if (!STRAPI_TOKEN || !SPREADSHEET_ID || !existsSync(CREDENTIALS_PATH)) {
  console.error('❌ Faltan variables de entorno');
  process.exit(1);
}

const HEADERS = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STRAPI_TOKEN}` };

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function fetchFromGoogleSheets(sheets) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Colecciones!A:Z' });
  const rows = response.data.values || [];
  if (rows.length < 2) throw new Error('Hoja vacía');
  const headers = rows[0];
  const colecciones = rows.slice(1).filter(r => {
    // Filtrar filas vacías - debe tener al menos nombre_coleccion
    const hasData = r.some(c => c && c.trim());
    if (!hasData) return false;
    // Verificar que tenga nombre_coleccion (requerido para crear/actualizar)
    const nombreIndex = headers.indexOf('nombre_coleccion');
    return nombreIndex !== -1 && r[nombreIndex] && r[nombreIndex].trim();
  }).map(r => {
    const obj = {}; headers.forEach((h, i) => { obj[h] = r[i] || ''; }); return obj;
  });
  
  const conDocumentId = colecciones.filter(c => c.documentId && c.documentId.trim());
  const sinDocumentId = colecciones.filter(c => !c.documentId || !c.documentId.trim());
  const paraEliminar = colecciones.filter(c => {
    const accion = (c.accion || c.eliminar || '').toString().toLowerCase().trim();
    return accion === 'eliminar' || accion === 'delete' || accion === 'x' || accion === 'eliminar' || accion === '🗑️';
  });
  
  console.log(`   ${colecciones.length} colecciones encontradas`);
  console.log(`   - Con documentId (actualizar): ${conDocumentId.length}`);
  console.log(`   - Sin documentId (crear nuevo): ${sinDocumentId.length}`);
  if (paraEliminar.length > 0) {
    console.log(`   - Para eliminar: ${paraEliminar.length}`);
  }
  return colecciones;
}

// Ya no necesitamos buscar por ID, usamos documentId directamente

async function obtenerMaxIdColeccion() {
  try {
    const response = await fetch(`${STRAPI_URL}/api/colecciones?pagination[pageSize]=1&sort[0]=id_coleccion:desc`, {
      headers: HEADERS,
    });
    if (!response.ok) return 0;
    const data = await response.json();
    const coleccion = data.data?.[0];
    if (coleccion && coleccion.id_coleccion) {
      return parseInt(coleccion.id_coleccion, 10) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function obtenerColeccionActual(documentId) {
  try {
    const response = await fetch(`${STRAPI_URL}/api/colecciones/${documentId}`, { headers: HEADERS });
    if (response.ok) {
      const data = await response.json();
      return data.data;
    }
  } catch {}
  return null;
}

async function crearOActualizarColeccion(coleccionData) {
  const payload = { data: {} };
  
  // Campos requeridos
  if (!coleccionData.nombre_coleccion || !coleccionData.nombre_coleccion.trim()) {
    throw new Error('nombre_coleccion es requerido');
  }
  payload.data.nombre_coleccion = coleccionData.nombre_coleccion.trim();
  
  // id_coleccion (generar automáticamente si no se proporciona y es nuevo)
  const documentId = coleccionData.documentId?.trim();
  const esNuevo = !documentId;
  
  // Para actualizaciones, obtener el registro actual primero
  let registroActual = null;
  if (!esNuevo) {
    registroActual = await obtenerColeccionActual(documentId);
  }
  
  // Solo incluir id_coleccion si es nuevo o si cambió
  if (coleccionData.id_coleccion && coleccionData.id_coleccion.trim()) {
    const id = parseInt(coleccionData.id_coleccion, 10);
    if (!isNaN(id)) {
      // Si es actualización y el id_coleccion no cambió, no lo incluimos para evitar conflictos
      if (esNuevo || !registroActual || registroActual.id_coleccion !== id) {
        payload.data.id_coleccion = id;
      }
    }
  } else if (esNuevo) {
    // Para nuevos registros, NO incluir id_coleccion en la creación inicial
    // Lo actualizaremos después de crear el registro
    // Esto evita problemas con la validación de unicidad durante la creación
    if (coleccionData.id_coleccion && coleccionData.id_coleccion.trim()) {
      // Guardar el ID deseado para actualizarlo después
      payload._desiredIdColeccion = parseInt(coleccionData.id_coleccion, 10);
    } else {
      const maxId = await obtenerMaxIdColeccion();
      payload._desiredIdColeccion = maxId + 1;
      console.log(`   📝 ID deseado para después: ${payload._desiredIdColeccion}`);
    }
    // No incluir id_coleccion en el payload inicial
  }
  
  // Para actualizaciones, no incluir id_coleccion si no cambió (evitar conflictos de unicidad)
  if (!esNuevo && registroActual && payload.data.id_coleccion === registroActual.id_coleccion) {
    delete payload.data.id_coleccion;
  }
  
  // Asegurar que el payload tenga al menos nombre_coleccion
  if (!payload.data.nombre_coleccion) {
    throw new Error('nombre_coleccion es requerido');
  }
  
  // Relaciones - usar documentId directamente (más simple y confiable)
  if (coleccionData.documentId_editorial !== undefined && coleccionData.documentId_editorial !== '') {
    const docId = coleccionData.documentId_editorial.trim();
    if (docId) {
      payload.data.editorial = docId;
    }
  }
  
  if (coleccionData.documentId_sello !== undefined && coleccionData.documentId_sello !== '') {
    const docId = coleccionData.documentId_sello.trim();
    if (docId) {
      payload.data.sello = docId;
    }
  }
  
  if (DRY_RUN) {
    if (esNuevo) {
      console.log(`   [DRY] Crearía nueva colección:`, JSON.stringify(payload.data, null, 2));
    } else {
      console.log(`   [DRY] Actualizaría ${documentId}:`, JSON.stringify(payload.data, null, 2));
    }
    return { success: true, created: esNuevo };
  }
  
  // Debug: mostrar payload antes de enviar
  if (esNuevo) {
    console.log(`   🔍 Payload para crear:`, JSON.stringify(payload, null, 2));
  }
  
  let response;
  if (esNuevo) {
    // Crear nuevo registro - incluir publishedAt para draftAndPublish
    payload.data.publishedAt = new Date().toISOString();
    response = await fetch(`${STRAPI_URL}/api/colecciones`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
  } else {
    // Actualizar registro existente
    response = await fetch(`${STRAPI_URL}/api/colecciones/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `HTTP ${response.status}: ${errorText}`;
    // Intentar parsear el error para más detalles
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error && errorJson.error.message) {
        errorMsg = `HTTP ${response.status}: ${errorJson.error.message}`;
      }
    } catch {}
    throw new Error(errorMsg);
  }
  
  const result = await response.json();
  const createdDocumentId = result.data?.documentId;
  
  // Si es nuevo y tenemos un id_coleccion deseado, actualizarlo después
  if (esNuevo && payload._desiredIdColeccion && createdDocumentId) {
    try {
      const updateResponse = await fetch(`${STRAPI_URL}/api/colecciones/${createdDocumentId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          data: { id_coleccion: payload._desiredIdColeccion }
        }),
      });
      if (updateResponse.ok) {
        console.log(`   ✅ id_coleccion actualizado a ${payload._desiredIdColeccion}`);
        // Obtener el registro actualizado
        const updatedResult = await updateResponse.json();
        return { success: true, created: esNuevo, data: updatedResult };
      } else {
        console.warn(`   ⚠️  No se pudo actualizar id_coleccion: ${updateResponse.status}`);
      }
    } catch (e) {
      console.warn(`   ⚠️  Error al actualizar id_coleccion: ${e.message}`);
    }
  }
  
  return { success: true, created: esNuevo, data: result };
}

async function eliminarColeccion(documentId, nombre) {
  if (DRY_RUN) {
    console.log(`   [DRY] Eliminaría colección: ${documentId} (${nombre})`);
    return { success: true };
  }
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/colecciones/${documentId}`, {
      method: 'DELETE',
      headers: HEADERS,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return { success: true };
  } catch (error) {
    throw error;
  }
}

async function publicarColeccion(documentId, nombre, publicar = true) {
  if (DRY_RUN) {
    console.log(`   [DRY] ${publicar ? 'Publicaría' : 'Despublicaría'} colección: ${documentId} (${nombre})`);
    return { success: true };
  }
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/colecciones/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          publishedAt: publicar ? new Date().toISOString() : null,
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return { success: true };
  } catch (error) {
    throw error;
  }
}

async function main() {
  try {
    console.log('=== Importar Colecciones desde Google Sheets ===\n');
    if (DRY_RUN) console.log('🔍 MODO DRY RUN\n');
    const sheets = await initGoogleSheets();
    const colecciones = await fetchFromGoogleSheets(sheets);
    if (colecciones.length === 0) { console.log('⚠️  No hay colecciones'); return; }
    
    // Separar por acción
    const getAccion = (c) => (c.accion || c.eliminar || '').toString().toLowerCase().trim();
    const paraEliminar = colecciones.filter(c => {
      const accion = getAccion(c);
      return (accion === 'eliminar' || accion === 'delete' || accion === 'x' || accion === '🗑️') && 
             c.documentId && c.documentId.trim();
    });
    const paraPublicar = colecciones.filter(c => {
      const accion = getAccion(c);
      return accion === 'publicar' && c.documentId && c.documentId.trim();
    });
    const paraDespublicar = colecciones.filter(c => {
      const accion = getAccion(c);
      return accion === 'despublicar' && c.documentId && c.documentId.trim();
    });
    const nuevas = colecciones.filter(c => 
      (!c.documentId || !c.documentId.trim()) && 
      !getAccion(c).match(/^(eliminar|delete|x|🗑️|publicar|despublicar)$/)
    );
    const existentes = colecciones.filter(c => 
      c.documentId && c.documentId.trim() && 
      !getAccion(c).match(/^(eliminar|delete|x|🗑️|publicar|despublicar)$/)
    );
    
    console.log(`   📋 Procesando:`);
    if (paraEliminar.length > 0) console.log(`      - Para eliminar: ${paraEliminar.length}`);
    if (paraPublicar.length > 0) console.log(`      - Para publicar: ${paraPublicar.length}`);
    if (paraDespublicar.length > 0) console.log(`      - Para despublicar: ${paraDespublicar.length}`);
    console.log(`      - Nuevas: ${nuevas.length}`);
    console.log(`      - Existentes: ${existentes.length}\n`);
    
    let success = 0, created = 0, updated = 0, deleted = 0, published = 0, unpublished = 0, errors = 0;
    
    // Procesar eliminaciones primero
    if (paraEliminar.length > 0) {
      console.log(`   🗑️  Eliminando ${paraEliminar.length} colecciones...\n`);
      for (const coleccion of paraEliminar) {
        try {
          await eliminarColeccion(coleccion.documentId, coleccion.nombre_coleccion || 'Sin nombre');
          deleted++;
          if (!DRY_RUN) {
            console.log(`   ✅ ELIMINADA: ${coleccion.documentId} (${coleccion.nombre_coleccion || 'Sin nombre'})`);
          }
        } catch (e) {
          errors++;
          console.error(`   ❌ Error al eliminar ${coleccion.documentId}: ${e.message}`);
        }
      }
      console.log('');
    }
    
    // Procesar publicaciones
    if (paraPublicar.length > 0) {
      console.log(`   📢 Publicando ${paraPublicar.length} colecciones...\n`);
      for (const coleccion of paraPublicar) {
        try {
          await publicarColeccion(coleccion.documentId, coleccion.nombre_coleccion || 'Sin nombre', true);
          published++;
          if (!DRY_RUN) {
            console.log(`   ✅ PUBLICADA: ${coleccion.documentId} (${coleccion.nombre_coleccion || 'Sin nombre'})`);
          }
        } catch (e) {
          errors++;
          console.error(`   ❌ Error al publicar ${coleccion.documentId}: ${e.message}`);
        }
      }
      console.log('');
    }
    
    // Procesar despublicaciones
    if (paraDespublicar.length > 0) {
      console.log(`   🔒 Despublicando ${paraDespublicar.length} colecciones...\n`);
      for (const coleccion of paraDespublicar) {
        try {
          await publicarColeccion(coleccion.documentId, coleccion.nombre_coleccion || 'Sin nombre', false);
          unpublished++;
          if (!DRY_RUN) {
            console.log(`   ✅ DESPUBLICADA: ${coleccion.documentId} (${coleccion.nombre_coleccion || 'Sin nombre'})`);
          }
        } catch (e) {
          errors++;
          console.error(`   ❌ Error al despublicar ${coleccion.documentId}: ${e.message}`);
        }
      }
      console.log('');
    }
    
    // Procesar nuevas primero
    for (const coleccion of nuevas) {
      try {
        const result = await crearOActualizarColeccion(coleccion);
        success++;
        if (result.created) {
          created++;
          if (!DRY_RUN) {
            const docId = result.data?.data?.documentId || 'nuevo';
            console.log(`   ✅ CREADA: ${coleccion.nombre_coleccion} (${docId})`);
          }
        } else {
          updated++;
          if (!DRY_RUN) console.log(`   ✅ ACTUALIZADA: ${coleccion.documentId}`);
        }
      } catch (e) {
        errors++;
        const nombre = coleccion.nombre_coleccion || 'Sin nombre';
        const docId = coleccion.documentId || 'NUEVO';
        console.error(`   ❌ ${docId} (${nombre}): ${e.message}`);
      }
    }
    
    // Procesar existentes después
    if (existentes.length > 0) {
      console.log(`\n   📝 Procesando ${existentes.length} colecciones existentes...\n`);
      for (const coleccion of existentes) {
        try {
          const result = await crearOActualizarColeccion(coleccion);
          success++;
          if (result.created) {
            created++;
            if (!DRY_RUN) {
              const docId = result.data?.data?.documentId || 'nuevo';
              console.log(`   ✅ CREADA: ${coleccion.nombre_coleccion} (${docId})`);
            }
          } else {
            updated++;
            if (!DRY_RUN) console.log(`   ✅ ACTUALIZADA: ${coleccion.documentId}`);
          }
        } catch (e) {
          errors++;
          const nombre = coleccion.nombre_coleccion || 'Sin nombre';
          const docId = coleccion.documentId || 'NUEVO';
          console.error(`   ❌ ${docId} (${nombre}): ${e.message}`);
        }
      }
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`   ✅ Total procesadas: ${success}`);
    if (deleted > 0) console.log(`   🗑️  Eliminadas: ${deleted}`);
    if (published > 0) console.log(`   📢 Publicadas: ${published}`);
    if (unpublished > 0) console.log(`   🔒 Despublicadas: ${unpublished}`);
    if (created > 0) console.log(`   🆕 Creadas: ${created}`);
    if (updated > 0) console.log(`   📝 Actualizadas: ${updated}`);
    if (errors > 0) console.log(`   ❌ Errores: ${errors}`);
    if (DRY_RUN) console.log(`\n💡 Ejecuta sin DRY=1 para aplicar cambios`);
    console.log('\n🎉 ¡Listo!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
