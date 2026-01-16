import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::libro-mira.libro-mira' as any, ({ strapi }) => ({
  async find(ctx: any) {
    try {
      strapi.log.info('[libro-mira.find] Iniciando búsqueda de libros MIRA...');
      
      // Obtener todos los libros MIRA publicados y activos
      const librosMira = await strapi.db.query('api::libro-mira.libro-mira').findMany({
        where: {
          activo: true,
          publishedAt: { $notNull: true },
        },
        populate: ['libro'],
      });

      strapi.log.info(`[libro-mira.find] Encontrados ${librosMira.length} libros MIRA publicados`);

      // Filtrar y formatear solo los que tienen relación libro con nombre_libro
      const librosConLibro = [];
      for (const libroMira of librosMira) {
        try {
          if (libroMira.libro && libroMira.libro.nombre_libro) {
            librosConLibro.push({
              id: libroMira.id,
              documentId: libroMira.documentId,
              activo: libroMira.activo,
              libro: {
                id: libroMira.libro.id,
                nombre_libro: libroMira.libro.nombre_libro,
                isbn_libro: libroMira.libro.isbn_libro || null,
              },
            });
            strapi.log.info(`[libro-mira.find] Libro MIRA ${libroMira.id} tiene relación libro: ${libroMira.libro.nombre_libro}`);
          } else {
            strapi.log.warn(`[libro-mira.find] Libro MIRA ${libroMira.id} no tiene relación libro o sin nombre_libro`);
          }
        } catch (error: any) {
          strapi.log.error(`[libro-mira.find] Error al procesar libro MIRA ${libroMira.id}:`, error.message);
        }
      }

      strapi.log.info(`[libro-mira.find] Total libros MIRA con relación libro: ${librosConLibro.length}`);

      return ctx.send({
        data: librosConLibro,
        meta: {
          pagination: {
            page: 1,
            pageSize: librosConLibro.length,
            pageCount: 1,
            total: librosConLibro.length,
          },
        },
      });
    } catch (error: any) {
      strapi.log.error('[libro-mira.find] Error:', error);
      return ctx.internalServerError(error.message || 'Error al obtener libros MIRA');
    }
  },

  /**
   * Override findOne para manejar tanto id numérico como documentId
   * y asegurar que solo devuelva registros publicados
   */
  async findOne(ctx: any) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.badRequest('ID es requerido');
    }

    try {
      strapi.log.info(`[libro-mira.findOne] Buscando libro-mira con ID: ${id}`);

      // Intentar buscar por id numérico primero
      let libroMira = null;
      
      // Si es un número, buscar por id
      if (!isNaN(Number(id))) {
        libroMira = await strapi.entityService.findOne('api::libro-mira.libro-mira' as any, Number(id), {
          populate: {
            libro: {
              populate: {
                portada_libro: true,
                autor_relacion: true,
              },
            },
          },
        });
      }

      // Si no se encontró o el ID es un string (documentId), buscar por documentId
      if (!libroMira) {
        strapi.log.info(`[libro-mira.findOne] Buscando por documentId: ${id}`);
        
        // Intentar con entityService primero
        let libros = await strapi.entityService.findMany('api::libro-mira.libro-mira' as any, {
          filters: {
            documentId: id,
            publishedAt: { $notNull: true }, // Solo publicados
          },
          populate: {
            libro: {
              populate: {
                portada_libro: true,
                autor_relacion: true,
              },
            },
          },
          limit: 1,
        });

        // Si no funciona con entityService, intentar con db.query
        if (!libros || libros.length === 0) {
          strapi.log.info(`[libro-mira.findOne] entityService no encontró, intentando con db.query...`);
          const librosDB = await strapi.db.query('api::libro-mira.libro-mira').findMany({
            where: {
              documentId: id,
              publishedAt: { $notNull: true },
            },
            populate: {
              libro: {
                populate: {
                  portada_libro: true,
                  autor_relacion: true,
                },
              },
            },
            limit: 1,
          });
          
          if (librosDB && librosDB.length > 0) {
            libros = librosDB;
            strapi.log.info(`[libro-mira.findOne] Libro encontrado con db.query`);
          }
        }

        if (libros && libros.length > 0) {
          libroMira = libros[0];
          strapi.log.info(`[libro-mira.findOne] Libro encontrado por documentId: ID=${libroMira.id}, documentId=${libroMira.documentId}`);
        } else {
          // Intentar buscar todos los libros publicados para debug
          const todosLosLibros = await strapi.entityService.findMany('api::libro-mira.libro-mira' as any, {
            filters: {
              publishedAt: { $notNull: true },
            },
            fields: ['id', 'documentId'],
            limit: 10,
          });
          strapi.log.warn(`[libro-mira.findOne] No se encontró libro con documentId: ${id}`);
          strapi.log.warn(`[libro-mira.findOne] Libros publicados disponibles: ${todosLosLibros.length}`);
          if (todosLosLibros.length > 0) {
            strapi.log.warn(`[libro-mira.findOne] Primeros libros: ${todosLosLibros.map((l: any) => `ID=${l.id}, docId=${l.documentId}`).join(', ')}`);
          }
        }
      }

      if (!libroMira) {
        strapi.log.warn(`[libro-mira.findOne] Libro-mira no encontrado con ID: ${id}`);
        return ctx.notFound('Libro no encontrado o no está publicado');
      }

      // Verificar que esté publicado
      if (!libroMira.publishedAt) {
        strapi.log.warn(`[libro-mira.findOne] Libro-mira encontrado pero no está publicado: ${id}`);
        return ctx.notFound('Libro no encontrado o no está publicado');
      }

      strapi.log.info(`[libro-mira.findOne] Libro-mira encontrado: ${libroMira.id || libroMira.documentId}`);

      return ctx.send({
        data: libroMira,
      });
    } catch (error: any) {
      strapi.log.error(`[libro-mira.findOne] Error:`, error);
      return ctx.internalServerError('Error al obtener el libro');
    }
  },
}));

