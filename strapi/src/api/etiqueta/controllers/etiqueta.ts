import { factories } from '@strapi/strapi';

const isNumericId = (value: string | number | undefined): boolean => {
  if (value === undefined || value === null) return false;
  return /^[0-9]+$/.test(String(value));
};

export default factories.createCoreController('api::etiqueta.etiqueta' as any, ({ strapi }) => ({
  async update(ctx: any) {
    const rawId = ctx.params.id;
    
    if (!rawId) {
      return ctx.badRequest('ID o documentId requerido');
    }
    
    let identifier: number | string;
    
    // Si es numérico, usar directamente
    if (isNumericId(rawId)) {
      identifier = Number(rawId);
    } else {
      // Es un documentId, necesitamos obtener el id numérico
      const found = await strapi.entityService.findMany('api::etiqueta.etiqueta' as any, {
        filters: { documentId: { $eq: String(rawId) } },
        fields: ['id'],
        limit: 1,
      });
      if (found && found.length > 0) {
        identifier = found[0].id;
      } else {
        return ctx.notFound('Etiqueta no encontrada');
      }
    }
    
    const { data } = ctx.request.body;
    
    const entity = await strapi.entityService.update('api::etiqueta.etiqueta' as any, identifier, {
      data,
    });
    
    return { data: entity };
  },
  
  async delete(ctx: any) {
    const rawId = ctx.params.id;
    
    if (!rawId) {
      return ctx.badRequest('ID o documentId requerido');
    }
    
    let identifier: number | string;
    
    // Si es numérico, usar directamente
    if (isNumericId(rawId)) {
      identifier = Number(rawId);
    } else {
      // Es un documentId, necesitamos obtener el id numérico
      const found = await strapi.entityService.findMany('api::etiqueta.etiqueta' as any, {
        filters: { documentId: { $eq: String(rawId) } },
        fields: ['id'],
        limit: 1,
      });
      if (found && found.length > 0) {
        identifier = found[0].id;
      } else {
        return ctx.notFound('Etiqueta no encontrada');
      }
    }
    
    const entity = await strapi.entityService.delete('api::etiqueta.etiqueta' as any, identifier);
    
    return { data: entity };
  },
}));
