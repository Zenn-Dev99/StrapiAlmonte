import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::evaluacion.evaluacion' as any, ({ strapi }) => ({
  async create(ctx: any) {
    try {
      strapi.log.info('[evaluacion.create] Iniciando creación de evaluación...');
      strapi.log.info('[evaluacion.create] Method:', ctx.request.method);
      strapi.log.info('[evaluacion.create] URL:', ctx.request.url);
      
      const contentType = ctx.request.headers['content-type'] || '';
      const isMultipart = contentType.includes('multipart/form-data');
      
      strapi.log.info('[evaluacion.create] Content-Type:', contentType);
      strapi.log.info('[evaluacion.create] Es multipart:', isMultipart);
      strapi.log.info('[evaluacion.create] ctx.request.body type:', typeof ctx.request.body);
      strapi.log.info('[evaluacion.create] ctx.request.body keys:', ctx.request.body ? Object.keys(ctx.request.body) : 'null/undefined');
      strapi.log.info('[evaluacion.create] ctx.request.body completo:', JSON.stringify(ctx.request.body, null, 2));

      let parsedData: any = null;
      let files: any = null;

      // Si es multipart, parsear FormData
      if (isMultipart) {
        // En Strapi v5, cuando se envía FormData, el campo 'data' viene como string JSON
        // y los archivos vienen en ctx.request.files
        parsedData = ctx.request.body?.data || ctx.request.body;
        files = ctx.request.files;
        
        strapi.log.info('[evaluacion.create] FormData detectado');
        strapi.log.info('[evaluacion.create] ctx.request.body keys:', ctx.request.body ? Object.keys(ctx.request.body) : 'vacío');
        strapi.log.info('[evaluacion.create] ctx.request.files keys:', files ? Object.keys(files) : 'no hay archivos');
        
        // Si data viene como string (desde FormData), parsearlo
        if (typeof parsedData === 'string') {
          try {
            parsedData = JSON.parse(parsedData);
            strapi.log.info('[evaluacion.create] Data parseado desde string JSON');
          } catch (jsonError: any) {
            strapi.log.error('[evaluacion.create] Error al parsear JSON del campo data:', jsonError.message);
            strapi.log.error('[evaluacion.create] Data recibido (primeros 200 chars):', parsedData?.substring(0, 200));
            return ctx.badRequest('Error al procesar los datos de la evaluación: formato JSON inválido en campo "data"');
          }
        }
      } else {
        // Si no es multipart, leer directamente de ctx.request.body
        parsedData = ctx.request.body?.data || ctx.request.body;
        files = ctx.request.files;
        strapi.log.info('[evaluacion.create] Datos desde JSON:', JSON.stringify(parsedData, null, 2));
      }

      // Validar que parsedData existe y tiene los campos requeridos
      if (!parsedData || typeof parsedData !== 'object') {
        strapi.log.error('[evaluacion.create] Data inválido o faltante. ctx.request.body:', ctx.request.body);
        return ctx.badRequest('Missing "data" payload in the request body');
      }

      // Validar campos requeridos
      if (!parsedData.nombre) {
        return ctx.badRequest('El campo "nombre" es requerido');
      }
      if (!parsedData.cantidad_preguntas) {
        return ctx.badRequest('El campo "cantidad_preguntas" es requerido');
      }
      if (!parsedData.libro_mira) {
        return ctx.badRequest('El campo "libro_mira" es requerido');
      }

      // Asegurar que libro_mira sea un número
      const libroMiraId = typeof parsedData.libro_mira === 'string' 
        ? parseInt(parsedData.libro_mira, 10) 
        : parsedData.libro_mira;

      if (isNaN(libroMiraId)) {
        return ctx.badRequest('El campo "libro_mira" debe ser un ID válido');
      }

      // Verificar que el libro_mira existe
      const libroMira = await strapi.entityService.findOne('api::libro-mira.libro-mira' as any, libroMiraId, {
        fields: ['id'],
      });

      if (!libroMira) {
        return ctx.badRequest(`No se encontró un libro MIRA con ID ${libroMiraId}`);
      }

      // Preparar los datos para crear la evaluación
      const dataToCreate = {
        nombre: parsedData.nombre,
        categoria: parsedData.categoria || null,
        cantidad_preguntas: parsedData.cantidad_preguntas,
        libro_mira: libroMiraId,
        pauta_respuestas: parsedData.pauta_respuestas || {},
        activo: parsedData.activo !== undefined ? parsedData.activo : true,
      };

      strapi.log.info('[evaluacion.create] Datos preparados:', JSON.stringify(dataToCreate, null, 2));

      // Verificar si hay archivos
      // Los archivos pueden venir en diferentes formatos dependiendo de cómo se parseó
      const hojaMaestraImagen = files?.['files.hoja_maestra_imagen'] 
        || files?.['hoja_maestra_imagen']
        || (Array.isArray(files) && files[0]) 
        || (files && Object.values(files)[0]);

      // Si hay archivos, usar entityService.create con files
      if (hojaMaestraImagen) {
        strapi.log.info('[evaluacion.create] Creando evaluación con imagen...');
        const result = await strapi.entityService.create('api::evaluacion.evaluacion' as any, {
          data: dataToCreate,
          files: {
            hoja_maestra_imagen: hojaMaestraImagen,
          },
        });

        strapi.log.info('[evaluacion.create] Evaluación creada exitosamente con imagen:', result.id);
        return ctx.created(result);
      } else {
        // Si no hay archivos, crear normalmente
        strapi.log.info('[evaluacion.create] Creando evaluación sin imagen...');
        const result = await strapi.entityService.create('api::evaluacion.evaluacion' as any, {
          data: dataToCreate,
        });

        strapi.log.info('[evaluacion.create] Evaluación creada exitosamente:', result.id);
        return ctx.created(result);
      }
    } catch (error: any) {
      strapi.log.error('[evaluacion.create] Error:', error);
      return ctx.internalServerError(
        process.env.NODE_ENV === 'development'
          ? `Error al crear evaluación: ${error.message}`
          : 'Error al crear la evaluación'
      );
    }
  },

  async find(ctx: any) {
    try {
      strapi.log.info('[evaluacion.find] Iniciando búsqueda de evaluaciones...');
      
      // Parsear parámetros del query string
      const pageSize = ctx.query.pagination?.pageSize 
        ? parseInt(ctx.query.pagination.pageSize, 10) 
        : (ctx.query['pagination[pageSize]'] ? parseInt(ctx.query['pagination[pageSize]'], 10) : 50);
      
      const page = ctx.query.pagination?.page 
        ? parseInt(ctx.query.pagination.page, 10) 
        : (ctx.query['pagination[page]'] ? parseInt(ctx.query['pagination[page]'], 10) : 1);
      
      const offset = (page - 1) * pageSize;

      // Parsear sort del query string (formato: sort[0]=createdAt:desc)
      let orderBy: any[] = [{ createdAt: 'desc' }]; // Default
      
      if (ctx.query.sort) {
        // Si viene como objeto parseado
        if (Array.isArray(ctx.query.sort)) {
          orderBy = ctx.query.sort.map((s: string) => {
            const [field, direction] = s.split(':');
            return { [field]: direction || 'asc' };
          });
        } else if (typeof ctx.query.sort === 'object') {
          orderBy = Object.entries(ctx.query.sort).map(([field, direction]) => ({
            [field]: direction || 'asc',
          }));
        }
      } else {
        // Intentar parsear desde query string directo (sort[0]=createdAt:desc)
        const sortKeys = Object.keys(ctx.query).filter(key => key.startsWith('sort['));
        if (sortKeys.length > 0) {
          orderBy = sortKeys
            .sort()
            .map(key => {
              const value = ctx.query[key];
              if (typeof value === 'string' && value.includes(':')) {
                const [field, direction] = value.split(':');
                return { [field]: direction || 'asc' };
              }
              return null;
            })
            .filter(Boolean) as any[];
          
          if (orderBy.length === 0) {
            orderBy = [{ createdAt: 'desc' }];
          }
        }
      }

      strapi.log.info('[evaluacion.find] orderBy:', JSON.stringify(orderBy));

      // Usar entityService en lugar de db.query para evitar duplicados con populate anidado
      // entityService maneja mejor los populate y no genera duplicados
      const evaluaciones = await strapi.entityService.findMany('api::evaluacion.evaluacion' as any, {
        filters: ctx.query.filters || {},
        populate: {
          libro_mira: {
            populate: {
              libro: {
                fields: ['nombre_libro', 'isbn_libro'],
              },
            },
          },
          hoja_maestra_imagen: true,
        },
        sort: orderBy.length > 0 ? orderBy.map((o: any) => {
          const key = Object.keys(o)[0];
          const value = o[key];
          return `${key}:${value}`;
        }).join(',') : 'createdAt:desc',
        pagination: {
          page,
          pageSize,
        },
      });

      // Asegurar que no haya duplicados por ID o documentId (doble verificación)
      const evaluacionesUnicas = evaluaciones.reduce((acc: any[], evaluacion: any) => {
        const id = evaluacion.id || evaluacion.documentId;
        const existe = acc.find((e: any) => (e.id === id || e.documentId === id) || (evaluacion.documentId && e.documentId === evaluacion.documentId));
        if (!existe) {
          acc.push(evaluacion);
        }
        return acc;
      }, []);

      strapi.log.info(`[evaluacion.find] Encontradas ${evaluaciones.length} evaluaciones (${evaluacionesUnicas.length} únicas después de deduplicar)`);
      
      const evaluacionesFinales = evaluacionesUnicas;

      // Contar total para paginación usando entityService
      const total = await strapi.entityService.count('api::evaluacion.evaluacion' as any, {
        filters: ctx.query.filters || {},
      });

      const pageCount = Math.ceil(total / pageSize);

      return ctx.send({
        data: evaluacionesFinales,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount,
            total,
          },
        },
      });
    } catch (error: any) {
      strapi.log.error('[evaluacion.find] Error:', error);
      return ctx.internalServerError(error.message || 'Error al obtener evaluaciones');
    }
  },
}));
