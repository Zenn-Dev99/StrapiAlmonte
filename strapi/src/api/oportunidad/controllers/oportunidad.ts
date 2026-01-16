import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::oportunidad.oportunidad' as any, ({ strapi }) => ({
  /**
   * Override find para manejar filtros por documentId correctamente
   * En Strapi v5, cuando se usa documentId, no se puede filtrar con filters[id][$eq]
   */
  async find(ctx: any) {
    try {
      const filters: any = ctx.query?.filters || {};
      
      // Si hay un filtro por id que parece ser un documentId (string largo)
      if (filters.id?.$eq) {
        const idValue = filters.id.$eq;
        
        // Si el ID es un string largo (documentId de Strapi v5), buscar por documentId
        if (typeof idValue === 'string' && idValue.length > 10 && !/^\d+$/.test(idValue)) {
          strapi.log.info(`[oportunidad.find] Detectado documentId, convirtiendo filtro: ${idValue}`);
          
          // Convertir el filtro de id a documentId
          const newFilters = {
            ...filters,
            documentId: idValue,
          };
          delete newFilters.id;
          
          // Actualizar el query
          ctx.query = {
            ...ctx.query,
            filters: newFilters,
          };
        }
      }
      
      // Llamar al método find del controller base
      return await super.find(ctx);
    } catch (error: any) {
      strapi.log.error('[oportunidad.find] Error:', error);
      return ctx.internalServerError(error.message || 'Error al buscar oportunidades');
    }
  },

  /**
   * Override findOne para manejar tanto id numérico como documentId
   */
  async findOne(ctx: any) {
    const { id } = ctx.params;

    if (!id) {
      return ctx.badRequest('ID es requerido');
    }

    try {
      strapi.log.info(`[oportunidad.findOne] Buscando oportunidad con ID: ${id}`);

      // Intentar buscar por id numérico primero
      let oportunidad = null;
      
      // Si es un número, buscar por id
      if (!isNaN(Number(id))) {
        oportunidad = await strapi.entityService.findOne('api::oportunidad.oportunidad' as any, Number(id), {
          populate: ctx.query?.populate || '*',
        });
      }

      // Si no se encontró o el ID es un string (documentId), buscar por documentId
      if (!oportunidad) {
        strapi.log.info(`[oportunidad.findOne] Buscando por documentId: ${id}`);
        
        // Intentar con entityService
        const oportunidades = await strapi.entityService.findMany('api::oportunidad.oportunidad' as any, {
          filters: {
            documentId: id,
          },
          populate: ctx.query?.populate || '*',
          limit: 1,
        });

        if (oportunidades && oportunidades.length > 0) {
          oportunidad = oportunidades[0];
        }

        // Si no funciona con entityService, intentar con db.query
        if (!oportunidad) {
          strapi.log.info(`[oportunidad.findOne] entityService no encontró, intentando con db.query...`);
          const oportunidadesDB = await strapi.db.query('api::oportunidad.oportunidad').findMany({
            where: {
              documentId: id,
            },
            populate: ctx.query?.populate || '*',
            limit: 1,
          });
          
          if (oportunidadesDB && oportunidadesDB.length > 0) {
            oportunidad = oportunidadesDB[0];
            strapi.log.info(`[oportunidad.findOne] Oportunidad encontrada con db.query`);
          }
        }
      }

      if (!oportunidad) {
        return ctx.notFound('Oportunidad no encontrada');
      }

      return ctx.send({ data: oportunidad });
    } catch (error: any) {
      strapi.log.error('[oportunidad.findOne] Error:', error);
      return ctx.internalServerError(error.message || 'Error al buscar oportunidad');
    }
  },
}));

