/**
 * Valida si un SKU/ISBN está correctamente escrito
 * - Solo números, sin espacios ni guiones
 * - Típicamente 13 dígitos (pero puede variar)
 */
function isSKUValido(sku: string | null | undefined): boolean {
  if (!sku) return false;
  // Remover guiones y espacios
  const skuLimpio = String(sku).replace(/[-\s]/g, '');
  // Verificar si es numérico (no temporal ni con letras)
  if (skuLimpio.startsWith('TEMP-') || /[a-zA-Z]/.test(skuLimpio)) return false;
  // Debe ser solo números
  return /^\d+$/.test(skuLimpio);
}

/**
 * NOTA: Los campos id_autor, id_editorial, id_sello, id_coleccion, id_obra fueron eliminados
 * porque son redundantes. Las relaciones (autor_relacion, editorial, sello, etc.) ya proporcionan
 * toda la información necesaria. Si necesitas el ID, puedes obtenerlo desde la relación directamente.
 * 
 * Esta función se mantiene por compatibilidad pero ya no actualiza campos que no existen.
 */
async function actualizarIdsDesdeRelaciones(libro: any, data: any) {
  // Los campos id_* fueron eliminados porque son redundantes
  // Las relaciones ya proporcionan toda la información necesaria
  // Si necesitas el ID, accede directamente desde la relación: libro.autor_relacion?.id
  
  // Mantener lógica de auto-asignar editorial desde sello si es necesario
  if (data.sello !== undefined && data.sello) {
    try {
      const selloId = typeof data.sello === 'object' 
        ? (data.sello.id || data.sello.documentId) 
        : data.sello;
      
      if (selloId && (!data.editorial || data.editorial === null)) {
        // Si el sello tiene una editorial asociada y el libro no tiene editorial,
        // actualizar la editorial del libro
        const sello = await strapi.entityService.findOne('api::sello.sello', selloId, {
          populate: ['editorial'],
        }) as any;
        
        if (sello?.editorial) {
          const editorialDelSello = sello.editorial;
          const editorialId = typeof editorialDelSello === 'object'
            ? (editorialDelSello.id || editorialDelSello.documentId)
            : editorialDelSello;
          
          if (editorialId) {
            data.editorial = editorialId;
            strapi.log.debug(`[libro] Editorial auto-asignada desde sello: ${editorialId}`);
          }
        }
      }
    } catch (error: any) {
      strapi.log.warn(`[libro] Error al obtener editorial del sello: ${error?.message || error}`);
    }
  }
}

/**
 * Calcula el KPI de completitud básica de un libro
 * Criterios:
 * 1. SKU correctamente escrito (ISBN): solo números, sin espacios ni guiones, típicamente 13 dígitos
 * 2. Si existe la imagen del producto (portada_libro)
 * 3. Si está presente el nombre del libro
 * 4. Si están ingresados los autores (autor_relacion)
 * 5. Si está añadida la editorial
 */
function calcularCompletitudBasica(libro: any): { 
  completo: boolean;
  faltantes: string[];
  completitud_basica: {
    sku_valido: boolean;
    tiene_imagen: boolean;
    tiene_nombre: boolean;
    tiene_autor: boolean;
    tiene_editorial: boolean;
    campos_faltantes: string[];
    score: number;
    porcentaje_completitud: number;
  };
} {
  // El SKU es el ISBN en este caso
  const sku = libro.isbn_libro || libro.attributes?.isbn_libro || '';
  const portada = libro.portada_libro || libro.attributes?.portada_libro;
  const nombre = libro.nombre_libro || libro.attributes?.nombre_libro || '';
  const autor = libro.autor_relacion || libro.attributes?.autor_relacion;
  const editorial = libro.editorial || libro.attributes?.editorial;

  // Validaciones
  const sku_valido = isSKUValido(sku);
  const tiene_imagen = Boolean(portada && (portada.data || portada.id || portada.documentId));
  const tiene_nombre = Boolean(nombre && nombre.trim());
  const tiene_autor = Boolean(autor);
  const tiene_editorial = Boolean(editorial);

  // Campos faltantes (para el selector múltiple)
  const faltantes: string[] = [];
  if (!sku_valido) faltantes.push('ISBN');
  if (!tiene_imagen) faltantes.push('Portada');
  if (!tiene_autor) faltantes.push('Autor');
  if (!tiene_editorial) faltantes.push('Editorial');

  // Campos faltantes (para el JSON de completitud detallado)
  const campos_faltantes: string[] = [];
  if (!sku_valido) campos_faltantes.push('SKU/ISBN válido');
  if (!tiene_imagen) campos_faltantes.push('Imagen del producto');
  if (!tiene_nombre) campos_faltantes.push('Nombre del libro');
  if (!tiene_autor) campos_faltantes.push('Autor(es)');
  if (!tiene_editorial) campos_faltantes.push('Editorial');

  // Score de completitud (0-100)
  const camposRequeridos = 5;
  const camposCompletos = [
    sku_valido,
    tiene_imagen,
    tiene_nombre,
    tiene_autor,
    tiene_editorial,
  ].filter(Boolean).length;
  
  const score = Math.round((camposCompletos / camposRequeridos) * 100);
  const porcentaje_completitud = score;

  // Tiene todos los datos básicos
  const completo = campos_faltantes.length === 0;

  return {
    completo,
    faltantes,
    completitud_basica: {
      sku_valido,
      tiene_imagen,
      tiene_nombre,
      tiene_autor,
      tiene_editorial,
      campos_faltantes,
      score,
      porcentaje_completitud,
    },
  };
}

