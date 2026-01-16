#!/usr/bin/env node

/**
 * Script para importar datos del backup de producción a local
 * 
 * Uso:
 *   node scripts/importar-backup-local.mjs [backup-dir]
 * 
 * Ejemplo:
 *   node scripts/importar-backup-local.mjs backups/backup-2025-11-17T23-20-11
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'url';
// Node 20+ tiene fetch nativo, no necesitamos node-fetch

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno (buscar en strapi/.env primero, luego en backend/.env)
const envPaths = [
  resolve(__dirname, '..', 'strapi', '.env'),
  resolve(__dirname, '..', '.env'),
];

for (const envPath of envPaths) {
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
    break; // Usar el primer .env encontrado
  }
}

const BACKUP_DIR = process.argv[2] || resolve(__dirname, '..', 'backups', 'backup-2025-11-17T23-20-11');
// Para importación local, siempre usar localhost (no producción)
const STRAPI_URL = process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
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

// Debug: verificar que el token esté presente
if (!STRAPI_TOKEN || STRAPI_TOKEN.length < 50) {
  console.error('❌ Token no válido o muy corto');
  console.error(`   Token length: ${STRAPI_TOKEN ? STRAPI_TOKEN.length : 0}`);
  console.error(`   Token preview: ${STRAPI_TOKEN ? STRAPI_TOKEN.substring(0, 20) + '...' : 'undefined'}`);
  process.exit(1);
}

// Debug: mostrar token (solo primeros caracteres)
console.log(`🔑 Token configurado: ${STRAPI_TOKEN.substring(0, 30)}...`);

// Orden de importación (dependencias primero)
const IMPORT_ORDER = [
  // Datos base (sin dependencias)
  'comuna',
  'asignatura',
  'colaborador',
  'empresa',
  'email-template',
  'media-category',
  'media-tag',
  
  // Datos con dependencias simples
  'colegio',
  'colegio-sostenedor',
  'persona',
  
  // Datos con dependencias complejas
  'cartera-periodo',
  'cartera-asignacion',
  'colegio-event',
  'colegio-campana',
  'persona-trayectoria',
  'promocion-contacto',
  'email-log',
  'user-mailbox',
  'media-asset',
  'news-article',
];

/**
 * Obtener pluralName desde el schema
 */
function getPluralName(contentType) {
  // Mapeo manual de nombres
  const mapping = {
    'comuna': 'comunas',
    'asignatura': 'asignaturas',
    'colaborador': 'colaboradores',
    'empresa': 'empresas',
    'email-template': 'email-templates',
    'media-category': 'media-categories',
    'media-tag': 'media-tags',
    'colegio': 'colegios',
    'colegio-sostenedor': 'colegio-sostenedores',
    'persona': 'personas',
    'cartera-periodo': 'cartera-periodos',
    'cartera-asignacion': 'cartera-asignaciones',
    'colegio-event': 'colegio-events',
    'colegio-campana': 'colegio-campanas',
    'persona-trayectoria': 'persona-trayectorias',
    'promocion-contacto': 'promocion-contactos',
    'email-log': 'email-logs',
    'user-mailbox': 'user-mailboxes',
    'media-asset': 'media-assets',
    'news-article': 'news-articles',
  };
  
  return mapping[contentType] || `${contentType}s`;
}

/**
 * Normalizar datos de Strapi (puede venir en formato {data: {...}} o {...})
 */
function normalizeData(entry) {
  let data;
  
  // Si tiene estructura Strapi v4/v5 con attributes
  if (entry.attributes) {
    data = { ...entry.attributes };
  }
  // Si ya está normalizado
  else if (entry.data) {
    data = entry.data;
  }
  // Si es un objeto plano
  else {
    data = { ...entry };
  }
  
  // Remover documentId inmediatamente si existe
  if (data.documentId) {
    delete data.documentId;
  }
  if (data.id) {
    delete data.id;
  }
  
  return data;
}

/**
 * Obtener schema local de un content type
 */
function getLocalSchema(contentType) {
  try {
    const schemaPath = resolve(__dirname, '..', 'src', 'api', contentType, 'content-types', contentType, 'schema.json');
    if (existsSync(schemaPath)) {
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      return JSON.parse(schemaContent);
    }
  } catch (error) {
    // Schema no existe, retornar null
  }
  return null;
}

/**
 * Limpiar relaciones y campos que Strapi no acepta en el payload
 * AHORA: Solo incluir campos que existen en el schema local
 */
