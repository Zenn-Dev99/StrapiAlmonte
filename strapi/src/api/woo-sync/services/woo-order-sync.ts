/**
 * Servicio de sincronización de pedidos (orders) a WooCommerce
 * Usa mappers y api-client para mantener la separación de responsabilidades
 */

import wooConfigService from './woo-config';
import wooApiClient from './woo-api-client';
import orderMapper from './mappers/order-mapper';
import lineItemMapper from './mappers/line-item-mapper';
import addressMapper from './mappers/address-mapper';
import type { WooOrder } from './types';

export default ({ strapi }) => {
  const configService = wooConfigService({ strapi });
  const apiClient = wooApiClient({ strapi });
  const orderMap = orderMapper({ strapi });
  const lineItemMap = lineItemMapper({ strapi });
  const addressMap = addressMapper({ strapi });

  /**
   * Busca un producto en WooCommerce por SKU
   */
  async function findProductBySku(config: any, sku: string): Promise<number | null> {
    try {
      const products = await apiClient.get(config, 'products', { sku });
      if (Array.isArray(products) && products.length > 0) {
        return products[0].id;
      }
      return null;
    } catch (error) {
      strapi.log.warn(`[woo-order-sync] Error buscando producto por SKU ${sku}:`, error);
      return null;
    }
  }

  /**
   * Valida que un customer existe en WooCommerce
   */
  async function validateCustomerId(config: any, customerId: number): Promise<boolean> {
    try {
      await apiClient.get(config, `customers/${customerId}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sincroniza un pedido (wo-pedido) de Strapi a WooCommerce
   */
  async function syncOrder(woPedido: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = configService.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    if (!woPedido.numero_pedido) {
      throw new Error('wo-pedido sin numero_pedido');
    }

    // Obtener pedido completo con relaciones
    // Importante: populate items.libro para tener acceso a externalIds del libro
    // En Strapi v5, el formato correcto es populate[items][populate]=* o populate[items][populate][libro]=true
    const woPedidoCompleto = await strapi.entityService.findOne('api::wo-pedido.wo-pedido', woPedido.id, {
      populate: {
        items: {
          populate: {
            libro: true,
          },
        },
        cliente: true,
      },
    }) as any;

    // Mapear line items
    let lineItems = await lineItemMap.mapItemsToWooLineItems(
      woPedidoCompleto?.items || [],
      platform
    );

    // Buscar productos por SKU para items sin product_id
    const itemsSinProductId = woPedidoCompleto?.items?.filter((item: any, index: number) => {
      return !lineItems[index] || !lineItems[index].product_id;
    }) || [];

    for (const item of itemsSinProductId) {
      if (item.sku) {
        const productId = await findProductBySku(wooConfig, item.sku);
        if (productId) {
          const lineItem = await lineItemMap.mapItemToWooLineItem(
            { ...item, producto_id: productId },
            platform
          );
          if (lineItem) {
            lineItems.push(lineItem);
            strapi.log.info(`[woo-order-sync] Producto encontrado por SKU: ${item.sku} → ${productId}`);
          }
        }
      }
    }

    // Validar que hay items válidos
    if (lineItems.length === 0) {
      throw new Error(
        `No se puede crear/actualizar un pedido sin productos válidos. ` +
        `Asegúrate de que los libros estén sincronizados en WooCommerce.`
      );
    }

    // Validar customer_id si existe
    let customerId: number | null = null;
    if (woPedidoCompleto?.cliente) {
      const cliente = woPedidoCompleto.cliente;
      const clienteExtIds = (cliente.externalIds || {}) as Record<string, unknown>;
      const potentialCustomerId = clienteExtIds[platform] || cliente.wooId;
      
      if (potentialCustomerId) {
        const id = parseInt(String(potentialCustomerId), 10);
        if (id > 0 && await validateCustomerId(wooConfig, id)) {
          customerId = id;
        } else {
          strapi.log.warn(`[woo-order-sync] Customer ID ${id} no existe en WooCommerce`);
        }
      }
    }

    // Mapear pedido usando order-mapper
    const orderPayload = await orderMap.mapWoPedidoToWooOrder(woPedidoCompleto, platform);
    orderPayload.line_items = lineItems;
    
    if (customerId) {
      orderPayload.customer_id = customerId;
    }

    // Mapear direcciones usando address-mapper
    if (woPedidoCompleto.billing) {
      orderPayload.billing = addressMap.mapBillingToWoo(woPedidoCompleto.billing);
    }
    if (woPedidoCompleto.shipping) {
      orderPayload.shipping = addressMap.mapShippingToWoo(woPedidoCompleto.shipping);
    }

    // Obtener externalId si existe
    const externalIds = (woPedido.externalIds || {}) as Record<string, unknown>;
    const wooId = (woPedido.wooId as number | string | null) || (externalIds[platform] as number | string | null | undefined);

    // Crear o actualizar pedido
    let result;
    if (wooId) {
      result = await apiClient.updateOrder(wooConfig, wooId as string | number, orderPayload);
      strapi.log.info(`[woo-order-sync] Pedido actualizado en ${platform}: ${wooId}`);
    } else {
      // El mapper siempre retorna status y total, que son los campos requeridos de WooOrder
      result = await apiClient.createOrder(wooConfig, {
        ...orderPayload,
        status: orderPayload.status || 'pending',
        total: orderPayload.total || '0',
      } as WooOrder);
      const newWooId = result.id;
      
      // Actualizar externalIds en Strapi
      const updatedExternalIds = { ...externalIds, [platform]: newWooId };
      await strapi.entityService.update('api::wo-pedido.wo-pedido', woPedido.id, {
        data: {
          wooId: newWooId,
          externalIds: updatedExternalIds,
          skipWooSync: true,
        },
      });
      
      strapi.log.info(`[woo-order-sync] Pedido creado en ${platform}: ${newWooId}`);
    }

    return result;
  }

  /**
   * Elimina un pedido en WooCommerce
   */
  async function deleteOrder(woPedido: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = configService.getWooConfig(platform);
    if (!wooConfig) {
      strapi.log.warn(`[woo-order-sync] Configuración no encontrada para ${platform}`);
      return;
    }

    const externalIds = (woPedido.externalIds || {}) as Record<string, unknown>;
    const wooId = (woPedido.wooId as number | string | null) || (externalIds[platform] as number | string | null | undefined);

    if (!wooId) {
      strapi.log.info(`[woo-order-sync] No hay wooId para eliminar pedido ${woPedido.id}`);
      return;
    }

    try {
      await apiClient.deleteOrder(wooConfig, wooId as string | number);
      strapi.log.info(`[woo-order-sync] Pedido eliminado en ${platform}: ${wooId}`);
    } catch (error) {
      strapi.log.error(`[woo-order-sync] Error eliminando pedido:`, error);
    }
  }

  return {
    syncOrder,
    deleteOrder,
  };
};
