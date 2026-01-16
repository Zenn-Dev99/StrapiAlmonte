/**
 * Lifecycles para sincronización automática de Sellos a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza un sello
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

// Helper para sincronizar libros relacionados cuando cambia un sello
async function syncLibrosRelacionados(sello: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { sello: sello.id },
      populate: ['canales']
    });
    
    for (const libro of libros) {
      const libroConCanales = libro as any;
      // Verificar si el libro tiene canales de WooCommerce
      const hasWooChannel = libroConCanales.canales?.some((c: any) => 
        c.key === 'moraleja' || c.key === 'escolar'
      );
      
      if (hasWooChannel) {
        // Sincronizar a todas las plataformas donde esté el libro
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
      strapi.log.info(`[sello] ✅ ${libros.length} libro(s) relacionado(s) sincronizado(s) después de actualizar sello`);
    }
  } catch (error) {
    strapi.log.error('[sello] ❌ Error sincronizando libros relacionados:', error);
  }
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result.nombre_sello) {
      return;
    }
    
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion === 'publicado') { // Only sync if published
      try {
        await strapi.service('api::woo-sync.woo-sync').syncSelloTerm(result);
        strapi.log.info(`[sello] ✅ Sello "${result.nombre_sello}" sincronizado a WooCommerce (tiempo real)`);
        
        // Sincronizar libros relacionados
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[sello] ❌ Error sincronizando sello a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[sello] ⏸️ Sello "${result.nombre_sello}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[sello] 🔍 afterUpdate ejecutado para sello ${result?.id || 'sin id'} - nombre: "${result?.nombre_sello || 'sin nombre'}"`);
    
    if (!shouldSync() || !result.nombre_sello) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncSelloTerm
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[sello] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion === 'publicado') { // Only sync if published
      try {
        await strapi.service('api::woo-sync.woo-sync').syncSelloTerm(result);
        strapi.log.info(`[sello] ✅ Sello "${result.nombre_sello}" sincronizado a WooCommerce (tiempo real)`);
        
        // Sincronizar libros relacionados
        await syncLibrosRelacionados(result);
      } catch (error) {
        strapi.log.error('[sello] ❌ Error sincronizando sello a WooCommerce:', error);
      }
    } else {
      strapi.log.info(`[sello] ⏸️ Sello "${result.nombre_sello}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result) {
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[sello] ⏭️  afterDelete ya procesado para sello ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si el sello realmente fue eliminado (puede ser draft/publish)
      if (result.documentId) {
        try {
          const sellosConMismoDocumentId = await strapi.db.query('api::sello.sello').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (sellosConMismoDocumentId.length > 0) {
            strapi.log.info(`[sello] ⏭️  afterDelete omitido: existen otros sellos con mismo documentId (${sellosConMismoDocumentId.map((s: any) => s.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        } catch (error) {
          strapi.log.warn(`[sello] ⚠️  Error verificando sellos con mismo documentId: ${error}`);
        }
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const selloCompleto = await strapi.db.query('api::sello.sello').findOne({
            where: { id: result.id },
          });
          if (selloCompleto) {
            strapi.log.info(`[sello] ⏭️  afterDelete omitido: sello ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[sello] ⚠️  Error verificando sello en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar estado_publicacion - solo eliminar de WooCommerce si estaba publicado
      const estadoPublicacionRaw = result.estado_publicacion || result.estadoPublicacion;
      const estadoPublicacion = estadoPublicacionRaw ? String(estadoPublicacionRaw).toLowerCase() : '';
      if (estadoPublicacion !== 'publicado') {
        strapi.log.info(`[sello] ⏭️  afterDelete omitido: estado_publicacion="${estadoPublicacion || 'no definido'}" (solo se elimina de WooCommerce si estaba "publicado")`);
        return;
      }
      
      // PASO 4: Verificar si hay otros sellos con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todosLosSellos = await strapi.db.query('api::sello.sello').findMany({
              where: {},
            });
            
            const sellosConMismoExternalId = todosLosSellos.filter((sello: any) => {
              const selloExternalIds = sello.externalIds || {};
              return selloExternalIds[platform] === wooId && sello.id !== result.id;
            });
            
            if (sellosConMismoExternalId.length > 0) {
              strapi.log.warn(`[sello] ⚠️  No se elimina término ${wooId} de ${platform} porque otros sellos (${sellosConMismoExternalId.map((s: any) => s.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[sello] ⚠️  Error verificando otros sellos con mismo externalId: ${error}`);
          }
        }
      }
      
      for (const platform of platforms) {
        const wooConfig = wooSyncService.getWooConfig(platform);
        if (!wooConfig) continue;
        
        const wooId = externalIds[platform];
        
        if (!wooId) {
          strapi.log.debug(`[sello] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
          continue;
        }
        
        // Obtener atributo "Sello"
        const selloAttr = await wooSyncService.getOrCreateAttribute(wooConfig, 'Sello', 'sello');
        if (!selloAttr || !selloAttr.id) {
          continue;
        }
        
        const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
        
        // Eliminar término
        const deleteResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/attributes/${selloAttr.id}/terms/${wooId}?force=true`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (deleteResponse.ok) {
          strapi.log.info(`[sello] ✅ Término eliminado de ${platform}: ${wooId}`);
        } else if (deleteResponse.status === 404) {
          strapi.log.info(`[sello] ⏭️  Término ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
        } else {
          const errorText = await deleteResponse.text().catch(() => '');
          strapi.log.warn(`[sello] ⚠️  No se pudo eliminar término ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
        }
      }
    } catch (error) {
      strapi.log.error('[sello] ❌ Error eliminando sello de WooCommerce:', error);
    }
  },
};


