#!/usr/bin/env node

/**
 * Script para importar editoriales desde CSV a Strapi
 * 
 * Uso:
 *   node scripts/importar-editoriales-csv.mjs <archivo.csv>
 * 
 * Formato CSV esperado (con encabezados):
 *   id_editorial,nombre_editorial,descripcion
 *   ED-001,"Editorial Planeta","Editorial española..."
 *   ED-002,"Penguin Random House","Editorial internacional..."
 * 
 * O formato simple:
 *   nombre_editorial
 *   "Editorial Planeta"
 *   "Penguin Random House"
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
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

async function importarEditorial(editorialData) {
  const url = `${STRAPI_URL}/api/editoriales`;

  // Preparar datos según el schema de Strapi
  // Mapear diferentes formatos de CSV
  const nombreEditorial = editorialData.nombre_editorial 
    || editorialData.nombre 
    || editorialData.name
    || editorialData.editorial 
    || '';
  
  // Mapear id_editorial desde diferentes campos
  const idEditorial = editorialData.id_editorial 
    || editorialData.id_brand 
    || editorialData.editorial_acronimo
    || editorialData.acronym
    || null;

  const data = {
    data: {
      nombre_editorial: nombreEditorial,
    },
  };

  // Agregar id_editorial si existe
  if (idEditorial) {
    data.data.id_editorial = String(idEditorial);
  }

  // Verificar si ya existe por id_editorial
  if (data.data.id_editorial) {
    try {
      const existing = await fetch(`${url}?filters[id_editorial][$eq]=${encodeURIComponent(data.data.id_editorial)}`, {
        method: 'GET',
        headers: HEADERS,
      }).then(res => res.json());

      if (existing.data && existing.data.length > 0) {
        console.log(`   ⚠️  Editorial ya existe: ${data.data.nombre_editorial} (${data.data.id_editorial})`);
        return { success: false, reason: 'exists', id: existing.data[0].id };
      }
    } catch (error) {
      // Continuar si hay error al verificar
    }
  }

  // Verificar si ya existe por nombre
  try {
    const existing = await fetch(`${url}?filters[nombre_editorial][$eq]=${encodeURIComponent(data.data.nombre_editorial)}`, {
      method: 'GET',
      headers: HEADERS,
    }).then(res => res.json());

    if (existing.data && existing.data.length > 0) {
      console.log(`   ⚠️  Editorial ya existe: ${data.data.nombre_editorial}`);
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
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`   ✅ Creada: ${data.data.nombre_editorial}${data.data.id_editorial ? ` (${data.data.id_editorial})` : ''}`);
    return { success: true, id: result.data.id, data: result.data };
  } catch (error) {
    console.error(`   ❌ Error: ${data.data.nombre_editorial} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  const csvFile = process.argv[2];

  if (!csvFile) {
    console.error('❌ Falta el archivo CSV');
    console.error('');
    console.error('Uso: node scripts/importar-editoriales-csv.mjs <archivo.csv>');
    console.error('');
    console.error('Formato CSV esperado:');
    console.error('  id_editorial,nombre_editorial,descripcion');
    console.error('  ED-001,"Editorial Planeta","Editorial española..."');
    console.error('  ED-002,"Penguin Random House","Editorial internacional..."');
    console.error('');
    console.error('O formato simple:');
    console.error('  nombre_editorial');
    console.error('  "Editorial Planeta"');
    console.error('  "Penguin Random House"');
    process.exit(1);
  }

  const csvPath = resolve(csvFile);
  if (!existsSync(csvPath)) {
    console.error(`❌ Archivo no encontrado: ${csvPath}`);
    process.exit(1);
  }

  console.log('📚 Importando Editoriales desde CSV');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Archivo: ${csvPath}`);
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const csvContent = readFileSync(csvPath, 'utf-8');
  const editoriales = parseCSV(csvContent);

  if (editoriales.length === 0) {
    console.error('❌ No se encontraron datos en el CSV');
    process.exit(1);
  }

  console.log(`\n📊 Encontradas ${editoriales.length} editoriales en el CSV\n`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < editoriales.length; i++) {
    const editorial = editoriales[i];
    process.stdout.write(`[${i + 1}/${editoriales.length}] `);
    
    const result = await importarEditorial(editorial);
    
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
  console.log(`   ✅ Creadas: ${success}`);
  console.log(`   ⚠️  Ya existían: ${skipped}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log(`   📦 Total: ${editoriales.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (success > 0) {
    console.log('\n💡 Próximo paso: Sincronizar a WooCommerce');
    console.log('   node scripts/sincronizar-autores-editoriales-woo.mjs');
  }
}

main().catch(console.error);

