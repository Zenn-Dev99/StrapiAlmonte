#!/usr/bin/env node

/**
 * Script completo para probar productos (libros) y su sincronización con WooCommerce
 * Prueba: Create, Read, Update, Delete y sincronización a WooCommerce
 */

import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.STRAPI_API_KEY || process.argv[2];

if (!STRAPI_TOKEN) {
  console.error('❌ Error: STRAPI_TOKEN no está configurado');
  process.exit(1);
}

const STRAPI_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${STRAPI_TOKEN}`,
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function strapiRequest(path, options = {}) {
  const { method = 'GET', body } = options;
  const res = await fetch(`${STRAPI_URL}/api${path}`, {
    method,
    headers: STRAPI_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strapi ${method} ${path} -> ${res.status}: ${text.substring(0, 500)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ==================== CREAR RECURSOS NECESARIOS ====================
async function crearRecursosNecesarios() {
  log('\n' + '='.repeat(70), 'magenta');
  log('🔧 CREANDO RECURSOS NECESARIOS', 'magenta');
  log('='.repeat(70), 'magenta');
  
  const timestamp = Date.now();
  const recursos = {};
  
  try {
    // 1. Crear Autor
    log('\n1. Creando Autor...', 'cyan');
    const autor = await strapiRequest('/autores', {
      method: 'POST',
      body: {
        data: {
          nombre_completo_autor: `Autor Test Producto ${timestamp}`,
          publishedAt: new Date().toISOString(),
        },
      },
    });
    recursos.autorId = autor?.data?.documentId || autor?.data?.id;
    log(`   ✅ Autor creado: ${recursos.autorId}`, 'green');
    await wait(2000); // Esperar sincronización
    
    // 2. Crear Editorial
    log('\n2. Creando Editorial...', 'cyan');
    const editoriales = await strapiRequest('/editoriales?pagination[pageSize]=1&sort=id_editorial:desc');
    let maxIdEditorial = 1000000;
    if (editoriales?.data?.[0]) {
      const ed = editoriales.data[0];
      const attrs = ed.attributes || ed;
      maxIdEditorial = (attrs.id_editorial || 0) + 1;
    }
    const editorial = await strapiRequest('/editoriales', {
      method: 'POST',
      body: {
        data: {
          nombre_editorial: `Editorial Test Producto ${timestamp}`,
          id_editorial: maxIdEditorial,
          publishedAt: new Date().toISOString(),
        },
      },
    });
    recursos.editorialId = editorial?.data?.documentId || editorial?.data?.id;
    log(`   ✅ Editorial creada: ${recursos.editorialId}`, 'green');
    await wait(2000); // Esperar sincronización
    
    // 3. Crear Marca
    log('\n3. Creando Marca...', 'cyan');
    const marca = await strapiRequest('/marcas', {
      method: 'POST',
      body: {
        data: {
          name: `Marca Test ${timestamp}`,
          descripcion: 'Descripción de marca de prueba',
          publishedAt: new Date().toISOString(),
        },
      },
    });
    recursos.marcaId = marca?.data?.documentId || marca?.data?.id;
    log(`   ✅ Marca creada: ${recursos.marcaId}`, 'green');
    await wait(2000); // Esperar sincronización
    
    // 4. Crear Etiqueta (opcional - puede fallar por errores 502)
    log('\n4. Creando Etiqueta...', 'cyan');
    try {
      const etiqueta = await strapiRequest('/etiquetas', {
        method: 'POST',
        body: {
          data: {
            name: `Etiqueta Test ${timestamp}`,
            descripcion: 'Descripción de etiqueta de prueba',
            publishedAt: new Date().toISOString(),
          },
        },
      });
      recursos.etiquetaId = etiqueta?.data?.documentId || etiqueta?.data?.id;
      log(`   ✅ Etiqueta creada: ${recursos.etiquetaId}`, 'green');
      await wait(2000); // Esperar sincronización
    } catch (error) {
      log(`   ⚠️  No se pudo crear etiqueta (puede ser error temporal del servidor): ${error.message.substring(0, 100)}`, 'yellow');
      log(`   Continuando sin etiqueta...`, 'yellow');
      recursos.etiquetaId = null;
    }
    
    // 5. Crear Categoría (opcional - puede fallar)
    log('\n5. Creando Categoría...', 'cyan');
    try {
      const categoria = await strapiRequest('/categoria-productos', {
        method: 'POST',
        body: {
          data: {
            name: `Categoría Test ${timestamp}`,
            descripcion: 'Descripción de categoría de prueba',
            tipo_visualizacion: 'default',
            publishedAt: new Date().toISOString(),
          },
        },
      });
      recursos.categoriaId = categoria?.data?.documentId || categoria?.data?.id;
      log(`   ✅ Categoría creada: ${recursos.categoriaId}`, 'green');
      await wait(2000); // Esperar sincronización
    } catch (error) {
      log(`   ⚠️  No se pudo crear categoría: ${error.message}`, 'yellow');
      log(`   Continuando sin categoría...`, 'yellow');
      recursos.categoriaId = null;
    }
    
    // 6. Buscar o crear Canal
    log('\n6. Buscando Canal "moraleja"...', 'cyan');
    let canalId;
    try {
      const canales = await strapiRequest('/canales?filters[key][$eq]=moraleja&pagination[limit]=1');
      if (canales?.data?.[0]) {
        canalId = canales.data[0].documentId || canales.data[0].id;
        log(`   ✅ Canal encontrado: ${canalId}`, 'green');
      } else {
        log(`   ⚠️  Canal no encontrado, el libro no se sincronizará sin canal`, 'yellow');
      }
    } catch (error) {
      log(`   ⚠️  Error buscando canal: ${error.message}`, 'yellow');
    }
    recursos.canalId = canalId;
    
    return recursos;
  } catch (error) {
    log(`   ❌ Error creando recursos: ${error.message}`, 'red');
    throw error;
  }
}

// ==================== TEST CREATE LIBRO ====================
async function testCreateLibro(recursos) {
  log('\n' + '='.repeat(70), 'magenta');
  log('📖 TEST: CREATE LIBRO', 'magenta');
  log('='.repeat(70), 'magenta');
  
  const timestamp = Date.now();
  let libroId;
  
  try {
    log('\n📝 Creando libro con todas las relaciones...', 'cyan');
    const libro = await strapiRequest('/libros', {
      method: 'POST',
      body: {
        data: {
          isbn_libro: `978${timestamp.toString().slice(-10)}`,
          nombre_libro: `Libro Test Producto ${timestamp}`,
          subtitulo_libro: 'Subtítulo de prueba',
          autor_relacion: recursos.autorId,
          editorial: recursos.editorialId,
          marcas: [recursos.marcaId],
          ...(recursos.etiquetaId ? { etiquetas: [recursos.etiquetaId] } : {}),
          ...(recursos.categoriaId ? { categorias_producto: [recursos.categoriaId] } : {}),
          canales: recursos.canalId ? [recursos.canalId] : [],
          tipo_libro: 'Texto Curricular',
          estado_edicion: 'Vigente',
          idioma: 'Español',
          publishedAt: new Date().toISOString(),
        },
      },
    });
    
    libroId = libro?.data?.documentId || libro?.data?.id;
    log(`   ✅ Libro creado: ${libroId}`, 'green');
    log(`   - ISBN: ${libro?.data?.attributes?.isbn_libro || libro?.data?.isbn_libro}`, 'blue');
    log(`   - Nombre: ${libro?.data?.attributes?.nombre_libro || libro?.data?.nombre_libro}`, 'blue');
    
    // Esperar procesamiento de lifecycles
    log('\n⏳ Esperando procesamiento de lifecycles y sincronización...', 'cyan');
    await wait(5000);
    
    // Verificar libro completo
    log('\n🔍 Verificando libro completo...', 'cyan');
    const libroCompleto = await strapiRequest(
      `/libros/${libroId}?populate[autor_relacion]=true&populate[editorial]=true&populate[marcas]=true&populate[etiquetas]=true&populate[categorias_producto]=true&populate[canales]=true`
    );
    
    const attrs = libroCompleto?.data?.attributes || libroCompleto?.data || {};
    log(`   ✅ Libro obtenido correctamente`, 'green');
    log(`   - Autor: ${attrs.autor_relacion ? '✅ Sí' : '❌ No'}`, attrs.autor_relacion ? 'green' : 'red');
    log(`   - Editorial: ${attrs.editorial ? '✅ Sí' : '❌ No'}`, attrs.editorial ? 'green' : 'red');
    log(`   - Marcas: ${attrs.marcas?.length || 0}`, attrs.marcas?.length > 0 ? 'green' : 'yellow');
    log(`   - Etiquetas: ${attrs.etiquetas?.length || 0}`, attrs.etiquetas?.length > 0 ? 'green' : 'yellow');
    log(`   - Categorías: ${attrs.categorias_producto?.length || 0}`, attrs.categorias_producto?.length > 0 ? 'green' : 'yellow');
    log(`   - Canales: ${attrs.canales?.length || 0}`, attrs.canales?.length > 0 ? 'green' : 'yellow');
    log(`   - ExternalIds: ${attrs.externalIds ? JSON.stringify(attrs.externalIds) : 'N/A'}`, 'blue');
    
    return { success: true, id: libroId, libro: attrs };
  } catch (error) {
    log(`   ❌ Error creando libro: ${error.message}`, 'red');
    return { success: false, id: libroId, error: error.message };
  }
}

// ==================== TEST UPDATE LIBRO ====================
async function testUpdateLibro(libroId) {
  log('\n' + '='.repeat(70), 'magenta');
  log('✏️  TEST: UPDATE LIBRO', 'magenta');
  log('='.repeat(70), 'magenta');
  
  try {
    log('\n📝 Actualizando libro...', 'cyan');
    const libroActualizado = await strapiRequest(`/libros/${libroId}`, {
      method: 'PUT',
      body: {
        data: {
          subtitulo_libro: 'Subtítulo actualizado',
          tipo_libro: 'Texto Complementario',
        },
      },
    });
    
    log(`   ✅ Libro actualizado`, 'green');
    const attrs = libroActualizado?.data?.attributes || libroActualizado?.data || {};
    log(`   - Subtítulo: ${attrs.subtitulo_libro}`, 'blue');
    log(`   - Tipo: ${attrs.tipo_libro}`, 'blue');
    
    // Esperar sincronización
    log('\n⏳ Esperando sincronización...', 'cyan');
    await wait(3000);
    
    // Verificar externalIds después de actualización
    const libroVerificado = await strapiRequest(`/libros/${libroId}`);
    const attrsVerif = libroVerificado?.data?.attributes || libroVerificado?.data || {};
    log(`   - ExternalIds después de update: ${attrsVerif.externalIds ? JSON.stringify(attrsVerif.externalIds) : 'N/A'}`, 'blue');
    
    return { success: true };
  } catch (error) {
    log(`   ❌ Error actualizando libro: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// ==================== VERIFICAR SINCRONIZACIÓN WOOCOMMERCE ====================
