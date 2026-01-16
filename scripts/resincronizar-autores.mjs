#!/usr/bin/env node

import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || '';

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

async function resincronizarAutores() {
  console.log('🔄 Resincronizando todos los autores...\n');
  
  // Obtener todos los autores
  const response = await fetch(`${STRAPI_URL}/api/autores?pagination[pageSize]=100`, {
    headers: HEADERS,
  });
  
  if (!response.ok) {
    throw new Error(`Error obteniendo autores: ${response.status}`);
  }
  
  const data = await response.json();
  const autores = data.data || [];
  
  console.log(`📋 Encontrados ${autores.length} autores\n`);
  
  let sincronizados = 0;
  let errores = 0;
  
  for (const autor of autores) {
    const nombre = autor.nombre_completo_autor || autor.attributes?.nombre_completo_autor;
    const documentId = autor.documentId || autor.id;
    
    if (!nombre || !documentId) {
      console.log(`⚠️  Saltando autor sin nombre o documentId: ${documentId}`);
      continue;
    }
    
    try {
      // Actualizar el autor (esto disparará la sincronización)
      const updateResponse = await fetch(`${STRAPI_URL}/api/autores/${documentId}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          data: {
            nombre_completo_autor: nombre,
          },
        }),
      });
      
      if (updateResponse.ok) {
        sincronizados++;
        process.stdout.write(`\r✅ Sincronizados: ${sincronizados}/${autores.length}`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Pequeña pausa
      } else {
        errores++;
        const errorText = await updateResponse.text();
        console.log(`\n❌ Error sincronizando "${nombre}": ${errorText.substring(0, 100)}`);
      }
    } catch (error) {
      errores++;
      console.log(`\n❌ Error sincronizando "${nombre}": ${error.message}`);
    }
  }
  
  console.log(`\n\n✅ Resincronización completada`);
  console.log(`   Sincronizados: ${sincronizados}`);
  console.log(`   Errores: ${errores}`);
}

resincronizarAutores().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
