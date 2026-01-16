/**
 * Script de prueba para sincronización de Brands, Tags y Categorías
 * 
 * Este script:
 * 1. Crea/verifica marcas, etiquetas y categorías en Strapi
 * 2. Asigna estas taxonomías a un libro
 * 3. Sincroniza el libro a WooCommerce
 * 4. Verifica que las taxonomías se sincronizaron correctamente
 */

// Cargar variables de entorno
// Compatible con diferentes nombres de variables
const STRAPI_URL = process.env.STRAPI_URL || process.env.STRAPI_PUBLIC_URL || 'https://strapi.moraleja.cl';
const STRAPI_API_KEY = process.env.STRAPI_API_KEY || process.env.STRAPI_TOKEN || process.env.STRAPI_READONLY_TOKEN;

if (!STRAPI_API_KEY) {
  console.error('❌ Error: Token de API no está definida');
  console.error('   Define una de estas variables de entorno:');
  console.error('   - STRAPI_API_KEY');
  console.error('   - STRAPI_TOKEN');
  console.error('   - STRAPI_READONLY_TOKEN');
  console.error('');
  console.error('   Ejemplo en PowerShell:');
  console.error('   $env:STRAPI_URL="https://tu-app.railway.app"');
  console.error('   $env:STRAPI_API_KEY="tu-token"');
  console.error('   node scripts/probar-sincronizacion-brands-tags-categorias.mjs');
  process.exit(1);
}

