#!/usr/bin/env node

/**
 * Script para obtener el KPI de completitud de libros
 * Muestra estadísticas sobre el porcentaje de completitud de los datos básicos
 * 
 * Uso:
 *   node scripts/kpi-completitud-libros.mjs
 */

import fetch from 'node-fetch';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

async function main() {
  console.log('📊 KPI de Completitud de Libros');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let totalLibros = 0;
  let conDatosBasicos = 0;
  let sumaPorcentajes = 0;
  
  // Contadores por criterio
  let skuValido = 0;
  let tieneImagen = 0;
  let tieneNombre = 0;
  let tieneAutor = 0;
  let tieneEditorial = 0;

  // Distribución por porcentaje
  const distribucion = {
    '100%': 0,
    '80-99%': 0,
    '60-79%': 0,
    '40-59%': 0,
    '20-39%': 0,
    '0-19%': 0,
  };

  let pagina = 1;
  const pageSize = 100;

  try {
    while (true) {
      const params = new URLSearchParams({
        'pagination[page]': String(pagina),
        'pagination[pageSize]': String(pageSize),
        'populate': ['autor_relacion', 'editorial', 'portada_libro'],
      });

      const response = await fetch(`${STRAPI_URL}/api/libros?${params.toString()}`, {
        headers: HEADERS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const libros = data.data || [];
      const pagination = data.meta?.pagination || {};

      if (libros.length === 0) break;

      for (const libro of libros) {
        totalLibros++;
        
        const completitud = libro.attributes?.completitud_basica || libro.completitud_basica || {};
        const porcentaje = completitud.porcentaje_completitud || completitud.score || 0;
        
        sumaPorcentajes += porcentaje;

        // Contar criterios individuales
        if (completitud.sku_valido) skuValido++;
        if (completitud.tiene_imagen) tieneImagen++;
        if (completitud.tiene_nombre) tieneNombre++;
        if (completitud.tiene_autor) tieneAutor++;
        if (completitud.tiene_editorial) tieneEditorial++;

        // Contar completitud total
        if (porcentaje === 100) {
          conDatosBasicos++;
          distribucion['100%']++;
        } else if (porcentaje >= 80) {
          distribucion['80-99%']++;
        } else if (porcentaje >= 60) {
          distribucion['60-79%']++;
        } else if (porcentaje >= 40) {
          distribucion['40-59%']++;
        } else if (porcentaje >= 20) {
          distribucion['20-39%']++;
        } else {
          distribucion['0-19%']++;
        }
      }

      if (pagina >= (pagination.pageCount || 1)) break;
      pagina++;
    }

    const porcentajePromedio = totalLibros > 0 
      ? Math.round((sumaPorcentajes / totalLibros) * 100) / 100
      : 0;
    const porcentajeCompletos = totalLibros > 0 
      ? Math.round((conDatosBasicos / totalLibros) * 100) 
      : 0;

    console.log('📈 Resumen General:');
    console.log(`   📦 Total de libros: ${totalLibros.toLocaleString()}`);
    console.log(`   ✅ Libros con 100% completitud: ${conDatosBasicos.toLocaleString()} (${porcentajeCompletos}%)`);
    console.log(`   📊 Porcentaje promedio de completitud: ${porcentajePromedio.toFixed(2)}%`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📋 Completitud por Criterio:');
    const porcentajeSKU = totalLibros > 0 ? Math.round((skuValido / totalLibros) * 100) : 0;
    const porcentajeImagen = totalLibros > 0 ? Math.round((tieneImagen / totalLibros) * 100) : 0;
    const porcentajeNombre = totalLibros > 0 ? Math.round((tieneNombre / totalLibros) * 100) : 0;
    const porcentajeAutor = totalLibros > 0 ? Math.round((tieneAutor / totalLibros) * 100) : 0;
    const porcentajeEditorial = totalLibros > 0 ? Math.round((tieneEditorial / totalLibros) * 100) : 0;

    console.log(`   1. SKU/ISBN válido: ${skuValido.toLocaleString()} / ${totalLibros.toLocaleString()} (${porcentajeSKU}%)`);
    console.log(`   2. Imagen del producto: ${tieneImagen.toLocaleString()} / ${totalLibros.toLocaleString()} (${porcentajeImagen}%)`);
    console.log(`   3. Nombre del libro: ${tieneNombre.toLocaleString()} / ${totalLibros.toLocaleString()} (${porcentajeNombre}%)`);
    console.log(`   4. Autor(es): ${tieneAutor.toLocaleString()} / ${totalLibros.toLocaleString()} (${porcentajeAutor}%)`);
    console.log(`   5. Editorial: ${tieneEditorial.toLocaleString()} / ${totalLibros.toLocaleString()} (${porcentajeEditorial}%)`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Distribución por Nivel de Completitud:');
    for (const [rango, cantidad] of Object.entries(distribucion)) {
      const porcentaje = totalLibros > 0 ? Math.round((cantidad / totalLibros) * 100) : 0;
      const barra = '█'.repeat(Math.round(porcentaje / 2));
      console.log(`   ${rango.padEnd(8)}: ${cantidad.toString().padStart(6)} libros (${porcentaje.toString().padStart(3)}%) ${barra}`);
    }
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

