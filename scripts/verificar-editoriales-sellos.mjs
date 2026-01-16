#!/usr/bin/env node

/**
 * Script para verificar si los sellos tienen editoriales asociadas
 * y analizar por qué los libros no tienen editorial
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

async function obtenerConPaginacion(endpoint, filters = {}) {
  let page = 1;
  const pageSize = 100;
  const resultados = [];
  
  while (true) {
    const params = new URLSearchParams({
      'pagination[page]': String(page),
      'pagination[pageSize]': String(pageSize),
    });
    
    Object.entries(filters).forEach(([key, value]) => {
      params.append(key, value);
    });
    
    const response = await fetch(`${STRAPI_URL}${endpoint}?${params.toString()}`, {
      headers: HEADERS,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const json = await response.json();
    const data = json?.data || [];
    resultados.push(...data);
    
    const pagination = json?.meta?.pagination || {};
    if (!pagination.pageCount || page >= pagination.pageCount) {
      break;
    }
    
    page++;
  }
  
  return resultados;
}

async function main() {
  console.log('🔍 ANALIZANDO EDITORIALES Y SELLOS');
  console.log('════════════════════════════════════════════════════════════════\n');
  
  try {
    // Obtener todos los sellos
    const sellos = await obtenerConPaginacion('/api/sellos', {});
    
    const totalSellos = sellos.length;
    let sellosConEditorial = 0;
    let sellosSinEditorial = 0;
    
    for (const sello of sellos) {
      const editorial = sello.attributes?.editorial?.data || sello.editorial?.data || sello.editorial;
      if (editorial) {
        sellosConEditorial++;
      } else {
        sellosSinEditorial++;
      }
    }
    
    console.log('📊 SELLOS EN STRAPI:');
    console.log(`   Total: ${totalSellos}`);
    console.log(`   Con editorial: ${sellosConEditorial}`);
    console.log(`   Sin editorial: ${sellosSinEditorial}`);
    console.log(`   Porcentaje sin editorial: ${((sellosSinEditorial / totalSellos) * 100).toFixed(1)}%\n`);
    
    // Obtener libros con sello pero sin editorial
    const librosConSello = await obtenerConPaginacion('/api/libros', {
      'filters[sello][$notNull]': 'true',
    });
    
    let librosConSelloSinEditorial = 0;
    let librosConSelloYEditorial = 0;
    
    for (const libro of librosConSello) {
      const sello = libro.attributes?.sello?.data || libro.sello?.data || libro.sello;
      const editorial = libro.attributes?.editorial?.data || libro.editorial?.data || libro.editorial;
      
      if (sello) {
        if (editorial) {
          librosConSelloYEditorial++;
        } else {
          librosConSelloSinEditorial++;
        }
      }
    }
    
    console.log('📊 LIBROS CON SELLO:');
    console.log(`   Total con sello: ${librosConSello.length}`);
    console.log(`   Con editorial: ${librosConSelloYEditorial}`);
    console.log(`   Sin editorial: ${librosConSelloSinEditorial}`);
    console.log(`   Porcentaje sin editorial: ${((librosConSelloSinEditorial / librosConSello.length) * 100).toFixed(1)}%\n`);
    
    // Verificar algunos ejemplos
    console.log('📋 EJEMPLOS DE LIBROS CON SELLO PERO SIN EDITORIAL:');
    let ejemplos = 0;
    for (const libro of librosConSello) {
      const sello = libro.attributes?.sello?.data || libro.sello?.data || libro.sello;
      const editorial = libro.attributes?.editorial?.data || libro.editorial?.data || libro.editorial;
      const nombre = libro.attributes?.nombre_libro || libro.nombre_libro || 'Sin nombre';
      
      if (sello && !editorial && ejemplos < 5) {
        const nombreSello = sello.attributes?.nombre_sello || sello.nombre_sello || 'Sin nombre';
        const idSello = sello.attributes?.id_sello || sello.id_sello || 'Sin ID';
        console.log(`   • ${nombre.substring(0, 50)}...`);
        console.log(`     Sello: ${nombreSello} (id_sello: ${idSello})`);
        ejemplos++;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

