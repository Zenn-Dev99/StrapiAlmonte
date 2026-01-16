/**
 * Script para publicar el libro y asignar canal para activar sincronización
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN || process.env.IMPORT_TOKEN;

if (!STRAPI_TOKEN) {
  console.error('❌ Error: STRAPI_TOKEN no está configurado');
  process.exit(1);
}

async function fetchStrapiAPI(endpoint, options = {}) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${STRAPI_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.data || data;
}

async function main() {
  console.log('🚀 Publicando libro y asignando canal para sincronización...\n');

  // Buscar libro por ISBN
  const isbnBuscar = 'TEST-754882';
  let libro;
  try {
    console.log(`🔍 Buscando libro por ISBN que contiene "${isbnBuscar}"...`);
    const libros = await fetchStrapiAPI(`/libros?filters[isbn_libro][$contains]=${isbnBuscar}&pagination[limit]=1&sort=createdAt:desc`);
    if (Array.isArray(libros) && libros.length > 0) {
      libro = libros[0];
      const libroId = libro.documentId || libro.id;
      console.log(`✅ Libro encontrado: "${libro.nombre_libro || libro.attributes?.nombre_libro}" (ID: ${libroId})\n`);
      
      // 1. Buscar o obtener canal "moraleja"
      console.log(`📡 Buscando canal "moraleja"...`);
      let canalId;
      try {
        const canales = await fetchStrapiAPI(`/canales?filters[key][$eq]=moraleja&pagination[limit]=1`);
        if (Array.isArray(canales) && canales.length > 0) {
          canalId = canales[0].documentId || canales[0].id;
          console.log(`✅ Canal encontrado: ${canales[0].name || canales[0].attributes?.name} (ID: ${canalId})`);
        } else {
          console.error(`❌ Canal "moraleja" no encontrado`);
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ Error buscando canal: ${error.message}`);
        process.exit(1);
      }
      
      // 2. Asignar canal al libro
      console.log(`\n🔗 Asignando canal al libro...`);
      try {
        const libroConCanal = await fetchStrapiAPI(`/libros/${libroId}`, {
          method: 'PUT',
          body: JSON.stringify({
            data: {
              canales: [canalId],
            },
          }),
        });
        console.log(`✅ Canal asignado al libro`);
      } catch (error) {
        console.error(`❌ Error asignando canal: ${error.message}`);
        process.exit(1);
      }
      
      // 3. Publicar el libro
      console.log(`\n📤 Publicando libro...`);
      try {
        const libroPublicado = await fetchStrapiAPI(`/libros/${libroId}/actions/publish`, {
          method: 'POST',
        });
        console.log(`✅ Libro publicado exitosamente`);
        console.log(`   - PublishedAt: ${libroPublicado.publishedAt || 'N/A'}`);
      } catch (error) {
        // Si el endpoint de publish no funciona, intentar con PUT
        console.log(`   ⚠️  Endpoint publish no disponible, intentando con PUT...`);
        try {
          const libroPublicado = await fetchStrapiAPI(`/libros/${libroId}`, {
            method: 'PUT',
            body: JSON.stringify({
              data: {
                publishedAt: new Date().toISOString(),
              },
            }),
          });
          console.log(`✅ Libro publicado exitosamente (vía PUT)`);
          console.log(`   - PublishedAt: ${libroPublicado.publishedAt || libroPublicado.attributes?.publishedAt || 'N/A'}`);
        } catch (error2) {
          console.error(`❌ Error publicando libro: ${error2.message}`);
          console.log(`\n💡 Publica el libro manualmente desde Strapi Admin para activar la sincronización`);
        }
      }
      
      console.log(`\n✅ ¡Libro configurado para sincronización!`);
      console.log(`\n📝 El lifecycle afterUpdate debería activar la sincronización automáticamente.`);
      console.log(`   Revisa los logs de Strapi para ver el proceso de sincronización.`);
      console.log(`   Busca mensajes que empiecen con "[libro]" o "[woo-sync]".`);
      
    } else {
      console.error(`❌ No se encontró el libro con ISBN que contiene "${isbnBuscar}"`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();




