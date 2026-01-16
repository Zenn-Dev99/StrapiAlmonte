import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::mailerlite.mailerlite' as any, ({ strapi }) => ({
  /**
   * Agrega o actualiza un suscriptor en MailerLite
   * POST /api/mailerlite/subscribers
   */
  async addSubscriber(ctx: any) {
    try {
      const { email, name, fields, groups } = ctx.request.body;

      if (!email) {
        return ctx.badRequest('El email es requerido');
      }

      const mailerliteService = strapi.service('api::mailerlite.mailerlite');
      const result = await mailerliteService.addSubscriber(email, name, fields, groups);

      return ctx.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      strapi.log.error('Error en addSubscriber:', error);
      return ctx.internalServerError(error.message || 'Error al agregar suscriptor');
    }
  },

  /**
   * Elimina un suscriptor de MailerLite
   * DELETE /api/mailerlite/subscribers/:email
   */
  async removeSubscriber(ctx: any) {
    try {
      const { email } = ctx.params;

      if (!email) {
        return ctx.badRequest('El email es requerido');
      }

      const mailerliteService = strapi.service('api::mailerlite.mailerlite');
      const result = await mailerliteService.removeSubscriber(email);

      return ctx.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      strapi.log.error('Error en removeSubscriber:', error);
      return ctx.internalServerError(error.message || 'Error al eliminar suscriptor');
    }
  },

  /**
   * Obtiene información de un suscriptor
   * GET /api/mailerlite/subscribers/:email
   */
  async getSubscriber(ctx: any) {
    try {
      const { email } = ctx.params;

      if (!email) {
        return ctx.badRequest('El email es requerido');
      }

      const mailerliteService = strapi.service('api::mailerlite.mailerlite');
      const result = await mailerliteService.getSubscriber(email);

      if (!result) {
        return ctx.notFound('Suscriptor no encontrado');
      }

      return ctx.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      strapi.log.error('Error en getSubscriber:', error);
      return ctx.internalServerError(error.message || 'Error al obtener suscriptor');
    }
  },

  /**
   * Sincroniza una Persona de Strapi a MailerLite
   * POST /api/mailerlite/sync-persona/:id
   */
  async syncPersona(ctx: any) {
    try {
      const { id } = ctx.params;
      const { groups, fields } = ctx.request.body || {};

      const persona = await strapi.entityService.findOne('api::persona.persona', id, {
        populate: ['emails'],
      });

      if (!persona) {
        return ctx.notFound('Persona no encontrada');
      }

      const mailerliteService = strapi.service('api::mailerlite.mailerlite');
      const result = await mailerliteService.syncPersona(persona, { groups, fields });

      return ctx.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      strapi.log.error('Error en syncPersona:', error);
      return ctx.internalServerError(error.message || 'Error al sincronizar persona');
    }
  },

  /**
   * Obtiene todos los grupos de MailerLite
   * GET /api/mailerlite/groups
   */
  async getGroups(ctx: any) {
    try {
      const mailerliteService = strapi.service('api::mailerlite.mailerlite');
      const groups = await mailerliteService.getGroups();

      return ctx.send({
        success: true,
        data: groups,
      });
    } catch (error: any) {
      strapi.log.error('Error en getGroups:', error);
      return ctx.internalServerError(error.message || 'Error al obtener grupos');
    }
  },
}));