function cleanRelations(data, localSchema = null) {
  // Crear copia profunda para no modificar el original
  const cleaned = JSON.parse(JSON.stringify(data));
  
  // Remover campos que Strapi no acepta en el payload de creación
  const fieldsToRemove = [
    // IDs y metadatos
    'id', 'documentId', 'createdBy', 'updatedBy', 
    'localizations', 'locale', 'publishedAt', 
    'createdAt', 'updatedAt',
  ];
  
  // Remover campos del nivel raíz
  fieldsToRemove.forEach(field => {
    if (cleaned.hasOwnProperty(field)) {
      delete cleaned[field];
    }
  });
  
  // Si tenemos el schema local, filtrar solo campos que existen
  if (localSchema && localSchema.attributes) {
    const allowedFields = Object.keys(localSchema.attributes);
    const filtered = {};
    
    Object.keys(cleaned).forEach(key => {
      // Solo incluir si el campo existe en el schema local
      if (allowedFields.includes(key)) {
        filtered[key] = cleaned[key];
      }
    });
    
    // Limpiar relaciones en los campos filtrados
    Object.keys(filtered).forEach(key => {
      const value = filtered[key];
      
      // Si es un array de objetos con id/documentId, convertir a array de IDs
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        if (value[0].id || value[0].documentId) {
          filtered[key] = value.map(item => item.id || item.documentId).filter(Boolean);
        }
      }
      // Si es un objeto con id/documentId, convertir a ID
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.id || value.documentId) {
          filtered[key] = value.id || value.documentId;
        }
      }
    });
    
    return filtered;
  }
  
  // Si no hay schema local, usar lógica anterior
  Object.keys(cleaned).forEach(key => {
    const value = cleaned[key];
    
    // Si es un array de objetos con id/documentId, convertir a array de IDs
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      if (value[0].id || value[0].documentId) {
        cleaned[key] = value.map(item => item.id || item.documentId).filter(Boolean);
      }
    }
    // Si es un objeto con id/documentId, convertir a ID
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (value.id || value.documentId) {
        cleaned[key] = value.id || value.documentId;
      }
    }
  });
  
  return cleaned;
}

/**
 * Importar un content type
 */
