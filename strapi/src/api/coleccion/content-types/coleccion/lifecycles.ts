/**
 * Lifecycles para sincronización automática de Colecciones a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza una colección
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

// Helper para sincronizar libros relacionados cuando cambia una colección
async function syncLibrosRelacionados(coleccion: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { coleccion: coleccion.id },
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
      strapi.log.info(`[coleccion] ✅ ${libros.length} libro(s) relacionado(s) sincronizado(s) después de actualizar colección`);
    }
  } catch (error) {
    strapi.log.error('[coleccion] ❌ Error sincronizando libros relacionados:', error);
  }
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result.nombre_coleccion) {
      return;
    }
    
    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "publicado"
    // Si es "pendiente" o "borrador", NO se publica en WordPress
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion !== 'publicado') {
      strapi.log.info(`[coleccion] ⏸️ Colección "${result.nombre_coleccion}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
      return;
    }
    
    try {
      await strapi.service('api::woo-sync.woo-sync').syncColeccionTerm(result);
      strapi.log.info(`[coleccion] ✅ Colección "${result.nombre_coleccion}" sincronizada a WooCommerce (tiempo real) - estado: ${estadoPublicacion}`);
      
      // Sincronizar libros relacionados
      await syncLibrosRelacionados(result);
    } catch (error) {
      strapi.log.error('[coleccion] ❌ Error sincronizando colección a WooCommerce:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[coleccion] 🔍 afterUpdate ejecutado para coleccion ${result?.id || 'sin id'} - nombre: "${result?.nombre_coleccion || 'sin nombre'}"`);
    
    if (!shouldSync() || !result.nombre_coleccion) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncColeccionTerm
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[coleccion] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "publicado"
    // Si es "pendiente" o "borrador", NO se publica en WordPress
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion !== 'publicado') {
      strapi.log.info(`[coleccion] ⏸️ Colección "${result.nombre_coleccion}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
      return;
    }
    
    try {
      await strapi.service('api::woo-sync.woo-sync').syncColeccionTerm(result);
      strapi.log.info(`[coleccion] ✅ Colección "${result.nombre_coleccion}" sincronizada a WooCommerce (tiempo real) - estado: ${estadoPublicacion}`);
      
      // Sincronizar libros relacionados
      await syncLibrosRelacionados(result);
    } catch (error) {
      strapi.log.error('[coleccion] ❌ Error sincronizando colección a WooCommerce:', error);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result) {
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[coleccion] ⏭️  afterDelete ya procesado para colección ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si la colección realmente fue eliminada (puede ser draft/publish)
      if (result.documentId) {
        try {
          const coleccionesConMismoDocumentId = await strapi.db.query('api::coleccion.coleccion').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (coleccionesConMismoDocumentId.length > 0) {
            strapi.log.info(`[coleccion] ⏭️  afterDelete omitido: existen otras colecciones con mismo documentId (${coleccionesConMismoDocumentId.map((c: any) => c.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        } catch (error) {
          strapi.log.warn(`[coleccion] ⚠️  Error verificando colecciones con mismo documentId: ${error}`);
        }
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const coleccionCompleta = await strapi.db.query('api::coleccion.coleccion').findOne({
            where: { id: result.id },
          });
          if (coleccionCompleta) {
            strapi.log.info(`[coleccion] ⏭️  afterDelete omitido: coleccion ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[coleccion] ⚠️  Error verificando coleccion en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar estado_publicacion - solo eliminar de WooCommerce si estaba publicado
      const estadoPublicacionRaw = result.estado_publicacion || result.estadoPublicacion;
      const estadoPublicacion = estadoPublicacionRaw ? String(estadoPublicacionRaw).toLowerCase() : '';
      if (estadoPublicacion !== 'publicado') {
        strapi.log.info(`[coleccion] ⏭️  afterDelete omitido: estado_publicacion="${estadoPublicacion || 'no definido'}" (solo se elimina de WooCommerce si estaba "publicado")`);
        return;
      }
      
      // PASO 4: Verificar si hay otras colecciones con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todasLasColecciones = await strapi.db.query('api::coleccion.coleccion').findMany({
              where: {},
            });
            
            const coleccionesConMismoExternalId = todasLasColecciones.filter((coleccion: any) => {
              const coleccionExternalIds = coleccion.externalIds || {};
              return coleccionExternalIds[platform] === wooId && coleccion.id !== result.id;
            });
            
            if (coleccionesConMismoExternalId.length > 0) {
              strapi.log.warn(`[coleccion] ⚠️  No se elimina término ${wooId} de ${platform} porque otras colecciones (${coleccionesConMismoExternalId.map((c: any) => c.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[coleccion] ⚠️  Error verificando otras colecciones con mismo externalId: ${error}`);
          }
        }
      }
      
      for (const platform of platforms) {
        const wooConfig = wooSyncService.getWooConfig(platform);
        if (!wooConfig) continue;
        
        const wooId = externalIds[platform];
        
        if (!wooId) {
          strapi.log.debug(`[coleccion] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
          continue;
        }
        
        // Obtener atributo "Colección"
        const coleccionAttr = await wooSyncService.getOrCreateAttribute(wooConfig, 'Colección', 'coleccion');
        if (!coleccionAttr || !coleccionAttr.id) {
          continue;
        }
        
        const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
        
        // Eliminar término
        const deleteResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/attributes/${coleccionAttr.id}/terms/${wooId}?force=true`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (deleteResponse.ok) {
          strapi.log.info(`[coleccion] ✅ Término eliminado de ${platform}: ${wooId}`);
        } else if (deleteResponse.status === 404) {
          strapi.log.info(`[coleccion] ⏭️  Término ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
        } else {
          const errorText = await deleteResponse.text().catch(() => '');
          strapi.log.warn(`[coleccion] ⚠️  No se pudo eliminar término ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
        }
      }
    } catch (error) {
      strapi.log.error('[coleccion] ❌ Error eliminando colección de WooCommerce:', error);
    }
  },
};