async function verificarSincronizacionWooCommerce(libroId) {
  log('\n' + '='.repeat(70), 'magenta');
  log('🔄 VERIFICANDO SINCRONIZACIÓN WOOCOMMERCE', 'magenta');
  log('='.repeat(70), 'magenta');
  
  try {
    log('\n🔍 Obteniendo libro con externalIds...', 'cyan');
    const libro = await strapiRequest(`/libros/${libroId}`);
    const attrs = libro?.data?.attributes || libro?.data || {};
    const externalIds = attrs.externalIds || {};
    
    log(`   - ExternalIds: ${JSON.stringify(externalIds)}`, 'blue');
    
    const plataformas = ['woo_moraleja', 'woo_escolar'];
    const resultados = {};
    
    for (const platform of plataformas) {
      const wooId = externalIds[platform];
      if (wooId) {
        log(`\n   ✅ ${platform}: ID ${wooId}`, 'green');
        resultados[platform] = { existe: true, id: wooId };
      } else {
        log(`\n   ⚠️  ${platform}: No sincronizado aún`, 'yellow');
        resultados[platform] = { existe: false };
      }
    }
    
    // Verificar relaciones sincronizadas
    log('\n🔍 Verificando sincronización de relaciones...', 'cyan');
    
    if (attrs.autor_relacion) {
      const autorExtIds = (typeof attrs.autor_relacion === 'object' ? attrs.autor_relacion.externalIds : null) || {};
      log(`   - Autor externalIds: ${JSON.stringify(autorExtIds)}`, Object.keys(autorExtIds).length > 0 ? 'green' : 'yellow');
    }
    
    if (attrs.editorial) {
      const editorialExtIds = (typeof attrs.editorial === 'object' ? attrs.editorial.externalIds : null) || {};
      log(`   - Editorial externalIds: ${JSON.stringify(editorialExtIds)}`, Object.keys(editorialExtIds).length > 0 ? 'green' : 'yellow');
    }
    
    return resultados;
  } catch (error) {
    log(`   ❌ Error verificando sincronización: ${error.message}`, 'red');
    return null;
  }
}