async function importContentType(contentType, data) {
  const pluralName = getPluralName(contentType);
  const url = `${STRAPI_URL}/api/${pluralName}`;
  
  let success = 0;
  let errors = 0;
  const errorDetails = [];

  console.log(`\n📦 Importando ${contentType}...`);
  console.log(`   Total: ${data.length} registros`);
  console.log(`   URL: ${url}`);

  // Obtener schema local para filtrar campos
  const localSchema = getLocalSchema(contentType);
  if (localSchema) {
    const fieldCount = Object.keys(localSchema.attributes || {}).length;
    console.log(`   📋 Schema local encontrado (${fieldCount} campos)`);
  } else {
    console.log(`   ⚠️  Schema local no encontrado, usando todos los campos`);
  }

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    const normalized = normalizeData(entry);
    const cleaned = cleanRelations(normalized, localSchema);
    
    // Crear objeto limpio sin campos problemáticos
    const dataToImport = {};
    const forbiddenKeys = ['id', 'documentId', 'createdBy', 'updatedBy', 'localizations', 
                           'locale', 'publishedAt', 'createdAt', 'updatedAt'];
    
    Object.keys(cleaned).forEach(key => {
      // Saltar campos que Strapi no acepta
      if (!forbiddenKeys.includes(key)) {
        const value = cleaned[key];
        // Si el valor es null o undefined, saltarlo
        if (value !== null && value !== undefined) {
          dataToImport[key] = value;
        }
      }
    });
    
    // Verificación final: asegurarse de que documentId no esté presente
    if (dataToImport.documentId !== undefined) {
      delete dataToImport.documentId;
    }
    if (dataToImport.id !== undefined) {
      delete dataToImport.id;
    }
    
    // Debug: verificar que no tenga documentId antes de enviar
    if (i === 0 && contentType === 'comuna') {
      console.log(`   🔍 Debug primer registro:`, {
        keys: Object.keys(dataToImport),
        hasDocumentId: 'documentId' in dataToImport,
        payload: JSON.stringify({ data: dataToImport }).substring(0, 200)
      });
    }
    
    try {
      const payload = JSON.stringify({ data: dataToImport });
      
      // Verificación final antes de enviar
      const payloadObj = JSON.parse(payload);
      if (payloadObj.data && payloadObj.data.documentId !== undefined) {
        delete payloadObj.data.documentId;
        console.log(`   ⚠️  documentId encontrado en payload, removiendo...`);
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(payloadObj),
      });

      if (!response.ok) {
        const errorText = await response.text();
        errors++;
        const entryId = entry.id || entry.documentId || 'N/A';
        errorDetails.push({
          index: i,
          id: entryId,
          error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`,
        });
        
        // Si es error 400, puede ser que el registro ya existe
        if (response.status === 400) {
          // Intentar actualizar si tiene ID
          if (id) {
            try {
              const updateResponse = await fetch(`${url}/${id}`, {
                method: 'PUT',
                headers: HEADERS,
                body: JSON.stringify({ data: dataToImport }),
              });
              
              if (updateResponse.ok) {
                success++;
                errors--;
                continue;
              }
            } catch (updateError) {
              // Ignorar error de actualización
            }
          }
        }
      } else {
        success++;
      }
      
      // Mostrar progreso cada 100 registros
      if ((i + 1) % 100 === 0) {
        process.stdout.write(`   Progreso: ${i + 1}/${data.length} (${success} OK, ${errors} errores)\r`);
      }
    } catch (error) {
      errors++;
      errorDetails.push({
        index: i,
        id: id || 'N/A',
        error: error.message,
      });
    }
    
    // Pequeña pausa para no sobrecargar
    if ((i + 1) % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n   ✅ ${success} registros importados`);
  if (errors > 0) {
    console.log(`   ⚠️  ${errors} errores`);
    if (errorDetails.length <= 10) {
      errorDetails.forEach(detail => {
        console.log(`      - Registro ${detail.index} (ID: ${detail.id}): ${detail.error}`);
      });
    }
  }

  return { success, errors, errorDetails };
}

/**
 * Función principal
 */
async function main() {
  console.log('📥 Importando backup de producción a local');
  console.log('━'.repeat(60));
  console.log(`📁 Backup: ${BACKUP_DIR}`);
  console.log(`🌐 Strapi: ${STRAPI_URL}`);
  console.log('━'.repeat(60));

  // Verificar que el directorio existe
  const dataDir = join(BACKUP_DIR, 'data');
  if (!existsSync(dataDir)) {
    console.error(`❌ Directorio no encontrado: ${dataDir}`);
    process.exit(1);
  }

  // Verificar conexión con Strapi
  try {
    // Intentar con /api primero, si falla probar sin /api
    let healthCheck;
    try {
      healthCheck = await fetch(`${STRAPI_URL}/api`, { headers: HEADERS });
    } catch (e) {
      // Si falla, probar sin /api (algunas versiones de Strapi)
      healthCheck = await fetch(`${STRAPI_URL}`, { headers: HEADERS });
    }
    
    if (!healthCheck.ok && healthCheck.status !== 404) {
      // 404 puede ser normal en algunas configuraciones
      console.warn(`⚠️  Advertencia: HTTP ${healthCheck.status} al verificar conexión`);
      console.warn(`   Continuando de todas formas...`);
    }
  } catch (error) {
    console.error(`❌ Error conectando a Strapi: ${error.message}`);
    console.error(`   Verifica que Strapi esté corriendo en ${STRAPI_URL}`);
    console.error(`   Error completo:`, error);
    process.exit(1);
  }

  // Leer todos los archivos JSON
  const files = readdirSync(dataDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  console.log(`\n📋 Content types encontrados: ${files.length}\n`);

  // Ordenar según IMPORT_ORDER
  const ordered = [];
  const unordered = [];

  for (const ct of IMPORT_ORDER) {
    if (files.includes(ct)) {
      ordered.push(ct);
    }
  }

  for (const ct of files) {
    if (!IMPORT_ORDER.includes(ct)) {
      unordered.push(ct);
    }
  }

  const allContentTypes = [...ordered, ...unordered];

  // Importar cada content type
  const results = {};
  let totalSuccess = 0;
  let totalErrors = 0;

  for (const contentType of allContentTypes) {
    const filePath = join(dataDir, `${contentType}.json`);
    
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`\n⏭️  ${contentType}: Sin datos, saltando`);
        continue;
      }

      const result = await importContentType(contentType, data);
      results[contentType] = result;
      totalSuccess += result.success;
      totalErrors += result.errors;
    } catch (error) {
      console.error(`\n❌ Error procesando ${contentType}:`, error.message);
      results[contentType] = { success: 0, errors: 1, errorDetails: [{ error: error.message }] };
      totalErrors++;
    }
  }

  // Resumen final
  console.log('\n' + '━'.repeat(60));
  console.log('📊 RESUMEN DE IMPORTACIÓN');
  console.log('━'.repeat(60));
  console.log(`✅ Total importado: ${totalSuccess} registros`);
  console.log(`⚠️  Total errores: ${totalErrors} registros`);
  console.log(`📦 Content types procesados: ${Object.keys(results).length}`);
  console.log('━'.repeat(60));

  // Mostrar content types con errores
  const withErrors = Object.entries(results).filter(([_, r]) => r.errors > 0);
  if (withErrors.length > 0) {
    console.log('\n⚠️  Content types con errores:');
    withErrors.forEach(([ct, r]) => {
      console.log(`   - ${ct}: ${r.errors} errores de ${r.success + r.errors} registros`);
    });
  }

  console.log('\n✅ Importación completada!\n');
}

main().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});

