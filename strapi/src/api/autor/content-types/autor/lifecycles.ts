/**
 * Lifecycles para sincronización automática de Autores a WooCommerce
 * Sincroniza inmediatamente cuando se crea o actualiza un autor
 * 
 * NOTA: Esto sincroniza en tiempo real los cambios en Strapi → WooCommerce
 * Para cambios en WooCommerce → Strapi, se usa el cron periódico
 */

// Verificar si Strapi está listo y no estamos en modo import/seed
function shouldSync(): boolean {
  // No sincronizar si Strapi no está disponible
  if (!strapi) {
    return false;
  }
  
  // No sincronizar durante imports o seeds
  if (process.env.DISABLE_WOO_SYNC === 'true' || process.env.SKIP_WOO_SYNC === 'true') {
    return false;
  }
  
  // Verificar que el servicio esté disponible (indica que Strapi está iniciado)
  try {
    if (!strapi.service('api::woo-sync.woo-sync')) {
      return false;
    }
  } catch (error) {
    return false;
  }
  
  return true;
}

// Helper para sincronizar libros relacionados cuando cambia un autor
async function syncLibrosRelacionados(autor: any) {
  try {
    const libros = await strapi.entityService.findMany('api::libro.libro', {
      filters: { autor_relacion: autor.id },
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
      strapi.log.info(`[autor] ✅ ${libros.length} libro(s) relacionado(s) sincronizado(s) después de actualizar autor`);
    }
  } catch (error) {
    strapi.log.error('[autor] ❌ Error sincronizando libros relacionados:', error);
  }
}

export default {
  async afterCreate(event: any) {
    const { result } = event;
    
    // Verificar condiciones antes de sincronizar
    if (!shouldSync()) {
      return;
    }
    
    // Solo sincronizar si tiene nombre_completo_autor
    if (!result.nombre_completo_autor) {
      return;
    }
    
    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "publicado"
    // Si es "pendiente" o "borrador", NO se publica en WordPress
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion !== 'publicado') {
      strapi.log.info(`[autor] ⏸️ Autor "${result.nombre_completo_autor}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
      return;
    }
    
    try {
      // Sincronizar término de autor a WooCommerce (todas las plataformas)
      await strapi.service('api::woo-sync.woo-sync').syncAutorTerm(result);
      strapi.log.info(`[autor] ✅ Autor "${result.nombre_completo_autor}" sincronizado a WooCommerce (tiempo real) - estado: ${estadoPublicacion}`);
      
      // Sincronizar libros relacionados
      await syncLibrosRelacionados(result);
    } catch (error) {
      strapi.log.error('[autor] ❌ Error sincronizando autor a WooCommerce:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    
    // Log para debugging
    strapi.log.info(`[autor] 🔍 afterUpdate ejecutado para autor ${result?.id || 'sin id'} - nombre: "${result?.nombre_completo_autor || 'sin nombre'}"`);
    
    // Verificar condiciones antes de sincronizar
    if (!shouldSync()) {
      return;
    }
    
    // Evitar bucle infinito si el update viene de syncAutorTerm
    if ((params as any)?.__skipWooSync === true) {
      strapi.log.debug(`[autor] ⏭️  afterUpdate omitido: __skipWooSync flag activo`);
      return;
    }
    
    // Solo sincronizar si tiene nombre_completo_autor
    if (!result.nombre_completo_autor) {
      strapi.log.debug(`[autor] ⏭️  afterUpdate omitido: sin nombre_completo_autor`);
      return;
    }
    
    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "publicado"
    // Si es "pendiente" o "borrador", NO se publica en WordPress
    const estadoPublicacion = result.estado_publicacion?.toLowerCase() || 'pendiente';
    if (estadoPublicacion !== 'publicado') {
      strapi.log.info(`[autor] ⏸️ Autor "${result.nombre_completo_autor}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
      return;
    }
    
    try {
      // Sincronizar término de autor a WooCommerce (todas las plataformas)
      await strapi.service('api::woo-sync.woo-sync').syncAutorTerm(result);
      strapi.log.info(`[autor] ✅ Autor "${result.nombre_completo_autor}" sincronizado a WooCommerce (tiempo real) - estado: ${estadoPublicacion}`);
      
      // Sincronizar libros relacionados
      await syncLibrosRelacionados(result);
    } catch (error) {
      strapi.log.error('[autor] ❌ Error sincronizando autor a WooCommerce:', error);
    }
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    // Log para debugging - ver stack trace y contexto completo
    const stack = new Error().stack;
    strapi.log.info(`[autor] 🔍 afterDelete ejecutado para autor ${result?.id || 'sin id'} (documentId: ${result?.documentId || 'sin documentId'}) - nombre: "${result?.nombre_completo_autor || 'sin nombre'}"`);
    strapi.log.info(`[autor] 🔍 afterDelete event keys: ${Object.keys(event || {}).join(', ')}`);
    strapi.log.info(`[autor] 🔍 afterDelete result keys: ${Object.keys(result || {}).slice(0, 10).join(', ')}`);
    strapi.log.debug(`[autor] 🔍 afterDelete stack trace:`, stack);
    
    if (!shouldSync() || !result) {
      strapi.log.debug(`[autor] ⏭️  afterDelete omitido: shouldSync=${shouldSync()}, result=${!!result}`);
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[autor] ⏭️  afterDelete ya procesado para autor ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si el autor realmente fue eliminado (puede ser draft/publish)
      // Si existe otro autor con el mismo documentId pero diferente ID, NO eliminar términos
      let autorRealmenteEliminado = true;
      try {
        if (result.documentId) {
          // Buscar si hay otros autores con el mismo documentId (draft vs published)
          const autoresConMismoDocumentId = await strapi.db.query('api::autor.autor').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (autoresConMismoDocumentId.length > 0) {
            strapi.log.info(`[autor] ⏭️  afterDelete omitido: existen otros autores con mismo documentId (${autoresConMismoDocumentId.map((a: any) => a.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        }
      } catch (error) {
        strapi.log.warn(`[autor] ⚠️  Error verificando autores con mismo documentId: ${error}`);
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const autorCompleto = await strapi.db.query('api::autor.autor').findOne({
            where: { id: result.id },
          });
          if (autorCompleto) {
            // Si aún existe, no eliminar (puede ser que no se eliminó realmente)
            strapi.log.info(`[autor] ⏭️  afterDelete omitido: autor ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          // Si no existe en BD, usar los externalIds del result
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[autor] ⚠️  Error verificando autor en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar estado_publicacion - solo eliminar de WooCommerce si estaba publicado
      const estadoPublicacionRaw = result.estado_publicacion || result.estadoPublicacion;
      const estadoPublicacion = estadoPublicacionRaw ? String(estadoPublicacionRaw).toLowerCase() : '';
      if (estadoPublicacion !== 'publicado') {
        strapi.log.info(`[autor] ⏭️  afterDelete omitido: estado_publicacion="${estadoPublicacion || 'no definido'}" (solo se elimina de WooCommerce si estaba "publicado")`);
        return;
      }
      
      // PASO 4: Verificar si hay otros autores con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          // Buscar otros autores con el mismo externalId
          try {
            const todosLosAutores = await strapi.db.query('api::autor.autor').findMany({
              where: {},
            });
            
            // Filtrar manualmente los que tienen el mismo externalId y existen
            const autoresConMismoExternalId = todosLosAutores.filter((autor: any) => {
              const autorExternalIds = autor.externalIds || {};
              return autorExternalIds[platform] === wooId && autor.id !== result.id;
            });
            
            if (autoresConMismoExternalId.length > 0) {
              strapi.log.warn(`[autor] ⚠️  No se elimina término ${wooId} de ${platform} porque otros autores (${autoresConMismoExternalId.map((a: any) => a.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[autor] ⚠️  Error verificando otros autores con mismo externalId: ${error}`);
            // Continuar con la eliminación si no se puede verificar
          }
        }
      }
      
      for (const platform of platforms) {
        const wooConfig = wooSyncService.getWooConfig(platform);
        if (!wooConfig) continue;
        
        const wooId = externalIds[platform];
        
        if (!wooId) {
          strapi.log.debug(`[autor] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
          continue;
        }
        
        // Obtener atributo "Autor"
        const autorAttr = await wooSyncService.getOrCreateAttribute(wooConfig, 'Autor', 'autor');
        if (!autorAttr || !autorAttr.id) {
          continue;
        }
        
        const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
        
        // Eliminar término
        const deleteResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/attributes/${autorAttr.id}/terms/${wooId}?force=true`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (deleteResponse.ok) {
          strapi.log.info(`[autor] ✅ Término eliminado de ${platform}: ${wooId}`);
        } else if (deleteResponse.status === 404) {
          // El término ya fue eliminado (probablemente en una ejecución previa)
          strapi.log.info(`[autor] ⏭️  Término ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
        } else {
          const errorText = await deleteResponse.text().catch(() => '');
          strapi.log.warn(`[autor] ⚠️  No se pudo eliminar término ${wooId} de ${platform}: ${deleteResponse.status} ${errorText}`);
        }
      }
    } catch (error) {
      strapi.log.error('[autor] ❌ Error eliminando autor de WooCommerce:', error);
    }
  },
};