// ==================== LIMPIAR RECURSOS ====================
async function limpiarRecursos(recursos, libroId) {
  log('\n' + '='.repeat(70), 'magenta');
  log('🧹 LIMPIANDO RECURSOS', 'magenta');
  log('='.repeat(70), 'magenta');
  
  const limpiados = [];
  
  try {
    // Eliminar libro primero
    if (libroId) {
      log(`\n🗑️  Eliminando libro ${libroId}...`, 'cyan');
      try {
        await strapiRequest(`/libros/${libroId}`, { method: 'DELETE' });
        log(`   ✅ Libro eliminado`, 'green');
        limpiados.push('libro');
        await wait(2000);
      } catch (error) {
        log(`   ⚠️  Error eliminando libro: ${error.message}`, 'yellow');
      }
    }
    
    // Eliminar recursos relacionados
    const recursosEliminar = [
      recursos.categoriaId && { id: recursos.categoriaId, tipo: 'categoria-productos', nombre: 'Categoría' },
      recursos.etiquetaId && { id: recursos.etiquetaId, tipo: 'etiquetas', nombre: 'Etiqueta' },
      recursos.marcaId && { id: recursos.marcaId, tipo: 'marcas', nombre: 'Marca' },
      recursos.editorialId && { id: recursos.editorialId, tipo: 'editoriales', nombre: 'Editorial' },
      recursos.autorId && { id: recursos.autorId, tipo: 'autores', nombre: 'Autor' },
    ].filter(Boolean);
    
    for (const recurso of recursosEliminar) {
      if (recurso.id) {
        log(`\n🗑️  Eliminando ${recurso.nombre} ${recurso.id}...`, 'cyan');
        try {
          await strapiRequest(`/${recurso.tipo}/${recurso.id}`, { method: 'DELETE' });
          log(`   ✅ ${recurso.nombre} eliminado`, 'green');
          limpiados.push(recurso.nombre.toLowerCase());
          await wait(1000);
        } catch (error) {
          log(`   ⚠️  Error eliminando ${recurso.nombre}: ${error.message}`, 'yellow');
        }
      }
    }
    
    log(`\n✅ Recursos limpiados: ${limpiados.join(', ')}`, 'green');
    return limpiados;
  } catch (error) {
    log(`   ❌ Error en limpieza: ${error.message}`, 'red');
    return limpiados;
  }
}

