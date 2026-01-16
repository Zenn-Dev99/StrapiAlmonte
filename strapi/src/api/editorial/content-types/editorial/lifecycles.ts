/**
 * Lifecycles para sincronización automática de Editoriales a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza una editorial
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

// Helper para sincronizar libros relacionados cuando cambia una editorial
async function syncLibrosRelacionados(editorial: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { editorial: editorial.id },
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
      strapi.log.info(`[editorial] ✅ ${libros.length} libro(s) relacionado(s) sincronizado(s) después de actualizar editorial`);
    }
  } catch (error) {
    strapi.log.error('[editorial] ❌ Error sincronizando libros relacionados:', error);
  }
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result.nombre_editorial) {
      return;
    }
    
    try {
      await strapi.service('api::woo-sync.woo-sync').syncEditorialTerm(result);
      strapi.log.info(`[editorial] ✅ Editorial "${result.nombre_editorial}" sincronizada a WooCommerce (tiempo real)`);
      
      // Sincronizar libros relacionados
      await syncLibrosRelacionados(result);
    } catch (error) {
      strapi.log.error('[editorial] ❌ Error sincronizando editorial a WooCommerce:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[editorial] 🔍 afterUpdate ejecutado para editorial ${result?.id || 'sin id'} - nombre: "${result?.nombre_editorial || 'sin nombre'}"`);
    
    if (!shouldSync() || !result.nombre_editorial) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncEditorialTerm
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[editorial] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    try {
      await strapi.service('api::woo-sync.woo-sync').syncEditorialTerm(result);
      strapi.log.info(`[editorial] ✅ Editorial "${result.nombre_editorial}" sincronizada a WooCommerce (tiempo real)`);
      
      // Sincronizar libros relacionados
      await syncLibrosRelacionados(result);
    } catch (error) {
      strapi.log.error('[editorial] ❌ Error sincronizando editorial a WooCommerce:', error);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    if (!shouldSync() || !result) {
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[editorial] ⏭️  afterDelete ya procesado para editorial ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si la editorial realmente fue eliminada (puede ser draft/publish)
      if (result.documentId) {
        try {
          const editorialesConMismoDocumentId = await strapi.db.query('api::editorial.editorial').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (editorialesConMismoDocumentId.length > 0) {
            strapi.log.info(`[editorial] ⏭️  afterDelete omitido: existen otras editoriales con mismo documentId (${editorialesConMismoDocumentId.map((e: any) => e.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        } catch (error) {
          strapi.log.warn(`[editorial] ⚠️  Error verificando editoriales con mismo documentId: ${error}`);
        }
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const editorialCompleta = await strapi.db.query('api::editorial.editorial').findOne({
            where: { id: result.id },
          });
          if (editorialCompleta) {
            strapi.log.info(`[editorial] ⏭️  afterDelete omitido: editorial ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[editorial] ⚠️  Error verificando editorial en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar si hay otras editoriales con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todasLasEditoriales = await strapi.db.query('api::editorial.editorial').findMany({
              where: {},
            });
            
            const editorialesConMismoExternalId = todasLasEditoriales.filter((editorial: any) => {
              const editorialExternalIds = editorial.externalIds || {};
              return editorialExternalIds[platform] === wooId && editorial.id !== result.id;
            });
            
            if (editorialesConMismoExternalId.length > 0) {
              strapi.log.warn(`[editorial] ⚠️  No se elimina término ${wooId} de ${platform} porque otras editoriales (${editorialesConMismoExternalId.map((e: any) => e.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[editorial] ⚠️  Error verificando otras editoriales con mismo externalId: ${error}`);
          }
        }
      }
      
      for (const platform of platforms) {
        const wooConfig = wooSyncService.getWooConfig(platform);
        if (!wooConfig) continue;
        
        const wooId = externalIds[platform];
        
        if (!wooId) {
          strapi.log.debug(`[editorial] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
          continue;
        }
        
        // Obtener atributo "Editorial"
        const editorialAttr = await wooSyncService.getOrCreateAttribute(wooConfig, 'Editorial', 'editorial');
        if (!editorialAttr || !editorialAttr.id) {
          continue;
        }
        
        const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
        
        // Eliminar término
        const deleteResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/attributes/${editorialAttr.id}/terms/${wooId}?force=true`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (deleteResponse.ok) {
          strapi.log.info(`[editorial] ✅ Término eliminado de ${platform}: ${wooId}`);
        } else if (deleteResponse.status === 404) {
          strapi.log.info(`[editorial] ⏭️  Término ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
        } else {
          const errorText = await deleteResponse.text().catch(() => '');
          strapi.log.warn(`[editorial] ⚠️  No se pudo eliminar término ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
        }
      }
    } catch (error) {
      strapi.log.error('[editorial] ❌ Error eliminando editorial de WooCommerce:', error);
    }
  },
};


