import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::libro.libro' as any, ({ strapi }) => ({
  /**
   * Crear o actualizar libro basado en externalIds o isbn_libro
   * Si viene externalIds, busca por ese campo
   * Si no, busca por isbn_libro
   * Si existe, actualiza; si no, crea uno nuevo
   */
  async create(ctx: any) {
    const { data } = ctx.request.body;
    
    if (!data) {
      return ctx.badRequest('Se requiere el campo "data" en el body');
    }

    try {
      let libroExistente = null;
      
      // Si viene externalIds, buscar por ese campo (compatibilidad con woocommerce_id legacy)
      const wooId = data.woocommerce_id || (data.externalIds && (data.externalIds.woo_moraleja || data.externalIds.woo_escolar));
      if (wooId) {
        // Buscar por externalIds usando JSON filter
        const libros = await strapi.entityService.findMany('api::libro.libro', {
          filters: {
            $or: [
              { externalIds: { $contains: { woo_moraleja: String(wooId) } } },
              { externalIds: { $contains: { woo_escolar: String(wooId) } } },
            ],
          } as any,
          limit: 1,
        }) as any[];
        
        if (libros.length > 0) {
          libroExistente = libros[0];
          strapi.log.info(`[libro] Libro encontrado por externalIds: ${wooId} → ID: ${libroExistente.id}`);
        }
      }
      
      // Si no se encontró por externalIds y viene isbn_libro, buscar por ISBN
      if (!libroExistente && data.isbn_libro) {
        try {
          const libros = await strapi.entityService.findMany('api::libro.libro', {
            filters: {
              isbn_libro: { $eq: data.isbn_libro },
            },
            limit: 1,
          }) as any[];
          
          if (libros.length > 0) {
            libroExistente = libros[0];
            strapi.log.info(`[libro] Libro encontrado por ISBN: ${data.isbn_libro} → ID: ${libroExistente.id}`);
          }
        } catch (error) {
          // Si no existe, continuar para crear uno nuevo
          strapi.log.debug(`[libro] No se encontró libro por ISBN: ${data.isbn_libro}`);
        }
      }
      
      // Si existe, actualizar
      if (libroExistente) {
        const libroId = libroExistente.id || libroExistente.documentId;
        
        // Preparar datos para actualizar
        const updateData: any = { ...data };
        
        // Actualizar externalIds si viene woocommerce_id (compatibilidad legacy) o externalIds
        if (data.woocommerce_id || data.externalIds) {
          const externalIds = { ...(libroExistente.externalIds || {}) };
          
          // Si viene woocommerce_id legacy, intentar determinar plataforma
          if (data.woocommerce_id && !data.externalIds) {
            // Por defecto, guardar en ambas plataformas si no se especifica
            externalIds.woo_moraleja = String(data.woocommerce_id);
            externalIds.woo_escolar = String(data.woocommerce_id);
          } else if (data.externalIds) {
            // Usar externalIds proporcionado
            Object.assign(externalIds, data.externalIds);
          }
          
          updateData.externalIds = externalIds;
        }
        
        const updated = await strapi.entityService.update('api::libro.libro', libroId, {
          data: updateData,
          populate: ctx.query.populate || '*',
        });
        
        strapi.log.info(`[libro] Libro actualizado: ${libroId}`);
        
        return {
          data: updated,
          meta: {
            action: 'updated',
            id: libroId,
          },
        };
      }
      
      // Si no existe, crear uno nuevo
      const createData: any = { ...data };
      
      // Actualizar externalIds si viene woocommerce_id (compatibilidad legacy) o externalIds
      if (data.woocommerce_id || data.externalIds) {
        const externalIds: any = {};
        
        // Si viene woocommerce_id legacy, intentar determinar plataforma
        if (data.woocommerce_id && !data.externalIds) {
          // Por defecto, guardar en ambas plataformas si no se especifica
          externalIds.woo_moraleja = String(data.woocommerce_id);
          externalIds.woo_escolar = String(data.woocommerce_id);
        } else if (data.externalIds) {
          // Usar externalIds proporcionado
          Object.assign(externalIds, data.externalIds);
        }
        
        createData.externalIds = externalIds;
      }
      
      const created = await strapi.entityService.create('api::libro.libro', {
        data: createData,
        populate: ctx.query.populate || '*',
      });
      
      strapi.log.info(`[libro] Libro creado: ${created.id}`);
      
      return {
        data: created,
        meta: {
          action: 'created',
          id: created.id,
        },
      };
    } catch (error: any) {
      strapi.log.error('[libro] Error en create:', error);
      return ctx.badRequest(error.message || 'Error al crear/actualizar libro');
    }
  },

  async find(ctx: any) {
    // Parsear manualmente los parámetros de paginación desde ctx.query
    const query = { ...ctx.query };
    
    // Extraer paginación manualmente si viene en el formato pagination[page]
    let page = 1;
    let pageSize = 25;
    
    if (query.pagination) {
      if (typeof query.pagination === 'object') {
        page = parseInt(String(query.pagination.page || '1'), 10);
        pageSize = parseInt(String(query.pagination.pageSize || '25'), 10);
      }
    }
    
    // Calcular start y limit para findMany
    const start = (page - 1) * pageSize;
    const limit = pageSize;
    
    // Usar findMany con start y limit en lugar de findPage
    // Esto evita problemas con la paginación cuando hay populate complejo
    const [results, total] = await Promise.all([
      strapi.entityService.findMany('api::libro.libro', {
        start,
        limit,
        sort: query.sort || { id: 'asc' },
        populate: query.populate || '*',
        filters: query.filters,
      }),
      strapi.entityService.count('api::libro.libro', {
        filters: query.filters,
      }),
    ]);
    
    // Calcular información de paginación
    const pageCount = Math.ceil(total / pageSize);
    const pagination = {
      page,
      pageSize,
      pageCount,
      total,
    };
    
    // Si no hay datos, devolver respuesta vacía
    if (!results || results.length === 0) {
      return {
        data: [],
        meta: {
          pagination,
        },
      };
    }
    
    // Formatear la respuesta: remover campos id_* cuando son NULL para que se muestren vacíos
    const formattedResults = results.map((libro: any) => {
      const formatted = { ...libro };
      
      // Remover campos id_* cuando son NULL (Strapi no los mostrará en lugar de "-")
      if (formatted.id_editorial === null || formatted.id_editorial === undefined) {
        delete formatted.id_editorial;
      }
      if (formatted.id_autor === null || formatted.id_autor === undefined) {
        delete formatted.id_autor;
      }
      if (formatted.id_sello === null || formatted.id_sello === undefined) {
        delete formatted.id_sello;
      }
      if (formatted.id_coleccion === null || formatted.id_coleccion === undefined) {
        delete formatted.id_coleccion;
      }
      if (formatted.id_obra === null || formatted.id_obra === undefined) {
        delete formatted.id_obra;
      }
      
      // También formatear attributes si existe
      if (formatted.attributes) {
        if (formatted.attributes.id_editorial === null || formatted.attributes.id_editorial === undefined) {
          delete formatted.attributes.id_editorial;
        }
        if (formatted.attributes.id_autor === null || formatted.attributes.id_autor === undefined) {
          delete formatted.attributes.id_autor;
        }
        if (formatted.attributes.id_sello === null || formatted.attributes.id_sello === undefined) {
          delete formatted.attributes.id_sello;
        }
        if (formatted.attributes.id_coleccion === null || formatted.attributes.id_coleccion === undefined) {
          delete formatted.attributes.id_coleccion;
        }
        if (formatted.attributes.id_obra === null || formatted.attributes.id_obra === undefined) {
          delete formatted.attributes.id_obra;
        }
      }
      
      return formatted;
    });
    
    return {
      data: formattedResults,
      meta: {
        pagination,
      },
    };
  },

  // Método personalizado para agregar precio a un libro
  async agregarPrecio(ctx: any) {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[Libro - Agregar Precio] Solicitud recibida');
      console.log('[Libro - Agregar Precio] Body:', JSON.stringify(ctx.request.body, null, 2));
      
      const { libroId, precio_venta, precio_costo, fecha_inicio, fecha_fin, activo } = ctx.request.body;
      
      // Validaciones
      if (!libroId) {
        console.error('[Libro - Agregar Precio] Error: libroId falta');
        return ctx.badRequest('libroId es requerido');
      }
      
      if (!precio_venta || precio_venta <= 0) {
        console.error('[Libro - Agregar Precio] Error: precio_venta inválido');
        return ctx.badRequest('precio_venta es requerido y debe ser mayor a 0');
      }
      
      if (!fecha_inicio) {
        console.error('[Libro - Agregar Precio] Error: fecha_inicio falta');
        return ctx.badRequest('fecha_inicio es requerida');
      }
      
      console.log('[Libro - Agregar Precio] Validaciones OK');
      console.log('[Libro - Agregar Precio] Creando precio...');
      
      // Crear el precio usando entityService
      const nuevoPrecio = await strapi.entityService.create('api::precio.precio', {
        data: {
          precio_venta: parseFloat(precio_venta),
          libro: parseInt(libroId),
          fecha_inicio: new Date(fecha_inicio),
          precio_costo: precio_costo ? parseFloat(precio_costo) : null,
          fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
          activo: activo !== undefined ? activo : true,
        },
      });
      
      console.log('[Libro - Agregar Precio] ✅ Precio creado exitosamente');
      console.log('[Libro - Agregar Precio] ID:', nuevoPrecio.id);
      console.log('═══════════════════════════════════════════════════════');
      
      return ctx.send({
        data: nuevoPrecio,
        message: 'Precio agregado exitosamente al libro'
      });
      
    } catch (error: any) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('[Libro - Agregar Precio] ❌ ERROR:', error.message);
      console.error('[Libro - Agregar Precio] Stack:', error.stack);
      console.error('═══════════════════════════════════════════════════════');
      
      return ctx.badRequest(error.message || 'Error al agregar precio');
    }
  },
}));
