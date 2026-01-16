import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::activity-log.activity-log' as any, ({ strapi }) => ({
  
  // Endpoint personalizado: Listar todos los logs con usuario poblado
  async listar(ctx) {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[Activity Log - Listar] Solicitud recibida');
      console.log('[Activity Log - Listar] Query params:', ctx.query);
      
      const { page = 1, pageSize = 25, sort = 'fecha:desc' } = ctx.query;
      
      const pageNum = parseInt(String(page));
      const pageSizeNum = parseInt(String(pageSize));
      
      const logs = await strapi.entityService.findMany('api::activity-log.activity-log' as any, {
        fields: ['accion', 'entidad', 'entidad_id', 'descripcion', 'fecha', 'ip_address'],
        populate: {
          usuario: {
            fields: ['id', 'documentId', 'email_login', 'activo'],
            populate: {
              persona: {
                fields: ['nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo']
              }
            }
          }
        },
        sort: String(sort),
        start: (pageNum - 1) * pageSizeNum,
        limit: pageSizeNum,
      });
      
      const total = await strapi.entityService.count('api::activity-log.activity-log' as any);
      
      const logsArray = Array.isArray(logs) ? logs : [logs];
      
      console.log('[Activity Log - Listar] ✅ Logs encontrados:', logsArray.length);
      console.log('[Activity Log - Listar] Total registros:', total);
      console.log('═══════════════════════════════════════════════════════');
      
      return ctx.send({
        data: logsArray,
        meta: {
          pagination: {
            page: pageNum,
            pageSize: pageSizeNum,
            pageCount: Math.ceil(total / pageSizeNum),
            total: total
          }
        }
      });
      
    } catch (error: any) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('[Activity Log - Listar] ❌ ERROR:', error.message);
      console.error('[Activity Log - Listar] Stack:', error.stack);
      console.error('═══════════════════════════════════════════════════════');
      
      return ctx.badRequest(error.message || 'Error al listar logs');
    }
  },
  
  // Endpoint personalizado: Detalle de un log específico con usuario poblado
  async detalle(ctx) {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[Activity Log - Detalle] Solicitud recibida');
      console.log('[Activity Log - Detalle] ID:', ctx.params.id);
      
      const { id } = ctx.params;
      
      if (!id) {
        console.error('[Activity Log - Detalle] ❌ ID falta');
        return ctx.badRequest('ID es requerido');
      }
      
      const log = await strapi.entityService.findOne('api::activity-log.activity-log' as any, id, {
        fields: ['accion', 'entidad', 'entidad_id', 'descripcion', 'fecha', 'ip_address', 'user_agent', 'datos_anteriores', 'datos_nuevos', 'metadata'],
        populate: {
          usuario: {
            fields: ['id', 'documentId', 'email_login', 'activo', 'rol'],
            populate: {
              persona: {
                fields: ['nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'rut']
              }
            }
          }
        }
      });
      
      if (!log) {
        console.error('[Activity Log - Detalle] ❌ Log no encontrado');
        return ctx.notFound('Log no encontrado');
      }
      
      const logWithUser = log as any;
      
      console.log('[Activity Log - Detalle] ✅ Log encontrado, ID:', log.id);
      console.log('[Activity Log - Detalle] Usuario:', logWithUser.usuario ? logWithUser.usuario.email_login : 'sin usuario');
      console.log('═══════════════════════════════════════════════════════');
      
      return ctx.send({
        data: log
      });
      
    } catch (error: any) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('[Activity Log - Detalle] ❌ ERROR:', error.message);
      console.error('[Activity Log - Detalle] Stack:', error.stack);
      console.error('═══════════════════════════════════════════════════════');
      
      return ctx.badRequest(error.message || 'Error al obtener detalle del log');
    }
  },
  
}));

