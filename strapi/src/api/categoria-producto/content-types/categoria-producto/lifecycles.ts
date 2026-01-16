/**
 * Lifecycles para sincronización automática de Categorías de Producto a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza una categoría
 */

function shouldSync(): boolean {
  if (!strapi) {
    return false;
  }
  
  if (process.env.DISABLE_WOO_SYNC === 'true' || process.env.SKIP_WOO_SYNC === 'true') {
    return false;
  }
  
  try {
    if (!strapi.service('api::woo-sync.woo-sync')) {
      return false;
    }
  } catch (error) {
    return false;
  }
  
  return true;
}

// Helper para sincronizar categoría individual a WooCommerce (usar método unificado del servicio)
async function syncCategoriaToWooCommerce(categoria: any) {
  try {
    const wooSyncService = strapi.service('api::woo-sync.woo-sync');
    await wooSyncService.syncCategoryTerm(categoria);
  } catch (error) {
    strapi.log.error('[categoria-producto] ❌ Error sincronizando categoría a WooCommerce:', error);
  }
}

// Helper para eliminar categoría de WooCommerce (con protección robusta igual que atributos)
async function deleteCategoriaFromWooCommerce(categoria: any) {
  try {
    const wooSyncService = strapi.service('api::woo-sync.woo-sync');
    const platforms: ('woo_moraleja' | 'woo_escolar')[] = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      const wooConfig = wooSyncService.getWooConfig(platform);
      if (!wooConfig) continue;
      
      const externalIds = categoria.externalIds || {};
      const wooId = externalIds[platform];
      
      if (!wooId) {
        strapi.log.debug(`[categoria-producto] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
        continue;
      }
      
      const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
      
      // Eliminar categoría
      const deleteResponse = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/products/categories/${wooId}?force=true`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (deleteResponse.ok) {
        strapi.log.info(`[categoria-producto] ✅ Categoría eliminada de ${platform}: ${wooId}`);
      } else if (deleteResponse.status === 404) {
        strapi.log.info(`[categoria-producto] ⏭️  Categoría ${wooId} ya no existe en ${platform}, probablemente ya fue eliminada`);
      } else {
        const errorText = await deleteResponse.text().catch(() => '');
        strapi.log.warn(`[categoria-producto] ⚠️  No se pudo eliminar categoría ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
      }
    }
  } catch (error) {
    strapi.log.error('[categoria-producto] ❌ Error eliminando categoría de WooCommerce:', error);
  }
}

// Helper para sincronizar libros relacionados cuando cambia una categoría
async function syncLibrosRelacionados(categoria: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { categorias_producto: { id: categoria.id } } as any,
      populate: ['canales'],
    });
    
    for (const libro of libros) {
      const libroConCanales = libro as any;
      const hasWooChannel = libroConCanales.canales?.some((c: any) => 
        c.key === 'moraleja' || c.key === 'escolar'
      );
      
      if (hasWooChannel) {
        for (const canal of libroConCanales.canales || []) {
          if (canal.key === 'moraleja') {
            await strapi.service('api::woo-sync.woo-sync').syncProduct(libroConCanales, 'woo_moraleja');
          } else if (canal.key === 'escolar') {
            await strapi.service('api::woo-sync.woo-sync').syncProduct(libroConCanales, 'woo_escolar');
          }
        }
      }
    }
    
    if (libros.length > 0) {
      strapi.log.info(`[categoria-producto] ✅ ${libros.length} libro(s) relacionado(s) sincronizado(s)`);
    }
  } catch (error) {
    strapi.log.error('[categoria-producto] ❌ Error sincronizando libros relacionados:', error);
  }
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result.name) {
      return;
    }
    
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion === 'publicado') { // Only sync if published
      try {
        await syncCategoriaToWooCommerce(result);
        strapi.log.info(`[categoria-producto] ✅ Categoría "${result.name}" sincronizada a WooCommerce (tiempo real)`);
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[categoria-producto] ❌ Error sincronizando categoría a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[categoria-producto] ⏸️ Categoría "${result.name}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[categoria-producto] 🔍 afterUpdate ejecutado para categoría ${result?.id || 'sin id'} - nombre: "${result?.name || 'sin nombre'}"`);
    
    if (!shouldSync() || !result.name) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncCategoryTerm
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[categoria-producto] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion === 'publicado') { // Only sync if published
      try {
        await syncCategoriaToWooCommerce(result);
        strapi.log.info(`[categoria-producto] ✅ Categoría "${result.name}" sincronizada a WooCommerce (tiempo real)`);
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[categoria-producto] ❌ Error sincronizando categoría a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[categoria-producto] ⏸️ Categoría "${result.name}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result) {
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[categoria-producto] ⏭️  afterDelete ya procesado para categoría ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si la categoría realmente fue eliminada (puede ser draft/publish)
      if (result.documentId) {
        try {
          const categoriasConMismoDocumentId = await strapi.db.query('api::categoria-producto.categoria-producto').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (categoriasConMismoDocumentId.length > 0) {
            strapi.log.info(`[categoria-producto] ⏭️  afterDelete omitido: existen otras categorías con mismo documentId (${categoriasConMismoDocumentId.map((c: any) => c.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        } catch (error) {
          strapi.log.warn(`[categoria-producto] ⚠️  Error verificando categorías con mismo documentId: ${error}`);
        }
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const categoriaCompleta = await strapi.db.query('api::categoria-producto.categoria-producto').findOne({
            where: { id: result.id },
          });
          if (categoriaCompleta) {
            strapi.log.info(`[categoria-producto] ⏭️  afterDelete omitido: categoría ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[categoria-producto] ⚠️  Error verificando categoría en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar si hay otras categorías con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todasLasCategorias = await strapi.db.query('api::categoria-producto.categoria-producto').findMany({
              where: {},
            });
            
            const categoriasConMismoExternalId = todasLasCategorias.filter((categoria: any) => {
              const categoriaExternalIds = categoria.externalIds || {};
              return categoriaExternalIds[platform] === wooId && categoria.id !== result.id;
            });
            
            if (categoriasConMismoExternalId.length > 0) {
              strapi.log.warn(`[categoria-producto] ⚠️  No se elimina categoría ${wooId} de ${platform} porque otras categorías (${categoriasConMismoExternalId.map((c: any) => c.id).join(', ')}) también la usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[categoria-producto] ⚠️  Error verificando otras categorías con mismo externalId: ${error}`);
          }
        }
      }
      
      // Si todas las verificaciones pasan, eliminar
      await deleteCategoriaFromWooCommerce(result);
      strapi.log.info(`[categoria-producto] ✅ Categoría eliminada de WooCommerce`);
    } catch (error) {
      strapi.log.error('[categoria-producto] ❌ Error eliminando categoría de WooCommerce:', error);
    }
  },
};
