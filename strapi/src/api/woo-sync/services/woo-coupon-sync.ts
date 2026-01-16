/**
 * Servicio de sincronización de cupones a WooCommerce
 * Usa api-client para mantener la separación de responsabilidades
 */

import wooConfigService from './woo-config';
import wooApiClient from './woo-api-client';

export default ({ strapi }) => {
  const configService = wooConfigService({ strapi });
  const apiClient = wooApiClient({ strapi });

  /**
   * Normaliza el tipo de cupón a valores válidos de WooCommerce
   */
  function normalizeDiscountType(tipo: string | null | undefined): 'percent' | 'fixed_cart' | 'fixed_product' {
    if (!tipo) return 'fixed_cart';
    
    const tipoLower = tipo.toString().trim().toLowerCase();
    
    if (tipoLower === 'percent' || tipoLower === 'porcentaje' || tipoLower === 'percentage') {
      return 'percent';
    }
    
    if (tipoLower === 'fixed_product' || tipoLower === 'producto_fijo' || tipoLower === 'producto') {
      return 'fixed_product';
    }
    
    return 'fixed_cart';
  }

  /**
   * Sincroniza un cupón (wo-cupon) de Strapi a WooCommerce
   */
  async function syncCoupon(woCupon: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = configService.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    if (!woCupon.codigo) {
      throw new Error('wo-cupon sin código');
    }

    // Construir payload del cupón
    const couponPayload: any = {
      code: woCupon.codigo,
      discount_type: normalizeDiscountType(woCupon.tipo_cupon),
      amount: woCupon.importe_cupon != null ? String(woCupon.importe_cupon) : undefined,
      description: woCupon.descripcion || '',
      product_ids: Array.isArray(woCupon.producto_ids) ? woCupon.producto_ids : [],
      usage_limit: woCupon.uso_limite ?? undefined,
      date_expires: woCupon.fecha_caducidad || undefined,
    };

    // Obtener externalId si existe
    const externalIds = (woCupon.externalIds || {}) as Record<string, unknown>;
    const wooId = (woCupon.wooId as number | string | null) || (externalIds[platform] as number | string | null | undefined);

    // Crear o actualizar cupón
    let result;
    if (wooId) {
      result = await apiClient.updateCoupon(wooConfig, wooId as string | number, couponPayload);
      strapi.log.info(`[woo-coupon-sync] Cupón actualizado en ${platform}: ${wooId}`);
    } else {
      result = await apiClient.createCoupon(wooConfig, couponPayload);
      const newWooId = result.id;
      
      // Actualizar externalIds en Strapi
      const updatedExternalIds = { ...externalIds, [platform]: newWooId };
      await strapi.entityService.update('api::wo-cupon.wo-cupon', woCupon.id, {
        data: {
          wooId: newWooId,
          externalIds: updatedExternalIds,
          skipWooSync: true,
        },
      });
      
      strapi.log.info(`[woo-coupon-sync] Cupón creado en ${platform}: ${newWooId}`);
    }

    return result;
  }

  /**
   * Elimina un cupón en WooCommerce
   */
  async function deleteCoupon(woCupon: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = configService.getWooConfig(platform);
    if (!wooConfig) {
      strapi.log.warn(`[woo-coupon-sync] Configuración no encontrada para ${platform}`);
      return;
    }

    const externalIds = (woCupon.externalIds || {}) as Record<string, unknown>;
    const wooId = (woCupon.wooId as number | string | null) || (externalIds[platform] as number | string | null | undefined);

    if (!wooId) {
      strapi.log.info(`[woo-coupon-sync] No hay wooId para eliminar cupón ${woCupon.id}`);
      return;
    }

    try {
      await apiClient.deleteCoupon(wooConfig, wooId as string | number);
      strapi.log.info(`[woo-coupon-sync] Cupón eliminado en ${platform}: ${wooId}`);
    } catch (error) {
      strapi.log.error(`[woo-coupon-sync] Error eliminando cupón:`, error);
    }
  }

  return {
    syncCoupon,
    deleteCoupon,
    normalizeDiscountType,
  };
};
