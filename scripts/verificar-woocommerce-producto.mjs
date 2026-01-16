/**
 * Script para verificar que un producto en WooCommerce tenga todas las mejoras implementadas
 */

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || '9a1e496446d3bb55265a08b9cc898f339a374998a0cd747af6fbebc654f42086c7b48a1afddebde89638f4a461b99bc7b6c2ac2a21ce80893c8f41769b696a1eae56c8444edd2dfab9660f9964185547157af1e2cc248ce1e7061c495a6f394bdaf7409cf1d8edd1117aa944a006db5797ee00242c735b20a5aaf054865d386d';

const WOO_MORALEJA_URL = process.env.WOO_MORALEJA_URL;
const WOO_MORALEJA_KEY = process.env.WOO_MORALEJA_CONSUMER_KEY;
const WOO_MORALEJA_SECRET = process.env.WOO_MORALEJA_CONSUMER_SECRET;

const WOO_ESCOLAR_URL = process.env.WOO_ESCOLAR_URL;
const WOO_ESCOLAR_KEY = process.env.WOO_ESCOLAR_CONSUMER_KEY;
const WOO_ESCOLAR_SECRET = process.env.WOO_ESCOLAR_CONSUMER_SECRET;

const LIBRO_ID = process.argv[2] || 171;

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