const fetchAPI = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${STRAPI_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STRAPI_API_KEY}`,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return response.json();
};

async function crearObtenerMarca(nombre) {
  console.log(`\n📦 Buscando/creando marca: "${nombre}"`);
  
  try {
    // Buscar marca existente
    const existing = await fetchAPI(
      `/api/marcas?filters[name][$eq]=${encodeURIComponent(nombre)}&pagination[limit]=1`
    );
    
    if (existing.data && existing.data.length > 0) {
      console.log(`✅ Marca encontrada: ID ${existing.data[0].id}`);
      return existing.data[0];
    }
    
    // Generar slug desde el nombre
    const slug = nombre.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Crear nueva marca
    const nueva = await fetchAPI('/api/marcas', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          name: nombre,
          slug: slug,
          descripcion: `Marca de prueba: ${nombre}`,
        },
      }),
    });
    
    console.log(`✅ Marca creada: ID ${nueva.data.id}`);
    return nueva.data;
  } catch (error) {
    console.error(`❌ Error con marca "${nombre}":`, error.message);
    throw error;
  }
}

async function crearObtenerEtiqueta(nombre) {
  console.log(`\n🏷️  Buscando/creando etiqueta: "${nombre}"`);
  
  try {
    const existing = await fetchAPI(
      `/api/etiquetas?filters[name][$eq]=${encodeURIComponent(nombre)}&pagination[limit]=1`
    );
    
    if (existing.data && existing.data.length > 0) {
      console.log(`✅ Etiqueta encontrada: ID ${existing.data[0].id}`);
      return existing.data[0];
    }
    
    // Generar slug desde el nombre
    const slug = nombre.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Crear nueva etiqueta
    const nueva = await fetchAPI('/api/etiquetas', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          name: nombre,
          slug: slug,
          descripcion: `Etiqueta de prueba: ${nombre}`,
        },
      }),
    });
    
    console.log(`✅ Etiqueta creada: ID ${nueva.data.id}`);
    return nueva.data;
  } catch (error) {
    console.error(`❌ Error con etiqueta "${nombre}":`, error.message);
    throw error;
  }
}

async function crearObtenerCategoria(nombre) {
  console.log(`\n📁 Buscando/creando categoría: "${nombre}"`);
  
  try {
    // Buscar categoría existente (usar endpoint correcto: categorias-producto)
    let existing;
    try {
      existing = await fetchAPI(
        `/api/categorias-producto?filters[name][$eq]=${encodeURIComponent(nombre)}&pagination[limit]=1`
      );
    } catch (e) {
      // Si falla, intentar con otro formato
      try {
        existing = await fetchAPI(
          `/api/categoria-productos?filters[name][$eq]=${encodeURIComponent(nombre)}&pagination[limit]=1`
        );
      } catch (e2) {
        existing = { data: [] };
      }
    }
    
    if (existing.data && existing.data.length > 0) {
      console.log(`✅ Categoría encontrada: ID ${existing.data[0].id}`);
      return existing.data[0];
    }
    
    // Generar slug desde el nombre
    const slug = nombre.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // Crear nueva categoría (usar endpoint correcto: categorias-producto)
    let nueva;
    try {
      nueva = await fetchAPI('/api/categorias-producto', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            name: nombre,
            slug: slug,
            descripcion: `Categoría de prueba: ${nombre}`,
            tipo_visualizacion: 'default',
          },
        }),
      });
    } catch (e) {
      // Intentar con otro formato si falla
      nueva = await fetchAPI('/api/categoria-productos', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            name: nombre,
            slug: slug,
            descripcion: `Categoría de prueba: ${nombre}`,
            tipo_visualizacion: 'default',
          },
        }),
      });
    }
    
    console.log(`✅ Categoría creada: ID ${nueva.data.id}`);
    return nueva.data;
  } catch (error) {
    console.error(`❌ Error con categoría "${nombre}":`, error.message);
    throw error;
  }
}

async function buscarLibroConCanales() {
  console.log('\n🔍 Buscando libro con canales WooCommerce...');
  
  try {
    const response = await fetchAPI(
      `/api/libros?populate[canales][fields][0]=name&populate[canales][fields][1]=key&pagination[limit]=10&sort=createdAt:desc`
    );
    
    if (!response.data || response.data.length === 0) {
      throw new Error('No se encontraron libros');
    }
    
    // Buscar libro con canales
    for (const libro of response.data) {
      if (libro.canales && libro.canales.length > 0) {
        const tieneWoo = libro.canales.some(c => 
          c.key === 'moraleja' || c.key === 'escolar' ||
          c.name?.toLowerCase().includes('moraleja') ||
          c.name?.toLowerCase().includes('escolar')
        );
        
        if (tieneWoo) {
          console.log(`✅ Libro encontrado: ID ${libro.id} - "${libro.nombre_libro}"`);
          return libro;
        }
      }
    }
    
    // Si no hay libro con canales, usar el primero y agregar canales
    const primerLibro = response.data[0];
    console.log(`⚠️  Usando primer libro (ID ${primerLibro.id}) - agregando canales...`);
    
    // Buscar canales
    const canalesResponse = await fetchAPI('/api/canales?pagination[limit]=10');
    const canales = canalesResponse.data || [];
    const canalMoraleja = canales.find(c => c.key === 'moraleja' || c.name?.toLowerCase().includes('moraleja'));
    
    if (canalMoraleja) {
      await fetchAPI(`/api/libros/${primerLibro.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            canales: [canalMoraleja.id],
          },
        }),
      });
      console.log(`✅ Canal agregado al libro`);
    }
    
    return primerLibro;
  } catch (error) {
    console.error('❌ Error buscando libro:', error.message);
    throw error;
  }
}

