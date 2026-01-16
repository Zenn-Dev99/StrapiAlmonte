import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::intranet-chat.intranet-chat', ({ strapi }) => ({
  /**
   * Controller personalizado que IGNORA permisos y devuelve TODOS los campos
   * Esto soluciona el problema de que remitente_id no se devuelve por restricciones de permisos
   */
  async find(ctx) {
    // Extraer filtros del query de Strapi (formato: filters[remitente_id][$eq]=X)
    const filters: any = (ctx.query as any).filters || {};
    
    // Extraer valores de los filtros
    // IMPORTANTE: NO hacer filtro bidireccional aquí, el frontend ya hace dos queries separadas
    let remitenteId: number | null = null;
    let clienteId: number | null = null;
    
    if (filters.remitente_id?.$eq) {
      remitenteId = parseInt(String(filters.remitente_id.$eq));
    }
    if (filters.cliente_id?.$eq) {
      clienteId = parseInt(String(filters.cliente_id.$eq));
    }

    // SIEMPRE usar db.query directamente para BYPASS completo de permisos
    // Esto garantiza que TODOS los campos se devuelvan, sin importar los permisos
    const tableName = 'intranet_chats';
    const knex = strapi.db.connection;

    let query = knex(tableName);

    // Aplicar filtros EXACTOS (no bidireccional)
    // El frontend ya maneja la bidireccionalidad haciendo dos queries separadas
    if (remitenteId && clienteId) {
      query = query.where({ remitente_id: remitenteId, cliente_id: clienteId });
    } else if (remitenteId) {
      query = query.where({ remitente_id: remitenteId });
    } else if (clienteId) {
      query = query.where({ cliente_id: clienteId });
    }

    // Aplicar filtro de fecha si existe
    if (filters.fecha?.$gt) {
      query = query.where('fecha', '>', filters.fecha.$gt);
    }

    // Aplicar ordenamiento
    const sort = String((ctx.query as any).sort || 'fecha:asc');
    const [sortField, sortOrder] = sort.split(':');
    query = query.orderBy(sortField || 'fecha', sortOrder === 'desc' ? 'desc' : 'asc');

    // Aplicar paginación si existe
    const pagination = (ctx.query as any).pagination;
    if (pagination) {
      const pageSize = parseInt(String(pagination.pageSize || '1000'));
      query = query.limit(pageSize);
    }

    const rawResults = await query;

    // Mapear resultados a formato Strapi (formato v4)
    const mappedResults = rawResults.map((row: any) => ({
      id: row.id,
      attributes: {
        texto: row.texto,
        remitente_id: row.remitente_id,
        cliente_id: row.cliente_id,
        fecha: row.fecha,
        leido: row.leido === 1 || row.leido === true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }));

    return ctx.send({ data: mappedResults });
  },

  async findOne(ctx) {
    const { id } = ctx.params;

    // SIEMPRE usar db.query directamente para BYPASS completo de permisos
    const tableName = 'intranet_chats';
    const knex = strapi.db.connection;
    const rawResult = await knex(tableName).where({ id }).first();

    if (rawResult) {
      // Mapear a formato Strapi v4
      const mappedResult = {
        id: rawResult.id,
        attributes: {
          texto: rawResult.texto,
          remitente_id: rawResult.remitente_id,
          cliente_id: rawResult.cliente_id,
          fecha: rawResult.fecha,
          leido: rawResult.leido === 1 || rawResult.leido === true,
          createdAt: rawResult.created_at,
          updatedAt: rawResult.updated_at,
        },
      };
      return ctx.send({ data: mappedResult });
    }

    return ctx.notFound();
  },

  async create(ctx) {
    // Log inmediato al entrar al método
    strapi.log.info('[intranet-chat create] 🚀 MÉTODO CREATE LLAMADO', {
      method: ctx.request.method,
      url: ctx.request.url,
      hasBody: !!ctx.request.body,
      bodyKeys: ctx.request.body ? Object.keys(ctx.request.body) : [],
    });

    try {
      const body = ctx.request.body.data || ctx.request.body;
      
      strapi.log.info('[intranet-chat create] Body recibido:', {
        bodyKeys: Object.keys(body || {}),
        hasData: !!ctx.request.body.data,
        bodyType: typeof body,
        bodyContent: JSON.stringify(body).substring(0, 500),
      });

      const { texto, remitente_id, cliente_id } = body || {};

      if (!texto || remitente_id === undefined || remitente_id === null || cliente_id === undefined || cliente_id === null) {
        strapi.log.error('[intranet-chat create] Faltan campos requeridos:', {
          tieneTexto: !!texto,
          tieneRemitenteId: remitente_id !== undefined && remitente_id !== null,
          tieneClienteId: cliente_id !== undefined && cliente_id !== null,
          body: JSON.stringify(body).substring(0, 200),
        });
        return ctx.badRequest('Faltan campos requeridos: texto, remitente_id, cliente_id');
      }

      // Normalizar IDs
      const remitenteIdNum = parseInt(String(remitente_id));
      const clienteIdNum = parseInt(String(cliente_id));

      if (isNaN(remitenteIdNum) || isNaN(clienteIdNum)) {
        strapi.log.error('[intranet-chat create] IDs inválidos:', {
          remitente_id,
          cliente_id,
          remitenteIdNum,
          clienteIdNum,
        });
        return ctx.badRequest('remitente_id y cliente_id deben ser números válidos');
      }

      // Usar acceso directo a la base de datos para asegurar que se guarde correctamente
      const tableName = 'intranet_chats';
      const knex = strapi.db.connection;
      const fecha = new Date();
      strapi.log.info('[intranet-chat create] Intentando crear mensaje:', {
        texto: String(texto).substring(0, 50),
        remitente_id: remitenteIdNum,
        cliente_id: clienteIdNum,
      });

      // Insertar directamente en la base de datos con returning para PostgreSQL
      const insertResult = await knex(tableName)
        .insert({
          texto: String(texto),
          remitente_id: remitenteIdNum,
          cliente_id: clienteIdNum,
          fecha: fecha.toISOString(),
          leido: false,
          created_at: fecha.toISOString(),
          updated_at: fecha.toISOString(),
        })
        .returning('id');

      strapi.log.info('[intranet-chat create] Resultado del insert:', { insertResult });

      // En PostgreSQL, returning devuelve un array de objetos: [{ id: X }]
      // En SQLite, puede devolver directamente el ID o un array
      let insertedId: number | undefined;
      
      if (Array.isArray(insertResult) && insertResult.length > 0) {
        const firstResult = insertResult[0];
        if (typeof firstResult === 'object' && firstResult !== null && 'id' in firstResult) {
          insertedId = (firstResult as any).id;
        } else if (typeof firstResult === 'number') {
          insertedId = firstResult;
        }
      }

      // Si no se obtuvo el ID, intentar obtener el último registro
      if (!insertedId) {
        strapi.log.warn('[intranet-chat create] No se obtuvo ID del returning, buscando último registro');
        const lastRecord = await knex(tableName).orderBy('id', 'desc').first();
        if (lastRecord) {
          insertedId = lastRecord.id;
        }
      }

      if (!insertedId) {
        strapi.log.error('[intranet-chat create] No se pudo obtener el ID del mensaje insertado');
        return ctx.internalServerError('Error al crear mensaje: no se pudo obtener el ID');
      }

      strapi.log.info('[intranet-chat create] ID obtenido:', { insertedId });

      // Obtener el mensaje recién creado
      const rawResult = await knex(tableName).where({ id: insertedId }).first();

      if (!rawResult) {
        strapi.log.error('[intranet-chat create] No se pudo recuperar el mensaje después de insertarlo', { insertedId });
        return ctx.internalServerError('Error al recuperar el mensaje creado');
      }

      // Mapear a formato Strapi v4
      const mappedResult = {
        id: rawResult.id,
        attributes: {
          texto: rawResult.texto,
          remitente_id: rawResult.remitente_id,
          cliente_id: rawResult.cliente_id,
          fecha: rawResult.fecha,
          leido: rawResult.leido === 1 || rawResult.leido === true,
          createdAt: rawResult.created_at,
          updatedAt: rawResult.updated_at,
        },
      };

      strapi.log.info('[intranet-chat create] Mensaje creado exitosamente:', { id: mappedResult.id });
      return ctx.send({ data: mappedResult }, 201);
    } catch (error: any) {
      strapi.log.error('[intranet-chat create] Error al crear mensaje:', {
        error: error.message,
        stack: error.stack?.substring(0, 1000),
        errorName: error.name,
        errorCode: error.code,
        body: JSON.stringify(ctx.request.body).substring(0, 300),
      });
      return ctx.internalServerError(`Error al crear mensaje: ${error.message || 'Error desconocido'}`);
    }
  },
}));
