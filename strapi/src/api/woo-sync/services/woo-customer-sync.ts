/**
 * Servicio de sincronización de clientes a WooCommerce
 * Usa mappers y api-client para mantener la separación de responsabilidades
 */

import wooConfigService from './woo-config';
import wooApiClient from './woo-api-client';
import customerMapper from './mappers/customer-mapper';

export default ({ strapi }) => {
  const configService = wooConfigService({ strapi });
  const apiClient = wooApiClient({ strapi });
  const mapper = customerMapper({ strapi });

  /**
   * Sincroniza un cliente (wo-cliente) de Strapi a WooCommerce
   */
  async function syncCustomer(woCliente: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = configService.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    if (!woCliente.correo_electronico) {
      throw new Error('wo-cliente sin correo_electronico');
    }

    // Asegurar que el cliente tiene las relaciones pobladas si es necesario
    if (woCliente.id) {
      const clienteCompleto = await strapi.entityService.findOne('api::wo-cliente.wo-cliente', woCliente.id, {
        populate: ['billing', 'shipping', 'persona'] as any,
      }) as any;
      if (clienteCompleto) {
        if (!woCliente.billing) woCliente.billing = clienteCompleto.billing;
        if (!woCliente.shipping) woCliente.shipping = clienteCompleto.shipping;
        if (!woCliente.persona) woCliente.persona = clienteCompleto.persona;
      }
    }

    // Usar mapper para construir el payload (ahora es async)
    const customerPayload = await mapper.mapWoClienteToWooCustomer(woCliente, platform);

    // Obtener externalId si existe
    const externalIds = (woCliente.externalIds || {}) as Record<string, unknown>;
    const wooId = (woCliente.wooId as number | string | null) || (externalIds[platform] as number | string | null | undefined);

    // Crear o actualizar cliente
    let result;
    if (wooId) {
      result = await apiClient.updateCustomer(wooConfig, wooId as string | number, customerPayload);
      strapi.log.info(`[woo-customer-sync] Cliente actualizado en ${platform}: ${wooId}`);
    } else {
      result = await apiClient.createCustomer(wooConfig, customerPayload);
      const newWooId = result.id;
      
      // Actualizar externalIds en Strapi
      const updatedExternalIds = { ...externalIds, [platform]: newWooId };
      await strapi.entityService.update('api::wo-cliente.wo-cliente', woCliente.id, {
        data: {
          wooId: newWooId,
          externalIds: updatedExternalIds,
          skipWooSync: true,
        },
      });
      
      strapi.log.info(`[woo-customer-sync] Cliente creado en ${platform}: ${newWooId}`);
    }

    return result;
  }

  /**
   * Elimina un cliente en WooCommerce
   */
  async function deleteCustomer(woCliente: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = configService.getWooConfig(platform);
    if (!wooConfig) {
      strapi.log.warn(`[woo-customer-sync] Configuración no encontrada para ${platform}`);
      return;
    }

    const externalIds = (woCliente.externalIds || {}) as Record<string, unknown>;
    const wooId = externalIds[platform] as number | string | null | undefined;

    if (!wooId) {
      strapi.log.info(`[woo-customer-sync] No hay externalId para eliminar cliente ${woCliente.id}`);
      return;
    }

    try {
      await apiClient.deleteCustomer(wooConfig, wooId as string | number);
      strapi.log.info(`[woo-customer-sync] Cliente eliminado en ${platform}: ${wooId}`);
    } catch (error) {
      strapi.log.error(`[woo-customer-sync] Error eliminando cliente:`, error);
    }
  }

  return {
    syncCustomer,
    deleteCustomer,
  };
};