async function asignarTaxonomiasALibro(libroId, marca, etiqueta, categoria) {
  console.log(`\n🔗 Asignando taxonomías al libro ID ${libroId}...`);
  
  try {
    // Obtener el libro primero para obtener documentId
    const libroActual = await fetchAPI(`/api/libros?filters[id][$eq]=${libroId}&pagination[limit]=1`);
    if (!libroActual.data || libroActual.data.length === 0) {
      throw new Error(`Libro con ID ${libroId} no encontrado`);
    }
    
    const libro = libroActual.data[0];
    const documentId = libro.documentId || libro.id;
    
    const response = await fetchAPI(`/api/libros/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        data: {
          marcas: [marca.id],
          etiquetas: [etiqueta.id],
          categorias_producto: [categoria.id],
        },
      }),
    });
    
    console.log(`✅ Taxonomías asignadas:`);
    console.log(`   - Marca: ${marca.name}`);
    console.log(`   - Etiqueta: ${etiqueta.name}`);
    console.log(`   - Categoría: ${categoria.name}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error asignando taxonomías:', error.message);
    throw error;
  }
}

async function verificarSincronizacion(libro) {
  console.log(`\n🔄 Verificando sincronización del libro ID ${libro.id}...`);
  
  try {
    // Obtener libro completo con relaciones (usar documentId)
    const libroActual = await fetchAPI(`/api/libros?filters[id][$eq]=${libro.id}&pagination[limit]=1`);
    if (!libroActual.data || libroActual.data.length === 0) {
      throw new Error(`Libro con ID ${libro.id} no encontrado`);
    }
    
    const libroDoc = libroActual.data[0];
    const documentId = libroDoc.documentId || libroDoc.id;
    
    const libroCompleto = await fetchAPI(
      `/api/libros/${documentId}?populate[marcas][fields][0]=name&populate[etiquetas][fields][0]=name&populate[categorias_producto][fields][0]=name&populate[canales][fields][0]=key`
    );
    
    console.log(`\n📊 Estado del libro:`);
    console.log(`   - ID: ${libroCompleto.data.id}`);
    console.log(`   - Nombre: ${libroCompleto.data.nombre_libro}`);
    console.log(`   - External IDs:`, libroCompleto.data.externalIds || 'Ninguno');
    
    if (libroCompleto.data.marcas && libroCompleto.data.marcas.length > 0) {
      console.log(`   - Marcas: ${libroCompleto.data.marcas.map(m => m.name).join(', ')}`);
      libroCompleto.data.marcas.forEach(m => {
        console.log(`     • ${m.name}: externalIds =`, m.externalIds || 'Ninguno');
      });
    }
    
    if (libroCompleto.data.etiquetas && libroCompleto.data.etiquetas.length > 0) {
      console.log(`   - Etiquetas: ${libroCompleto.data.etiquetas.map(e => e.name).join(', ')}`);
      libroCompleto.data.etiquetas.forEach(e => {
        console.log(`     • ${e.name}: externalIds =`, e.externalIds || 'Ninguno');
      });
    }
    
    if (libroCompleto.data.categorias_producto && libroCompleto.data.categorias_producto.length > 0) {
      console.log(`   - Categorías: ${libroCompleto.data.categorias_producto.map(c => c.name).join(', ')}`);
      libroCompleto.data.categorias_producto.forEach(c => {
        console.log(`     • ${c.name}: externalIds =`, c.externalIds || 'Ninguno');
      });
    }
    
    if (libroCompleto.data.canales && libroCompleto.data.canales.length > 0) {
      console.log(`   - Canales: ${libroCompleto.data.canales.map(c => c.key).join(', ')}`);
    }
    
    // Intentar actualizar el libro para activar la sincronización
    console.log(`\n⚡ Activando sincronización actualizando el libro...`);
    try {
      const documentId = libroCompleto.data.documentId || libroCompleto.data.id;
      await fetchAPI(`/api/libros/${documentId}`, {
        method: 'PUT',
        body: JSON.stringify({
          data: {
            // Solo actualizar un campo para activar el lifecycle
            nombre_libro: libroCompleto.data.nombre_libro,
          },
        }),
      });
      console.log(`✅ Actualización enviada - la sincronización debería ejecutarse automáticamente`);
    } catch (error) {
      console.warn(`⚠️  No se pudo actualizar el libro:`, error.message);
      console.log(`   (Puedes actualizar el libro manualmente desde la UI de Strapi)`);
    }
    
    return libroCompleto.data;
  } catch (error) {
    console.error('❌ Error verificando sincronización:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Prueba de Sincronización: Brands, Tags y Categorías');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Strapi: ${STRAPI_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // 1. Crear/obtener taxonomías
    const marca = await crearObtenerMarca('Editorial Prueba');
    const etiqueta = await crearObtenerEtiqueta('Ficción');
    const categoria = await crearObtenerCategoria('Literatura');
    
    // 2. Buscar libro con canales
    const libro = await buscarLibroConCanales();
    
    // 3. Asignar taxonomías al libro
    await asignarTaxonomiasALibro(libro.id, marca, etiqueta, categoria);
    
    // 4. Verificar sincronización
    await verificarSincronizacion(libro);
    
    console.log('\n\n✅ Proceso completado!');
    console.log('\n📝 Próximos pasos:');
    console.log('   1. Revisa los logs de Strapi para ver la sincronización');
    console.log('   2. Verifica en WooCommerce que las taxonomías se crearon');
    console.log('   3. Verifica que el producto tiene las taxonomías asignadas');
    console.log('   4. Si Brands no funciona, puede necesitar el plugin MAS Brands');
    
  } catch (error) {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  }
}

main().catch(console.error);
