#!/usr/bin/env node

/**
 * Script para verificar y regenerar la tabla wp_wc_product_attributes_lookup de WooCommerce
 * 
 * Este script:
 * 1. Verifica que los productos en Strapi tengan sus atributos correctamente registrados en WooCommerce
 * 2. Compara la tabla de lookup con los productos reales
 * 3. Regenera la tabla de lookup si es necesario
 * 4. Muestra un reporte de inconsistencias
 * 
 * Uso:
 *   node scripts/verificar-regenerar-atributos-woocommerce.mjs
 *   node scripts/verificar-regenerar-atributos-woocommerce.mjs --regenerate
 *   node scripts/verificar-regenerar-atributos-woocommerce.mjs -r
 * 
 * Variables de entorno requeridas:
 *   STRAPI_URL - URL de Strapi (default: https://strapi.moraleja.cl)
 *   STRAPI_TOKEN - Token de autenticación de Strapi (o pasar como argumento)
 *   WOO_MORALEJA_URL - URL de WooCommerce Moraleja
 *   WOO_MORALEJA_CONSUMER_KEY - Consumer Key de WooCommerce Moraleja
 *   WOO_MORALEJA_CONSUMER_SECRET - Consumer Secret de WooCommerce Moraleja
 *   WOO_ESCOLAR_URL - URL de WooCommerce Escolar
 *   WOO_ESCOLAR_CONSUMER_KEY - Consumer Key de WooCommerce Escolar
 *   WOO_ESCOLAR_CONSUMER_SECRET - Consumer Secret de WooCommerce Escolar
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración
const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.argv.find(arg => arg.startsWith('--token='))?.split('=')[1] || '';
const STRAPI_API_KEY = STRAPI_TOKEN || process.env.STRAPI_API_KEY || '';

// Configuración de WooCommerce (usando los mismos nombres que en Strapi)
const WOO_CONFIGS = {
  woo_moraleja: {
    url: process.env.WOO_MORALEJA_URL || '',
    consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET || '',
  },
  woo_escolar: {
    url: process.env.WOO_ESCOLAR_URL || '',
    consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET || '',
  },
};

// Headers para Strapi
const STRAPI_HEADERS = {
  'Content-Type': 'application/json',
  ...(STRAPI_TOKEN && { Authorization: `Bearer ${STRAPI_TOKEN}` }),
};

/**
 * Obtener autenticación para WooCommerce
 */
function getWooAuth(config) {
  return Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
}

/**
 * Obtener todos los libros de Strapi con sus relaciones
 */