export default {
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Auto-asignar editorial desde sello si es necesario
    try {
      await actualizarIdsDesdeRelaciones(null, data);
    } catch (error: any) {
      strapi.log.warn(`[libro] Error en actualizarIdsDesdeRelaciones (beforeCreate): ${error?.message || error}`);
      // Continuar con la creación aunque falle
    }

    // Calcular completitud básica antes de crear
    try {
      const completitud = calcularCompletitudBasica(data);
      data.completo = completitud.completo;
      data.faltantes = completitud.faltantes;
      data.completitud_basica = completitud.completitud_basica;
    } catch (error: any) {
      strapi.log.warn(`[libro] Error calculando completitud: ${error?.message || error}`);
      // Establecer valores por defecto
      data.completo = false;
      data.faltantes = [];
      data.completitud_basica = 0;
    }
  },

  async beforeUpdate(event: any) {
    const { data } = event.params;

    // ============================================
    // PROTECCIÓN DE CAMPOS ESTÁTICOS
    // ============================================
    // ⚠️ IMPORTANTE: Proteger campos que no deben modificarse una vez creados
    const CAMPOS_PROTEGIDOS = ['isbn_libro'];
    
    if (event.params.where) {
      const libroExistente = await strapi.entityService.findOne('api::libro.libro', event.params.where.id, {
        populate: ['autor_relacion', 'editorial', 'sello', 'coleccion', 'obra', 'portada_libro'],
      });
      
      if (libroExistente) {
        const libroAttrs = (libroExistente as any).attributes || libroExistente;
        
        // Proteger ISBN: No permitir modificación si ya existe
        if (data.isbn_libro !== undefined && libroAttrs.isbn_libro) {
          const isbnNuevo = String(data.isbn_libro).trim();
          const isbnExistente = String(libroAttrs.isbn_libro).trim();
          
          if (isbnNuevo !== isbnExistente) {
            strapi.log.warn(
              `[libro] ⚠️ Intento de modificar ISBN protegido: ` +
              `Existente: "${isbnExistente}", Intentado: "${isbnNuevo}". ` +
              `Manteniendo ISBN original (campo protegido).`
            );
            // Eliminar isbn_libro de data para que no se actualice
            delete data.isbn_libro;
          } else {
            // Si es el mismo, permitir (no hace daño)
            strapi.log.debug(`[libro] ISBN sin cambios: "${isbnExistente}"`);
          }
        }
        
        // Si se intenta eliminar ISBN y ya existe, protegerlo
        if (data.isbn_libro === null || data.isbn_libro === '') {
          if (libroAttrs.isbn_libro) {
            strapi.log.warn(
              `[libro] ⚠️ Intento de eliminar ISBN protegido: "${libroAttrs.isbn_libro}". ` +
              `Manteniendo ISBN original (campo protegido).`
            );
            delete data.isbn_libro;
          }
        }

        // ============================================
        // PRESERVAR externalIds SI NO SE INCLUYE EN LA ACTUALIZACIÓN
        // ============================================
        // ⚠️ CRÍTICO: Si externalIds no viene en el payload, preservar el existente
        // Esto evita que se pierdan los IDs de WooCommerce y se creen productos duplicados
        if (data.externalIds === undefined && libroAttrs.externalIds) {
          data.externalIds = libroAttrs.externalIds;
          strapi.log.info(
            `[libro] ✅ Preservando externalIds existente: ${JSON.stringify(libroAttrs.externalIds)}`
          );
        }

        // Si se intenta eliminar externalIds (null o vacío) y ya existe, protegerlo
        if (data.externalIds !== undefined && libroAttrs.externalIds) {
          const isEmptyObject = data.externalIds !== null && 
                               typeof data.externalIds === 'object' && 
                               Object.keys(data.externalIds).length === 0;
          
          if (data.externalIds === null || isEmptyObject) {
            data.externalIds = libroAttrs.externalIds;
            strapi.log.warn(
              `[libro] ⚠️ Intento de eliminar externalIds. Manteniendo IDs originales (campo protegido).`
            );
          }
        }
      }

      // Combinar datos existentes con los nuevos
      const libroExistenteAny = libroExistente as any;
      
      // Si se está actualizando el sello y no hay editorial, intentar obtenerla del sello
      if (data.sello !== undefined && (!data.editorial || data.editorial === null)) {
        const selloActual = data.sello || libroExistenteAny?.sello;
        if (selloActual) {
          try {
            const selloId = typeof selloActual === 'object' 
              ? (selloActual.documentId || selloActual.id) 
              : selloActual;
            const sello = await strapi.entityService.findOne('api::sello.sello', selloId, {
              populate: ['editorial'],
            });
            if (sello) {
              const editorialDelSello = (sello as any).editorial;
            if (editorialDelSello) {
              const editorialId = typeof editorialDelSello === 'object'
                ? (editorialDelSello.id || editorialDelSello.documentId)
                : editorialDelSello;
              data.editorial = editorialId;
            }
            }
          } catch (error) {
            strapi.log.warn('[libro] Error al obtener editorial del sello:', error);
          }
        }
      }
      
      const libroCompleto = {
        ...libroExistenteAny,
        ...data,
        // Preservar relaciones si no se están actualizando
        autor_relacion: data.autor_relacion !== undefined ? data.autor_relacion : libroExistenteAny?.autor_relacion,
        editorial: data.editorial !== undefined ? data.editorial : libroExistenteAny?.editorial,
        sello: data.sello !== undefined ? data.sello : libroExistenteAny?.sello,
        coleccion: data.coleccion !== undefined ? data.coleccion : libroExistenteAny?.coleccion,
        obra: data.obra !== undefined ? data.obra : libroExistenteAny?.obra,
        portada_libro: data.portada_libro ?? libroExistenteAny?.portada_libro,
      };

      // Auto-asignar editorial desde sello si es necesario
      await actualizarIdsDesdeRelaciones(libroExistenteAny, data);

      const completitud = calcularCompletitudBasica(libroCompleto);
      data.completo = completitud.completo;
      data.faltantes = completitud.faltantes;
      data.completitud_basica = completitud.completitud_basica;
    } else {
      // Auto-asignar editorial desde sello si es necesario
      await actualizarIdsDesdeRelaciones(null, data);

      // Si no hay where, calcular solo con los datos nuevos
      const completitud = calcularCompletitudBasica(data);
      data.completo = completitud.completo;
      data.faltantes = completitud.faltantes;
      data.completitud_basica = completitud.completitud_basica;
    }
  },

  async afterCreate(event: any) {
    const { result } = event;
    const libroId = result.id || result.documentId;

    // NOTA: Los campos id_* fueron eliminados porque son redundantes
    // Las relaciones ya proporcionan toda la información necesaria

    // Verificar si la sincronización está habilitada antes de intentar sincronizar
    const wooService = strapi.service('api::woo-sync.woo-sync');
    if (wooService && wooService.isSyncEnabled && !wooService.isSyncEnabled()) {
      strapi.log.info(`[libro] ⏭️  Sincronización deshabilitada. Omitiendo sync en afterCreate`);
      return;
    }

    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "Publicado"
    // Si es "Pendiente" o "Borrador", NO se publica en WordPress
    const libroAttrs = result.attributes || result;
    const estadoPublicacionRaw = libroAttrs.estado_publicacion || 'Pendiente';
    const estadoPublicacion = typeof estadoPublicacionRaw === 'string' ? estadoPublicacionRaw : String(estadoPublicacionRaw);
    const estadoPublicacionLower = estadoPublicacion.toLowerCase();
    
    if (estadoPublicacionLower !== 'publicado') {
      strapi.log.info(`[libro] ⏸️ Libro "${libroAttrs.nombre_libro || libroId}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se guarda en Strapi)`);
      return;
    }

    // Sincronizar a WooCommerce si tiene canales
    try {
      await strapi.service('api::libro.libro').syncToWooCommerce(result);
      strapi.log.info(`[libro] ✅ Libro sincronizado a WooCommerce - estado: ${estadoPublicacion}`);
    } catch (error) {
      strapi.log.error('[libro] Error en afterCreate sync:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result } = event;
    const libroId = result.id || result.documentId;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🔄 [LIBRO - afterUpdate ejecutado]');
    console.log(`Libro ID: ${libroId}`);
    console.log(`Nombre: ${result.attributes?.nombre_libro || result.nombre_libro || 'sin nombre'}`);
    console.log('═══════════════════════════════════════════════════════');

    // Verificar si la sincronización está habilitada antes de intentar sincronizar
    const wooService = strapi.service('api::woo-sync.woo-sync');
    if (wooService && wooService.isSyncEnabled && !wooService.isSyncEnabled()) {
      console.log('[libro] ⏭️  Sincronización DESHABILITADA globalmente');
      strapi.log.info(`[libro] ⏭️  Sincronización deshabilitada. Omitiendo sync en afterUpdate`);
      return;
    }

    // IMPORTANTE: Solo sincronizar con WordPress si estado_publicacion === "Publicado"
    // Si es "Pendiente" o "Borrador", NO se publica en WordPress
    const libroAttrs = result.attributes || result;
    const estadoPublicacionRaw = libroAttrs.estado_publicacion || 'Pendiente';
    const estadoPublicacion = typeof estadoPublicacionRaw === 'string' ? estadoPublicacionRaw : String(estadoPublicacionRaw);
    const estadoPublicacionLower = estadoPublicacion.toLowerCase();
    
    console.log(`[libro] Estado de publicación: "${estadoPublicacion}"`);
    
    if (estadoPublicacionLower !== 'publicado') {
      console.log(`[libro] ⏸️  NO se sincroniza: estado !== "Publicado"`);
      strapi.log.info(`[libro] ⏸️ Libro "${libroAttrs.nombre_libro || libroId}" con estado "${estadoPublicacion}" - NO se sincroniza a WooCommerce (solo se actualiza en Strapi)`);
      return;
    }

    console.log(`[libro] ✅ Estado correcto para sincronizar ("Publicado")`);
    console.log(`[libro] 🚀 Llamando a syncToWooCommerce()...`);

    // Sincronizar a WooCommerce si tiene canales
    try {
      const syncResult = await strapi.service('api::libro.libro').syncToWooCommerce(result);
      
      if (syncResult && syncResult.length > 0) {
        console.log(`[libro] ✅ Sincronización completada exitosamente`);
        console.log(`[libro] Plataformas sincronizadas:`, syncResult.map((r: any) => r.platform).join(', '));
        strapi.log.info(`[libro] ✅ Libro sincronizado a WooCommerce - estado: ${estadoPublicacion}`);
      } else {
        console.log(`[libro] ⚠️  syncToWooCommerce() retornó null o vacío`);
        console.log(`[libro] ⚠️  Probablemente no tiene canales asignados`);
      }
    } catch (error) {
      console.error('❌ [libro] ERROR en syncToWooCommerce:');
      console.error(error);
      strapi.log.error('[libro] Error en afterUpdate sync:', error);
    }
    
    console.log('═══════════════════════════════════════════════════════');
  },

  async afterDelete(event: any) {
    const { result } = event;
    
    // Log para debugging
    strapi.log.info(`[libro] 🔍 afterDelete ejecutado para libro ${result?.id || 'sin id'} (documentId: ${result?.documentId || 'sin documentId'}) - nombre: "${result?.nombre_libro || result?.attributes?.nombre_libro || 'sin nombre'}"`);
    
    if (!result) {
      strapi.log.debug(`[libro] ⏭️  afterDelete omitido: result=${!!result}`);
      return;
    }
    
    // Verificar si la sincronización está habilitada antes de intentar sincronizar
    const wooService = strapi.service('api::woo-sync.woo-sync');
    if (wooService && wooService.isSyncEnabled && !wooService.isSyncEnabled()) {
      strapi.log.info(`[libro] ⏭️  Sincronización deshabilitada. Omitiendo sync en afterDelete`);
      return;
    }
    
    // Prevenir ejecuciones múltiples usando un flag en el objeto result
    if ((result as any).__wooSyncDeleteProcessed) {
      strapi.log.debug(`[libro] ⏭️  afterDelete ya procesado para libro ${result.id}, omitiendo`);
      return;
    }
    (result as any).__wooSyncDeleteProcessed = true;
    
    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
      
      // PASO 1: Verificar si el libro realmente fue eliminado (puede ser draft/publish)
      try {
        if (result.documentId) {
          const librosConMismoDocumentId = await strapi.db.query('api::libro.libro').findMany({
            where: {
              documentId: result.documentId,
            },
          });
          
          if (librosConMismoDocumentId.length > 0) {
            strapi.log.info(`[libro] ⏭️  afterDelete omitido: existen otros libros con mismo documentId (${librosConMismoDocumentId.map((l: any) => l.id).join(', ')}), probablemente draft/publish`);
            return;
          }
        }
      } catch (error) {
        strapi.log.warn(`[libro] ⚠️  Error verificando libros con mismo documentId: ${error}`);
      }
      
      // PASO 2: Obtener externalIds desde la base de datos
      let externalIds: Record<string, any> = {};
      try {
        if (result.id) {
          const libroCompleto = await strapi.db.query('api::libro.libro').findOne({
            where: { id: result.id },
          });
          if (libroCompleto) {
            strapi.log.info(`[libro] ⏭️  afterDelete omitido: libro ${result.id} aún existe en BD, no se elimina`);
            return;
          }
          externalIds = result.externalIds || {};
        } else {
          externalIds = result.externalIds || {};
        }
      } catch (error) {
        strapi.log.warn(`[libro] ⚠️  Error verificando libro en BD, usando result.externalIds: ${error}`);
        externalIds = result.externalIds || {};
      }
      
      // PASO 3: Verificar estado_publicacion - solo eliminar de WooCommerce si estaba publicado
      const libroAttrs = result.attributes || result;
      const estadoPublicacionRaw = libroAttrs.estado_publicacion || result.estado_publicacion || result.estadoPublicacion;
      const estadoPublicacion = estadoPublicacionRaw ? String(estadoPublicacionRaw).toLowerCase() : '';
      if (estadoPublicacion !== 'publicado') {
        strapi.log.info(`[libro] ⏭️  afterDelete omitido: estado_publicacion="${estadoPublicacion || 'no definido'}" (solo se elimina de WooCommerce si estaba "publicado")`);
        return;
      }
      
      // PASO 4: Verificar si hay otros libros con los mismos externalIds antes de eliminar
      for (const platform of platforms) {
        const wooId = externalIds[platform];
        if (wooId) {
          try {
            const todosLosLibros = await strapi.db.query('api::libro.libro').findMany({
              where: {},
            });
            
            const librosConMismoExternalId = todosLosLibros.filter((libro: any) => {
              const libroExternalIds = libro.externalIds || {};
              return libroExternalIds[platform] === wooId && libro.id !== result.id;
            });
            
            if (librosConMismoExternalId.length > 0) {
              strapi.log.warn(`[libro] ⚠️  No se elimina producto ${wooId} de ${platform} porque otros libros (${librosConMismoExternalId.map((l: any) => l.id).join(', ')}) también lo usan`);
              continue;
            }
          } catch (error) {
            strapi.log.warn(`[libro] ⚠️  Error verificando otros libros con mismo externalId: ${error}`);
          }
        }
      }
      
      // PASO 5: Eliminar productos de WooCommerce
      const wooApiClient = strapi.service('api::woo-sync.woo-api-client');
      if (!wooApiClient) {
        strapi.log.warn('[libro] ⚠️ Servicio woo-api-client no disponible');
        return;
      }
      
      for (const platform of platforms) {
        const wooConfig = wooSyncService.getWooConfig(platform);
        if (!wooConfig) continue;
        
        const wooId = externalIds[platform];
        
        if (!wooId) {
          strapi.log.debug(`[libro] ⏭️  No hay externalId para ${platform}, omitiendo eliminación`);
          continue;
        }
        
        try {
          await wooApiClient.deleteProduct(wooConfig, wooId);
          strapi.log.info(`[libro] ✅ Producto eliminado de ${platform}: ${wooId}`);
        } catch (error: any) {
          if (error.status === 404) {
            strapi.log.info(`[libro] ⏭️  Producto ${wooId} ya no existe en ${platform}, probablemente ya fue eliminado`);
          } else {
            strapi.log.warn(`[libro] ⚠️  No se pudo eliminar producto ${wooId} de ${platform}: ${error.message || error}`);
          }
        }
      }
    } catch (error) {
      strapi.log.error('[libro] ❌ Error eliminando libro de WooCommerce:', error);
    }
  },
};