// ==================== MAIN ====================
async function main() {
  log('\n' + '='.repeat(70), 'bold');
  log('🚀 TEST COMPLETO: PRODUCTO Y SINCRONIZACIÓN WOOCOMMERCE', 'bold');
  log('='.repeat(70), 'bold');
  
  const recursos = {};
  let libroId = null;
  const resultados = {
    create: null,
    update: null,
    sincronizacion: null,
  };
  
  try {
    // 1. Crear recursos necesarios
    Object.assign(recursos, await crearRecursosNecesarios());
    
    // 2. Test CREATE
    const resultadoCreate = await testCreateLibro(recursos);
    resultados.create = resultadoCreate;
    if (!resultadoCreate.success) {
      log('\n⚠️  CREATE falló, no se puede continuar con UPDATE', 'yellow');
    } else {
      libroId = resultadoCreate.id;
      
      // 3. Verificar sincronización
      resultados.sincronizacion = await verificarSincronizacionWooCommerce(libroId);
      
      // 4. Test UPDATE
      resultados.update = await testUpdateLibro(libroId);
      
      // 5. Verificar sincronización después de UPDATE
      log('\n🔄 Verificando sincronización después de UPDATE...', 'cyan');
      await verificarSincronizacionWooCommerce(libroId);
    }
    
    // 6. Resumen
    log('\n' + '='.repeat(70), 'magenta');
    log('📊 RESUMEN DE PRUEBAS', 'magenta');
    log('='.repeat(70), 'magenta');
    log(`\n✅ CREATE: ${resultados.create?.success ? 'PASÓ' : 'FALLÓ'}`, resultados.create?.success ? 'green' : 'red');
    log(`✅ UPDATE: ${resultados.update?.success ? 'PASÓ' : 'FALLÓ'}`, resultados.update?.success ? 'green' : 'red');
    if (resultados.sincronizacion) {
      const platforms = Object.keys(resultados.sincronizacion);
      platforms.forEach(platform => {
        const res = resultados.sincronizacion[platform];
        log(`✅ ${platform}: ${res.existe ? `Sincronizado (ID: ${res.id})` : 'No sincronizado'}`, res.existe ? 'green' : 'yellow');
      });
    }
    
    const todosPasaron = resultados.create?.success && resultados.update?.success;
    log(`\n${todosPasaron ? '✅' : '⚠️'} RESULTADO GENERAL: ${todosPasaron ? 'TODAS LAS PRUEBAS PASARON' : 'ALGUNAS PRUEBAS FALLARON'}`, todosPasaron ? 'green' : 'yellow');
    
  } catch (error) {
    log(`\n❌ ERROR GENERAL: ${error.message}`, 'red');
    console.error(error);
  } finally {
    // Limpiar recursos
    await limpiarRecursos(recursos, libroId);
    log('\n✅ Test completado', 'green');
  }
}

main().catch(console.error);
