/**
 * Script completo para probar la sincronización bidireccional
 * Verifica que todas las mejoras implementadas funcionen correctamente
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '9a1e496446d3bb55265a08b9cc898f339a374998a0cd747af6fbebc654f42086c7b48a1afddebde89638f4a461b99bc7b6c2ac2a21ce80893c8f41769b696a1eae56c8444edd2dfab9660f9964185547157af1e2cc248ce1e7061c495a6f394bdaf7409cf1d8edd1117aa944a006db5797ee00242c735b20a5aaf054865d386d';

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

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

async function probarSincronizacion() {
  console.log('🧪 Iniciando pruebas completas de sincronización...\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Buscar libro con canales de WooCommerce
    console.log('\n1️⃣ Buscando libros con canales de WooCommerce...');
    const libros = await fetchAPI('GET', '/api/libros?pagination[pageSize]=10&sort=createdAt:desc');
    
    const librosConCanales = libros.data?.filter(l => {
      // El libro debería tener canales, pero no podemos verificar aquí sin populate
      // Buscar por externalIds como indicador
      return l.externalIds && (l.externalIds.woo_moraleja || l.externalIds.woo_escolar);
    }) || [];
    
    if (librosConCanales.length === 0) {
      console.log('⚠️ No se encontraron libros ya sincronizados.');
      console.log('   Creando nuevo libro de prueba...\n');
      
      // Ejecutar script de creación
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      try {
        const { stdout } = await execAsync('node scripts/crear-libro-prueba-sincronizacion.mjs');
        console.log(stdout);
      } catch (error) {
        console.error('Error creando libro:', error.message);
      }
      
      // Buscar de nuevo
      const nuevosLibros = await fetchAPI('GET', '/api/libros?pagination[pageSize]=5&sort=createdAt:desc');
      if (nuevosLibros.data && nuevosLibros.data.length > 0) {
        librosConCanales.push(nuevosLibros.data[0]);
      }
    }
    
    if (librosConCanales.length === 0) {
      console.log('❌ No se pudo encontrar o crear un libro para probar');
      return;
    }
    
    const libro = librosConCanales[0];
    console.log(`✅ Libro seleccionado: "${libro.nombre_libro}" (ID: ${libro.id}, ISBN: ${libro.isbn_libro})\n`);
    
    // 2. Obtener libro completo con relaciones (usar filtros)
    console.log('2️⃣ Obteniendo libro completo con relaciones...');
    let libroCompleto;
    try {
      libroCompleto = await fetchAPI('GET', `/api/libros?filters[id][$eq]=${libro.id}&populate[canales][fields][0]=name&populate[canales][fields][1]=key&populate[autor_relacion][fields][0]=nombre_completo_autor&populate[editorial][fields][0]=nombre_editorial&populate[sello][fields][0]=nombre_sello&populate[coleccion][fields][0]=nombre_coleccion&populate[obra][fields][0]=nombre_obra`);
      if (libroCompleto.data && libroCompleto.data.length > 0) {
        libroCompleto = { data: libroCompleto.data[0] };
      } else {
        throw new Error('No encontrado');
      }
    } catch (error) {
      console.log('⚠️ No se pudo obtener libro con relaciones, usando datos básicos');
      libroCompleto = { data: libro };
    }
    
    const libroData = libroCompleto.data || libro;
    console.log('✅ Libro obtenido\n');
    
    // 3. Verificar relaciones
    console.log('3️⃣ Verificando relaciones del libro:');
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
    console.log(`   - External IDs: ${JSON.stringify(libroData.externalIds || {})}\n`);
    
    // 4. Verificar si tiene canales de WooCommerce
    const canalesWoo = libroData.canales?.filter(c => 
      c.key === 'moraleja' || c.key === 'escolar'
    ) || [];
    
    if (canalesWoo.length === 0) {
      console.log('⚠️ El libro NO tiene canales de WooCommerce configurados.');
      console.log('   Agregando canales automáticamente...\n');
      
      // Obtener canales
      const todosCanales = await fetchAPI('GET', '/api/canales?pagination[pageSize]=10');
      const moraleja = todosCanales.data?.find(c => c.key === 'moraleja');
      const escolar = todosCanales.data?.find(c => c.key === 'escolar');
      
      if (moraleja && escolar) {
        try {
          await fetchAPI('PUT', `/api/libros/${libro.id}`, {
            data: {
              canales: [moraleja.id, escolar.id]
            }
          });
          console.log('✅ Canales agregados: Moraleja, Escolar\n');
          // Recargar libro
          const libroActualizado = await fetchAPI('GET', `/api/libros/${libro.id}?populate[canales][fields][0]=name&populate[canales][fields][1]=key`);
          Object.assign(libroData, libroActualizado.data);
        } catch (error) {
          console.log(`⚠️ No se pudieron agregar canales: ${error.message}`);
          console.log('   Agrega canales manualmente desde Strapi\n');
        }
      }
    }
    
    // 5. Verificar estado de sincronización
    console.log('4️⃣ Estado de sincronización:');
    const externalIds = libroData.externalIds || {};
    
    if (externalIds.woo_moraleja) {
      console.log(`   ✅ Sincronizado a WooCommerce Moraleja (ID: ${externalIds.woo_moraleja})`);
    } else {
      console.log(`   ⏳ Pendiente sincronización a WooCommerce Moraleja`);
    }
    
    if (externalIds.woo_escolar) {
      console.log(`   ✅ Sincronizado a WooCommerce Escolar (ID: ${externalIds.woo_escolar})`);
    } else {
      console.log(`   ⏳ Pendiente sincronización a WooCommerce Escolar`);
    }
    console.log('');
    
    // 6. Trigger sincronización manualmente
    console.log('5️⃣ Activando sincronización (actualizando libro)...');
    try {
      // Actualizar libro para trigger sincronización
      await fetchAPI('PUT', `/api/libros/${libro.id}`, {
        data: {
          nombre_libro: libroData.nombre_libro // Sin cambios, solo para trigger
        }
      });
      console.log('✅ Libro actualizado (sincronización automática activada)');
      console.log('   📝 Revisa los logs de Strapi para ver la sincronización\n');
    } catch (error) {
      console.log(`⚠️ No se pudo actualizar el libro: ${error.message}`);
      console.log('   La sincronización se activará cuando actualices el libro desde Strapi\n');
    }
    
    // 7. Resumen final
    console.log('='.repeat(60));
    console.log('📊 RESUMEN DE PRUEBAS');
    console.log('='.repeat(60));
    console.log(`\n✅ Libro configurado:`);
    console.log(`   - ID: ${libro.id}`);
    console.log(`   - ISBN: ${libroData.isbn_libro}`);
    console.log(`   - Título: ${libroData.nombre_libro}`);
    console.log(`\n✅ Relaciones configuradas:`);
    console.log(`   - Autor: ${libroData.autor_relacion ? '✅' : '❌'}`);
    console.log(`   - Editorial: ${libroData.editorial ? '✅' : '❌'}`);
    console.log(`   - Sello: ${libroData.sello ? '✅' : '❌'}`);
    console.log(`   - Colección: ${libroData.coleccion ? '✅' : '❌'}`);
    console.log(`   - Obra: ${libroData.obra ? '✅' : '❌'}`);
    console.log(`   - Canales: ${libroData.canales?.length || 0} (${canalesWoo.length > 0 ? '✅' : '❌'})`);
    console.log(`\n✅ Funcionalidades a probar:`);
    console.log(`   1. Sincronización de atributos (Autor, Editorial, Sello, Colección, Obra)`);
    console.log(`   2. Sincronización de canales → categorías WooCommerce`);
    console.log(`   3. Sincronización de precios por canal (si están creados)`);
    console.log(`   4. Sincronización de stocks por ubicación (si están creados)`);
    console.log(`   5. Sincronización de libros relacionados (si están configurados)`);
    console.log(`   6. Metadata de relaciones anidadas (Sello→Editorial, Coleccion→Editorial)`);
    console.log(`\n🔍 Próximos pasos:`);
    console.log(`   1. Revisa los logs de Strapi para ver la sincronización`);
    console.log(`   2. Verifica en WooCommerce que el producto exista y tenga:`);
    console.log(`      - Atributos correctos (Autor, Editorial, etc.)`);
    console.log(`      - Categorías (canales)`);
    console.log(`      - Precio correcto`);
    console.log(`      - Stock correcto`);
    console.log(`   3. Si falta algo, actualiza el libro en Strapi para re-sincronizar`);
    console.log(`\n📝 URL del libro en Strapi:`);
    console.log(`   ${STRAPI_URL}/admin/content-manager/collection-types/api::libro.libro/${libro.id}\n`);
    
  } catch (error) {
    console.error('\n❌ Error en pruebas:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Ejecutar
probarSincronizacion();
