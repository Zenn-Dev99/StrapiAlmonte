#!/usr/bin/env node

/**
 * Script para actualizar el indicador de completitud básica de todos los libros
 * Calcula automáticamente si cada libro tiene los datos básicos requeridos
 * 
 * Uso:
 *   node scripts/actualizar-completitud-libros.mjs
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

/**
 * Valida si un SKU/ISBN está correctamente escrito
 * - Solo números, sin espacios ni guiones
 * - Típicamente 13 dígitos (pero puede variar)
 */
function isSKUValido(sku) {
  if (!sku) return false;
  const skuLimpio = String(sku).replace(/[-\s]/g, '');
  if (skuLimpio.startsWith('TEMP-') || /[a-zA-Z]/.test(skuLimpio)) return false;
  return /^\d+$/.test(skuLimpio);
}

/**
 * Calcula el KPI de completitud básica de un libro
 * Criterios:
 * 1. SKU correctamente escrito (ISBN): solo números, sin espacios ni guiones
 * 2. Si existe la imagen del producto (portada_libro)
 * 3. Si está presente el nombre del libro
 * 4. Si están ingresados los autores (autor_relacion o nombre_completo_autor)
 * 5. Si está añadida la editorial
 */
function calcularCompletitudBasica(libro) {
  // El SKU es el ISBN en este caso
  const sku = libro.attributes?.isbn_libro || libro.isbn_libro || '';
  const portada = libro.attributes?.portada_libro || libro.portada_libro;
  const nombre = libro.attributes?.nombre_libro || libro.nombre_libro || '';
  const autor = libro.attributes?.autor_relacion?.data || libro.autor_relacion;
  const nombreCompletoAutor = libro.attributes?.nombre_completo_autor || libro.nombre_completo_autor || '';
  const editorial = libro.attributes?.editorial?.data || libro.editorial;

  const sku_valido = isSKUValido(sku);
  const tiene_imagen = Boolean(portada && (portada.data || portada.id || portada.documentId));
  const tiene_nombre = Boolean(nombre && nombre.trim());
  const tiene_autor = Boolean(autor || (nombreCompletoAutor && nombreCompletoAutor.trim()));
  const tiene_editorial = Boolean(editorial);

  // Campos faltantes (para el selector múltiple)
  const faltantes = [];
  if (!sku_valido) faltantes.push('ISBN');
  if (!tiene_imagen) faltantes.push('Portada');
  if (!tiene_autor) faltantes.push('Autor');
  if (!tiene_editorial) faltantes.push('Editorial');

  // Campos faltantes (para el JSON de completitud detallado)
  const campos_faltantes = [];
  if (!sku_valido) campos_faltantes.push('SKU/ISBN válido');
  if (!tiene_imagen) campos_faltantes.push('Imagen del producto');
  if (!tiene_nombre) campos_faltantes.push('Nombre del libro');
  if (!tiene_autor) campos_faltantes.push('Autor(es)');
  if (!tiene_editorial) campos_faltantes.push('Editorial');

  const camposRequeridos = 5;
  const camposCompletos = [
    sku_valido,
    tiene_imagen,
    tiene_nombre,
    tiene_autor,
    tiene_editorial,
  ].filter(Boolean).length;
  
  const score = Math.round((camposCompletos / camposRequeridos) * 100);
  const porcentaje_completitud = score;
  const completo = campos_faltantes.length === 0;

  return {
    completo,
    faltantes,
    completitud_basica: {
      sku_valido,
      tiene_imagen,
      tiene_nombre,
      tiene_autor,
      tiene_editorial,
      campos_faltantes,
      score,
      porcentaje_completitud,
    },
  };
}

async function actualizarCompletitudLibro(libro) {
  const libroId = libro.documentId || libro.id;
  const nombre = libro.attributes?.nombre_libro || libro.nombre_libro || 'Sin nombre';
  
  try {
    const completitud = calcularCompletitudBasica(libro);
    
    const updateResponse = await fetch(`${STRAPI_URL}/api/libros/${libroId}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        data: {
          completo: completitud.completo,
          faltantes: completitud.faltantes,
          completitud_basica: completitud.completitud_basica,
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`HTTP ${updateResponse.status}: ${errorText.substring(0, 200)}`);
    }

    return {
      success: true,
      completo: completitud.completo,
      score: completitud.completitud_basica.score,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('📊 Actualizando indicador de completitud de libros');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let totalLibros = 0;
  let conDatosBasicos = 0;
  let sinDatosBasicos = 0;
  let errores = 0;
  let pagina = 1;
  const pageSize = 100;

  try {
    while (true) {
      const params = new URLSearchParams({
        'pagination[page]': String(pagina),
        'pagination[pageSize]': String(pageSize),
        'populate': ['autor_relacion', 'editorial', 'portada_libro'].join(','),
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

      console.log(`📄 Procesando página ${pagina}/${pagination.pageCount || 1} (${libros.length} libros)...\n`);

      for (let i = 0; i < libros.length; i++) {
        const libro = libros[i];
        totalLibros++;
        
        const nombre = libro.attributes?.nombre_libro || libro.nombre_libro || `Libro ${totalLibros}`;
        process.stdout.write(`[${totalLibros}] ${nombre.substring(0, 50)}... `);

        const resultado = await actualizarCompletitudLibro(libro);

        if (resultado.success) {
          if (resultado.completo) {
            console.log(`✅ ${resultado.score}% completo`);
            conDatosBasicos++;
          } else {
            console.log(`⚠️  ${resultado.score}% completo`);
            sinDatosBasicos++;
          }
        } else {
          console.log(`❌ ${resultado.error}`);
          errores++;
        }

        // Pausa pequeña cada 50 libros
        if (totalLibros % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (pagina >= (pagination.pageCount || 1)) break;
      pagina++;
      
      // Pausa entre páginas
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const porcentajePromedio = totalLibros > 0 
      ? Math.round((conDatosBasicos / totalLibros) * 100) 
      : 0;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 KPI de Completitud de Libros:');
    console.log(`   📦 Total libros procesados: ${totalLibros}`);
    console.log(`   ✅ Con datos básicos completos (100%): ${conDatosBasicos} (${porcentajePromedio}%)`);
    console.log(`   ⚠️  Sin datos básicos completos (<100%): ${sinDatosBasicos} (${100 - porcentajePromedio}%)`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`\n   📈 Porcentaje promedio de completitud: ${porcentajePromedio}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);

