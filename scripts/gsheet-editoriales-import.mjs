#!/usr/bin/env node

/**
 * Script para importar editoriales desde Google Sheets a Strapi
 * 
 * Uso:
 *   npm run gsheet:editoriales:import
 *   npm run gsheet:editoriales:import:dry (solo muestra cambios sin aplicarlos)
 */

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
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const STRAPI_URL = process.env.STRAPI_URL || process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || resolve(__dirname, '..', 'data', 'gsheets', 'credentials.json');
const DRY_RUN = process.env.DRY === '1';

if (!STRAPI_TOKEN) {
  console.error('❌ Falta STRAPI_TOKEN o IMPORT_TOKEN');
  process.exit(1);
}

if (!SPREADSHEET_ID) {
  console.error('❌ Falta GOOGLE_SHEETS_SPREADSHEET_ID');
  process.exit(1);
}

if (!existsSync(CREDENTIALS_PATH)) {
  console.error(`❌ No se encontró credentials.json en: ${CREDENTIALS_PATH}`);
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

const COLUMNS = [
  'id_editorial',
  'nombre_editorial',
  'acronimo',
  'website',
  'accion',
  'fecha_creacion',
  'fecha_edicion',
  'documentId',
  'url',
];

async function initGoogleSheets() {
  const credentials = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function fetchFromGoogleSheets(sheets) {
  console.log('📥 Leyendo datos desde Google Sheets...');
  
  const sheetName = 'Editoriales';
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];
  
  if (rows.length < 2) {
    throw new Error('La hoja está vacía o solo tiene encabezados');
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const editoriales = dataRows
    .filter(row => {
      const hasData = row.some(cell => cell && cell.trim());
      if (!hasData) return false;
      const nombreIndex = headers.indexOf('nombre_editorial');
      return nombreIndex !== -1 && row[nombreIndex] && row[nombreIndex].trim();
    })
    .map(row => {
      const editorial = {};
      headers.forEach((header, index) => {
        editorial[header] = row[index] || '';
      });
      return editorial;
    });

  const conDocumentId = editoriales.filter(e => e.documentId && e.documentId.trim());
  const sinDocumentId = editoriales.filter(e => !e.documentId || !e.documentId.trim());
  
  console.log(`   ${editoriales.length} editoriales encontradas`);
  console.log(`   - Con documentId (actualizar): ${conDocumentId.length}`);
  console.log(`   - Sin documentId (crear nuevo): ${sinDocumentId.length}`);
  
  return editoriales;
}

async function obtenerMaxIdEditorial() {
  try {
    const response = await fetch(`${STRAPI_URL}/api/editoriales?pagination[pageSize]=100&sort[0]=id_editorial:desc`, {
      headers: HEADERS,
    });
    if (!response.ok) return 0;
    const data = await response.json();
    const editoriales = data.data || [];
    let maxId = 0;
    for (const editorial of editoriales) {
      if (editorial.id_editorial) {
        const id = parseInt(String(editorial.id_editorial), 10);
        if (!isNaN(id) && id > maxId) {
          maxId = id;
        }
      }
    }
    return maxId;
  } catch {
    return 0;
  }
}

async function obtenerEditorialActual(documentId) {
  try {
    const response = await fetch(`${STRAPI_URL}/api/editoriales/${documentId}`, { headers: HEADERS });
    if (response.ok) {
      const data = await response.json();
      return data.data;
    }
  } catch {}
  return null;
}

async function buscarEditorialPorIdEditorial(idEditorial) {
  try {
    const response = await fetch(`${STRAPI_URL}/api/editoriales?filters[id_editorial][$eq]=${encodeURIComponent(idEditorial)}&pagination[pageSize]=1`, {
      headers: HEADERS,
    });
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        return data.data[0];
      }
    }
  } catch {}
  return null;
}

