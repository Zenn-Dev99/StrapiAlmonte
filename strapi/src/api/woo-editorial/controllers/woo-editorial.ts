export default {
  /**
   * Sincronizar una editorial específica a WooCommerce
   */
  async syncEditorial(ctx: any) {
    try {
      const { id } = ctx.params;
      const { platform } = ctx.query; // 'woo_moraleja' o 'woo_escolar'

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      // Obtener editorial de Strapi
      const editorial = await strapi.entityService.findOne('api::editorial.editorial', id, {
        populate: ['libros'],
      });

      if (!editorial) {
        return ctx.notFound('Editorial no encontrada');
      }

      // Sincronizar
      const editorialService = strapi.service('api::woo-editorial.woo-editorial');
      const termId = await editorialService.syncEditorial(editorial, platform);

      return ctx.send({
        success: true,
        editorial: editorial.nombre_editorial,
        platform,
        termId,
      });
    } catch (error) {
      strapi.log.error('[woo-editorial] Error en syncEditorial:', error);
      return ctx.internalServerError((error as Error).message);
    }
  },

  /**
   * Sincronizar todas las editoriales a WooCommerce
   */
  async syncAll(ctx: any) {
    try {
      const { platform } = ctx.query; // 'woo_moraleja' o 'woo_escolar'

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      const editorialService = strapi.service('api::woo-editorial.woo-editorial');
      const results = await editorialService.syncAllEditoriales(platform);

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
      strapi.log.error('[woo-editorial] Error en syncAll:', error);
      return ctx.internalServerError((error as Error).message);
    }
  },

  /**
   * Crear/verificar atributo de producto "Editorial" en WooCommerce
   */
  async syncAttribute(ctx: any) {
    try {
      const { platform } = ctx.query; // 'woo_moraleja' o 'woo_escolar'

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      const editorialService = strapi.service('api::woo-editorial.woo-editorial');
      const attributeId = await editorialService.syncEditorialAttribute(platform);

      return ctx.send({
        success: true,
        platform,
        attributeId,
      });
    } catch (error) {
      strapi.log.error('[woo-editorial] Error en syncAttribute:', error);
      return ctx.internalServerError((error as Error).message);
    }
  },
};

