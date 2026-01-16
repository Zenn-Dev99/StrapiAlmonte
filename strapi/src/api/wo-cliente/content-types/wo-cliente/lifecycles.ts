export default {
  async beforeUpdate(event: any) {
    const { data } = event.params;

    // ============================================
    // PROTECCIÓN DE CAMPOS ESTÁTICOS
    // ============================================
    // ⚠️ IMPORTANTE: Proteger campos que no deben modificarse una vez creados
    const CAMPOS_PROTEGIDOS = ['correo_electronico'];
    
    if (event.params.where) {
      const woClienteExistente = await strapi.entityService.findOne('api::wo-cliente.wo-cliente', event.params.where.id);
      
      if (woClienteExistente) {
        const clienteAttrs = (woClienteExistente as any).attributes || woClienteExistente;
        
        // Proteger email: No permitir modificación si ya existe
        if (data.correo_electronico !== undefined && clienteAttrs.correo_electronico) {
          const emailNuevo = String(data.correo_electronico).trim().toLowerCase();
          const emailExistente = String(clienteAttrs.correo_electronico).trim().toLowerCase();
          
          if (emailNuevo !== emailExistente) {
            strapi.log.warn(
              `[wo-cliente] ⚠️ Intento de modificar email protegido: ` +
              `Existente: "${clienteAttrs.correo_electronico}", Intentado: "${data.correo_electronico}". ` +
              `Manteniendo email original (campo protegido).`
            );
            // Eliminar correo_electronico de data para que no se actualice
            delete data.correo_electronico;
          } else {
            // Si es el mismo, permitir (no hace daño)
            strapi.log.debug(`[wo-cliente] Email sin cambios: "${emailExistente}"`);
          }
        }
        
        // Si se intenta eliminar email y ya existe, protegerlo
        if (data.correo_electronico === null || data.correo_electronico === '') {
          if (clienteAttrs.correo_electronico) {
            strapi.log.warn(
              `[wo-cliente] ⚠️ Intento de eliminar email protegido: "${clienteAttrs.correo_electronico}". ` +
              `Manteniendo email original (campo protegido).`
            );
            delete data.correo_electronico;
          }
        }
      }
    }
  },

  async afterCreate(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    // Evitar bucle: si viene desde WooCommerce (webhook), no volver a sincronizar
    if (data.skipWooSync === true) {
      strapi.log.info(
        `[wo-cliente] ⏭️  afterCreate omitido (skipWooSync=true, originPlatform=${data.originPlatform || result.originPlatform})`
      );
      return;
    }

    const platform = (result as any).originPlatform || data.originPlatform;
    if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
      return;
    }

    // Solo sincronizar si ya está publicado y aún no tiene externalId para esa plataforma
    if (!(result as any).publishedAt) {
      strapi.log.info(`[wo-cliente] ⏭️  afterCreate omitido (cliente no publicado aún)`);
      return;
    }

    const extIds = ((result as any).externalIds || {}) as Record<string, unknown>;
    if (extIds[platform]) {
      strapi.log.info(
        `[wo-cliente] ⏭️  afterCreate omitido (ya tiene externalId para ${platform})`
      );
      return;
    }

    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      if (!wooSyncService || !(wooSyncService as any).syncCustomerFromWoCliente) {
        strapi.log.warn('[wo-cliente] Servicio woo-sync o método syncCustomerFromWoCliente no disponible');
        return;
      }

      strapi.log.info(
        `[wo-cliente] ▶️  afterCreate → syncCustomerFromWoCliente (ID: ${result.id}, plataforma: ${platform})`
      );
      await (wooSyncService as any).syncCustomerFromWoCliente(result, platform);
      strapi.log.info(
        `[wo-cliente] ✅ Cliente sincronizado a WooCommerce desde afterCreate (ID: ${result.id}, plataforma: ${platform})`
      );
    } catch (error) {
      strapi.log.error('[wo-cliente] Error en afterCreate syncCustomerFromWoCliente:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    // Evitar bucle: si viene desde WooCommerce (webhook), no volver a sincronizar
    if (data.skipWooSync === true) {
      strapi.log.info(
        `[wo-cliente] ⏭️  afterUpdate omitido (skipWooSync=true, originPlatform=${data.originPlatform || result.originPlatform})`
      );
      return;
    }

    const platform = (result as any).originPlatform || data.originPlatform;
    if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
      return;
    }

    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      if (!wooSyncService || !(wooSyncService as any).syncCustomerFromWoCliente) {
        strapi.log.warn('[wo-cliente] Servicio woo-sync o método syncCustomerFromWoCliente no disponible');
        return;
      }

      strapi.log.info(
        `[wo-cliente] ▶️  afterUpdate → syncCustomerFromWoCliente (ID: ${result.id}, plataforma: ${platform})`
      );
      await (wooSyncService as any).syncCustomerFromWoCliente(result, platform);
      strapi.log.info(
        `[wo-cliente] ✅ Cliente sincronizado a WooCommerce desde afterUpdate (ID: ${result.id}, plataforma: ${platform})`
      );
    } catch (error) {
      strapi.log.error('[wo-cliente] Error en afterUpdate syncCustomerFromWoCliente:', error);
    }
  },

  async afterDelete(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    const registros = Array.isArray(result) ? result : [result];

    for (const registro of registros) {
      if (!registro) continue;

      const platform = (registro as any).originPlatform || data.originPlatform;
      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        continue;
      }

      // Determinar wooId / externalIds
      const externalIds = ((registro as any).externalIds || {}) as Record<string, unknown>;
      const wooId = externalIds[platform];
      if (!wooId) {
        strapi.log.info(
          `[wo-cliente] ⏭️  afterDelete omitido para ${registro.id}: no externalIds[${platform}]`
        );
        continue;
      }

      // Si existe OTRO registro con el mismo wooId en esta plataforma, no borrar en Woo
      try {
        const otros = await strapi.entityService.findMany('api::wo-cliente.wo-cliente' as any, {
          filters: {
            id: { $ne: registro.id },
            externalIds: {
              $contains: { [platform]: wooId },
            },
          },
        }) as any[];

        if (otros && otros.length > 0) {
          strapi.log.info(
            `[wo-cliente] ⏭️  afterDelete omitido para ${registro.id}: hay ${otros.length} registro(s) más con wooId=${wooId} en ${platform}`
          );
          continue;
        }

        const wooSyncService = strapi.service('api::woo-sync.woo-sync');
        if (!wooSyncService || !(wooSyncService as any).deleteCustomerFromWoCliente) {
          strapi.log.warn('[wo-cliente] Servicio woo-sync o método deleteCustomerFromWoCliente no disponible');
          continue;
        }

        strapi.log.info(
          `[wo-cliente] ▶️  afterDelete → deleteCustomerFromWoCliente (ID local: ${registro.id}, wooId=${wooId}, plataforma: ${platform})`
        );
        await (wooSyncService as any).deleteCustomerFromWoCliente(registro, platform);
      } catch (error) {
        strapi.log.error('[wo-cliente] Error en afterDelete deleteCustomerFromWoCliente:', error);
      }
    }
  },
};


