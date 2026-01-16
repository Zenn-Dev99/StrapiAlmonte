#!/usr/bin/env node

/**
 * Script para asignar canales a libros usando la API de Strapi
 * Esto asegura que Strapi procese correctamente las relaciones
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

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...HEADERS,
          ...options.headers,
        },
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

async function main() {
  try {
    console.log('🔄 Asignando canales a libros vía API de Strapi');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Obtener canales
    console.log('📚 Obteniendo canales...');
    const canalesResponse = await fetchWithRetry(`${STRAPI_URL}/api/canales?pagination[pageSize]=100`);
    
    if (!canalesResponse || !canalesResponse.data) {
      console.log('❌ No se pudieron obtener los canales');
      return;
    }
    
    let canalEscolar = null;
    let canalMoraleja = null;
    
    canalesResponse.data.forEach(canal => {
      const name = (canal.attributes?.name || canal.name || '').toLowerCase();
      const key = (canal.attributes?.key || canal.key || '').toLowerCase();
      
      if ((name === 'escolar' || key === 'escolar') && !canalEscolar) {
        canalEscolar = canal;
      }
      if ((name === 'moraleja' || key === 'moraleja') && !canalMoraleja) {
        canalMoraleja = canal;
      }
    });
    
    // Si no se encontraron, buscar por ID directamente
    if (!canalEscolar) {
      const canal4 = canalesResponse.data.find(c => c.id === 4 || (c.attributes && c.attributes.id === 4));
      if (canal4) canalEscolar = canal4;
    }
    
    if (!canalMoraleja) {
      const canal2 = canalesResponse.data.find(c => c.id === 2 || (c.attributes && c.attributes.id === 2));
      if (canal2) canalMoraleja = canal2;
    }
    
    if (!canalEscolar) {
      console.log('❌ No se encontró el canal "escolar"');
      return;
    }
    
    console.log(`   ✅ Canal "escolar" encontrado: ID ${canalEscolar.id}`);
    if (canalMoraleja) {
      console.log(`   ✅ Canal "moraleja" encontrado: ID ${canalMoraleja.id}`);
    }
    console.log('');
    
    // 2. Obtener todos los libros
    console.log('📦 Obteniendo libros...');
    let page = 1;
    let pageSize = 50; // Reducir para evitar timeouts
    let totalLibros = 0;
    let librosActualizados = 0;
    let librosConEscolar = 0;
    let librosConMoraleja = 0;
    
    while (true) {
      console.log(`   📄 Procesando página ${page}...`);
      const response = await fetchWithRetry(
        `${STRAPI_URL}/api/libros?pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate=canales,editorial&publicationState=live`
      );
      
      if (!response || !response.data || response.data.length === 0) {
        break;
      }
      
      const libros = response.data;
      const pagination = response.meta?.pagination;
      
      totalLibros += libros.length;
      console.log(`      Procesando ${libros.length} libros (página ${page}/${pagination?.pageCount || '?'})...`);
      
      for (const libro of libros) {
        try {
          const canalesActuales = libro.attributes?.canales?.data || [];
          const canalesIds = canalesActuales.map(c => c.id);
          
          const tieneEscolar = canalesIds.includes(canalEscolar.id);
          const tieneMoraleja = canalMoraleja && canalesIds.includes(canalMoraleja.id);
          
          // Verificar si es editorial Moraleja
          const editorial = libro.attributes?.editorial?.data;
          const esMoraleja = editorial?.attributes?.id_editorial === 1;
          
          // Preparar lista de canales a asignar
          const nuevosCanales = [...canalesIds];
          
          if (!tieneEscolar) {
            nuevosCanales.push(canalEscolar.id);
          }
          
          if (esMoraleja && canalMoraleja && !tieneMoraleja) {
            nuevosCanales.push(canalMoraleja.id);
          }
          
          // Solo actualizar si hay cambios
          if (nuevosCanales.length !== canalesIds.length || 
              nuevosCanales.some(id => !canalesIds.includes(id))) {
            
            const updateData = {
              data: {
                canales: nuevosCanales,
              },
            };
            
            await fetchWithRetry(
              `${STRAPI_URL}/api/libros/${libro.id}`,
              {
                method: 'PUT',
                body: JSON.stringify(updateData),
              }
            );
            
            librosActualizados++;
            
            if (!tieneEscolar) librosConEscolar++;
            if (esMoraleja && !tieneMoraleja && canalMoraleja) librosConMoraleja++;
          } else {
            if (tieneEscolar) librosConEscolar++;
            if (tieneMoraleja) librosConMoraleja++;
          }
          
          // Pausa pequeña
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          console.error(`   ❌ Error al actualizar libro ${libro.id}:`, error.message);
        }
      }
      
      // Verificar si hay más páginas
      if (pagination) {
        if (page >= pagination.pageCount) {
          break;
        }
      } else if (libros.length < pageSize) {
        break;
      }
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resumen:');
    console.log(`   📚 Total libros procesados: ${totalLibros}`);
    console.log(`   ✅ Libros actualizados: ${librosActualizados}`);
    console.log(`   ✅ Libros con canal "escolar": ${librosConEscolar}`);
    console.log(`   ✅ Libros con canal "moraleja": ${librosConMoraleja}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);

