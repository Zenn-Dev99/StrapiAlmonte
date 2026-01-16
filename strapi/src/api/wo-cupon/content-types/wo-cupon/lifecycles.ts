export default {
  async afterCreate(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    // Evitar bucle e internal updates
    if (data.skipWooSync === true) {
      strapi.log.info(
        `[wo-cupon] ⏭️  afterCreate omitido (skipWooSync=true, originPlatform=${data.originPlatform || result.originPlatform})`
      );
      return;
    }

    const platform = (result as any).originPlatform || data.originPlatform;
    if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
      return;
    }

    // Solo sincronizar si ya está publicado y aún no tiene externalId para esa plataforma
    if (!(result as any).publishedAt) {
      strapi.log.info(`[wo-cupon] ⏭️  afterCreate omitido (cupón no publicado aún)`);
      return;
    }

    const extIds = ((result as any).externalIds || {}) as Record<string, unknown>;
    if (extIds[platform]) {
      strapi.log.info(
        `[wo-cupon] ⏭️  afterCreate omitido (ya tiene externalId para ${platform})`
      );
      return;
    }

    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      if (!wooSyncService || !(wooSyncService as any).syncCouponFromWoCupon) {
        strapi.log.warn('[wo-cupon] Servicio woo-sync o método syncCouponFromWoCupon no disponible');
        return;
      }

      strapi.log.info(
        `[wo-cupon] ▶️  afterCreate → syncCouponFromWoCupon (ID: ${result.id}, plataforma: ${platform})`
      );
      await (wooSyncService as any).syncCouponFromWoCupon(result, platform);
      strapi.log.info(
        `[wo-cupon] ✅ Cupón sincronizado a WooCommerce desde afterCreate (ID: ${result.id}, plataforma: ${platform})`
      );
    } catch (error) {
      strapi.log.error('[wo-cupon] Error en afterCreate syncCouponFromWoCupon:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    if (data.skipWooSync === true) {
      strapi.log.info(
        `[wo-cupon] ⏭️  afterUpdate omitido (skipWooSync=true, originPlatform=${data.originPlatform || result.originPlatform})`
      );
      return;
    }

    const platform = (result as any).originPlatform || data.originPlatform;
    if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
      return;
    }

    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      if (!wooSyncService || !(wooSyncService as any).syncCouponFromWoCupon) {
        strapi.log.warn('[wo-cupon] Servicio woo-sync o método syncCouponFromWoCupon no disponible');
        return;
      }

      strapi.log.info(
        `[wo-cupon] ▶️  afterUpdate → syncCouponFromWoCupon (ID: ${result.id}, plataforma: ${platform})`
      );
      await (wooSyncService as any).syncCouponFromWoCupon(result, platform);
      strapi.log.info(
        `[wo-cupon] ✅ Cupón sincronizado a WooCommerce desde afterUpdate (ID: ${result.id}, plataforma: ${platform})`
      );
    } catch (error) {
      strapi.log.error('[wo-cupon] Error en afterUpdate syncCouponFromWoCupon:', error);
    }
  },

  async afterDelete(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    // result puede ser un solo objeto o un array (deleteMany)
    const registros = Array.isArray(result) ? result : [result];

    for (const registro of registros) {
      if (!registro) continue;

      const platform = (registro as any).originPlatform || data.originPlatform;
      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        continue;
      }

      // Determinar wooId / externalIds
      const externalIds = ((registro as any).externalIds || {}) as Record<string, unknown>;
      const wooId = (registro as any).wooId || externalIds[platform];
      if (!wooId) {
        strapi.log.info(
          `[wo-cupon] ⏭️  afterDelete omitido para ${registro.id}: no wooId ni externalIds[${platform}]`
        );
        continue;
      }

      // Si existe OTRO registro con el mismo wooId en esta plataforma, no borrar en Woo
      try {
        const otros = await strapi.entityService.findMany('api::wo-cupon.wo-cupon' as any, {
          filters: {
            id: { $ne: registro.id },
            externalIds: {
              $contains: { [platform]: wooId },
            },
          },
        }) as any[];

        if (otros && otros.length > 0) {
          strapi.log.info(
            `[wo-cupon] ⏭️  afterDelete omitido para ${registro.id}: hay ${otros.length} registro(s) más con wooId=${wooId} en ${platform}`
          );
          continue;
        }

        const wooSyncService = strapi.service('api::woo-sync.woo-sync');
        if (!wooSyncService || !(wooSyncService as any).deleteCouponFromWoCupon) {
          strapi.log.warn('[wo-cupon] Servicio woo-sync o método deleteCouponFromWoCupon no disponible');
          continue;
        }

        strapi.log.info(
          `[wo-cupon] ▶️  afterDelete → deleteCouponFromWoCupon (ID local: ${registro.id}, wooId=${wooId}, plataforma: ${platform})`
        );
        await (wooSyncService as any).deleteCouponFromWoCupon(registro, platform);
      } catch (error) {
        strapi.log.error('[wo-cupon] Error en afterDelete deleteCouponFromWoCupon:', error);
      }
    }
  },
};


