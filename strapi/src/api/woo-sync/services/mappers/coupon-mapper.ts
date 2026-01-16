/**
 * Servicio de mapeo para Cupones entre Strapi y WooCommerce
 */

import type { WooCoupon, StrapiWoCupon, WooPlatform } from '../types';

export default ({ strapi }) => ({
  /**
   * Mapea un wo-cupon de Strapi a formato WooCommerce
   * Mapea TODOS los campos disponibles en el schema de wo-cupon
   */
  async mapWoCuponToWooCoupon(woCupon: StrapiWoCupon, platform: WooPlatform): Promise<Partial<WooCoupon>> {
    const wooCoupon: Partial<WooCoupon> = {
      code: woCupon.codigo || '',
    };
    
    // ============================================
    // TIPO DE DESCUENTO
    // ============================================
    // Normalizar tipo de cupón a los valores permitidos por WooCommerce
    const rawTipo = (woCupon.tipo_cupon || '').toString().trim().toLowerCase();
    let discountType: 'percent' | 'fixed_cart' | 'fixed_product' = 'fixed_cart';

    if (rawTipo === 'percent' || rawTipo === 'porcentaje' || rawTipo === 'percentage') {
      discountType = 'percent';
    } else if (
      rawTipo === 'fixed_cart' ||
      rawTipo === 'fijo_carro' ||
      rawTipo === 'fijo' ||
      rawTipo === 'carro'
    ) {
      discountType = 'fixed_cart';
    } else if (
      rawTipo === 'fixed_product' ||
      rawTipo === 'producto_fijo' ||
      rawTipo === 'producto'
    ) {
      discountType = 'fixed_product';
    }
    
    wooCoupon.discount_type = discountType;

    // ============================================
    // IMPORTE
    // ============================================
    if (woCupon.importe_cupon !== undefined && woCupon.importe_cupon !== null) {
      wooCoupon.amount = String(woCupon.importe_cupon);
    }

    // ============================================
    // DESCRIPCIÓN
    // ============================================
    if (woCupon.descripcion) {
      wooCoupon.description = woCupon.descripcion;
    }

    // ============================================
    // PRODUCTOS
    // ============================================
    if (woCupon.producto_ids && Array.isArray(woCupon.producto_ids)) {
      wooCoupon.product_ids = woCupon.producto_ids;
    } else {
      wooCoupon.product_ids = [];
    }

    // ============================================
    // LÍMITES DE USO
    // ============================================
    if (woCupon.uso_limite !== undefined && woCupon.uso_limite !== null) {
      wooCoupon.usage_limit = woCupon.uso_limite;
    }

    // ============================================
    // FECHA DE CADUCIDAD
    // ============================================
    if (woCupon.fecha_caducidad) {
      // WooCommerce espera fecha en formato ISO string o timestamp
      let fecha: Date;
      if (woCupon.fecha_caducidad instanceof Date) {
        fecha = woCupon.fecha_caducidad;
      } else if (typeof woCupon.fecha_caducidad === 'string') {
        fecha = new Date(woCupon.fecha_caducidad);
      } else {
        fecha = new Date(String(woCupon.fecha_caducidad));
      }
      
      if (!isNaN(fecha.getTime())) {
        // Formato ISO string (YYYY-MM-DDTHH:mm:ss)
        wooCoupon.date_expires = fecha.toISOString();
      }
    }

    // ============================================
    // METADATOS ADICIONALES
    // ============================================
    wooCoupon.meta_data = wooCoupon.meta_data || [];
    
    // Guardar código en meta_data (backup)
    if (woCupon.codigo) {
      wooCoupon.meta_data.push({
        key: 'codigo_cupon',
        value: String(woCupon.codigo),
      });
    }
    
    // Guardar plataforma de origen
    if (woCupon.originPlatform) {
      wooCoupon.meta_data.push({
        key: 'origin_platform',
        value: woCupon.originPlatform,
      });
    }

    return wooCoupon;
  },

  /**
   * Mapea un cupón de WooCommerce a formato Strapi (wo-cupon)
   * IMPORTANTE: NO modifica campos estáticos como código si ya existe en Strapi
   * @param wooCoupon - Cupón de WooCommerce
   * @param platform - Plataforma (woo_moraleja o woo_escolar)
   * @param woCuponExistente - Cupón existente en Strapi (opcional, para proteger campos estáticos)
   */
  mapWooCouponToWoCupon(
    wooCoupon: WooCoupon, 
    platform: WooPlatform,
    woCuponExistente?: StrapiWoCupon | any
  ): Partial<StrapiWoCupon> {
    const woCupon: Partial<StrapiWoCupon> = {
      originPlatform: platform,
    };
    
    // ============================================
    // CÓDIGO (CAMPO ESTÁTICO - Solo se actualiza si no existe)
    // ============================================
    // ⚠️ PROTECCIÓN: No sobrescribir código si ya existe en Strapi
    if (wooCoupon.code) {
      const codigoWoo = String(wooCoupon.code).trim();
      const codigoExistente = woCuponExistente?.codigo || woCuponExistente?.attributes?.codigo;
      
      if (!codigoExistente) {
        // Solo actualizar si no existe código en Strapi
        woCupon.codigo = codigoWoo;
      } else if (codigoExistente !== codigoWoo) {
        // Si difieren, mantener el de Strapi y loguear advertencia
        strapi.log.warn(
          `[coupon-mapper] Código conflictivo: Strapi tiene "${codigoExistente}" pero WooCommerce tiene "${codigoWoo}". ` +
          `Manteniendo código de Strapi (campo protegido).`
        );
        // NO actualizar codigo
      }
      // Si son iguales, no hacer nada
    }

    // ============================================
    // TIPO DE CUPÓN (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooCoupon.discount_type) {
      woCupon.tipo_cupon = wooCoupon.discount_type;
    }

    // ============================================
    // IMPORTE (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooCoupon.amount !== undefined) {
      woCupon.importe_cupon = parseFloat(wooCoupon.amount) || null;
    }

    // ============================================
    // DESCRIPCIÓN (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooCoupon.description !== undefined) {
      woCupon.descripcion = wooCoupon.description || null;
    }

    // ============================================
    // PRODUCTOS (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooCoupon.product_ids !== undefined) {
      woCupon.producto_ids = Array.isArray(wooCoupon.product_ids) ? wooCoupon.product_ids : [];
    }

    // ============================================
    // LÍMITES DE USO (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooCoupon.usage_limit !== undefined) {
      woCupon.uso_limite = wooCoupon.usage_limit ?? null;
    }

    // ============================================
    // FECHA DE CADUCIDAD (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooCoupon.date_expires) {
      try {
        const fecha = new Date(wooCoupon.date_expires);
        if (!isNaN(fecha.getTime())) {
          woCupon.fecha_caducidad = fecha;
        }
      } catch (error) {
        strapi.log.warn(`[coupon-mapper] Error parseando fecha de caducidad: ${wooCoupon.date_expires}`, error);
      }
    }

    // ============================================
    // METADATOS ADICIONALES (desde meta_data)
    // ============================================
    if (wooCoupon.meta_data && Array.isArray(wooCoupon.meta_data)) {
      const metaData = wooCoupon.meta_data;
      
      // Buscar campos específicos en meta_data
      const getMetaValue = (key: string): string | null => {
        const meta = metaData.find((m: any) => m.key === key);
        if (!meta || meta.value === undefined || meta.value === null) {
          return null;
        }
        // Convertir a string si es número
        return String(meta.value);
      };
      
      // Los campos principales ya se mapearon arriba
      // Aquí se pueden agregar campos adicionales si se necesitan en el futuro
    }

    // ============================================
    // EXTERNAL ID (siempre se actualiza)
    // ============================================
    if (wooCoupon.id) {
      const existingExternalIds = woCuponExistente?.externalIds || woCuponExistente?.attributes?.externalIds || {};
      woCupon.externalIds = {
        ...existingExternalIds,
        [platform]: wooCoupon.id,
      };
      woCupon.wooId = wooCoupon.id;
    }

    // ============================================
    // DATOS RAW (siempre se guardan)
    // ============================================
    woCupon.rawWooData = wooCoupon;

    return woCupon;
  },
});