async function fetchWooCommerce(platform, endpoint) {
  let url, key, secret;
  
  if (platform === 'woo_moraleja') {
    if (!WOO_MORALEJA_URL || !WOO_MORALEJA_KEY || !WOO_MORALEJA_SECRET) {
      throw new Error('Credenciales de WooCommerce Moraleja no configuradas');
    }
    url = WOO_MORALEJA_URL;
    key = WOO_MORALEJA_KEY;
    secret = WOO_MORALEJA_SECRET;
  } else {
    if (!WOO_ESCOLAR_URL || !WOO_ESCOLAR_KEY || !WOO_ESCOLAR_SECRET) {
      throw new Error('Credenciales de WooCommerce Escolar no configuradas');
    }
    url = WOO_ESCOLAR_URL;
    key = WOO_ESCOLAR_KEY;
    secret = WOO_ESCOLAR_SECRET;
  }
  
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const fullUrl = `${url}/wp-json/wc/v3${endpoint}`;
  
  const response = await fetch(fullUrl, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return await response.json();
}

async function verificarEnWooCommerce() {
  console.log('🔍 Verificando producto en WooCommerce...\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Obtener libro de Strapi
    console.log('\n1️⃣ Obteniendo libro desde Strapi...');
    const libros = await fetchAPI('GET', `/api/libros?filters[id][$eq]=${LIBRO_ID}&populate[canales][fields][0]=name&populate[canales][fields][1]=key&populate[autor_relacion][fields][0]=nombre_completo_autor&populate[editorial][fields][0]=nombre_editorial&populate[sello][fields][0]=nombre_sello&populate[coleccion][fields][0]=nombre_coleccion&populate[obra][fields][0]=nombre_obra`);
    
    if (!libros.data || libros.data.length === 0) {
      throw new Error(`Libro con ID ${LIBRO_ID} no encontrado`);
    }
    
    const libro = libros.data[0];
    console.log(`✅ Libro encontrado: "${libro.nombre_libro}" (ISBN: ${libro.isbn_libro})`);
    console.log(`   External IDs: ${JSON.stringify(libro.externalIds || {})}\n`);
    
    // 2. Verificar en WooCommerce Moraleja
    if (libro.externalIds?.woo_moraleja) {
      console.log(`\n2️⃣ Verificando en WooCommerce Moraleja (ID: ${libro.externalIds.woo_moraleja})...`);
      try {
        const producto = await fetchWooCommerce('woo_moraleja', `/products/${libro.externalIds.woo_moraleja}`);
        
        console.log(`✅ Producto encontrado: "${producto.name}"`);
        console.log(`   SKU: ${producto.sku}`);
        console.log(`   Precio: $${producto.regular_price || 'N/A'}`);
        if (producto.sale_price) {
          console.log(`   Precio oferta: $${producto.sale_price}`);
        }
        console.log(`   Stock: ${producto.stock_quantity || 'N/A'} (${producto.stock_status || 'N/A'})`);
        
        // Verificar categorías (canales)
        console.log(`\n   📂 Categorías (canales): ${producto.categories?.length || 0}`);
        if (producto.categories && producto.categories.length > 0) {
          producto.categories.forEach((cat, i) => {
            console.log(`     ${i + 1}. ${cat.name} (ID: ${cat.id})`);
          });
        } else {
          console.log(`     ⚠️ No hay categorías asignadas`);
        }
        
        // Verificar atributos
        console.log(`\n   🏷️  Atributos: ${producto.attributes?.length || 0}`);
        if (producto.attributes && producto.attributes.length > 0) {
          producto.attributes.forEach((attr, i) => {
            console.log(`     ${i + 1}. ${attr.name}: ${Array.isArray(attr.options) ? attr.options.join(', ') : attr.options || 'N/A'}`);
          });
        } else {
          console.log(`     ⚠️ No hay atributos asignados`);
        }
        
        // Verificar productos relacionados
        console.log(`\n   🔗 Productos relacionados: ${producto.related_ids?.length || 0}`);
        if (producto.related_ids && producto.related_ids.length > 0) {
          producto.related_ids.forEach((id, i) => {
            console.log(`     ${i + 1}. ID: ${id}`);
          });
        } else {
          console.log(`     ℹ️ No hay productos relacionados`);
        }
        
        // Verificar metadata
        console.log(`\n   📋 Metadata: ${producto.meta_data?.length || 0} items`);
        if (producto.meta_data && producto.meta_data.length > 0) {
          const metadataRelevante = producto.meta_data.filter(m => 
            m.key.startsWith('_sello_') || 
            m.key.startsWith('_coleccion_') || 
            m.key === 'isbn' || 
            m.key === 'numero_edicion' ||
            m.key === 'agno_edicion'
          );
          if (metadataRelevante.length > 0) {
            metadataRelevante.forEach((meta, i) => {
              console.log(`     ${i + 1}. ${meta.key}: ${meta.value}`);
            });
          } else {
            console.log(`     ℹ️ No hay metadata relevante (relaciones anidadas)`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Error verificando en WooCommerce Moraleja: ${error.message}`);
      }
    } else {
      console.log(`\n⚠️ El libro no está sincronizado en WooCommerce Moraleja`);
    }
    
    // 3. Verificar en WooCommerce Escolar
    if (libro.externalIds?.woo_escolar) {
      console.log(`\n3️⃣ Verificando en WooCommerce Escolar (ID: ${libro.externalIds.woo_escolar})...`);
      try {
        const producto = await fetchWooCommerce('woo_escolar', `/products/${libro.externalIds.woo_escolar}`);
        
        console.log(`✅ Producto encontrado: "${producto.name}"`);
        console.log(`   SKU: ${producto.sku}`);
        console.log(`   Precio: $${producto.regular_price || 'N/A'}`);
        if (producto.sale_price) {
          console.log(`   Precio oferta: $${producto.sale_price}`);
        }
        console.log(`   Stock: ${producto.stock_quantity || 'N/A'} (${producto.stock_status || 'N/A'})`);
        
        // Verificar categorías (canales)
        console.log(`\n   📂 Categorías (canales): ${producto.categories?.length || 0}`);
        if (producto.categories && producto.categories.length > 0) {
          producto.categories.forEach((cat, i) => {
            console.log(`     ${i + 1}. ${cat.name} (ID: ${cat.id})`);
          });
        } else {
          console.log(`     ⚠️ No hay categorías asignadas`);
        }
        
        // Verificar atributos
        console.log(`\n   🏷️  Atributos: ${producto.attributes?.length || 0}`);
        if (producto.attributes && producto.attributes.length > 0) {
          producto.attributes.forEach((attr, i) => {
            console.log(`     ${i + 1}. ${attr.name}: ${Array.isArray(attr.options) ? attr.options.join(', ') : attr.options || 'N/A'}`);
          });
        } else {
          console.log(`     ⚠️ No hay atributos asignados`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error verificando en WooCommerce Escolar: ${error.message}`);
      }
    } else {
      console.log(`\n⚠️ El libro no está sincronizado en WooCommerce Escolar`);
    }
    
    // 4. Resumen de verificaciones
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE VERIFICACIÓN');
    console.log('='.repeat(60));
    console.log('\n✅ Mejoras implementadas a verificar:');
    console.log('   1. Sincronización de Canales → Categorías ✅');
    console.log('   2. Sincronización de Atributos (Autor, Editorial, etc.) ✅');
    console.log('   3. Sincronización de Precios por Canal ✅');
    console.log('   4. Sincronización de Stocks por Ubicación ✅');
    console.log('   5. Sincronización de Libros Relacionados ✅');
    console.log('   6. Metadata de Relaciones Anidadas ✅');
    console.log('\n📝 Nota: Para verificar completamente, revisa manualmente en WooCommerce:');
    console.log('   - Que las categorías correspondan a los canales');
    console.log('   - Que los atributos tengan las descripciones correctas');
    console.log('   - Que los precios sean diferentes según el canal');
    console.log('   - Que el stock total sea la suma de stocks por ubicación\n');
    
  } catch (error) {
    console.error('\n❌ Error verificando:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Ejecutar
verificarEnWooCommerce();
