/**
 * Servicio de mapeo para Pedidos (Orders) entre Strapi y WooCommerce
 * Mapea TODOS los campos disponibles en el schema de wo-pedido
 */

import type { WooOrder, StrapiWoPedido, WooPlatform } from '../types';
import addressMapper from './address-mapper';

export default ({ strapi }) => {
  const log = strapi?.log || console;
  const address = addressMapper({ strapi });
  
  /**
   * Normaliza el estado del pedido a valores válidos de WooCommerce
   */
  function normalizeOrderStatus(status: string | null | undefined): string {
    if (!status) return 'pending';
    
    const statusLower = status.toLowerCase().trim();
    const validStatuses = [
      'auto-draft',
      'pending',
      'processing',
      'on-hold',
      'completed',
      'cancelled',
      'refunded',
      'failed',
      'checkout-draft',
    ];
    
    if (validStatuses.includes(statusLower)) {
      return statusLower;
    }
    
    // Mapeo de estados comunes
    const statusMap: Record<string, string> = {
      'draft': 'auto-draft',
      'canceled': 'cancelled',
      'cancel': 'cancelled',
      'refund': 'refunded',
      'error': 'failed',
    };
    
    if (statusMap[statusLower]) {
      log.info(`[order-mapper] Estado mapeado: "${status}" → "${statusMap[statusLower]}"`);
      return statusMap[statusLower];
    }
    
    log.warn(`[order-mapper] Estado no válido: "${status}", usando "pending" por defecto`);
    return 'pending';
  }
  
  return {
  /**
   * Mapea un wo-pedido de Strapi a formato WooCommerce
   * Mapea TODOS los campos disponibles en el schema de wo-pedido
   */
  async mapWoPedidoToWooOrder(woPedido: StrapiWoPedido, platform: WooPlatform): Promise<Partial<WooOrder>> {
    const wooOrder: Partial<WooOrder> = {
      status: normalizeOrderStatus(woPedido.estado),
      total: woPedido.total ? String(woPedido.total) : '0',
    };

    // ============================================
    // NÚMERO DE PEDIDO
    // ============================================
    if (woPedido.numero_pedido) {
      wooOrder.number = String(woPedido.numero_pedido);
    }

    // ============================================
    // TOTALES
    // ============================================
    if (woPedido.subtotal != null) {
      wooOrder.subtotal = String(woPedido.subtotal);
    }
    if (woPedido.impuestos != null) {
      wooOrder.total_tax = String(woPedido.impuestos);
    }
    if (woPedido.envio != null) {
      wooOrder.shipping_total = String(woPedido.envio);
    }
    if (woPedido.descuento != null) {
      wooOrder.discount_total = String(woPedido.descuento);
    }

    // ============================================
    // MONEDA
    // ============================================
    if (woPedido.moneda) {
      wooOrder.currency = woPedido.moneda;
    }

    // ============================================
    // MÉTODO DE PAGO
    // ============================================
    if (woPedido.metodo_pago) {
      wooOrder.payment_method = woPedido.metodo_pago;
    }
    if (woPedido.metodo_pago_titulo) {
      wooOrder.payment_method_title = woPedido.metodo_pago_titulo;
    }

    // ============================================
    // ORIGEN
    // ============================================
    if (woPedido.origen) {
      wooOrder.created_via = woPedido.origen;
    }

    // ============================================
    // NOTA DEL CLIENTE
    // ============================================
    if (woPedido.nota_cliente) {
      wooOrder.customer_note = woPedido.nota_cliente;
    }

    // ============================================
    // FECHAS
    // ============================================
    if (woPedido.fecha_pedido) {
      let fecha: Date;
      if (woPedido.fecha_pedido instanceof Date) {
        fecha = woPedido.fecha_pedido;
      } else if (typeof woPedido.fecha_pedido === 'string') {
        fecha = new Date(woPedido.fecha_pedido);
      } else {
        fecha = new Date(String(woPedido.fecha_pedido));
      }
      
      if (!isNaN(fecha.getTime())) {
        wooOrder.date_created = fecha.toISOString();
      }
    }

    // ============================================
    // DIRECCIONES (usando address-mapper)
    // ============================================
    if (woPedido.billing) {
      wooOrder.billing = address.mapBillingToWoo(woPedido.billing);
    }
    
    if (woPedido.shipping) {
      wooOrder.shipping = address.mapShippingToWoo(woPedido.shipping);
    }

    // ============================================
    // CLIENTE (customer_id)
    // ============================================
    if (woPedido.cliente) {
      const clienteId = typeof woPedido.cliente === 'object' 
        ? (woPedido.cliente.id || woPedido.cliente.documentId)
        : woPedido.cliente;
      
      if (clienteId) {
        try {
          // Obtener cliente completo para acceder a externalIds
          const cliente = await strapi.entityService.findOne('api::wo-cliente.wo-cliente', clienteId) as any;
          if (cliente?.externalIds?.[platform]) {
            wooOrder.customer_id = parseInt(String(cliente.externalIds[platform]), 10);
          }
        } catch (error) {
          log.warn(`[order-mapper] Error obteniendo cliente ${clienteId}:`, error);
        }
      }
    }

    // ============================================
    // METADATOS ADICIONALES
    // ============================================
    wooOrder.meta_data = wooOrder.meta_data || [];
    
    // Guardar número de pedido en meta_data (backup)
    if (woPedido.numero_pedido) {
      wooOrder.meta_data.push({
        key: 'numero_pedido',
        value: String(woPedido.numero_pedido),
      });
    }
    
    // Guardar plataforma de origen
    if (woPedido.originPlatform) {
      wooOrder.meta_data.push({
        key: 'origin_platform',
        value: woPedido.originPlatform,
      });
    }

    // Line items se mapean en otro servicio (line-item-mapper)

    return wooOrder;
  },

  /**
   * Mapea un pedido de WooCommerce a formato Strapi (wo-pedido)
   * IMPORTANTE: NO modifica campos estáticos como numero_pedido si ya existe en Strapi
   * @param wooOrder - Pedido de WooCommerce
   * @param platform - Plataforma (woo_moraleja o woo_escolar)
   * @param woPedidoExistente - Pedido existente en Strapi (opcional, para proteger campos estáticos)
   */
  mapWooOrderToWoPedido(
    wooOrder: WooOrder, 
    platform: WooPlatform,
    woPedidoExistente?: StrapiWoPedido | any
  ): Partial<StrapiWoPedido> {
    const woPedido: any = {
      originPlatform: platform,
    };

    // ============================================
    // NÚMERO DE PEDIDO (CAMPO ESTÁTICO - Solo se actualiza si no existe)
    // ============================================
    // ⚠️ PROTECCIÓN: No sobrescribir numero_pedido si ya existe en Strapi
    if (wooOrder.number || wooOrder.id) {
      const numeroWoo = String(wooOrder.number || wooOrder.id || '').trim();
      const numeroExistente = woPedidoExistente?.numero_pedido || woPedidoExistente?.attributes?.numero_pedido;
      
      if (!numeroExistente) {
        // Solo actualizar si no existe numero_pedido en Strapi
        woPedido.numero_pedido = numeroWoo;
      } else if (numeroExistente !== numeroWoo) {
        // Si difieren, mantener el de Strapi y loguear advertencia
        log.warn(
          `[order-mapper] Número de pedido conflictivo: Strapi tiene "${numeroExistente}" pero WooCommerce tiene "${numeroWoo}". ` +
          `Manteniendo número de pedido de Strapi (campo protegido).`
        );
        // NO actualizar numero_pedido
      }
      // Si son iguales, no hacer nada
    }

    // ============================================
    // ESTADO (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooOrder.status) {
      woPedido.estado = normalizeOrderStatus(wooOrder.status);
    }

    // ============================================
    // TOTALES (siempre se actualizan desde WooCommerce)
    // ============================================
    if (wooOrder.total !== undefined) {
      woPedido.total = parseFloat(wooOrder.total) || 0;
    }
    
    if (wooOrder.subtotal !== undefined) {
      woPedido.subtotal = parseFloat(wooOrder.subtotal) || 0;
    }
    
    if (wooOrder.total_tax !== undefined) {
      woPedido.impuestos = parseFloat(wooOrder.total_tax) || 0;
    }
    
    if (wooOrder.shipping_total !== undefined) {
      woPedido.envio = parseFloat(wooOrder.shipping_total) || 0;
    }
    
    if (wooOrder.discount_total !== undefined) {
      woPedido.descuento = parseFloat(wooOrder.discount_total) || 0;
    }

    // ============================================
    // MONEDA (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooOrder.currency) {
      woPedido.moneda = wooOrder.currency;
    }

    // ============================================
    // MÉTODO DE PAGO (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooOrder.payment_method !== undefined) {
      woPedido.metodo_pago = wooOrder.payment_method || null;
    }
    
    if (wooOrder.payment_method_title !== undefined) {
      woPedido.metodo_pago_titulo = wooOrder.payment_method_title || null;
    }

    // ============================================
    // ORIGEN (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooOrder.created_via !== undefined) {
      woPedido.origen = wooOrder.created_via || 'web';
    }

    // ============================================
    // NOTA DEL CLIENTE (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooOrder.customer_note !== undefined) {
      woPedido.nota_cliente = wooOrder.customer_note || null;
    }

    // ============================================
    // FECHAS (siempre se actualizan desde WooCommerce)
    // ============================================
    if (wooOrder.date_created) {
      try {
        const fecha = new Date(wooOrder.date_created);
        if (!isNaN(fecha.getTime())) {
          woPedido.fecha_pedido = fecha;
        }
      } catch (error) {
        log.warn(`[order-mapper] Error parseando fecha de creación: ${wooOrder.date_created}`, error);
      }
    }

    // ============================================
    // DIRECCIONES (usando address-mapper)
    // ============================================
    if (wooOrder.billing) {
      woPedido.billing = address.mapWooBillingToStrapi(wooOrder.billing);
    }
    
    if (wooOrder.shipping) {
      woPedido.shipping = address.mapWooShippingToStrapi(wooOrder.shipping);
    }

    // ============================================
    // METADATOS ADICIONALES (desde meta_data)
    // ============================================
    if (wooOrder.meta_data && Array.isArray(wooOrder.meta_data)) {
      const metaData = wooOrder.meta_data;
      
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
    if (wooOrder.id) {
      const existingExternalIds = woPedidoExistente?.externalIds || woPedidoExistente?.attributes?.externalIds || {};
      woPedido.externalIds = {
        ...existingExternalIds,
        [platform]: wooOrder.id,
      };
      woPedido.wooId = wooOrder.id;
    }

    // ============================================
    // DATOS RAW (siempre se guardan)
    // ============================================
    woPedido.rawWooData = wooOrder;

    // Line items se mapean en otro servicio (line-item-mapper)

    return woPedido;
  },

  normalizeOrderStatus,
  };
};
