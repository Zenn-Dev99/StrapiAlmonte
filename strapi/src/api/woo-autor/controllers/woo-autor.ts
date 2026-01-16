export default {
  /**
   * Sincronizar un autor específico a WooCommerce
   */
  async syncAutor(ctx: any) {
    try {
      const { id } = ctx.params;
      const { platform } = ctx.query; // 'woo_moraleja' o 'woo_escolar'

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      // Obtener autor de Strapi
      const autor = await strapi.entityService.findOne('api::autor.autor', id, {
        populate: ['obras', 'libros'],
      });

      if (!autor) {
        return ctx.notFound('Autor no encontrado');
      }

      // Sincronizar
      const autorService = strapi.service('api::woo-autor.woo-autor');
      const termId = await autorService.syncAutor(autor, platform);

      return ctx.send({
        success: true,
        autor: autor.nombre_completo_autor,
        platform,
        termId,
      });
    } catch (error) {
      strapi.log.error('[woo-autor] Error en syncAutor:', error);
      return ctx.internalServerError((error as Error).message);
    }
  },

  /**
   * Sincronizar todos los autores a WooCommerce
   */
  async syncAll(ctx: any) {
    try {
      const { platform } = ctx.query; // 'woo_moraleja' o 'woo_escolar'

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      const autorService = strapi.service('api::woo-autor.woo-autor');
      const results = await autorService.syncAllAutores(platform);

      const successCount = results.filter((r: any) => r.success).length;
      const errorCount = results.filter((r: any) => !r.success).length;

      return ctx.send({
        success: true,
        platform,
        total: results.length,
        successCount,
        errorCount,
        results,
      });
    } catch (error) {
      strapi.log.error('[woo-autor] Error en syncAll:', error);
      return ctx.internalServerError((error as Error).message);
    }
  },

  /**
   * Crear/verificar atributo de producto "Autor" en WooCommerce
   */
  async syncAttribute(ctx: any) {
    try {
      const { platform } = ctx.query; // 'woo_moraleja' o 'woo_escolar'

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      const autorService = strapi.service('api::woo-autor.woo-autor');
      const attributeId = await autorService.syncAutorAttribute(platform);

      return ctx.send({
        success: true,
        platform,
        attributeId,
      });
    } catch (error) {
      strapi.log.error('[woo-autor] Error en syncAttribute:', error);
      return ctx.internalServerError((error as Error).message);
    }
  },
};

