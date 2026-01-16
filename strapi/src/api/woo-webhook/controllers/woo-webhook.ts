import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::woo-webhook.woo-webhook', ({ strapi }) => ({
  async product(ctx) {
    try {
      // Log inicial para confirmar que el endpoint se está alcanzando
      strapi.log.info(`[woo-webhook] ⚡ Endpoint product alcanzado - Method: ${ctx.request.method}, URL: ${ctx.request.url}`);
      
      const platform = ctx.params.platform || 'woo_moraleja'; // woo_moraleja o woo_escolar
      
      strapi.log.info(`[woo-webhook] Platform detectada: ${platform}`);
      
      // Log completo del request para debugging
      const rawBody = ctx.request.body;
      const bodyType = typeof rawBody;
      const bodyKeys = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? Object.keys(rawBody) : [];
      const contentType = ctx.request.headers['content-type'] || 'no content-type';
      
      strapi.log.info(`[woo-webhook] Request recibido desde ${platform}`, {
        bodyType,
        bodyKeys: bodyKeys.length > 0 ? bodyKeys : 'no keys',
        hasBody: !!rawBody,
        bodyIsArray: Array.isArray(rawBody),
        bodyIsNull: rawBody === null,
        bodyIsUndefined: rawBody === undefined,
        bodyStringLength: typeof rawBody === 'string' ? rawBody.length : 0,
        contentType
      });
      
      // Log detallado del body - SIEMPRE mostrar el contenido
      if (rawBody) {
        try {
          const bodyStr = JSON.stringify(rawBody, null, 2);
          strapi.log.info(`[woo-webhook] Body recibido (tipo: ${bodyType}, longitud: ${bodyStr.length}):`);
          strapi.log.info(bodyStr);
          
          // Mostrar estructura del objeto
          if (typeof rawBody === 'object' && !Array.isArray(rawBody)) {
            strapi.log.info(`[woo-webhook] Estructura del body:`, {
              keys: Object.keys(rawBody),
              hasId: 'id' in rawBody,
              hasData: 'data' in rawBody,
              hasProduct: 'product' in rawBody,
              hasWebhookId: 'webhook_id' in rawBody,
              idValue: rawBody.id,
              webhookIdValue: rawBody.webhook_id,
              dataType: rawBody.data ? typeof rawBody.data : 'no data'
            });
          }
        } catch (e) {
          strapi.log.warn(`[woo-webhook] Error serializando body:`, e);
          strapi.log.info(`[woo-webhook] Body (toString):`, String(rawBody).substring(0, 500));
        }
      } else {
        strapi.log.warn(`[woo-webhook] Body completamente vacío o no disponible`);
        strapi.log.info(`[woo-webhook] Content-Type:`, contentType);
        strapi.log.info(`[woo-webhook] Headers relevantes:`, {
          'content-type': ctx.request.headers['content-type'],
          'content-length': ctx.request.headers['content-length'],
          'user-agent': ctx.request.headers['user-agent']?.substring(0, 100)
        });
      }
      
      // Manejar webhook de prueba de WooCommerce (solo contiene webhook_id)
      if (rawBody && typeof rawBody === 'object' && 'webhook_id' in rawBody && !('id' in rawBody) && !('data' in rawBody)) {
        strapi.log.info(`[woo-webhook] Webhook de prueba recibido desde ${platform} (webhook_id: ${rawBody.webhook_id})`);
        return ctx.send({ 
          success: true, 
          message: 'Webhook de prueba recibido correctamente',
          webhook_id: rawBody.webhook_id 
        });
      }
      
      // WooCommerce puede enviar el producto en diferentes formatos:
      // 1. Directamente en el body: { id: 123, name: "...", ... }
      // 2. En un objeto data: { data: { id: 123, name: "...", ... } }
      // 3. En un objeto con action: { action: "created", data: { ... } }
      // 4. Como array: [{ id: 123, ... }] (múltiples productos)
      // 5. Body vacío o null (WooCommerce a veces envía así)
      const body = rawBody || {};
      let wooProduct = null;

      // Si el body es un array, tomar el primer elemento
      if (Array.isArray(body) && body.length > 0) {
        strapi.log.info(`[woo-webhook] Body es un array con ${body.length} elementos`);
        const firstItem = body[0];
        if (firstItem && firstItem.id) {
          wooProduct = firstItem;
        } else if (firstItem && firstItem.data && firstItem.data.id) {
          wooProduct = firstItem.data;
        }
      }
      // Intentar extraer el producto del body en diferentes formatos
      else if (body.id && (typeof body.id === 'number' || typeof body.id === 'string')) {
        // Formato 1: Producto directamente en el body
        wooProduct = body;
      } else if (body.data) {
        // Formato 2: Producto en objeto data
        if (body.data.id) {
          wooProduct = body.data;
        } else if (Array.isArray(body.data) && body.data.length > 0 && body.data[0].id) {
          // Data es un array, tomar el primero
          wooProduct = body.data[0];
        }
      } else if (body.product && body.product.id) {
        // Formato alternativo: Producto en objeto product
        wooProduct = body.product;
      } else if (body.action && body.data && body.data.id) {
        // Formato con action: { action: "created", data: { id: ... } }
        wooProduct = body.data;
      }

      // Si aún no tenemos el producto, log completo y error
      if (!wooProduct || !wooProduct.id) {
        strapi.log.error(`[woo-webhook] Formato de body no reconocido desde ${platform}`);
        strapi.log.error(`[woo-webhook] rawBody:`, rawBody ? JSON.stringify(rawBody, null, 2) : 'null/undefined');
        strapi.log.error(`[woo-webhook] bodyType:`, bodyType);
        strapi.log.error(`[woo-webhook] bodyKeys:`, bodyKeys);
        strapi.log.error(`[woo-webhook] Headers:`, JSON.stringify(ctx.request.headers, null, 2));
        strapi.log.error(`[woo-webhook] Query:`, JSON.stringify(ctx.query, null, 2));
        strapi.log.error(`[woo-webhook] Params:`, JSON.stringify(ctx.params, null, 2));
        strapi.log.error(`[woo-webhook] Content-Type:`, contentType);
        return ctx.badRequest('Formato de datos inválido. Se espera un objeto con id o data.id');
      }

      strapi.log.info(`[woo-webhook] Producto extraído desde ${platform}`, { 
        productId: wooProduct.id,
        productName: wooProduct.name,
        sku: wooProduct.sku,
        bodyKeys: Object.keys(body)
      });

      // Validar que sea un producto válido
      if (!wooProduct.id) {
        strapi.log.warn(`[woo-webhook] Producto sin ID recibido desde ${platform}:`, JSON.stringify(wooProduct, null, 2));
        return ctx.badRequest('Datos de producto inválidos. Se espera un objeto con id.');
      }

      // Procesar producto (crear/actualizar libro)
      const result = await strapi.service('api::woo-webhook.woo-webhook').syncProduct(wooProduct, platform);

      strapi.log.info(`[woo-webhook] Producto sincronizado exitosamente: ${wooProduct.name || 'Sin nombre'} (ID: ${wooProduct.id})`);

      return ctx.send({ 
        success: true, 
        message: 'Producto sincronizado exitosamente',
        data: result 
      });
    } catch (error: any) {
      strapi.log.error('[woo-webhook] Error procesando producto:', error);
      strapi.log.error('[woo-webhook] Body recibido:', JSON.stringify(ctx.request.body, null, 2));
      strapi.log.error('[woo-webhook] Headers:', JSON.stringify(ctx.request.headers, null, 2));
      strapi.log.error('[woo-webhook] Stack trace:', error.stack);
      return ctx.internalServerError(`Error procesando producto: ${error.message || 'Error desconocido'}`);
    }
  },

  async customer(ctx) {
    try {
      const platform = ctx.params.platform || 'woo_moraleja';
      const rawBody = ctx.request.body;
      
      strapi.log.info(`[woo-webhook] ⚡ Endpoint customer alcanzado desde ${platform}`);
      
      // Manejar webhook de prueba de WooCommerce (solo contiene webhook_id)
      if (rawBody && typeof rawBody === 'object' && 'webhook_id' in rawBody && !('id' in rawBody) && !('data' in rawBody)) {
        strapi.log.info(`[woo-webhook] Webhook de prueba de cliente recibido desde ${platform} (webhook_id: ${rawBody.webhook_id})`);
        return ctx.send({ 
          success: true, 
          message: 'Webhook de prueba de cliente recibido correctamente',
          webhook_id: rawBody.webhook_id 
        });
      }
      
      // WooCommerce puede enviar el cliente en diferentes formatos
      const body = rawBody || {};
      let wooCustomer = null;
      
      // Intentar extraer el cliente del body en diferentes formatos (misma lógica para ambas plataformas)
      if (body.id && (typeof body.id === 'number' || typeof body.id === 'string')) {
        wooCustomer = body;
      } else if (body.data) {
        if (body.data.id) {
          wooCustomer = body.data;
        } else if (Array.isArray(body.data) && body.data.length > 0 && body.data[0].id) {
          wooCustomer = body.data[0];
        }
      } else if (body.customer && body.customer.id) {
        wooCustomer = body.customer;
      } else if (body.action && body.data && body.data.id) {
        wooCustomer = body.data;
      } else if (Array.isArray(body) && body.length > 0 && body[0].id) {
        wooCustomer = body[0];
      }
      
      if (!wooCustomer || !wooCustomer.id) {
        strapi.log.error(`[woo-webhook] Formato de body no reconocido para cliente desde ${platform}`);
        strapi.log.error(`[woo-webhook] rawBody:`, rawBody ? JSON.stringify(rawBody, null, 2) : 'null/undefined');
        return ctx.badRequest('Formato de datos inválido. Se espera un objeto con id o data.id');
      }
      
      // Si no hay email directo, intentar encontrarlo en otros lugares (misma lógica para ambas plataformas)
      if (!wooCustomer.email) {
        if (wooCustomer.billing?.email) {
          wooCustomer.email = wooCustomer.billing.email;
        } else if (wooCustomer.meta_data && Array.isArray(wooCustomer.meta_data)) {
          const emailMeta = wooCustomer.meta_data.find((m: any) => 
            (m.key === 'email' || m.key === 'Email' || m.key === 'EMAIL') && m.value
          );
          if (emailMeta?.value) {
            wooCustomer.email = emailMeta.value;
          }
        } else if ((wooCustomer as any).user_email) {
          wooCustomer.email = (wooCustomer as any).user_email;
        }
      }
      
      strapi.log.info(`[woo-webhook] Cliente extraído desde ${platform}`, { 
        customerId: wooCustomer.id,
        email: wooCustomer.email,
        firstName: wooCustomer.first_name,
        lastName: wooCustomer.last_name
      });
      
      const result = await strapi.service('api::woo-webhook.woo-webhook').syncCustomer(wooCustomer, platform);
      
      strapi.log.info(`[woo-webhook] Cliente sincronizado exitosamente desde ${platform}: ${wooCustomer.email || 'Sin email'} (ID: ${wooCustomer.id})`);
      
      return ctx.send({ 
        success: true, 
        message: 'Cliente sincronizado exitosamente',
        data: result 
      });
    } catch (error: any) {
      const platform = ctx.params.platform || 'unknown';
      strapi.log.error(`[woo-webhook] Error procesando cliente desde ${platform}:`, error);
      strapi.log.error(`[woo-webhook] Body recibido:`, JSON.stringify(ctx.request.body, null, 2));
      strapi.log.error(`[woo-webhook] Stack trace:`, error.stack);
      return ctx.internalServerError(`Error procesando cliente: ${error.message || 'Error desconocido'}`);
    }
  },

  async coupon(ctx) {
    try {
      strapi.log.info(`[woo-webhook] ⚡ Endpoint coupon alcanzado - Method: ${ctx.request.method}, URL: ${ctx.request.url}`);
      
      const platform = ctx.params.platform || 'woo_moraleja';
      const rawBody = ctx.request.body;
      
      strapi.log.info(`[woo-webhook] Platform detectada: ${platform}`);
      
      // Manejar webhook de prueba de WooCommerce (solo contiene webhook_id)
      if (rawBody && typeof rawBody === 'object' && 'webhook_id' in rawBody && !('id' in rawBody) && !('data' in rawBody)) {
        strapi.log.info(`[woo-webhook] Webhook de prueba de cupón recibido desde ${platform} (webhook_id: ${rawBody.webhook_id})`);
        return ctx.send({ 
          success: true, 
          message: 'Webhook de prueba de cupón recibido correctamente',
          webhook_id: rawBody.webhook_id 
        });
      }
      
      // WooCommerce puede enviar el cupón en diferentes formatos
      const body = rawBody || {};
      let wooCoupon = null;
      
      // Intentar extraer el cupón del body en diferentes formatos
      if (body.id && (typeof body.id === 'number' || typeof body.id === 'string')) {
        wooCoupon = body;
      } else if (body.data) {
        if (body.data.id) {
          wooCoupon = body.data;
        } else if (Array.isArray(body.data) && body.data.length > 0 && body.data[0].id) {
          wooCoupon = body.data[0];
        }
      } else if (body.coupon && body.coupon.id) {
        wooCoupon = body.coupon;
      } else if (body.action && body.data && body.data.id) {
        wooCoupon = body.data;
      } else if (Array.isArray(body) && body.length > 0 && body[0].id) {
        wooCoupon = body[0];
      }
      
      if (!wooCoupon || !wooCoupon.id) {
        strapi.log.error(`[woo-webhook] Formato de body no reconocido para cupón desde ${platform}`);
        strapi.log.error(`[woo-webhook] rawBody:`, rawBody ? JSON.stringify(rawBody, null, 2) : 'null/undefined');
        return ctx.badRequest('Formato de datos inválido. Se espera un objeto con id o data.id');
      }
      
      strapi.log.info(`[woo-webhook] Cupón extraído desde ${platform}`, { 
        couponId: wooCoupon.id,
        code: wooCoupon.code,
        discountType: wooCoupon.discount_type,
        amount: wooCoupon.amount
      });
      
      const result = await strapi.service('api::woo-webhook.woo-webhook').syncCoupon(wooCoupon, platform);
      
      strapi.log.info(`[woo-webhook] Cupón sincronizado exitosamente: ${wooCoupon.code || 'Sin código'} (ID: ${wooCoupon.id})`);
      
      return ctx.send({ 
        success: true, 
        message: 'Cupón sincronizado exitosamente',
        data: result 
      });
    } catch (error: any) {
      strapi.log.error('[woo-webhook] Error procesando cupón:', error);
      strapi.log.error('[woo-webhook] Body recibido:', JSON.stringify(ctx.request.body, null, 2));
      strapi.log.error('[woo-webhook] Stack trace:', error.stack);
      return ctx.internalServerError(`Error procesando cupón: ${error.message || 'Error desconocido'}`);
    }
  },

  async order(ctx) {
    try {
      strapi.log.info(`[woo-webhook] ⚡ Endpoint order alcanzado - Method: ${ctx.request.method}, URL: ${ctx.request.url}`);
      
      const platform = ctx.params.platform || 'woo_moraleja';
      const rawBody = ctx.request.body;
      
      strapi.log.info(`[woo-webhook] Platform detectada: ${platform}`);
      
      // Manejar webhook de prueba de WooCommerce (solo contiene webhook_id)
      if (rawBody && typeof rawBody === 'object' && 'webhook_id' in rawBody && !('id' in rawBody) && !('data' in rawBody)) {
        strapi.log.info(`[woo-webhook] Webhook de prueba de pedido recibido desde ${platform} (webhook_id: ${rawBody.webhook_id})`);
        return ctx.send({ 
          success: true, 
          message: 'Webhook de prueba de pedido recibido correctamente',
          webhook_id: rawBody.webhook_id 
        });
      }
      
      // WooCommerce puede enviar el pedido en diferentes formatos
      const body = rawBody || {};
      let wooOrder = null;
      
      // Intentar extraer el pedido del body en diferentes formatos
      if (body.id && (typeof body.id === 'number' || typeof body.id === 'string')) {
        wooOrder = body;
      } else if (body.data) {
        if (body.data.id) {
          wooOrder = body.data;
        } else if (Array.isArray(body.data) && body.data.length > 0 && body.data[0].id) {
          wooOrder = body.data[0];
        }
      } else if (body.order && body.order.id) {
        wooOrder = body.order;
      } else if (body.action && body.data && body.data.id) {
        wooOrder = body.data;
      } else if (Array.isArray(body) && body.length > 0 && body[0].id) {
        wooOrder = body[0];
      }
      
      if (!wooOrder || !wooOrder.id) {
        strapi.log.error(`[woo-webhook] Formato de body no reconocido para pedido desde ${platform}`);
        strapi.log.error(`[woo-webhook] rawBody:`, rawBody ? JSON.stringify(rawBody, null, 2) : 'null/undefined');
        return ctx.badRequest('Formato de datos inválido. Se espera un objeto con id o data.id');
      }
      
      strapi.log.info(`[woo-webhook] Pedido extraído desde ${platform}`, { 
        orderId: wooOrder.id,
        orderNumber: wooOrder.number,
        status: wooOrder.status,
        total: wooOrder.total,
        lineItemsCount: wooOrder.line_items?.length || 0
      });
      
      // Usar el servicio de webhook para sincronizar el pedido
      const result = await strapi.service('api::woo-webhook.woo-webhook').syncOrder(wooOrder, platform);
      
      strapi.log.info(`[woo-webhook] Pedido sincronizado exitosamente: #${wooOrder.number || wooOrder.id} (ID: ${wooOrder.id})`);
      
      return ctx.send({ 
        success: true, 
        message: 'Pedido sincronizado exitosamente',
        data: result 
      });
    } catch (error: any) {
      strapi.log.error('[woo-webhook] Error procesando pedido:', error);
      strapi.log.error('[woo-webhook] Body recibido:', JSON.stringify(ctx.request.body, null, 2));
      strapi.log.error('[woo-webhook] Stack trace:', error.stack);
      return ctx.internalServerError(`Error procesando pedido: ${error.message || 'Error desconocido'}`);
    }
  },

  /**
   * Endpoint para importar productos masivamente desde WooCommerce
   * Ejecuta desde la nube (Railway) sin necesidad de scripts locales
   * 
   * POST /api/woo-webhook/import/:platform
   * Query params:
   *   - limit: número máximo de productos a importar (opcional)
   *   - dryRun: true para simular sin importar (opcional)
   */
  async import(ctx) {
    try {
      const platform = ctx.params.platform || 'woo_moraleja'; // woo_moraleja o woo_escolar
      const { limit, dryRun } = ctx.query;

      // Convertir limit a número si existe
      const limitNum = limit ? parseInt(String(limit)) : undefined;
      const isDryRun = dryRun === 'true' || dryRun === true || dryRun === '1';

      strapi.log.info(`[woo-webhook] Iniciando importación masiva desde ${platform}`, { 
        limit: limitNum || 'sin límite',
        dryRun: isDryRun 
      });

      // Validar autenticación (requerir token para seguridad)
      const authHeader = ctx.request.headers.authorization;
      const apiToken = process.env.STRAPI_API_TOKEN;
      
      if (!authHeader || !apiToken || authHeader !== `Bearer ${apiToken}`) {
        return ctx.unauthorized('Token de autenticación requerido');
      }

      // Ejecutar importación
      const result = await strapi.service('api::woo-webhook.woo-webhook').importProducts(
        platform,
        {
          limit: limitNum,
          dryRun: isDryRun,
        }
      );

      return ctx.send({ 
        success: true, 
        message: 'Importación completada',
        data: result 
      });
    } catch (error) {
      strapi.log.error('[woo-webhook] Error en importación masiva:', error);
      return ctx.internalServerError('Error en importación masiva');
    }
  },

  /**
   * Endpoint para sincronizar manualmente un término de atributo desde WooCommerce a Strapi
   * Útil cuando se crea/actualiza un término en WooCommerce y no se activa el webhook automáticamente
   * 
   * POST /api/woo-webhook/sync-term/:platform
   * Body: {
   *   "attributeName": "Autor",
   *   "termName": "Gabriel García Márquez"
   * }
   */
  async syncTerm(ctx: any) {
    try {
      const platform = ctx.params.platform || 'woo_moraleja';
      const { attributeName, termName } = ctx.request.body;

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      if (!attributeName || !termName) {
        return ctx.badRequest('Se requieren "attributeName" y "termName" en el body');
      }

      strapi.log.info(`[woo-webhook] Sincronización manual de término solicitada: "${termName}" del atributo "${attributeName}" desde ${platform}`);

      const result = await strapi.service('api::woo-webhook.woo-webhook').syncTermFromWooCommerce(
        platform,
        attributeName,
        termName
      );

      return ctx.send({
        success: true,
        message: 'Término sincronizado exitosamente',
        data: result,
      });
    } catch (error: any) {
      strapi.log.error('[woo-webhook] Error sincronizando término:', error);
      return ctx.internalServerError(`Error sincronizando término: ${error.message || 'Error desconocido'}`);
    }
  },

  /**
   * Endpoint para sincronización periódica bidireccional de todos los términos
   * 
   * POST /api/woo-webhook/sync-all/:platform
   * Query params:
   *   - recentHours: número de horas hacia atrás para sincronizar (default: 24)
   *   - attributeTypes: tipos de atributos a sincronizar, separados por coma (default: todos)
   *   - dryRun: true para simular sin sincronizar (default: false)
   */
  async syncAll(ctx: any) {
    try {
      const platform = ctx.params.platform || 'woo_moraleja';
      const { recentHours, attributeTypes, dryRun } = ctx.query;

      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        return ctx.badRequest('Platform debe ser "woo_moraleja" o "woo_escolar"');
      }

      // La validación de autenticación se hace mediante la política 'is-authenticated-or-api-token'
      // que acepta STRAPI_API_TOKEN, STRAPI_TOKEN, IMPORT_TOKEN o cualquier API Token de Strapi
      // Si llegamos aquí, la política ya validó el token correctamente
      strapi.log.info('[sync-all] Autenticación validada por política');

      // Convertir parámetros
      const recentHoursNum = recentHours ? parseInt(String(recentHours)) : 24;
      const attributeTypesArray = attributeTypes ? String(attributeTypes).split(',').map((a: string) => a.trim()) : undefined;
      const isDryRun = dryRun === 'true' || dryRun === true || dryRun === '1';

      strapi.log.info(`[sync-all] Sincronización periódica solicitada para ${platform}`, {
        recentHours: recentHoursNum,
        attributeTypes: attributeTypesArray || 'todos',
        dryRun: isDryRun,
      });

      const result = await strapi.service('api::woo-webhook.woo-webhook').syncAllTerms(
        platform,
        {
          recentHours: recentHoursNum,
          attributeTypes: attributeTypesArray,
          dryRun: isDryRun,
        }
      );

      return ctx.send({
        success: true,
        message: 'Sincronización periódica completada',
        data: result,
      });
    } catch (error: any) {
      strapi.log.error('[sync-all] Error en sincronización periódica:', error);
      return ctx.internalServerError(`Error en sincronización periódica: ${error.message || 'Error desconocido'}`);
    }
  },
}));

