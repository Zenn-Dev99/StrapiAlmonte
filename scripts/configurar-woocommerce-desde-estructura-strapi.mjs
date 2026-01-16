#!/usr/bin/env node

/**
 * Script para CONFIGURAR WooCommerce desde la ESTRUCTURA COMPLETA de Strapi
 * 
 * Este script:
 * 1. Lee TODOS los Content Types de Strapi (Autores, Editoriales, Sellos, Colecciones)
 * 2. Crea atributos en WooCommerce si no existen
 * 3. Crea términos (terms) para cada elemento de los Content Types
 * 4. Crea brands para Editoriales
 * 5. Luego asigna esos términos a productos existentes en WooCommerce
 * 
 * Uso:
 *   node scripts/configurar-woocommerce-desde-estructura-strapi.mjs moraleja
 *   node scripts/configurar-woocommerce-desde-estructura-strapi.mjs escolar
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
const envPath = join(__dirname, '..', '.env');
try {
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
} catch (err) {}

const STORES = {
  moraleja: {
    name: 'Moraleja',
    url: process.env.WOO_MORALEJA_URL || 'https://staging.moraleja.cl',
    consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY,
    consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET,
    strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
    strapiToken: process.env.STRAPI_API_TOKEN,
  },
  escolar: {
    name: 'Librería Escolar',
    url: process.env.WOO_ESCOLAR_URL || 'https://staging.escolar.cl',
    consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY,
    consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
    strapiUrl: process.env.STRAPI_URL || 'http://localhost:1337',
    strapiToken: process.env.STRAPI_API_TOKEN,
  },
};

const PLATFORM_MAP = {
  moraleja: 'woo_moraleja',
  escolar: 'woo_escolar',
};

// Helper para hacer requests autenticados a WooCommerce
async function fetchWooAPI(store, endpoint, options = {}) {
  const auth = Buffer.from(`${store.consumerKey}:${store.consumerSecret}`).toString('base64');
  const apiUrl = `${store.url}/wp-json/wc/v3/${endpoint}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(`WooCommerce API error: ${response.status} ${errorText}`);
      error.status = response.status;
      error.responseText = errorText;
      throw error;
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Helper para hacer requests a Strapi
async function fetchStrapiAPI(store, endpoint, options = {}) {
  const apiUrl = `${store.strapiUrl}/api/${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (store.strapiToken) {
    headers['Authorization'] = `Bearer ${store.strapiToken}`;
  }

  try {
    const response = await fetch(apiUrl, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Strapi API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Obtener todos los items de un Content Type de Strapi
async function getAllStrapiItems(store, contentType) {
  const allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await fetchStrapiAPI(store, `${contentType}?pagination[page]=${page}&pagination[pageSize]=100`);
      const data = response.data || [];
      
      if (data.length === 0) {
        hasMore = false;
      } else {
        allItems.push(...data);
        hasMore = data.length === 100;
        page++;
      }
    } catch (error) {
      console.error(`   ⚠️  Error obteniendo ${contentType}:`, error.message);
      hasMore = false;
    }
  }

  return allItems;
}

// Obtener o crear atributo en WooCommerce
async function getOrCreateAttribute(store, attributeName, slug) {
  // Buscar atributo existente
  try {
    const attributes = await fetchWooAPI(store, `products/attributes`);
    // Buscar por nombre o slug (case insensitive)
    // Priorizar búsqueda por slug (más confiable)
    let attribute = attributes.find(attr => 
      (attr.slug && attr.slug.toLowerCase() === slug.toLowerCase()) ||
      attr.slug === slug
    );
    // Si no se encuentra por slug, buscar por nombre
    if (!attribute) {
      attribute = attributes.find(attr => 
        attr.name && attr.name.toLowerCase() === attributeName.toLowerCase()
      );
    }

    if (!attribute) {
      try {
        // Crear atributo
        const auth = Buffer.from(`${store.consumerKey}:${store.consumerSecret}`).toString('base64');
        const apiUrl = `${store.url}/wp-json/wc/v3/products/attributes`;
        
        const createResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: attributeName,
            slug: slug,
            type: 'select',
            has_archives: true,
          }),
        });

        if (createResponse.ok) {
          attribute = await createResponse.json();
          console.log(`   ✅ Atributo "${attributeName}" creado (ID: ${attribute.id})`);
        } else {
          // Si falla (probablemente por slug duplicado), buscar de nuevo
          const errorText = await createResponse.text();
          const errorMsg = errorText || '';
          
          if (createResponse.status === 400 && (errorMsg.includes('slug') || errorMsg.includes('ya está utilizando'))) {
            // Buscar de nuevo - el atributo ya existe con ese slug
            const attributes2 = await fetchWooAPI(store, `products/attributes`);
            // Buscar por slug primero (más confiable)
            attribute = attributes2.find(attr => 
              attr.slug === slug || 
              (attr.slug && attr.slug.toLowerCase() === slug.toLowerCase())
            );
            if (attribute) {
              console.log(`   ✅ Atributo con slug "${slug}" encontrado (ID: ${attribute.id}, nombre: ${attribute.name})`);
            } else {
              // Si no se encuentra por slug, buscar por nombre
              attribute = attributes2.find(attr => 
                attr.name && attr.name.toLowerCase() === attributeName.toLowerCase()
              );
              if (attribute) {
                console.log(`   ✅ Atributo "${attributeName}" encontrado por nombre (ID: ${attribute.id}, slug: ${attribute.slug})`);
              } else {
                // Como último recurso, mostrar advertencia y continuar sin este atributo
                console.warn(`   ⚠️  No se pudo crear ni encontrar atributo "${attributeName}" con slug "${slug}"`);
                console.warn(`   ⚠️  Atributos disponibles: ${attributes2.map(a => `${a.name}(${a.slug})`).join(', ')}`);
                console.warn(`   ⚠️  Continuando sin este atributo...`);
                // Retornar null en lugar de lanzar error
                return null;
              }
            }
          } else {
            throw new Error(`WooCommerce API error: ${createResponse.status} ${errorText}`);
          }
        }
      } catch (createError) {
        // Si es un error de red u otro, buscar de nuevo por si acaso
        try {
          const attributes2 = await fetchWooAPI(store, `products/attributes`);
          attribute = attributes2.find(attr => 
            attr.name.toLowerCase() === attributeName.toLowerCase() || 
            attr.slug === slug
          );
          if (attribute) {
            console.log(`   ✅ Atributo "${attributeName}" encontrado después de error (ID: ${attribute.id})`);
          } else {
            throw createError;
          }
        } catch {
          throw createError;
        }
      }
    } else {
      console.log(`   ✅ Atributo "${attributeName}" encontrado (ID: ${attribute.id})`);
    }

    return attribute;
  } catch (error) {
    console.error(`   ❌ Error con atributo "${attributeName}":`, error.message);
    throw error;
  }
}

// Obtener o crear término de atributo
async function getOrCreateAttributeTerm(store, attributeId, termName) {
  if (!termName || termName.trim() === '') {
    return null;
  }

  // Buscar término existente
  try {
    const terms = await fetchWooAPI(store, `products/attributes/${attributeId}/terms`);
    let term = terms.find(t => t.name === termName);

    if (!term) {
      // Crear término
      const slug = termName.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      term = await fetchWooAPI(store, `products/attributes/${attributeId}/terms`, {
        method: 'POST',
        body: {
          name: termName,
          slug: slug,
        },
      });
      console.log(`      ✅ Término "${termName}" creado`);
    }

    return term;
  } catch (error) {
    console.error(`      ⚠️  Error creando término "${termName}":`, error.message);
    return null;
  }
}

// Obtener o crear brand en WooCommerce
async function getOrCreateBrand(store, brandName) {
  if (!brandName || brandName.trim() === '') {
    return null;
  }

  try {
    // Buscar brand existente
    const brands = await fetchWooAPI(store, `products/brands`);
    let brand = brands.find(b => b.name === brandName);

    if (!brand) {
      // Crear brand
      const slug = brandName.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      brand = await fetchWooAPI(store, 'products/brands', {
        method: 'POST',
        body: {
          name: brandName,
          slug: slug,
        },
      });
      console.log(`   ✅ Brand "${brandName}" creado (ID: ${brand.id})`);
    } else {
      console.log(`   ✅ Brand "${brandName}" encontrado (ID: ${brand.id})`);
    }

    return brand;
  } catch (error) {
    if (error.message.includes('404')) {
      console.log(`   ⚠️  Plugin de brands no instalado, saltando brands`);
      return null;
    }
    console.error(`   ⚠️  Error con brand "${brandName}":`, error.message);
    return null;
  }
}

// PASO 1: Sincronizar todos los Autores
async function syncAutores(store) {
  console.log(`\n👤 Sincronizando AUTORES desde Strapi...`);
  
  const autores = await getAllStrapiItems(store, 'autores');
  console.log(`   📚 ${autores.length} autores encontrados en Strapi`);

  if (autores.length === 0) {
    console.log(`   ⚠️  No hay autores en Strapi`);
    return { attributeId: null, terms: {} };
  }

  // Crear atributo "Autor" si no existe
  const autorAttr = await getOrCreateAttribute(store, 'Autor', 'autor');
  
  // Crear términos para cada autor
  const terms = {};
  for (const autor of autores) {
    const nombre = autor.nombre_completo_autor || autor.nombre || 'Sin nombre';
    const term = await getOrCreateAttributeTerm(store, autorAttr.id, nombre);
    if (term) {
      terms[nombre] = term.id;
    }
  }

  console.log(`   ✅ ${Object.keys(terms).length} términos de Autor sincronizados`);
  return { attributeId: autorAttr.id, terms };
}

// PASO 2: Sincronizar todas las Editoriales
async function syncEditoriales(store) {
  console.log(`\n🏢 Sincronizando EDITORIALES desde Strapi...`);
  
  const editoriales = await getAllStrapiItems(store, 'editoriales');
  console.log(`   📚 ${editoriales.length} editoriales encontradas en Strapi`);

  if (editoriales.length === 0) {
    console.log(`   ⚠️  No hay editoriales en Strapi`);
    return { attributeId: null, terms: {}, brands: {} };
  }

  // Crear atributo "Editorial" si no existe
  const editorialAttr = await getOrCreateAttribute(store, 'Editorial', 'editorial');
  
  // Crear términos y brands para cada editorial
  const terms = {};
  const brands = {};
  
  for (const editorial of editoriales) {
    const nombre = editorial.nombre_editorial || editorial.nombre || 'Sin nombre';
    
    // Crear término de atributo
    const term = await getOrCreateAttributeTerm(store, editorialAttr.id, nombre);
    if (term) {
      terms[nombre] = term.id;
    }

    // Crear brand
    const brand = await getOrCreateBrand(store, nombre);
    if (brand) {
      brands[nombre] = brand.id;
    }
  }

  console.log(`   ✅ ${Object.keys(terms).length} términos de Editorial sincronizados`);
  console.log(`   ✅ ${Object.keys(brands).length} brands de Editorial sincronizados`);
  return { attributeId: editorialAttr.id, terms, brands };
}

// PASO 3: Sincronizar todos los Sellos
async function syncSellos(store) {
  console.log(`\n🏷️  Sincronizando SELLOS desde Strapi...`);
  
  const sellos = await getAllStrapiItems(store, 'sellos');
  console.log(`   📚 ${sellos.length} sellos encontrados en Strapi`);

  if (sellos.length === 0) {
    console.log(`   ⚠️  No hay sellos en Strapi`);
    return { attributeId: null, terms: {} };
  }

  // Crear atributo "Sello" si no existe
  const selloAttr = await getOrCreateAttribute(store, 'Sello', 'sello');
  
  // Crear términos para cada sello
  const terms = {};
  for (const sello of sellos) {
    const nombre = sello.nombre_sello || sello.nombre || 'Sin nombre';
    const term = await getOrCreateAttributeTerm(store, selloAttr.id, nombre);
    if (term) {
      terms[nombre] = term.id;
    }
  }

  console.log(`   ✅ ${Object.keys(terms).length} términos de Sello sincronizados`);
  return { attributeId: selloAttr.id, terms };
}

// PASO 4: Sincronizar todas las Colecciones
async function syncColecciones(store) {
  console.log(`\n📚 Sincronizando COLECCIONES desde Strapi...`);
  
  const colecciones = await getAllStrapiItems(store, 'coleccions');
  console.log(`   📚 ${colecciones.length} colecciones encontradas en Strapi`);

  if (colecciones.length === 0) {
    console.log(`   ⚠️  No hay colecciones en Strapi`);
    return { attributeId: null, terms: {} };
  }

  // Crear atributo "Colección" si no existe
  const coleccionAttr = await getOrCreateAttribute(store, 'Colección', 'coleccion');
  
  // Crear términos para cada colección
  const terms = {};
  for (const coleccion of colecciones) {
    const nombre = coleccion.nombre_coleccion || coleccion.nombre || 'Sin nombre';
    const term = await getOrCreateAttributeTerm(store, coleccionAttr.id, nombre);
    if (term) {
      terms[nombre] = term.id;
    }
  }

  console.log(`   ✅ ${Object.keys(terms).length} términos de Colección sincronizados`);
  return { attributeId: coleccionAttr.id, terms };
}

// PASO 5: Sincronizar todas las Obras
async function syncObras(store) {
  console.log(`\n📖 Sincronizando OBRAS desde Strapi...`);
  
  const obras = await getAllStrapiItems(store, 'obras');
  console.log(`   📚 ${obras.length} obras encontradas en Strapi`);

  if (obras.length === 0) {
    console.log(`   ⚠️  No hay obras en Strapi`);
    return { attributeId: null, terms: {} };
  }

  // Crear atributo "Obra" si no existe
  const obraAttr = await getOrCreateAttribute(store, 'Obra', 'obra');
  
  // Crear términos para cada obra
  const terms = {};
  for (const obra of obras) {
    const nombre = obra.nombre_obra || obra.nombre || 'Sin nombre';
    const term = await getOrCreateAttributeTerm(store, obraAttr.id, nombre);
    if (term) {
      terms[nombre] = term.id;
    }
  }

  console.log(`   ✅ ${Object.keys(terms).length} términos de Obra sincronizados`);
  return { attributeId: obraAttr.id, terms };
}


// PASO 6: Asignar términos y meta_data a productos existentes en WooCommerce
async function asignarTerminosAProductos(store, libros, estructura, platform) {
  console.log(`\n🔗 Asignando términos a productos en WooCommerce...`);
  
  let updatedCount = 0;
  let skippedCount = 0;

  for (const libro of libros) {
    const wooId = libro.externalIds?.[platform];
    if (!wooId) {
      skippedCount++;
      continue;
    }

    const updateData = {
      attributes: [],
      brands: [],
      meta_data: [],
    };

    // META_DATA: Campos del libro
    if (libro.isbn_libro) {
      updateData.meta_data.push({ key: 'isbn', value: String(libro.isbn_libro) });
    }
    if (libro.numero_edicion) {
      updateData.meta_data.push({ key: 'numero_edicion', value: String(libro.numero_edicion) });
    }
    if (libro.agno_edicion) {
      updateData.meta_data.push({ key: 'agno_edicion', value: String(libro.agno_edicion) });
    }
    if (libro.estado_edicion) {
      updateData.meta_data.push({ key: 'estado_edicion', value: String(libro.estado_edicion) });
    }

    // Autor
    if (libro.autor_relacion && estructura.autores.attributeId) {
      const nombreAutor = libro.autor_relacion.nombre_completo_autor || libro.autor_relacion.nombre;
      if (nombreAutor && estructura.autores.terms[nombreAutor]) {
        updateData.attributes.push({
          id: estructura.autores.attributeId,
          name: 'Autor',
          options: [nombreAutor],
          visible: true,
          variation: false,
        });
      }
    }

    // Editorial
    if (libro.editorial && estructura.editoriales.attributeId) {
      const nombreEditorial = libro.editorial.nombre_editorial || libro.editorial.nombre;
      if (nombreEditorial && estructura.editoriales.terms[nombreEditorial]) {
        updateData.attributes.push({
          id: estructura.editoriales.attributeId,
          name: 'Editorial',
          options: [nombreEditorial],
          visible: true,
          variation: false,
        });

        // También como brand
        if (estructura.editoriales.brands[nombreEditorial]) {
          updateData.brands.push({ id: estructura.editoriales.brands[nombreEditorial] });
        }
      }
    }

    // Sello
    if (libro.sello && estructura.sellos.attributeId) {
      const nombreSello = libro.sello.nombre_sello || libro.sello.nombre;
      if (nombreSello && estructura.sellos.terms[nombreSello]) {
        updateData.attributes.push({
          id: estructura.sellos.attributeId,
          name: 'Sello',
          options: [nombreSello],
          visible: true,
          variation: false,
        });
      }
    }

    // Colección
    if (libro.coleccion && estructura.colecciones.attributeId) {
      const nombreColeccion = libro.coleccion.nombre_coleccion || libro.coleccion.nombre;
      if (nombreColeccion && estructura.colecciones.terms[nombreColeccion]) {
        updateData.attributes.push({
          id: estructura.colecciones.attributeId,
          name: 'Colección',
          options: [nombreColeccion],
          visible: true,
          variation: false,
        });
      }
    }

    // Obra
    if (libro.obra && estructura.obras.attributeId) {
      const nombreObra = libro.obra.nombre_obra || libro.obra.nombre;
      if (nombreObra && estructura.obras.terms[nombreObra]) {
        updateData.attributes.push({
          id: estructura.obras.attributeId,
          name: 'Obra',
          options: [nombreObra],
          visible: true,
          variation: false,
        });
      }
    }

    // Idioma (enumeration → atributo)
    if (libro.idioma) {
      // Buscar o crear atributo "Idioma"
      const idiomaAttr = await getOrCreateAttribute(store, 'Idioma', 'idioma');
      const idiomaTerm = await getOrCreateAttributeTerm(store, idiomaAttr.id, libro.idioma);
      if (idiomaTerm) {
        updateData.attributes.push({
          id: idiomaAttr.id,
          name: 'Idioma',
          options: [libro.idioma],
          visible: true,
          variation: false,
        });
      }
      // También en meta_data
      updateData.meta_data.push({ key: 'idioma', value: String(libro.idioma) });
    }

    // Tipo Libro (enumeration → atributo)
    if (libro.tipo_libro) {
      // Buscar o crear atributo "Tipo Libro"
      const tipoLibroAttr = await getOrCreateAttribute(store, 'Tipo Libro', 'tipo-libro');
      const tipoLibroTerm = await getOrCreateAttributeTerm(store, tipoLibroAttr.id, libro.tipo_libro);
      if (tipoLibroTerm) {
        updateData.attributes.push({
          id: tipoLibroAttr.id,
          name: 'Tipo Libro',
          options: [libro.tipo_libro],
          visible: true,
          variation: false,
        });
      }
      // También en meta_data
      updateData.meta_data.push({ key: 'tipo_libro', value: String(libro.tipo_libro) });
    }

    // Estado Edición (enumeration → atributo)
    if (libro.estado_edicion) {
      // Buscar o crear atributo "Estado Edición"
      const estadoAttr = await getOrCreateAttribute(store, 'Estado Edición', 'estado-edicion');
      if (estadoAttr && estadoAttr.id) {
        const estadoTerm = await getOrCreateAttributeTerm(store, estadoAttr.id, libro.estado_edicion);
        if (estadoTerm) {
          updateData.attributes.push({
            id: estadoAttr.id,
            name: 'Estado Edición',
            options: [libro.estado_edicion],
            visible: true,
            variation: false,
          });
        }
      }
      // También en meta_data
      updateData.meta_data.push({ key: 'estado_edicion', value: String(libro.estado_edicion) });
    }

    // Solo actualizar si hay atributos, brands o meta_data para asignar
    if (updateData.attributes.length > 0 || updateData.brands.length > 0 || updateData.meta_data.length > 0) {
      try {
        await fetchWooAPI(store, `products/${wooId}`, {
          method: 'PUT',
          body: updateData,
        });
        updatedCount++;
      } catch (error) {
        console.error(`   ⚠️  Error actualizando producto ${wooId}:`, error.message);
      }
    }
  }

  console.log(`   ✅ ${updatedCount} productos actualizados`);
  console.log(`   ⏭️  ${skippedCount} productos sin ID de WooCommerce (saltados)`);
}

// Función principal
async function configurarWooCommerce(storeKey) {
  const store = STORES[storeKey];
  const platform = PLATFORM_MAP[storeKey];
  
  if (!store) {
    console.error(`❌ Tienda "${storeKey}" no encontrada`);
    process.exit(1);
  }

  if (!store.consumerKey || !store.consumerSecret) {
    console.error(`❌ Faltan credenciales de WooCommerce para ${store.name}`);
    process.exit(1);
  }

  if (!store.strapiUrl) {
    console.error(`❌ Falta STRAPI_URL en variables de entorno`);
    process.exit(1);
  }

  console.log(`\n🚀 Configurando WooCommerce desde estructura de Strapi`);
  console.log(`   Tienda: ${store.name}`);
  console.log(`   Platform: ${platform}`);
  console.log(`   Strapi: ${store.strapiUrl}\n`);

  // PASO 1-5: Sincronizar estructura completa basada en relaciones de Libro
  console.log(`\n📋 Sincronizando estructura completa basada en relaciones de Libro...\n`);
  
  const estructura = {
    autores: await syncAutores(store),
    editoriales: await syncEditoriales(store),
    sellos: await syncSellos(store),
    colecciones: await syncColecciones(store),
    obras: await syncObras(store),
  };

  // PASO 6: Obtener libros y asignar términos y meta_data
  console.log(`\n📚 Obteniendo libros de Strapi para asignar términos...`);
  const libros = await getAllStrapiItems(store, 'libros?populate=*');
  console.log(`   ✅ ${libros.length} libros obtenidos`);

  // Asignar términos a productos
  await asignarTerminosAProductos(store, libros, estructura, platform);

  console.log(`\n\n✅ ¡Configuración completada!`);
  console.log(`   📊 Estructura sincronizada desde Strapi a WooCommerce`);
  console.log(`   🔗 Términos asignados a productos existentes\n`);
}

// Ejecutar
const storeKey = process.argv[2];

if (!storeKey) {
  console.error('❌ Uso: node scripts/configurar-woocommerce-desde-estructura-strapi.mjs <tienda>');
  console.error('   Ejemplo: node scripts/configurar-woocommerce-desde-estructura-strapi.mjs moraleja');
  console.error('   Ejemplo: node scripts/configurar-woocommerce-desde-estructura-strapi.mjs escolar');
  process.exit(1);
}

configurarWooCommerce(storeKey).catch(error => {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});

