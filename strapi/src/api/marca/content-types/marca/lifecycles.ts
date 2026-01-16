/**
 * Lifecycles para sincronización automática de Marcas a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza una marca
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

// Helper para sincronizar marca individual a WooCommerce (usar método unificado del servicio)
async function syncMarcaToWooCommerce(marca: any) {
  try {
    const wooSyncService = strapi.service('api::woo-sync.woo-sync');
    await wooSyncService.syncBrandTerm(marca);
  } catch (error) {
    strapi.log.error('[marca] ❌ Error sincronizando marca a WooCommerce:', error);
  }
}

// Helper para sincronizar libros relacionados cuando cambia una marca
async function syncLibrosRelacionados(marca: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { marcas: { id: marca.id } } as any,
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
      strapi.log.info(`[marca] ✅ ${libros.length} libro(s) relacionado(s) sincronizado(s)`);
    }
  } catch (error) {
    strapi.log.error('[marca] ❌ Error sincronizando libros relacionados:', error);
  }
}

// Helper para eliminar marca de WooCommerce (como término de atributo)
async function deleteMarcaFromWooCommerce(marca: any) {
  try {
    const wooSyncService = strapi.service('api::woo-sync.woo-sync');
    const platforms: ('woo_moraleja' | 'woo_escolar')[] = ['woo_moraleja', 'woo_escolar'];
    const externalIds = marca.externalIds || {};
    
    for (const platform of platforms) {
      const wooConfig = wooSyncService.getWooConfig(platform);
      if (!wooConfig) continue;
      
      const wooId = externalIds[platform];
      
      if (!wooId) {
        strapi.log.debug(`[marca] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
        continue;
      }
      
      // Obtener atributo "Marca"
      const marcaAttr = await wooSyncService.getOrCreateAttribute(wooConfig, 'Marca', 'marca');
      if (!marcaAttr || !marcaAttr.id) {
        continue;
      }
      
      const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
      
      // Eliminar término del atributo
      const deleteResponse = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/products/attributes/${marcaAttr.id}/terms/${wooId}?force=true`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (deleteResponse.ok) {
        strapi.log.info(`[marca] ✅ Término eliminado de ${platform}: ${wooId}`);
      } else if (deleteResponse.status === 404) {
        strapi.log.info(`[marca] ⏭️  Término ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
      } else {
        const errorText = await deleteResponse.text().catch(() => '');
        strapi.log.warn(`[marca] ⚠️  No se pudo eliminar término ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
      }
    }
  } catch (error) {
    strapi.log.error('[marca] ❌ Error eliminando marca de WooCommerce:', error);
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
        await syncMarcaToWooCommerce(result);
        strapi.log.info(`[marca] ✅ Marca "${result.name}" sincronizada a WooCommerce (tiempo real)`);
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[marca] ❌ Error sincronizando marca a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[marca] ⏸️ Marca "${result.name}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[marca] 🔍 afterUpdate ejecutado para marca ${result?.id || 'sin id'} - nombre: "${result?.name || 'sin nombre'}"`);
    
    if (!shouldSync() || !result.name) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncMarcaToWooCommerce
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[marca] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion === 'publicado') { // Only sync if published
      try {
        await syncMarcaToWooCommerce(result);
        strapi.log.info(`[marca] ✅ Marca "${result.name}" sincronizada a WooCommerce (tiempo real)`);
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[marca] ❌ Error sincronizando marca a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[marca] ⏸️ Marca "${result.name}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
    }
  },

  async afterDelete(event: any) {
    const { result, params } = event;
    
    if (!shouldSync() || !result) {
      return;
    }
    
    // Obtener ID de la marca de múltiples formas posibles
    const marcaId = result?.id || result?.documentId || params?.where?.id || params?.where?.documentId || params?.where?.$id;
    if (!marcaId) {
      strapi.log.warn(`[marca] No se pudo obtener ID de marca para eliminación`);
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    const cacheKey = String(marcaId);
    if ((result as any)?.__wooSyncDeleteProcessed) {
      strapi.log.debug(`[marca] ⏭️  afterDelete ya procesado para marca ${marcaId}, omitiendo`);
      return;
    }
    if (result) {
      (result as any).__wooSyncDeleteProcessed = true;
    }
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si la marca realmente fue eliminada (puede ser draft/publish)
      if (result.documentId) {
        try {
          const marcasConMismoDocumentId = await strapi.db.query('api::marca.marca').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (marcasConMismoDocumentId.length > 0) {
            strapi.log.info(`[marca] ⏭️  afterDelete omitido: existen otras marcas con mismo documentId (${marcasConMismoDocumentId.map((m: any) => m.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        } catch (error) {
          strapi.log.warn(`[marca] ⚠️  Error verificando marcas con mismo documentId: ${error}`);
        }
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const marcaCompleta = await strapi.db.query('api::marca.marca').findOne({
            where: { id: result.id },
          });
          if (marcaCompleta) {
            strapi.log.info(`[marca] ⏭️  afterDelete omitido: marca ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[marca] ⚠️  Error verificando marca en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar estado_publicacion - solo eliminar de WooCommerce si estaba publicado
      const estadoPublicacionRaw = result.estado_publicacion || result.estadoPublicacion;
      const estadoPublicacion = estadoPublicacionRaw ? String(estadoPublicacionRaw).toLowerCase() : '';
      if (estadoPublicacion !== 'publicado') {
        strapi.log.info(`[marca] ⏭️  afterDelete omitido: estado_publicacion="${estadoPublicacion || 'no definido'}" (solo se elimina de WooCommerce si estaba "publicado")`);
        return;
      }
      
      // PASO 4: Verificar si hay otras marcas con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todasLasMarcas = await strapi.db.query('api::marca.marca').findMany({
              where: {},
            });
            
            const marcasConMismoExternalId = todasLasMarcas.filter((m: any) => {
              const marcaExternalIds = m.externalIds || {};
              return marcaExternalIds[platform] === wooId && m.id !== result.id;
            });
            
            if (marcasConMismoExternalId.length > 0) {
              strapi.log.warn(`[marca] ⚠️  No se elimina término ${wooId} de ${platform} porque otras marcas (${marcasConMismoExternalId.map((m: any) => m.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[marca] ⚠️  Error verificando otras marcas con mismo externalId: ${error}`);
          }
        }
      }
      
      // Si todas las verificaciones pasan, eliminar
      await deleteMarcaFromWooCommerce(result);
      strapi.log.info(`[marca] ✅ Marca eliminada de WooCommerce`);
      
    } catch (error) {
      strapi.log.error('[marca] ❌ Error eliminando marca de WooCommerce:', error);
    }
  },
};
