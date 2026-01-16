/**
 * Script para verificar el estado de sincronización de un libro
 * y trigger la sincronización si es necesario
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '9a1e496446d3bb55265a08b9cc898f339a374998a0cd747af6fbebc654f42086c7b48a1afddebde89638f4a461b99bc7b6c2ac2a21ce80893c8f41769b696a1eae56c8444edd2dfab9660f9964185547157af1e2cc248ce1e7061c495a6f394bdaf7409cf1d8edd1117aa944a006db5797ee00242c735b20a5aaf054865d386d';

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

const LIBRO_ID = process.argv[2] || 181; // ID del libro a verificar

async function fetchAPI(method, endpoint, body = null) {
  const endpointNormalized = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  const url = `${STRAPI_URL}${endpointNormalized}`;
  const options = {
    method,
    headers: HEADERS,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return await response.json();
}

async function verificarSincronizacion() {
  console.log(`🔍 Verificando sincronización del libro ID: ${LIBRO_ID}\n`);
  
  try {
    // 1. Buscar libro primero (puede usar id o documentId)
    console.log('1️⃣ Buscando libro...');
    let libro;
    try {
      // Intentar con id primero
      libro = await fetchAPI('GET', `/api/libros?filters[id][$eq]=${LIBRO_ID}&populate[canales][fields][0]=name&populate[canales][fields][1]=key&populate[autor_relacion][fields][0]=nombre_completo_autor&populate[editorial][fields][0]=nombre_editorial&populate[sello][fields][0]=nombre_sello&populate[coleccion][fields][0]=nombre_coleccion&populate[obra][fields][0]=nombre_obra`);
      if (!libro.data || libro.data.length === 0) {
        throw new Error('No encontrado');
      }
      libro = { data: libro.data[0] };
    } catch (error) {
      // Intentar buscar por documentId
      libro = await fetchAPI('GET', `/api/libros?filters[documentId][$eq]=${LIBRO_ID}&populate[canales][fields][0]=name&populate[canales][fields][1]=key&populate[autor_relacion][fields][0]=nombre_completo_autor&populate[editorial][fields][0]=nombre_editorial&populate[sello][fields][0]=nombre_sello&populate[coleccion][fields][0]=nombre_coleccion&populate[obra][fields][0]=nombre_obra`);
      if (!libro.data || libro.data.length === 0) {
        throw new Error(`Libro con ID ${LIBRO_ID} no encontrado (ni por id ni por documentId)`);
      }
      libro = { data: libro.data[0] };
    }
    
    if (!libro.data) {
      throw new Error(`Libro con ID ${LIBRO_ID} no encontrado`);
    }
    
    const libroData = libro.data;
    console.log(`✅ Libro encontrado: "${libroData.nombre_libro}"\n`);
    
    // 2. Verificar relaciones
    console.log('2️⃣ Verificando relaciones:');
    console.log(`   - Autor: ${libroData.autor_relacion?.nombre_completo_autor || '❌ N/A'}`);
    console.log(`   - Editorial: ${libroData.editorial?.nombre_editorial || '❌ N/A'}`);
    console.log(`   - Sello: ${libroData.sello?.nombre_sello || '❌ N/A'}`);
    console.log(`   - Colección: ${libroData.coleccion?.nombre_coleccion || '❌ N/A'}`);
    console.log(`   - Obra: ${libroData.obra?.nombre_obra || '❌ N/A'}`);
    console.log(`   - Canales: ${libroData.canales?.length || 0}`);
    if (libroData.canales && libroData.canales.length > 0) {
      libroData.canales.forEach((c, i) => {
        console.log(`     ${i + 1}. ${c.name || c.key} (${c.key})`);
      });
    }
    console.log(`   - Precios: ${libroData.precios?.length || 0}`);
    console.log(`   - Stocks: ${libroData.stocks?.length || 0}`);
    console.log(`   - Libros Relacionados: ${libroData.libros_relacionados?.length || 0}`);
    console.log(`   - External IDs: ${JSON.stringify(libroData.externalIds || {})}\n`);
    
    // 3. Verificar si tiene canales de WooCommerce
    const canalesWoo = libroData.canales?.filter(c => 
      c.key === 'moraleja' || c.key === 'escolar'
    ) || [];
    
    if (canalesWoo.length === 0) {
      console.log('⚠️ El libro NO tiene canales de WooCommerce configurados.');
      console.log('   Para sincronizar, necesita tener canales "moraleja" o "escolar".\n');
      return;
    }
    
    console.log(`✅ El libro tiene ${canalesWoo.length} canal(es) de WooCommerce configurado(s)\n`);
    
    // 4. Trigger sincronización actualizando el libro
    console.log('3️⃣ Activando sincronización (actualizando libro)...');
    try {
      // Hacer una actualización mínima para trigger los lifecycles
      await fetchAPI('PUT', `/api/libros/${LIBRO_ID}`, {
        data: {
          nombre_libro: libroData.nombre_libro // Sin cambios, solo para trigger
        }
      });
      console.log('✅ Libro actualizado (esto debería trigger la sincronización automática)');
      console.log('   📝 Revisa los logs de Strapi para ver la sincronización\n');
    } catch (error) {
      console.log(`⚠️ No se pudo actualizar el libro: ${error.message}`);
      console.log('   El libro se sincronizará automáticamente cuando se actualice desde la UI de Strapi\n');
    }
    
    // 5. Resumen
    console.log('='.repeat(60));
    console.log('📊 RESUMEN DE SINCRONIZACIÓN');
    console.log('='.repeat(60));
    console.log(`\n✅ Libro listo para sincronizar:`);
    console.log(`   - Título: ${libroData.nombre_libro}`);
    console.log(`   - ISBN: ${libroData.isbn_libro}`);
    console.log(`   - Canales: ${canalesWoo.map(c => c.name).join(', ')}`);
    console.log(`   - External IDs: ${JSON.stringify(libroData.externalIds || {})}`);
    
    if (libroData.externalIds && (libroData.externalIds.woo_moraleja || libroData.externalIds.woo_escolar)) {
      console.log(`\n✅ El libro ya está sincronizado en WooCommerce`);
      if (libroData.externalIds.woo_moraleja) {
        console.log(`   - WooCommerce Moraleja ID: ${libroData.externalIds.woo_moraleja}`);
      }
      if (libroData.externalIds.woo_escolar) {
        console.log(`   - WooCommerce Escolar ID: ${libroData.externalIds.woo_escolar}`);
      }
    } else {
      console.log(`\n⏳ El libro aún no está sincronizado en WooCommerce`);
      console.log(`   Se sincronizará automáticamente cuando se actualice desde Strapi`);
    }
    
    console.log(`\n🔍 Próximos pasos:`);
    console.log(`   1. Verifica los logs de Strapi para ver la sincronización`);
    console.log(`   2. Verifica en WooCommerce que el producto exista`);
    console.log(`   3. Si los precios/stocks no están, créalos manualmente desde Strapi\n`);
    
  } catch (error) {
    console.error('\n❌ Error verificando sincronización:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Ejecutar
verificarSincronizacion();
