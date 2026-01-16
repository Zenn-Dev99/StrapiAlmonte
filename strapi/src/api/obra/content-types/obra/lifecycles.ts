/**
 * Lifecycles para sincronización automática de Obras a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza una obra
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

// Helper para sincronizar ediciones (libros) relacionadas cuando cambia una obra
async function syncEdicionesRelacionadas(obra: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { obra: obra.id },
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
      strapi.log.info(`[obra] ✅ ${libros.length} edición(es) relacionada(s) sincronizada(s) después de actualizar obra`);
    }
  } catch (error) {
    strapi.log.error('[obra] ❌ Error sincronizando ediciones relacionadas:', error);
  }
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result.nombre_obra) {
      return;
    }
    
    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "publicado"
    // Si es "pendiente" o "borrador", NO se publica en WordPress
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion !== 'publicado') {
      strapi.log.info(`[obra] ⏸️ Obra "${result.nombre_obra}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
      return;
    }
    
    try {
      await strapi.service('api::woo-sync.woo-sync').syncObraTerm(result);
      strapi.log.info(`[obra] ✅ Obra "${result.nombre_obra}" sincronizada a WooCommerce (tiempo real) - estado: ${estadoPublicacion}`);
      
      // Sincronizar ediciones relacionadas
      await syncEdicionesRelacionadas(result);
    } catch (error) {
      strapi.log.error('[obra] ❌ Error sincronizando obra a WooCommerce:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[obra] 🔍 afterUpdate ejecutado para obra ${result?.id || 'sin id'} - nombre: "${result?.nombre_obra || 'sin nombre'}"`);
    
    if (!shouldSync() || !result.nombre_obra) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncObraTerm
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[obra] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "publicado"
    // Si es "pendiente" o "borrador", NO se publica en WordPress
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion !== 'publicado') {
      strapi.log.info(`[obra] ⏸️ Obra "${result.nombre_obra}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
      return;
    }
    
    try {
      await strapi.service('api::woo-sync.woo-sync').syncObraTerm(result);
      strapi.log.info(`[obra] ✅ Obra "${result.nombre_obra}" sincronizada a WooCommerce (tiempo real) - estado: ${estadoPublicacion}`);
      
      // Sincronizar ediciones relacionadas
      await syncEdicionesRelacionadas(result);
    } catch (error) {
      strapi.log.error('[obra] ❌ Error sincronizando obra a WooCommerce:', error);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result) {
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[obra] ⏭️  afterDelete ya procesado para obra ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si la obra realmente fue eliminada (puede ser draft/publish)
      if (result.documentId) {
        try {
          const obrasConMismoDocumentId = await strapi.db.query('api::obra.obra').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (obrasConMismoDocumentId.length > 0) {
            strapi.log.info(`[obra] ⏭️  afterDelete omitido: existen otras obras con mismo documentId (${obrasConMismoDocumentId.map((o: any) => o.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        } catch (error) {
          strapi.log.warn(`[obra] ⚠️  Error verificando obras con mismo documentId: ${error}`);
        }
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const obraCompleta = await strapi.db.query('api::obra.obra').findOne({
            where: { id: result.id },
          });
          if (obraCompleta) {
            strapi.log.info(`[obra] ⏭️  afterDelete omitido: obra ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[obra] ⚠️  Error verificando obra en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar estado_publicacion - solo eliminar de WooCommerce si estaba publicado
      const estadoPublicacionRaw = result.estado_publicacion || result.estadoPublicacion;
      const estadoPublicacion = estadoPublicacionRaw ? String(estadoPublicacionRaw).toLowerCase() : '';
      if (estadoPublicacion !== 'publicado') {
        strapi.log.info(`[obra] ⏭️  afterDelete omitido: estado_publicacion="${estadoPublicacion || 'no definido'}" (solo se elimina de WooCommerce si estaba "publicado")`);
        return;
      }
      
      // PASO 4: Verificar si hay otras obras con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todasLasObras = await strapi.db.query('api::obra.obra').findMany({
              where: {},
            });
            
            const obrasConMismoExternalId = todasLasObras.filter((obra: any) => {
              const obraExternalIds = obra.externalIds || {};
              return obraExternalIds[platform] === wooId && obra.id !== result.id;
            });
            
            if (obrasConMismoExternalId.length > 0) {
              strapi.log.warn(`[obra] ⚠️  No se elimina término ${wooId} de ${platform} porque otras obras (${obrasConMismoExternalId.map((o: any) => o.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[obra] ⚠️  Error verificando otras obras con mismo externalId: ${error}`);
          }
        }
      }
      
      for (const platform of platforms) {
        const wooConfig = wooSyncService.getWooConfig(platform);
        if (!wooConfig) continue;
        
        const wooId = externalIds[platform];
        
        if (!wooId) {
          strapi.log.debug(`[obra] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
          continue;
        }
        
        // Obtener atributo "Obra"
        const obraAttr = await wooSyncService.getOrCreateAttribute(wooConfig, 'Obra', 'obra');
        if (!obraAttr || !obraAttr.id) {
          continue;
        }
        
        const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
        
        // Eliminar término
        const deleteResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/attributes/${obraAttr.id}/terms/${wooId}?force=true`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (deleteResponse.ok) {
          strapi.log.info(`[obra] ✅ Término eliminado de ${platform}: ${wooId}`);
        } else if (deleteResponse.status === 404) {
          strapi.log.info(`[obra] ⏭️  Término ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
        } else {
          const errorText = await deleteResponse.text().catch(() => '');
          strapi.log.warn(`[obra] ⚠️  No se pudo eliminar término ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
        }
      }
    } catch (error) {
      strapi.log.error('[obra] ❌ Error eliminando obra de WooCommerce:', error);
    }
  },
};