async function crearOActualizarEditorial(editorialData) {
  const payload = { data: {} };
  
  if (!editorialData.nombre_editorial || !editorialData.nombre_editorial.trim()) {
    throw new Error('nombre_editorial es requerido');
  }
  payload.data.nombre_editorial = editorialData.nombre_editorial.trim();
  
  const documentId = editorialData.documentId?.trim();
  const esNuevo = !documentId;
  
  // Para actualizaciones, obtener el registro actual primero
  let registroActual = null;
  if (!esNuevo) {
    registroActual = await obtenerEditorialActual(documentId);
  }
  
  // Incluir id_editorial si se proporciona y es diferente al actual
  if (editorialData.id_editorial && editorialData.id_editorial.trim()) {
    const nuevoId = String(editorialData.id_editorial).trim();
    const idActual = registroActual ? String(registroActual.id_editorial || '').trim() : '';
    
    // Si el id_editorial cambió o es nuevo
    if (esNuevo || !registroActual || nuevoId !== idActual) {
      // Verificar si el nuevo id_editorial ya existe en otra editorial
      const editorialConMismoId = await buscarEditorialPorIdEditorial(nuevoId);
      if (editorialConMismoId) {
        // Verificar si es la misma editorial (puede pasar si el id no cambió realmente)
        if (documentId && editorialConMismoId.documentId === documentId) {
          // Es la misma editorial, no hay conflicto
          payload.data.id_editorial = nuevoId;
        } else {
        // Hay conflicto: otra editorial ya tiene ese id_editorial
        // Primero mover esa otra editorial a un valor temporal que no exista
        console.log(`   ⚠️  Conflicto: id_editorial ${nuevoId} ya existe en otra editorial (${editorialConMismoId.documentId})`);
        
        // Buscar un id temporal que no exista
        let idTemporal = null;
        const maxId = await obtenerMaxIdEditorial();
        for (let i = 1; i <= 1000; i++) {
          const candidato = String(maxId + 10000 + i);
          const existe = await buscarEditorialPorIdEditorial(candidato);
          if (!existe) {
            idTemporal = candidato;
            break;
          }
        }
        
        if (!idTemporal) {
          throw new Error(`No se pudo encontrar un id temporal disponible para resolver el conflicto`);
        }
        
        console.log(`   🔄 Moviendo la otra editorial a id temporal: ${idTemporal}`);
        
        try {
          // Obtener los datos actuales de la editorial conflictiva para preservarlos
          const editorialConflictiva = await obtenerEditorialActual(editorialConMismoId.documentId);
          if (!editorialConflictiva) {
            throw new Error(`No se pudo obtener los datos de la editorial conflictiva`);
          }
          
          const tempResponse = await fetch(`${STRAPI_URL}/api/editoriales/${editorialConMismoId.documentId}`, {
            method: 'PUT',
            headers: HEADERS,
            body: JSON.stringify({
              data: {
                id_editorial: idTemporal,
                nombre_editorial: editorialConflictiva.nombre_editorial || 'Temporal',
                acronimo: editorialConflictiva.acronimo || null,
                website: editorialConflictiva.website || null,
              }
            }),
          });
          if (tempResponse.ok) {
            console.log(`   ✅ Editorial conflictiva movida temporalmente`);
          } else {
            const errorText = await tempResponse.text();
            throw new Error(`No se pudo mover la editorial conflictiva: ${tempResponse.status} - ${errorText}`);
          }
        } catch (e) {
          throw new Error(`Error al resolver conflicto de id_editorial: ${e.message}`);
        }
        }
        // Ahora sí podemos asignar el nuevo id_editorial
        payload.data.id_editorial = nuevoId;
      } else {
        // No hay conflicto, asignar directamente
        payload.data.id_editorial = nuevoId;
      }
    } else if (esNuevo) {
      // Para nuevas editoriales, verificar que el id no exista
      const editorialExistente = await buscarEditorialPorIdEditorial(nuevoId);
      if (editorialExistente) {
        throw new Error(`id_editorial ${nuevoId} ya existe en otra editorial`);
      }
      payload.data.id_editorial = nuevoId;
    }
      } else if (esNuevo) {
    const maxId = await obtenerMaxIdEditorial();
    payload.data.id_editorial = String(maxId + 1);
    console.log(`   📝 Generando id_editorial automático: ${payload.data.id_editorial}`);
  }
  
  // Para actualizaciones, no incluir id_editorial si no cambió (evitar conflictos de unicidad)
  if (!esNuevo && registroActual && payload.data.id_editorial === registroActual.id_editorial) {
    delete payload.data.id_editorial;
  }
  
  if (editorialData.acronimo !== undefined) {
    payload.data.acronimo = editorialData.acronimo?.trim() || null;
  }
  if (editorialData.website !== undefined) {
    payload.data.website = editorialData.website?.trim() || null;
  }
  
  if (DRY_RUN) {
    if (esNuevo) {
      console.log(`   [DRY] Crearía nueva editorial:`, JSON.stringify(payload.data, null, 2));
    } else {
      console.log(`   [DRY] Actualizaría ${documentId}:`, JSON.stringify(payload.data, null, 2));
      if (registroActual && payload.data.id_editorial) {
        console.log(`   [DRY] Cambio de id_editorial: ${registroActual.id_editorial} → ${payload.data.id_editorial}`);
      }
    }
    return { success: true, created: esNuevo };
  }
  
  // Debug: mostrar payload antes de enviar si hay cambio de id_editorial
  if (!esNuevo && registroActual && payload.data.id_editorial && payload.data.id_editorial !== registroActual.id_editorial) {
    console.log(`   🔄 Cambiando id_editorial: ${registroActual.id_editorial} → ${payload.data.id_editorial}`);
  }
  
  let response;
  if (esNuevo) {
    payload.data.publishedAt = new Date().toISOString();
    response = await fetch(`${STRAPI_URL}/api/editoriales`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
  } else {
    response = await fetch(`${STRAPI_URL}/api/editoriales/${documentId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return { success: true, created: esNuevo, data: await response.json() };
}

async function eliminarEditorial(documentId, nombre) {
  if (DRY_RUN) {
    console.log(`   [DRY] Eliminaría editorial: ${documentId} (${nombre})`);
    return { success: true };
  }
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/editoriales/${documentId}`, {
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

async function publicarEditorial(documentId, nombre, publicar = true) {
  if (DRY_RUN) {
    console.log(`   [DRY] ${publicar ? 'Publicaría' : 'Despublicaría'} editorial: ${documentId} (${nombre})`);
    return { success: true };
  }
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/editoriales/${documentId}`, {
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
    console.log('=== Importar Editoriales desde Google Sheets ===\n');
    if (DRY_RUN) {
      console.log('🔍 MODO DRY RUN - No se harán cambios reales\n');
    }
    console.log(`Strapi: ${STRAPI_URL}`);
    console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);

    const sheets = await initGoogleSheets();
    const editoriales = await fetchFromGoogleSheets(sheets);

    if (editoriales.length === 0) {
      console.log('⚠️  No se encontraron editoriales para importar');
      return;
    }

    const getAccion = (e) => (e.accion || '').toString().toLowerCase().trim();
    const paraEliminar = editoriales.filter(e => {
      const accion = getAccion(e);
      return (accion === 'eliminar' || accion === 'delete' || accion === 'x' || accion === '🗑️') && 
             e.documentId && e.documentId.trim();
    });
    const paraPublicar = editoriales.filter(e => {
      const accion = getAccion(e);
      return accion === 'publicar' && e.documentId && e.documentId.trim();
    });
    const paraDespublicar = editoriales.filter(e => {
      const accion = getAccion(e);
      return accion === 'despublicar' && e.documentId && e.documentId.trim();
    });
    const nuevas = editoriales.filter(e => 
      (!e.documentId || !e.documentId.trim()) && 
      !getAccion(e).match(/^(eliminar|delete|x|🗑️|publicar|despublicar)$/)
    );
    const existentes = editoriales.filter(e => 
      e.documentId && e.documentId.trim() && 
      !getAccion(e).match(/^(eliminar|delete|x|🗑️|publicar|despublicar)$/)
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
      console.log(`   🗑️  Eliminando ${paraEliminar.length} editoriales...\n`);
      for (const editorial of paraEliminar) {
        try {
          await eliminarEditorial(editorial.documentId, editorial.nombre_editorial || 'Sin nombre');
          deleted++;
          if (!DRY_RUN) {
            console.log(`   ✅ ELIMINADA: ${editorial.documentId} (${editorial.nombre_editorial || 'Sin nombre'})`);
          }
        } catch (e) {
          errors++;
          console.error(`   ❌ Error al eliminar ${editorial.documentId}: ${e.message}`);
        }
      }
      console.log('');
    }
    
    // Procesar publicaciones
    if (paraPublicar.length > 0) {
      console.log(`   📢 Publicando ${paraPublicar.length} editoriales...\n`);
      for (const editorial of paraPublicar) {
        try {
          await publicarEditorial(editorial.documentId, editorial.nombre_editorial || 'Sin nombre', true);
          published++;
          if (!DRY_RUN) {
            console.log(`   ✅ PUBLICADA: ${editorial.documentId} (${editorial.nombre_editorial || 'Sin nombre'})`);
          }
        } catch (e) {
          errors++;
          console.error(`   ❌ Error al publicar ${editorial.documentId}: ${e.message}`);
        }
      }
      console.log('');
    }
    
    // Procesar despublicaciones
    if (paraDespublicar.length > 0) {
      console.log(`   🔒 Despublicando ${paraDespublicar.length} editoriales...\n`);
      for (const editorial of paraDespublicar) {
        try {
          await publicarEditorial(editorial.documentId, editorial.nombre_editorial || 'Sin nombre', false);
          unpublished++;
          if (!DRY_RUN) {
            console.log(`   ✅ DESPUBLICADA: ${editorial.documentId} (${editorial.nombre_editorial || 'Sin nombre'})`);
          }
        } catch (e) {
          errors++;
          console.error(`   ❌ Error al despublicar ${editorial.documentId}: ${e.message}`);
        }
      }
      console.log('');
    }
    
    // Procesar nuevas primero
    for (const editorial of nuevas) {
      try {
        const result = await crearOActualizarEditorial(editorial);
        success++;
        if (result.created) {
          created++;
          if (!DRY_RUN) {
            const docId = result.data?.data?.documentId || 'nuevo';
            console.log(`   ✅ CREADA: ${editorial.nombre_editorial} (${docId})`);
          }
        }
      } catch (e) {
        errors++;
        const nombre = editorial.nombre_editorial || 'Sin nombre';
        console.error(`   ❌ NUEVO (${nombre}): ${e.message}`);
      }
    }
    
    // Procesar existentes después
    if (existentes.length > 0) {
      console.log(`\n   📝 Procesando ${existentes.length} editoriales existentes...\n`);
      for (const editorial of existentes) {
        try {
          const result = await crearOActualizarEditorial(editorial);
          success++;
          if (result.created) {
            created++;
          } else {
            updated++;
            if (!DRY_RUN) console.log(`   ✅ ACTUALIZADA: ${editorial.documentId}`);
          }
        } catch (e) {
          errors++;
          const nombre = editorial.nombre_editorial || 'Sin nombre';
          const docId = editorial.documentId || 'NUEVO';
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
    if (errors.length > 0) {
      console.log(`\n⚠️  Errores detallados:`);
      errors.forEach(({ documentId, error }) => {
        console.log(`   - ${documentId}: ${error}`);
      });
    }

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