async function getLibrosFromStrapi() {
  try {
    // Obtener libros con paginación y populate básico
    const allLibros = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      // Construir parámetros de populate para Strapi v5 (sin anidar para evitar errores)
      const params = new URLSearchParams({
        'pagination[page]': String(page),
        'pagination[pageSize]': String(pageSize),
        'populate[autor_relacion]': 'true',
        'populate[editorial]': 'true',
        'populate[sello]': 'true',
        'populate[coleccion]': 'true',
        'populate[obra]': 'true',
      });
      
      const response = await fetch(
        `${STRAPI_URL}/api/libros?${params.toString()}`,
        {
          headers: STRAPI_HEADERS,
        }
      );

      if (!response.ok) {
        if (page === 1) {
          // Solo mostrar error en la primera página
          const errorText = await response.text();
          throw new Error(`Error obteniendo libros: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
        }
        break; // Si falla después de la primera página, probablemente no hay más
      }

      const data = await response.json();
      const libros = Array.isArray(data.data) ? data.data : [];
      
      if (libros.length === 0) {
        break; // No hay más libros
      }

      allLibros.push(...libros);
      
      // Verificar si hay más páginas
      const pagination = data.meta?.pagination;
      if (!pagination || page >= pagination.pageCount) {
        break;
      }
      
      page++;
    }

    return allLibros;
  } catch (error) {
    console.error('❌ Error obteniendo libros de Strapi:', error.message);
    return [];
  }
}

/**
 * Obtener un producto de WooCommerce
 */
async function getWooProduct(config, productId) {
  try {
    const auth = getWooAuth(config);
    const response = await fetch(
      `${config.url}/wp-json/wc/v3/products/${productId}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Error obteniendo producto ${productId} de WooCommerce:`, error.message);
    return null;
  }
}

/**
 * Obtener todos los productos de WooCommerce (paginado)
 */
async function getAllWooProducts(config) {
  const products = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const auth = getWooAuth(config);
      const response = await fetch(
        `${config.url}/wp-json/wc/v3/products?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        break;
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      products.push(...data);
      page++;

      if (data.length < perPage) {
        break;
      }
    }
  } catch (error) {
    console.error('❌ Error obteniendo productos de WooCommerce:', error.message);
  }

  return products;
}

/**
 * Obtener atributos de un producto de WooCommerce
 */
async function getProductAttributes(config, productId) {
  const product = await getWooProduct(config, productId);
  if (!product || !product.attributes) {
    return [];
  }

  return product.attributes.map((attr) => ({
    id: attr.id,
    name: attr.name,
    slug: attr.slug || attr.name.toLowerCase().replace(/\s+/g, '-'),
    options: attr.options || [],
  }));
}

/**
 * Verificar atributos de un libro en WooCommerce
 */
async function verificarAtributosLibro(libro, platform) {
  const config = WOO_CONFIGS[platform];
  if (!config || !config.url) {
    return { error: 'Configuración no disponible' };
  }

  const externalIds = libro.attributes?.externalIds || libro.externalIds || {};
  const wooId = externalIds[platform];

  if (!wooId) {
    return { error: 'Producto no sincronizado en WooCommerce' };
  }

  const product = await getWooProduct(config, wooId);
  if (!product) {
    return { error: 'Producto no encontrado en WooCommerce' };
  }

  const atributosEsperados = [];
  const atributosEncontrados = [];

  // Verificar autor
  if (libro.attributes?.autor_relacion?.data) {
    const autor = libro.attributes.autor_relacion.data;
    const autorName = autor.attributes?.nombre_completo_autor || autor.nombre_completo_autor;
    atributosEsperados.push({ tipo: 'Autor', nombre: autorName });
  }

  // Verificar editorial
  if (libro.attributes?.editorial?.data) {
    const editorial = libro.attributes.editorial.data;
    const editorialName = editorial.attributes?.nombre_editorial || editorial.nombre_editorial;
    atributosEsperados.push({ tipo: 'Editorial', nombre: editorialName });
  }

  // Verificar sello
  if (libro.attributes?.sello?.data) {
    const sello = libro.attributes.sello.data;
    const selloName = sello.attributes?.nombre_sello || sello.nombre_sello;
    atributosEsperados.push({ tipo: 'Sello', nombre: selloName });
  }

  // Verificar obra
  if (libro.attributes?.obra?.data) {
    const obra = libro.attributes.obra.data;
    const obraName = obra.attributes?.nombre_obra || obra.nombre_obra;
    atributosEsperados.push({ tipo: 'Obra', nombre: obraName });
  }

  // Verificar colección
  if (libro.attributes?.coleccion?.data) {
    const coleccion = libro.attributes.coleccion.data;
    const coleccionName = coleccion.attributes?.nombre_coleccion || coleccion.nombre_coleccion;
    atributosEsperados.push({ tipo: 'Colección', nombre: coleccionName });
  }

  // Verificar atributos en el producto de WooCommerce
  if (product.attributes) {
    for (const attr of product.attributes) {
      if (attr.options && Array.isArray(attr.options)) {
        for (const option of attr.options) {
          atributosEncontrados.push({ tipo: attr.name, nombre: option });
        }
      }
    }
  }

  // Comparar
  const faltantes = atributosEsperados.filter(
    (esperado) =>
      !atributosEncontrados.some(
        (encontrado) =>
          encontrado.tipo === esperado.tipo && encontrado.nombre === esperado.nombre
      )
  );

  const extras = atributosEncontrados.filter(
    (encontrado) =>
      !atributosEsperados.some(
        (esperado) =>
          esperado.tipo === encontrado.tipo && esperado.nombre === encontrado.nombre
      )
  );

  return {
    productoId: wooId,
    sku: product.sku || 'sin SKU',
    nombre: product.name,
    atributosEsperados,
    atributosEncontrados,
    faltantes,
    extras,
    correcto: faltantes.length === 0 && extras.length === 0,
  };
}

/**
 * Regenerar tabla de lookup para un producto específico
 * Intenta forzar la regeneración actualizando el producto
 */
async function regenerarLookupParaProducto(config, productId, autoRegenerate = false) {
  if (!autoRegenerate) {
    console.log(`⚠️  Para regenerar lookup del producto ${productId}, ejecuta manualmente:`);
    console.log(`   wp wc palt regenerate_for_product ${productId} --url=${config.url}`);
    return false;
  }

  try {
    const auth = getWooAuth(config);
    const product = await getWooProduct(config, productId);
    if (!product) {
      console.log(`   ❌ Producto ${productId} no encontrado`);
      return false;
    }

    // Actualizar el producto para forzar regeneración de lookup
    // WooCommerce regenera la tabla automáticamente cuando se actualiza un producto
    const response = await fetch(
      `${config.url}/wp-json/wc/v3/products/${productId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...product,
          // Agregar un campo temporal para forzar actualización
          meta_data: [
            ...(product.meta_data || []),
            { key: '_lookup_regenerated_at', value: new Date().toISOString() },
          ],
        }),
      }
    );

    if (response.ok) {
      console.log(`   ✅ Producto ${productId} actualizado, lookup debería regenerarse automáticamente`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Error actualizando producto ${productId}: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error regenerando lookup para producto ${productId}:`, error.message);
    return false;
  }
}

/**
 * Regenerar toda la tabla de lookup (usando WP-CLI si está disponible)
 */
async function regenerarLookupCompleto(config) {
  try {
    console.log(`⚠️  Para regenerar toda la tabla de lookup, ejecuta manualmente:`);
    console.log(`   wp wc palt regenerate --url=${config.url}`);
    console.log(`\n   O desde el admin de WooCommerce:`);
    console.log(`   WooCommerce > Status > Tools > "Regenerate the product attributes lookup table"`);
    return false;
  } catch (error) {
    console.error('❌ Error regenerando lookup completo:', error.message);
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  // Verificar si se debe regenerar automáticamente
  const args = process.argv.slice(2);
  const autoRegenerate = args.includes('--regenerate') || args.includes('-r');
  const regenerateAll = args.includes('--regenerate-all') || args.includes('-R');

  if (autoRegenerate || regenerateAll) {
    console.log('🔄 Modo de regeneración automática activado\n');
  }
  console.log('🔍 Verificando atributos de productos en WooCommerce...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Obtener libros de Strapi
  console.log('📚 Obteniendo libros de Strapi...');
  const libros = await getLibrosFromStrapi();
  console.log(`✅ ${libros.length} libro(s) encontrado(s)\n`);

  if (libros.length === 0) {
    console.log('⚠️  No hay libros para verificar');
    return;
  }

  // Verificar que las configuraciones de WooCommerce estén disponibles
  const configsDisponibles = [];
  for (const [platform, config] of Object.entries(WOO_CONFIGS)) {
    if (config.url && config.consumerKey && config.consumerSecret) {
      configsDisponibles.push(platform);
    }
  }

  if (configsDisponibles.length === 0) {
    console.log('⚠️  No hay configuraciones de WooCommerce disponibles');
    console.log('\n💡 Para verificar atributos, configura las siguientes variables de entorno:');
    console.log('   WOO_MORALEJA_URL, WOO_MORALEJA_CONSUMER_KEY, WOO_MORALEJA_CONSUMER_SECRET');
    console.log('   WOO_ESCOLAR_URL, WOO_ESCOLAR_CONSUMER_KEY, WOO_ESCOLAR_CONSUMER_SECRET\n');
    return;
  }

  console.log(`✅ Configuraciones disponibles: ${configsDisponibles.join(', ')}\n`);

  const resultados = {
    woo_moraleja: { correctos: 0, conErrores: 0, noSincronizados: 0, detalles: [] },
    woo_escolar: { correctos: 0, conErrores: 0, noSincronizados: 0, detalles: [] },
  };

  // Verificar cada libro en ambas plataformas
  for (const libro of libros) {
    const libroNombre = libro.attributes?.nombre_libro || libro.nombre_libro || `Libro ID: ${libro.id}`;
    console.log(`\n📖 Verificando: ${libroNombre}`);

    for (const platform of ['woo_moraleja', 'woo_escolar']) {
      const config = WOO_CONFIGS[platform];
      if (!config || !config.url) {
        console.log(`   ⏭️  ${platform}: Configuración no disponible`);
        continue;
      }

      const resultado = await verificarAtributosLibro(libro, platform);

      if (resultado.error) {
        if (resultado.error.includes('no sincronizado')) {
          resultados[platform].noSincronizados++;
          console.log(`   ⏭️  ${platform}: ${resultado.error}`);
        } else {
          resultados[platform].conErrores++;
          console.log(`   ❌ ${platform}: ${resultado.error}`);
        }
        resultados[platform].detalles.push({
          libro: libroNombre,
          libroId: libro.id,
          error: resultado.error,
        });
      } else {
        if (resultado.correcto) {
          resultados[platform].correctos++;
          console.log(`   ✅ ${platform}: Atributos correctos (${resultado.atributosEncontrados.length} atributo(s))`);
        } else {
          resultados[platform].conErrores++;
          console.log(`   ⚠️  ${platform}: Problemas encontrados`);
          if (resultado.faltantes.length > 0) {
            console.log(`      Faltantes: ${resultado.faltantes.map((f) => `${f.tipo}: ${f.nombre}`).join(', ')}`);
          }
          if (resultado.extras.length > 0) {
            console.log(`      Extras: ${resultado.extras.map((e) => `${e.tipo}: ${e.nombre}`).join(', ')}`);
          }
        }
        resultados[platform].detalles.push({
          libro: libroNombre,
          libroId: libro.id,
          productoId: resultado.productoId,
          sku: resultado.sku,
          correcto: resultado.correcto,
          faltantes: resultado.faltantes,
          extras: resultado.extras,
        });
      }
    }
  }

  // Mostrar resumen
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 RESUMEN DE VERIFICACIÓN\n');

  for (const platform of ['woo_moraleja', 'woo_escolar']) {
    const res = resultados[platform];
    console.log(`${platform.toUpperCase()}:`);
    console.log(`   ✅ Correctos: ${res.correctos}`);
    console.log(`   ⚠️  Con errores: ${res.conErrores}`);
    console.log(`   ⏭️  No sincronizados: ${res.noSincronizados}`);
    console.log(`   📦 Total: ${res.correctos + res.conErrores + res.noSincronizados}`);
    console.log('');
  }

  // Mostrar productos con problemas
  const productosConProblemas = [];
  for (const platform of ['woo_moraleja', 'woo_escolar']) {
    const res = resultados[platform];
    for (const detalle of res.detalles) {
      if (!detalle.correcto && detalle.productoId) {
        productosConProblemas.push({ platform, ...detalle });
      }
    }
  }

  if (productosConProblemas.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  PRODUCTOS CON PROBLEMAS\n');

    for (const problema of productosConProblemas) {
      console.log(`${problema.libro} (${problema.platform}):`);
      console.log(`   Producto ID: ${problema.productoId}`);
      console.log(`   SKU: ${problema.sku}`);
      if (problema.faltantes && problema.faltantes.length > 0) {
        console.log(`   Faltantes: ${problema.faltantes.map((f) => `${f.tipo}: ${f.nombre}`).join(', ')}`);
      }
      if (problema.extras && problema.extras.length > 0) {
        console.log(`   Extras: ${problema.extras.map((e) => `${e.tipo}: ${e.nombre}`).join(', ')}`);
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (autoRegenerate || regenerateAll) {
      console.log('🔄 REGENERANDO LOOKUP PARA PRODUCTOS CON PROBLEMAS\n');
      
      let regenerados = 0;
      for (const problema of productosConProblemas) {
        const config = WOO_CONFIGS[problema.platform];
        if (config && config.url && problema.productoId) {
          console.log(`Regenerando ${problema.libro} (${problema.platform}, Producto ID: ${problema.productoId})...`);
          const resultado = await regenerarLookupParaProducto(config, problema.productoId, true);
          if (resultado) {
            regenerados++;
          }
          // Pequeña pausa para no sobrecargar la API
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      
      console.log(`\n✅ ${regenerados} producto(s) actualizado(s) para regenerar lookup`);
      console.log('⚠️  Nota: WooCommerce regenera la tabla automáticamente, pero puede tomar unos minutos.\n');
    } else {
      console.log('🔄 OPCIONES PARA REGENERAR LOOKUP\n');

      console.log('1. Regenerar lookup completo (recomendado si hay muchos problemas):');
      for (const platform of ['woo_moraleja', 'woo_escolar']) {
        const config = WOO_CONFIGS[platform];
        if (config && config.url) {
          console.log(`   ${platform}:`);
          console.log(`   - WP-CLI: wp wc palt regenerate --url=${config.url}`);
          console.log(`   - Admin: WooCommerce > Status > Tools > "Regenerate the product attributes lookup table"`);
        }
      }

      console.log('\n2. Regenerar lookup para productos específicos:');
      console.log('   Ejecuta este script con --regenerate para regenerar automáticamente:');
      console.log('   node scripts/verificar-regenerar-atributos-woocommerce.mjs --regenerate');
      console.log('\n   O manualmente con WP-CLI:');
      for (const problema of productosConProblemas.slice(0, 10)) {
        const config = WOO_CONFIGS[problema.platform];
        if (config && config.url) {
          console.log(`   wp wc palt regenerate_for_product ${problema.productoId} --url=${config.url}`);
        }
      }

      if (productosConProblemas.length > 10) {
        console.log(`   ... y ${productosConProblemas.length - 10} más`);
      }

      console.log('\n3. Re-sincronizar productos desde Strapi:');
      console.log('   Los productos con problemas pueden ser re-sincronizados desde Strapi');
      console.log('   para asegurar que los atributos estén correctamente vinculados.\n');
    }
  } else {
    console.log('✅ Todos los productos verificados tienen sus atributos correctamente registrados!\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!autoRegenerate && !regenerateAll) {
    console.log('💡 TIP: Ejecuta este script con --regenerate para regenerar automáticamente:');
    console.log('   node scripts/verificar-regenerar-atributos-woocommerce.mjs --regenerate\n');
  }
}

// Ejecutar
main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
