/**
 * Lifecycles para sincronización automática de Etiquetas a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza una etiqueta
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

// Helper para sincronizar etiqueta individual a WooCommerce (usar método unificado del servicio)
async function syncEtiquetaToWooCommerce(etiqueta: any) {
  try {
    const wooSyncService = strapi.service('api::woo-sync.woo-sync');
    await wooSyncService.syncTagTerm(etiqueta);
  } catch (error) {
    strapi.log.error('[etiqueta] ❌ Error sincronizando etiqueta a WooCommerce:', error);
  }
}

// Helper para eliminar etiqueta de WooCommerce (con protección robusta igual que categorías)
async function deleteEtiquetaFromWooCommerce(etiqueta: any) {
  try {
    const wooSyncService = strapi.service('api::woo-sync.woo-sync');
    const platforms: ('woo_moraleja' | 'woo_escolar')[] = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      const wooConfig = wooSyncService.getWooConfig(platform);
      if (!wooConfig) continue;
      
      const externalIds = etiqueta.externalIds || {};
      const wooId = externalIds[platform];
      
      if (!wooId) {
        strapi.log.debug(`[etiqueta] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
        continue;
      }
      
      const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
      
      // Eliminar tag
      const deleteResponse = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/products/tags/${wooId}?force=true`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (deleteResponse.ok) {
        strapi.log.info(`[etiqueta] ✅ Tag eliminado de ${platform}: ${wooId}`);
      } else if (deleteResponse.status === 404) {
        strapi.log.info(`[etiqueta] ⏭️  Tag ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
      } else {
        const errorText = await deleteResponse.text().catch(() => '');
        strapi.log.warn(`[etiqueta] ⚠️  No se pudo eliminar tag ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
      }
    }
  } catch (error) {
    strapi.log.error('[etiqueta] ❌ Error eliminando etiqueta de WooCommerce:', error);
  }
}

// Helper para sincronizar libros relacionados cuando cambia una etiqueta
async function syncLibrosRelacionados(etiqueta: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { etiquetas: { id: etiqueta.id } } as any,
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
      strapi.log.info(`[etiqueta] ✅ ${libros.length} libro(s) relacionado(s) sincronizado(s)`);
    }
  } catch (error) {
    strapi.log.error('[etiqueta] ❌ Error sincronizando libros relacionados:', error);
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
        await syncEtiquetaToWooCommerce(result);
        strapi.log.info(`[etiqueta] ✅ Etiqueta "${result.name}" sincronizada a WooCommerce (tiempo real)`);
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[etiqueta] ❌ Error sincronizando etiqueta a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[etiqueta] ⏸️ Etiqueta "${result.name}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[etiqueta] 🔍 afterUpdate ejecutado para etiqueta ${result?.id || 'sin id'} - nombre: "${result?.name || 'sin nombre'}"`);
    
    if (!shouldSync() || !result.name) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncTagTerm
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[etiqueta] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion === 'publicado') { // Only sync if published
      try {
        await syncEtiquetaToWooCommerce(result);
        strapi.log.info(`[etiqueta] ✅ Etiqueta "${result.name}" sincronizada a WooCommerce (tiempo real)`);
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[etiqueta] ❌ Error sincronizando etiqueta a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[etiqueta] ⏸️ Etiqueta "${result.name}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result) {
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[etiqueta] ⏭️  afterDelete ya procesado para etiqueta ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si la etiqueta realmente fue eliminada (puede ser draft/publish)
      if (result.documentId) {
        try {
          const etiquetasConMismoDocumentId = await strapi.db.query('api::etiqueta.etiqueta').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (etiquetasConMismoDocumentId.length > 0) {
            strapi.log.info(`[etiqueta] ⏭️  afterDelete omitido: existen otras etiquetas con mismo documentId (${etiquetasConMismoDocumentId.map((e: any) => e.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        } catch (error) {
          strapi.log.warn(`[etiqueta] ⚠️  Error verificando etiquetas con mismo documentId: ${error}`);
        }
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const etiquetaCompleta = await strapi.db.query('api::etiqueta.etiqueta').findOne({
            where: { id: result.id },
          });
          if (etiquetaCompleta) {
            strapi.log.info(`[etiqueta] ⏭️  afterDelete omitido: etiqueta ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[etiqueta] ⚠️  Error verificando etiqueta en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar estado_publicacion - solo eliminar de WooCommerce si estaba publicado
      const estadoPublicacionRaw = result.estado_publicacion || result.estadoPublicacion;
      const estadoPublicacion = estadoPublicacionRaw ? String(estadoPublicacionRaw).toLowerCase() : '';
      if (estadoPublicacion !== 'publicado') {
        strapi.log.info(`[etiqueta] ⏭️  afterDelete omitido: estado_publicacion="${estadoPublicacion || 'no definido'}" (solo se elimina de WooCommerce si estaba "publicado")`);
        return;
      }
      
      // PASO 4: Verificar si hay otras etiquetas con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todasLasEtiquetas = await strapi.db.query('api::etiqueta.etiqueta').findMany({
              where: {},
            });
            
            const etiquetasConMismoExternalId = todasLasEtiquetas.filter((etiqueta: any) => {
              const etiquetaExternalIds = etiqueta.externalIds || {};
              return etiquetaExternalIds[platform] === wooId && etiqueta.id !== result.id;
            });
            
            if (etiquetasConMismoExternalId.length > 0) {
              strapi.log.warn(`[etiqueta] ⚠️  No se elimina tag ${wooId} de ${platform} porque otras etiquetas (${etiquetasConMismoExternalId.map((e: any) => e.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[etiqueta] ⚠️  Error verificando otras etiquetas con mismo externalId: ${error}`);
          }
        }
      }
      
      // Si todas las verificaciones pasan, eliminar
      await deleteEtiquetaFromWooCommerce(result);
      strapi.log.info(`[etiqueta] ✅ Etiqueta eliminada de WooCommerce`);
    } catch (error) {
      strapi.log.error('[etiqueta] ❌ Error eliminando etiqueta de WooCommerce:', error);
    }
  },
};
