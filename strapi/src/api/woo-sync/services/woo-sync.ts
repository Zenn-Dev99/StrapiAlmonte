import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::woo-sync.woo-sync', ({ strapi }) => ({
  /**
   * Sincroniza un producto (libro) de Strapi a WooCommerce
   */
  async syncProduct(libro: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    // Asegurar que el libro tiene las relaciones pobladas
    if (libro.id) {
      const libroCompleto = await strapi.entityService.findOne('api::libro.libro', libro.id, {
        populate: ['autor_relacion', 'editorial', 'marcas', 'etiquetas', 'categorias_producto'] as any,
      }) as any;
      if (libroCompleto) {
        if (!libro.autor_relacion) libro.autor_relacion = libroCompleto.autor_relacion;
        if (!libro.editorial) libro.editorial = libroCompleto.editorial;
        if (!libro.marcas) libro.marcas = libroCompleto.marcas;
        if (!libro.etiquetas) libro.etiquetas = libroCompleto.etiquetas;
        if (!libro.categorias_producto) libro.categorias_producto = libroCompleto.categorias_producto;
      }
    }

    // Preparar datos del producto para WooCommerce (ahora es async)
    const wooProduct = await this.buildWooProduct(libro, platform);

    // Obtener externalId si existe
    const externalIds = libro.externalIds || {};
    const wooId = externalIds[platform];

    let result;
    try {
      if (wooId) {
        // Actualizar producto existente
        result = await this.updateWooProduct(wooConfig, wooId, wooProduct);
        strapi.log.info(`[woo-sync] Producto actualizado en ${platform}: ${wooId}`);
      } else {
        // Crear nuevo producto
        result = await this.createWooProduct(wooConfig, wooProduct);
        const newWooId = result.id;
        
        // Actualizar externalIds en Strapi
        const updatedExternalIds = { ...externalIds, [platform]: newWooId };
        await strapi.entityService.update('api::libro.libro', libro.id, {
          data: { externalIds: updatedExternalIds },
        });
        
        strapi.log.info(`[woo-sync] Producto creado en ${platform}: ${newWooId}`);
      }
    } catch (error: any) {
      // Si el error es por permisos de imagen, intentar sin imagen
      if (error.message && error.message.includes('woocommerce_product_image_upload_error')) {
        strapi.log.warn(`[woo-sync] ⚠️ Error de permisos de imagen, reintentando sin imagen...`);
        
        // Remover imagen del producto
        const wooProductSinImagen = { ...wooProduct };
        delete wooProductSinImagen.images;
        
        // Reintentar
        if (wooId) {
          result = await this.updateWooProduct(wooConfig, wooId, wooProductSinImagen);
          strapi.log.info(`[woo-sync] ✅ Producto actualizado sin imagen en ${platform}: ${wooId}`);
        } else {
          result = await this.createWooProduct(wooConfig, wooProductSinImagen);
          const newWooId = result.id;
          
          // Actualizar externalIds en Strapi
          const updatedExternalIds = { ...externalIds, [platform]: newWooId };
          await strapi.entityService.update('api::libro.libro', libro.id, {
            data: { externalIds: updatedExternalIds },
          });
          
          strapi.log.info(`[woo-sync] ✅ Producto creado sin imagen en ${platform}: ${newWooId}`);
        }
      } else {
        // Si es otro error, lanzarlo
        throw error;
      }
    }

    return result;
  },

  /**
   * Sincroniza un cliente basado en WO-Clientes (wo-cliente) hacia WooCommerce
   * Usa los campos normalizados (nombre, correo, ciudad, región, etc.)
   */
  async syncCustomerFromWoCliente(woCliente: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    if (!woCliente.correo_electronico) {
      throw new Error('wo-cliente sin correo_electronico');
    }

    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');

    // Determinar Woo ID existente
    const externalIds = (woCliente.externalIds || {}) as Record<string, unknown>;
    let wooId: number | string | null = (woCliente.wooId as number | string | null) || null;
    if (!wooId && externalIds[platform]) {
      wooId = externalIds[platform] as number | string;
    }

    // Intentar separar nombre en first_name / last_name (simple: primer espacio)
    const nombreCompleto = (woCliente.nombre || '').trim();
    let firstName = '';
    let lastName = '';
    if (nombreCompleto) {
      const partes = nombreCompleto.split(' ');
      firstName = partes.shift() || '';
      lastName = partes.join(' ');
    }

    const billing: any = {};
    if (woCliente.pais_region) billing.country = woCliente.pais_region;
    if (woCliente.ciudad) billing.city = woCliente.ciudad;
    if (woCliente.region) billing.state = woCliente.region;
    if (woCliente.codigo_postal) billing.postcode = woCliente.codigo_postal;

    const customerPayload: any = {
      email: woCliente.correo_electronico,
      first_name: firstName,
      last_name: lastName,
      billing,
    };

    let response;
    if (wooId) {
      // Actualizar cliente existente
      strapi.log.info(
        `[woo-sync] Actualizando cliente en ${platform}: Woo ID=${wooId}, correo=${woCliente.correo_electronico}`
      );
      response = await fetch(`${wooConfig.url}/wp-json/wc/v3/customers/${wooId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(customerPayload),
      });
    } else {
      // Crear nuevo cliente
      strapi.log.info(
        `[woo-sync] Creando cliente en ${platform}: correo=${woCliente.correo_electronico}`
      );
      response = await fetch(`${wooConfig.url}/wp-json/wc/v3/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(customerPayload),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce API error (customers): ${response.status} ${errorText}`);
    }

    const wooCustomer = (await response.json()) as any;

    // Actualizar externalIds y wooId en wo-cliente
    try {
      const updatedExternalIds = { ...(woCliente.externalIds || {}), [platform]: wooCustomer.id };
      const updateData: any = {
        wooId: wooCustomer.id,
        externalIds: updatedExternalIds,
        // Flag solo para este update (no está en schema) para evitar bucle en lifecycles
        skipWooSync: true,
      };

      await strapi.entityService.update('api::wo-cliente.wo-cliente' as any, woCliente.id, {
        data: updateData,
      } as any);
    } catch (error) {
      strapi.log.warn('[woo-sync] No se pudo actualizar externalIds/wooId en wo-cliente:', error);
    }

    return wooCustomer;
  },

  /**
   * Elimina un cliente en WooCommerce basado en los datos de WO-Clientes
   */
  async deleteCustomerFromWoCliente(woCliente: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      strapi.log.warn(`[woo-sync] Configuración de WooCommerce no encontrada para ${platform}. No se elimina cliente.`);
      return;
    }

    const externalIds = (woCliente.externalIds || {}) as Record<string, unknown>;
    const wooId = (externalIds[platform] as number | string | null) || null;

    if (!wooId) {
      strapi.log.info(
        `[woo-sync] ⏭️  deleteCustomerFromWoCliente omitido: no hay externalIds[${platform}] para cliente ${woCliente.id}`
      );
      return;
    }

    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');

    try {
      strapi.log.info(
        `[woo-sync] Eliminando cliente en ${platform}: Woo ID=${wooId}, correo=${woCliente.correo_electronico || woCliente.email}`
      );

      const response = await fetch(`${wooConfig.url}/wp-json/wc/v3/customers/${wooId}?force=true`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.status === 404) {
        strapi.log.warn(
          `[woo-sync] Cliente ${wooId} no encontrado en ${platform} al intentar eliminar (ya estaba eliminado).`
        );
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API error (delete customer): ${response.status} ${errorText}`);
      }

      strapi.log.info(
        `[woo-sync] ✅ Cliente eliminado en ${platform}: Woo ID=${wooId}, correo=${woCliente.correo_electronico || woCliente.email}`
      );
    } catch (error) {
      strapi.log.error('[woo-sync] Error eliminando cliente en WooCommerce:', error);
    }
  },

  /**
   * Sincroniza un cupón basado en WO-Cupones (wo-cupon) hacia WooCommerce
   * Usa el mapper para mapear todos los campos de forma consistente
   */
  async syncCouponFromWoCupon(woCupon: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    if (!woCupon.codigo) {
      throw new Error('wo-cupon sin código');
    }

    // Obtener mapper de cupones
    let mappers: any = null;
    try {
      // Intentar obtener el servicio de mappers
      mappers = strapi.service('api::woo-sync.mappers-service');
      if (!mappers) {
        // Si no está disponible como servicio, importar directamente
        const mappersModule = require('./mappers-service');
        mappers = mappersModule.default({ strapi });
      }
    } catch (error) {
      strapi.log.warn('[woo-sync] Error obteniendo mappers, usando importación directa:', error);
      const mappersModule = require('./mappers-service');
      mappers = mappersModule.default({ strapi });
    }
    
    if (!mappers || !mappers.coupon) {
      throw new Error('Mapper de cupones no disponible');
    }

    // Obtener wo-cupon completo si solo tenemos el ID
    let woCuponCompleto = woCupon;
    if (woCupon.id && (!woCupon.codigo || !woCupon.tipo_cupon)) {
      woCuponCompleto = await strapi.entityService.findOne('api::wo-cupon.wo-cupon' as any, woCupon.id) as any;
      if (!woCuponCompleto) {
        throw new Error(`wo-cupon con ID ${woCupon.id} no encontrado`);
      }
    }

    // Usar mapper para construir el payload de WooCommerce
    const couponPayload = await mappers.coupon.mapWoCuponToWooCoupon(woCuponCompleto, platform);

    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');

    const externalIds = (woCuponCompleto.externalIds || {}) as Record<string, unknown>;
    let wooId: number | string | null = (woCuponCompleto.wooId as number | string | null) || null;
    if (!wooId && externalIds[platform]) {
      wooId = externalIds[platform] as number | string;
    }

    let response;
    if (wooId) {
      strapi.log.info(
        `[woo-sync] Actualizando cupón en ${platform}: Woo ID=${wooId}, código=${woCuponCompleto.codigo}`
      );
      response = await fetch(`${wooConfig.url}/wp-json/wc/v3/coupons/${wooId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(couponPayload),
      });
    } else {
      strapi.log.info(
        `[woo-sync] Creando cupón en ${platform}: código=${woCuponCompleto.codigo}`
      );
      response = await fetch(`${wooConfig.url}/wp-json/wc/v3/coupons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(couponPayload),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce API error (coupons): ${response.status} ${errorText}`);
    }

    const wooCoupon = (await response.json()) as any;

    // Actualizar externalIds y wooId en wo-cupon
    try {
      const updatedExternalIds = { ...(woCuponCompleto.externalIds || {}), [platform]: wooCoupon.id };
      const updateData: any = {
        wooId: wooCoupon.id,
        externalIds: updatedExternalIds,
        skipWooSync: true,
      };
      await strapi.entityService.update('api::wo-cupon.wo-cupon' as any, woCuponCompleto.id, {
        data: updateData,
      } as any);
    } catch (error) {
      strapi.log.warn('[woo-sync] No se pudo actualizar externalIds/wooId en wo-cupon:', error);
    }

    return wooCoupon;
  },

  /**
   * Valida y normaliza el estado del pedido para WooCommerce
   * Estados válidos: auto-draft, pending, processing, on-hold, completed, cancelled, refunded, failed, checkout-draft
   */
  normalizeOrderStatus(status: string | null | undefined): string {
    if (!status) return 'pending';
    
    const statusLower = status.toLowerCase().trim();
    
    // Estados válidos de WooCommerce
    const validStatuses = [
      'auto-draft',
      'pending',
      'processing',
      'on-hold',
      'completed',
      'cancelled',
      'refunded',
      'failed',
      'checkout-draft'
    ];
    
    // Si el estado es válido, devolverlo tal cual
    if (validStatuses.includes(statusLower)) {
      return statusLower;
    }
    
    // Mapeo de estados comunes que pueden venir de Strapi
    const statusMap: Record<string, string> = {
      'draft': 'pending',
      'active': 'processing',
      'inactive': 'on-hold',
      'done': 'completed',
      'canceled': 'cancelled',
      'cancel': 'cancelled',
      'refund': 'refunded',
      'error': 'failed',
    };
    
    // Si hay un mapeo, usarlo
    if (statusMap[statusLower]) {
      strapi.log.info(`[woo-sync] Estado de pedido mapeado: "${status}" → "${statusMap[statusLower]}"`);
      return statusMap[statusLower];
    }
    
    // Por defecto, usar 'pending'
    strapi.log.warn(`[woo-sync] Estado de pedido no válido: "${status}", usando "pending" por defecto`);
    return 'pending';
  },

  async syncOrderFromWoPedido(woPedido: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    if (!woPedido.numero_pedido) {
      throw new Error('wo-pedido sin numero_pedido');
    }

    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');

    const externalIds = (woPedido.externalIds || {}) as Record<string, unknown>;
    let wooId: number | string | null = (woPedido.wooId as number | string | null) || null;
    if (!wooId && externalIds[platform]) {
      wooId = externalIds[platform] as number | string;
    }

    // Obtener el pedido completo con relaciones pobladas
    // Importante: populate items.libro para tener acceso a externalIds del libro
    // En Strapi v5, el formato correcto es populate[items][populate][libro]=true
    const woPedidoCompleto = await strapi.entityService.findOne('api::wo-pedido.wo-pedido' as any, woPedido.id, {
      populate: {
        items: {
          populate: {
            libro: true,
          },
        },
        cliente: true,
      },
    }) as any;

    // OPCIÓN C: Sincronizar automáticamente los libros que no tienen externalIds
    if (woPedidoCompleto?.items && Array.isArray(woPedidoCompleto.items)) {
      strapi.log.info(`[woo-sync] 🔄 Verificando y sincronizando libros automáticamente si es necesario...`);
      
      for (const item of woPedidoCompleto.items) {
        if (item.libro) {
          try {
            const libroId = typeof item.libro === 'object' 
              ? (item.libro.documentId || item.libro.id || item.libro)
              : item.libro;
            
            if (!libroId) continue;
            
            // Obtener libro completo
            // En Strapi v5, entityService.findOne puede aceptar documentId directamente
            let libro: any = null;
            try {
              libro = await strapi.entityService.findOne('api::libro.libro', libroId, {
                populate: ['canales'] as any,
              }) as any;
            } catch (error: any) {
              // Si falla con documentId, intentar buscar por ID numérico si es posible
              strapi.log.warn(`[woo-sync] Error obteniendo libro ${libroId}, intentando alternativa: ${error?.message || error}`);
              // Si libroId es un documentId y falla, no podemos buscar por documentId en filtros
              // Continuar sin el libro
            }
            
            if (!libro) {
              strapi.log.warn(`[woo-sync] Libro ${libroId} no encontrado`);
              continue;
            }
            
            // Verificar si tiene externalIds para esta plataforma
            const libroAttrs = libro.attributes || libro;
            const externalIds = libroAttrs?.externalIds || {};
            
            if (!externalIds[platform]) {
              // El libro no está sincronizado, intentar sincronizarlo automáticamente
              strapi.log.info(`[woo-sync] 📦 Libro ${libroId} no tiene externalIds para ${platform}, sincronizando automáticamente...`);
              
              try {
                // Verificar que el libro esté en un canal de WooCommerce
                const canales = libroAttrs?.canales || libro.canales || [];
                const tieneCanalWoo = canales.some((c: any) => {
                  const canalKey = c.key || c.slug || c.nombre?.toLowerCase();
                  return canalKey === platform || canalKey === 'woo_moraleja' || canalKey === 'woo_escolar';
                });
                
                if (!tieneCanalWoo) {
                  strapi.log.warn(`[woo-sync] ⚠️  Libro ${libroId} no está en un canal de WooCommerce, no se puede sincronizar automáticamente`);
                  continue;
                }
                
                // Sincronizar el libro
                const libroParaSync = {
                  id: libro.id || libroId,
                  ...libroAttrs,
                };
                
                await this.syncProduct(libroParaSync, platform);
                strapi.log.info(`[woo-sync] ✅ Libro ${libroId} sincronizado automáticamente a ${platform}`);
                
                // Actualizar el libro en el item para que tenga los externalIds actualizados
                const libroActualizado = await strapi.entityService.findOne('api::libro.libro', libro.id || libroId) as any;
                if (libroActualizado) {
                  item.libro = libroActualizado;
                }
              } catch (syncError: any) {
                strapi.log.warn(`[woo-sync] ⚠️  Error sincronizando libro ${libroId} automáticamente: ${syncError?.message || syncError}`);
                // Continuar con el siguiente item
              }
            } else {
              strapi.log.info(`[woo-sync] ✓ Libro ${libroId} ya tiene externalIds para ${platform}`);
            }
          } catch (error: any) {
            strapi.log.warn(`[woo-sync] ⚠️  Error verificando libro del item: ${error?.message || error}`);
            // Continuar con el siguiente item
          }
        }
      }
    }

    // Obtener servicio de mappers
    // Los mappers se importan directamente ya que no son un content type
    let mappersService: any = null;
    try {
      // Importar los mappers directamente
      const mappersModule = require('./mappers-service');
      mappersService = mappersModule.default({ strapi });
      strapi.log.info('[woo-sync] ✅ Mappers cargados correctamente - usando servicios modulares de mapeo');
    } catch (error) {
      strapi.log.warn('[woo-sync] ⚠️ Servicio de mappers no disponible, continuando sin mappers:', error);
    }

    // Usar line-item-mapper para construir line_items si está disponible
    let lineItems: any[] = [];
    if (mappersService) {
      strapi.log.info(`[woo-sync] 🔄 Mapeando ${woPedidoCompleto?.items?.length || 0} items usando line-item-mapper`);
      lineItems = await mappersService.lineItem.mapItemsToWooLineItems(
        woPedidoCompleto?.items || [],
        platform
      );
      strapi.log.info(`[woo-sync] ✅ Mapeados ${lineItems.length} line items para WooCommerce`);
      
      // Si el mapper no encontró algunos items, intentar búsqueda directa en WooCommerce por SKU
      // para los items que no tienen product_id
      const itemsSinProductId = woPedidoCompleto?.items?.filter((item: any, index: number) => {
        return !lineItems[index] || !lineItems[index].product_id;
      }) || [];
      
      if (itemsSinProductId.length > 0) {
        for (const item of itemsSinProductId) {
          if (item.sku) {
            try {
              const searchResponse = await fetch(
                `${wooConfig.url}/wp-json/wc/v3/products?sku=${encodeURIComponent(item.sku)}`,
                {
                  headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              if (searchResponse.ok) {
                const products = await searchResponse.json() as any[];
                if (Array.isArray(products) && products.length > 0) {
                  const productId = products[0].id;
                  const lineItem = await mappersService.lineItem.mapItemToWooLineItem(
                    { ...item, producto_id: productId },
                    platform
                  );
                  if (lineItem) {
                    lineItems.push(lineItem);
                    strapi.log.info(`[woo-sync] Producto encontrado en WooCommerce por SKU: ${item.sku} → product_id: ${productId}`);
                  }
                }
              }
            } catch (error) {
              strapi.log.warn(`[woo-sync] Error buscando producto por SKU en WooCommerce: ${item.sku}`, error);
            }
          }
        }
      }
    } else {
      // Fallback: construir line_items manualmente (método legacy)
      strapi.log.warn('[woo-sync] Usando método legacy para construir line_items');
      for (const item of woPedidoCompleto?.items || []) {
        let productId: number | null = null;
        
        if (item.producto_id && item.producto_id > 0) {
          productId = parseInt(String(item.producto_id), 10);
        }
        
        if ((!productId || productId === 0) && item.libro) {
          const libro = await strapi.entityService.findOne('api::libro.libro', item.libro.id || item.libro) as any;
          if (libro?.externalIds?.[platform]) {
            productId = parseInt(String(libro.externalIds[platform]), 10);
          }
        }
        
        if ((!productId || productId === 0) && item.sku) {
          const libros = await strapi.entityService.findMany('api::libro.libro', {
            filters: { isbn_libro: item.sku },
          }) as any[];
          if (libros.length > 0 && libros[0].externalIds?.[platform]) {
            productId = parseInt(String(libros[0].externalIds[platform]), 10);
          }
        }
        
        if ((!productId || productId === 0) && item.sku) {
          try {
            const searchResponse = await fetch(
              `${wooConfig.url}/wp-json/wc/v3/products?sku=${encodeURIComponent(item.sku)}`,
              {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            if (searchResponse.ok) {
              const products = await searchResponse.json() as any[];
              if (Array.isArray(products) && products.length > 0) {
                productId = products[0].id;
                strapi.log.info(`[woo-sync] Producto encontrado en WooCommerce por SKU: ${item.sku} → product_id: ${productId}`);
              }
            }
          } catch (error) {
            strapi.log.warn(`[woo-sync] Error buscando producto por SKU en WooCommerce: ${item.sku}`, error);
          }
        }
        
        if (!productId || productId === 0) {
          const itemInfo = {
            nombre: item.nombre || 'sin nombre',
            sku: item.sku || 'sin SKU',
            producto_id: item.producto_id || 'no definido',
            libro_id: item.libro ? (item.libro.id || item.libro) : 'no relacionado',
          };
          
          strapi.log.error(`[woo-sync] ❌ No se pudo encontrar product_id válido para item:`, itemInfo);
          continue;
        }
        
        const lineItem: any = {
          product_id: productId,
          quantity: item.cantidad || 1,
        };
        
        if (item.nombre) lineItem.name = item.nombre;
        if (item.sku) lineItem.sku = item.sku;
        if (item.precio_unitario) lineItem.price = String(item.precio_unitario);
        if (item.total) lineItem.total = String(item.total);
        
        lineItems.push(lineItem);
      }
    }

    // Si no hay items válidos y tenemos rawWooData, intentar usar rawWooData
    if (lineItems.length === 0 && woPedido.rawWooData && typeof woPedido.rawWooData === 'object') {
      const raw = woPedido.rawWooData;
      if (raw.line_items && Array.isArray(raw.line_items)) {
        // Validar que los line_items de rawWooData tengan product_id válido
        for (const rawItem of raw.line_items) {
          if (rawItem.product_id && parseInt(String(rawItem.product_id), 10) > 0) {
            lineItems.push(rawItem);
          }
        }
      }
    }
    
    // Validar que tenemos al menos un line_item válido
    if (lineItems.length === 0) {
      const totalItems = woPedidoCompleto?.items?.length || 0;
      const errorMsg = `No se puede crear/actualizar un pedido sin productos válidos. ` +
        `El pedido tiene ${totalItems} item(s) pero ninguno tiene un product_id válido. ` +
        `Asegúrate de que los libros estén sincronizados en WooCommerce o agrega product_id manualmente a los items.`;
      strapi.log.error(`[woo-sync] ${errorMsg}`);
      
      // Log detallado de los items para debugging
      if (woPedidoCompleto?.items && woPedidoCompleto.items.length > 0) {
        strapi.log.error(`[woo-sync] Detalles de items:`, woPedidoCompleto.items.map((item: any, i: number) => ({
          index: i,
          nombre: item.nombre || 'sin nombre',
          sku: item.sku || 'sin SKU',
          producto_id: item.producto_id || 'no definido',
          libro_id: item.libro ? (typeof item.libro === 'object' ? (item.libro.id || item.libro.documentId) : item.libro) : 'no relacionado',
          libro_externalIds: item.libro && typeof item.libro === 'object' ? (item.libro.externalIds || {}) : {},
        })));
      }
      
      throw new Error(errorMsg);
    }

    // Obtener y validar customer_id si hay cliente relacionado
    let customerId: number | null = null;
    if (woPedidoCompleto?.cliente) {
      const cliente = woPedidoCompleto.cliente;
      const clienteExtIds = (cliente.externalIds || {}) as Record<string, unknown>;
      const potentialCustomerId = clienteExtIds[platform] || cliente.wooId;
      
      if (potentialCustomerId) {
        customerId = parseInt(String(potentialCustomerId), 10);
        
        // Validar que el customer existe en WooCommerce
        if (customerId > 0) {
          try {
            const customerCheck = await fetch(
              `${wooConfig.url}/wp-json/wc/v3/customers/${customerId}`,
              {
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            if (!customerCheck.ok) {
              strapi.log.warn(`[woo-sync] Customer ID ${customerId} no existe en WooCommerce, no se incluirá en el pedido`);
              customerId = null;
            }
          } catch (error) {
            strapi.log.warn(`[woo-sync] Error validando customer_id ${customerId}:`, error);
            customerId = null;
          }
        } else {
          customerId = null;
        }
      }
    }

    // Construir payload del pedido usando mappers si están disponibles
    let orderPayload: any;
    if (mappersService) {
      strapi.log.info('[woo-sync] 🔄 Mapeando pedido usando order-mapper');
      orderPayload = await mappersService.order.mapWoPedidoToWooOrder(woPedidoCompleto, platform);
      orderPayload.line_items = lineItems;
      
      // Agregar customer_id si está validado
      if (customerId) {
        orderPayload.customer_id = customerId;
      }
      
      // Usar address-mapper para direcciones
      if (woPedidoCompleto.billing) {
        strapi.log.info('[woo-sync] 🔄 Mapeando dirección de facturación usando address-mapper');
        orderPayload.billing = mappersService.address.mapBillingToWoo(woPedidoCompleto.billing);
      }
      if (woPedidoCompleto.shipping) {
        strapi.log.info('[woo-sync] 🔄 Mapeando dirección de envío usando address-mapper');
        orderPayload.shipping = mappersService.address.mapShippingToWoo(woPedidoCompleto.shipping);
      }
      strapi.log.info('[woo-sync] ✅ Payload del pedido mapeado completamente usando mappers modulares');
    } else {
      // Fallback: construir payload manualmente (método legacy)
      const normalizedStatus = this.normalizeOrderStatus(woPedidoCompleto.estado);
      orderPayload = {
        status: normalizedStatus,
        total: woPedidoCompleto.total ? String(woPedidoCompleto.total) : '0',
        line_items: lineItems,
      };
      
      if (woPedidoCompleto.subtotal != null) orderPayload.subtotal = String(woPedidoCompleto.subtotal);
      if (woPedidoCompleto.impuestos != null) orderPayload.total_tax = String(woPedidoCompleto.impuestos);
      if (woPedidoCompleto.envio != null) orderPayload.shipping_total = String(woPedidoCompleto.envio);
      if (woPedidoCompleto.descuento != null) orderPayload.discount_total = String(woPedidoCompleto.descuento);
      if (woPedidoCompleto.moneda) orderPayload.currency = woPedidoCompleto.moneda;
      if (woPedidoCompleto.metodo_pago) orderPayload.payment_method = woPedidoCompleto.metodo_pago;
      if (woPedidoCompleto.metodo_pago_titulo) orderPayload.payment_method_title = woPedidoCompleto.metodo_pago_titulo;
      if (woPedidoCompleto.nota_cliente) orderPayload.customer_note = woPedidoCompleto.nota_cliente;
      if (customerId) orderPayload.customer_id = customerId;
      
      // Direcciones (método legacy)
      if (woPedidoCompleto.billing && typeof woPedidoCompleto.billing === 'object') {
        const billing = woPedidoCompleto.billing as any;
        orderPayload.billing = {
          first_name: billing.first_name || billing.firstName || '',
          last_name: billing.last_name || billing.lastName || '',
          company: billing.company || '',
          address_1: billing.address_1 || billing.address1 || billing.address || '',
          address_2: billing.address_2 || billing.address2 || '',
          city: billing.city || '',
          state: billing.state || '',
          postcode: billing.postcode || billing.postal_code || '',
          country: billing.country || 'CL',
          email: billing.email || '',
          phone: billing.phone || '',
        };
      }
      if (woPedidoCompleto.shipping && typeof woPedidoCompleto.shipping === 'object') {
        const shipping = woPedidoCompleto.shipping as any;
        orderPayload.shipping = {
          first_name: shipping.first_name || shipping.firstName || '',
          last_name: shipping.last_name || shipping.lastName || '',
          company: shipping.company || '',
          address_1: shipping.address_1 || shipping.address1 || shipping.address || '',
          address_2: shipping.address_2 || shipping.address2 || '',
          city: shipping.city || '',
          state: shipping.state || '',
          postcode: shipping.postcode || shipping.postal_code || '',
          country: shipping.country || 'CL',
        };
      }
    }

    // Si tenemos rawWooData, usar datos adicionales de ahí si no están en woPedido
    if (woPedido.rawWooData && typeof woPedido.rawWooData === 'object') {
      const raw = woPedido.rawWooData;
      
      // Usar billing de rawWooData si no está en woPedido
      if (!orderPayload.billing && raw.billing) {
        if (mappersService) {
          orderPayload.billing = mappersService.address.normalizeAddress(raw.billing, 'billing');
        } else {
          // Fallback legacy
          const billing = raw.billing as any;
          orderPayload.billing = {
            first_name: billing.first_name || billing.firstName || '',
            last_name: billing.last_name || billing.lastName || '',
            company: billing.company || '',
            address_1: billing.address_1 || billing.address1 || billing.address || '',
            address_2: billing.address_2 || billing.address2 || '',
            city: billing.city || '',
            state: billing.state || '',
            postcode: billing.postcode || billing.postal_code || '',
            country: billing.country || 'CL',
            email: billing.email || '',
            phone: billing.phone || '',
          };
        }
      }
      
      // Usar shipping de rawWooData si no está en woPedido
      if (!orderPayload.shipping && raw.shipping) {
        if (mappersService) {
          orderPayload.shipping = mappersService.address.normalizeAddress(raw.shipping, 'shipping');
        } else {
          // Fallback legacy
          const shipping = raw.shipping as any;
          orderPayload.shipping = {
            first_name: shipping.first_name || shipping.firstName || '',
            last_name: shipping.last_name || shipping.lastName || '',
            company: shipping.company || '',
            address_1: shipping.address_1 || shipping.address1 || shipping.address || '',
            address_2: shipping.address_2 || shipping.address2 || '',
            city: shipping.city || '',
            state: shipping.state || '',
            postcode: shipping.postcode || shipping.postal_code || '',
            country: shipping.country || 'CL',
          };
        }
      }
      
      // Usar customer_id de rawWooData si no está en woPedido
      if (!customerId && raw.customer_id) {
        const rawCustomerId = parseInt(String(raw.customer_id), 10);
        if (rawCustomerId > 0) {
          customerId = rawCustomerId;
          orderPayload.customer_id = customerId;
        }
      }
      
      // Usar payment_method de rawWooData si no está en woPedido
      if (!orderPayload.payment_method && raw.payment_method) {
        orderPayload.payment_method = raw.payment_method;
      }
    }

    // Log del payload antes de enviar (para debugging)
    strapi.log.info(`[woo-sync] Payload del pedido para ${platform}:`, {
      status: orderPayload.status,
      total: orderPayload.total,
      line_items_count: orderPayload.line_items.length,
      customer_id: customerId || 'no customer',
      has_billing: !!orderPayload.billing,
      has_shipping: !!orderPayload.shipping,
      line_items: orderPayload.line_items.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        name: item.name || 'sin nombre',
        sku: item.sku || 'sin SKU',
      })),
    });
    
    let response;
    if (wooId) {
      strapi.log.info(
        `[woo-sync] Actualizando pedido en ${platform}: Woo ID=${wooId}, número=${woPedido.numero_pedido}`
      );
      response = await fetch(`${wooConfig.url}/wp-json/wc/v3/orders/${wooId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(orderPayload),
      });
    } else {
      strapi.log.info(
        `[woo-sync] Creando pedido en ${platform}: número=${woPedido.numero_pedido}`
      );
      // Validación ya se hizo arriba, pero verificamos nuevamente por seguridad
      if (!orderPayload.line_items || orderPayload.line_items.length === 0) {
        throw new Error('No se puede crear un pedido sin productos válidos (line_items con product_id válido)');
      }
      
      // Para crear un pedido, billing es requerido si no hay customer_id
      if (!customerId && !orderPayload.billing) {
        strapi.log.warn('[woo-sync] ⚠️ Creando pedido sin customer_id ni billing, WooCommerce puede rechazarlo');
      }
      response = await fetch(`${wooConfig.url}/wp-json/wc/v3/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(orderPayload),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      strapi.log.error(`[woo-sync] ❌ Error de WooCommerce API (orders):`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        payload_sent: JSON.stringify(orderPayload, null, 2).substring(0, 1000), // Primeros 1000 caracteres
      });
      throw new Error(`WooCommerce API error (orders): ${response.status} ${errorText}`);
    }

    const wooOrder = (await response.json()) as any;

    // Actualizar externalIds y wooId en wo-pedido
    try {
      const updatedExternalIds = { ...(woPedido.externalIds || {}), [platform]: wooOrder.id };
      const updateData: any = {
        wooId: wooOrder.id,
        externalIds: updatedExternalIds,
        skipWooSync: true,
      };
      await strapi.entityService.update('api::wo-pedido.wo-pedido' as any, woPedido.id, {
        data: updateData,
      } as any);
    } catch (error) {
      strapi.log.warn('[woo-sync] No se pudo actualizar externalIds/wooId en wo-pedido:', error);
    }

    return wooOrder;
  },

  /**
   * Elimina un pedido en WooCommerce basado en los datos de WO-Pedidos
   */
  async deleteOrderFromWoPedido(woPedido: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      strapi.log.warn(`[woo-sync] Configuración de WooCommerce no encontrada para ${platform}. No se elimina pedido.`);
      return;
    }

    const externalIds = (woPedido.externalIds || {}) as Record<string, unknown>;
    const wooId = (woPedido.wooId as number | string | null) || (externalIds[platform] as number | string | null);

    if (!wooId) {
      strapi.log.info(
        `[woo-sync] ⏭️  deleteOrderFromWoPedido omitido: no hay wooId ni externalIds[${platform}] para pedido ${woPedido.id}`
      );
      return;
    }

    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');

    try {
      strapi.log.info(
        `[woo-sync] Eliminando pedido en ${platform}: Woo ID=${wooId}, número=${woPedido.numero_pedido}`
      );

      const response = await fetch(`${wooConfig.url}/wp-json/wc/v3/orders/${wooId}?force=true`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.status === 404) {
        strapi.log.warn(
          `[woo-sync] Pedido ${wooId} no encontrado en ${platform} al intentar eliminar (ya estaba eliminado).`
        );
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API error (delete order): ${response.status} ${errorText}`);
      }

      strapi.log.info(
        `[woo-sync] ✅ Pedido eliminado en ${platform}: Woo ID=${wooId}, número=${woPedido.numero_pedido}`
      );
    } catch (error) {
      strapi.log.error('[woo-sync] Error eliminando pedido en WooCommerce:', error);
    }
  },

  /**
   * Elimina un cupón en WooCommerce basado en los datos de WO-Cupones
   */
  async deleteCouponFromWoCupon(woCupon: any, platform: 'woo_moraleja' | 'woo_escolar') {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      strapi.log.warn(`[woo-sync] Configuración de WooCommerce no encontrada para ${platform}. No se elimina cupón.`);
      return;
    }

    const externalIds = (woCupon.externalIds || {}) as Record<string, unknown>;
    const wooId = (woCupon.wooId as number | string | null) || (externalIds[platform] as number | string | null);

    if (!wooId) {
      strapi.log.info(
        `[woo-sync] ⏭️  deleteCouponFromWoCupon omitido: no hay wooId ni externalIds[${platform}] para cupón ${woCupon.id}`
      );
      return;
    }

    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');

    try {
      strapi.log.info(
        `[woo-sync] Eliminando cupón en ${platform}: Woo ID=${wooId}, código=${woCupon.codigo}`
      );

      const response = await fetch(`${wooConfig.url}/wp-json/wc/v3/coupons/${wooId}?force=true`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.status === 404) {
        strapi.log.warn(
          `[woo-sync] Cupón ${wooId} no encontrado en ${platform} al intentar eliminar (ya estaba eliminado).`
        );
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API error (delete coupon): ${response.status} ${errorText}`);
      }

      strapi.log.info(
        `[woo-sync] ✅ Cupón eliminado en ${platform}: Woo ID=${wooId}, código=${woCupon.codigo}`
      );
    } catch (error) {
      strapi.log.error('[woo-sync] Error eliminando cupón en WooCommerce:', error);
    }
  },

  /**
   * Obtiene la URL de la imagen desde Strapi (media.moraleja.cl)
   */
  getImageUrl(portadaLibro: any): string | null {
    if (!portadaLibro) return null;

    // Si es un objeto con url
    if (typeof portadaLibro === 'object') {
      const url = portadaLibro.url || portadaLibro.formats?.large?.url || portadaLibro.formats?.medium?.url || portadaLibro.formats?.small?.url;
      if (url) {
        // Si ya es una URL completa (empieza con http), devolverla
        if (url.startsWith('http')) {
          return url;
        }
        // Si es una ruta relativa, construir URL completa
        const baseUrl = process.env.S3_BASE_URL || process.env.MEDIA_URL || 'https://media.moraleja.cl';
        return `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
      }
    }

    // Si es un string (URL directa)
    if (typeof portadaLibro === 'string') {
      if (portadaLibro.startsWith('http')) {
        return portadaLibro;
      }
      const baseUrl = process.env.S3_BASE_URL || process.env.MEDIA_URL || 'https://media.moraleja.cl';
      return `${baseUrl.replace(/\/$/, '')}${portadaLibro.startsWith('/') ? portadaLibro : `/${portadaLibro}`}`;
    }

    return null;
  },

  /**
   * Construye el objeto de producto para WooCommerce
   * Ahora sincroniza automáticamente el autor si existe
   * Si existe rawWooData, lo usa directamente (desde Intranet)
   */
  async buildWooProduct(libro: any, platform: 'woo_moraleja' | 'woo_escolar') {
    // Convertir descripcion (blocks) a texto plano primero (lo necesitaremos)
    let descripcionTexto = '';
    if (libro.descripcion && Array.isArray(libro.descripcion)) {
      descripcionTexto = libro.descripcion
        .map((block: any) => {
          if (block.children && Array.isArray(block.children)) {
            return block.children.map((child: any) => child.text || '').join('');
          }
          return '';
        })
        .join('\n');
    }
    
    // ⚠️ CRÍTICO: Si existe rawWooData, usarlo como base
    if (libro.rawWooData && typeof libro.rawWooData === 'object') {
      strapi.log.info('[woo-sync] ✅ Usando rawWooData desde Intranet');
      console.log('[woo-sync] 📦 rawWooData:', JSON.stringify(libro.rawWooData, null, 2));
      
      // rawWooData ya viene en el formato exacto de WooCommerce
      const product = { ...libro.rawWooData };
      
      // ✅ COMPLETAR campos que falten en rawWooData desde Strapi
      // ⚠️ IMPORTANTE: NO mezclar description con short_description (evitar sobrescritura)
      
      // Agregar description SOLO desde libro.descripcion (blocks convertidos a texto)
      if (!product.description || product.description === '') {
        product.description = descripcionTexto || ''; // SOLO descripcion, SIN fallback a subtitulo
        if (product.description) {
          strapi.log.info('[woo-sync] 📝 Description agregada desde libro.descripcion');
        }
      }
      
      // Agregar short_description SOLO desde libro.subtitulo_libro
      if (!product.short_description || product.short_description === '') {
        product.short_description = libro.subtitulo_libro || ''; // SOLO subtitulo, SIN fallback a descripcion
        if (product.short_description) {
          strapi.log.info('[woo-sync] 📝 Short description agregada desde libro.subtitulo_libro');
        }
      }
      
      // Agregar imagen si no viene en rawWooData
      if (!product.images && libro.portada_libro) {
        const portadaUrl = libro.portada_libro?.url || 
                          libro.portada_libro?.formats?.large?.url || 
                          libro.portada_libro?.formats?.medium?.url || 
                          libro.portada_libro?.formats?.small?.url || 
                          (typeof libro.portada_libro === 'string' ? libro.portada_libro : null);
        
        if (portadaUrl) {
          const fullUrl = portadaUrl.startsWith('http') ? portadaUrl : `${process.env.STRAPI_URL || 'https://strapi.moraleja.cl'}${portadaUrl}`;
          product.images = [{
            src: fullUrl,
            alt: libro.nombre_libro || 'Portada'
          }];
          strapi.log.info('[woo-sync] 📸 Imagen agregada desde portada_libro');
        }
      }
      
      strapi.log.info('[woo-sync] ✅ Producto construido desde rawWooData (con campos completados)');
      return product;
    }
    
    // Si NO hay rawWooData, construir el producto de forma tradicional
    strapi.log.info('[woo-sync] 🔧 Construyendo producto de forma tradicional (sin rawWooData)');
    
    const externalIds = libro.externalIds || {};
    const wooId = externalIds[platform];

    // Preparar meta_data para identificadores
    const metaData: Array<{ key: string; value: string }> = [];
    
    // ISBN en meta_data (backup/búsqueda)
    if (libro.isbn_libro) {
      metaData.push({ key: 'isbn', value: String(libro.isbn_libro) });
    }
    
    // EAN en meta_data (si existe)
    if (libro.ean_libro) {
      metaData.push({ key: 'ean', value: String(libro.ean_libro) });
    }

    // SKU: usar ISBN, EAN, o generar uno único si no hay
    let sku = libro.isbn_libro || libro.ean_libro || '';
    if (!sku && libro.id) {
      // Generar SKU único basado en ID de Strapi si no hay ISBN/EAN
      sku = `STRAPI-${libro.id}`;
    }
    
    // descripcionTexto ya fue convertido al inicio de la función
    
    const product: any = {
      name: libro.nombre_libro || 'Sin nombre',
      type: 'simple',
      sku: sku, // SKU = ISBN, EAN, o ID de Strapi
      // ✅ CORRECCIÓN: Cada campo usa SOLO su fuente correspondiente (sin fallbacks cruzados)
      description: descripcionTexto || '', // SOLO libro.descripcion (blocks)
      short_description: libro.subtitulo_libro || '', // SOLO libro.subtitulo_libro
      // Campos para wp_wc_product_meta_lookup
      virtual: false, // Libros físicos, no virtuales
      downloadable: false, // Libros físicos, no descargables
      tax_status: 'taxable', // Productos sujetos a impuestos
      tax_class: '', // Clase de impuestos vacía (usa la por defecto)
      // Stock: se establecerá en syncStocksToWooCommerce, pero valores por defecto
      manage_stock: true,
      stock_quantity: 0, // Se actualizará en syncStocksToWooCommerce
      stock_status: 'outofstock', // Se actualizará en syncStocksToWooCommerce
      // Precio: se establecerá en syncPreciosToWooCommerce, pero valor por defecto
      regular_price: '0', // Se actualizará en syncPreciosToWooCommerce
    };

    // Agregar meta_data si hay datos
    if (metaData.length > 0) {
      product.meta_data = metaData;
    }

    // Inicializar attributes si no existe
    if (!product.attributes) {
      product.attributes = [];
    }

    // Sincronizar atributos desde relaciones del libro
    try {
      await this.syncAttributesForProduct(product, libro, platform, metaData);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando atributos para libro ${libro.id}:`, error);
    }

    // Sincronizar canales → categorías WooCommerce
    try {
      await this.syncCanalesToWooCommerce(libro, product, platform);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando canales para libro ${libro.id}:`, error);
    }

    // Sincronizar precios por canal
    try {
      await this.syncPreciosToWooCommerce(libro, product, platform);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando precios para libro ${libro.id}:`, error);
    }

    // Sincronizar stocks por ubicación
    try {
      await this.syncStocksToWooCommerce(libro, product, platform);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando stocks para libro ${libro.id}:`, error);
    }

    // Sincronizar libros relacionados
    try {
      await this.syncLibrosRelacionadosToWooCommerce(libro, product, platform);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando libros relacionados para libro ${libro.id}:`, error);
    }

    // Sincronizar marcas (Brands)
    try {
      await this.syncMarcasToWooCommerce(libro, product, platform);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando marcas para libro ${libro.id}:`, error);
    }

    // Sincronizar etiquetas (Tags)
    try {
      await this.syncEtiquetasToWooCommerce(libro, product, platform);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando etiquetas para libro ${libro.id}:`, error);
    }

    // Sincronizar categorías (Categories) - después de canales para no sobrescribir
    try {
      await this.syncCategoriasToWooCommerce(libro, product, platform);
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error sincronizando categorías para libro ${libro.id}:`, error);
    }

    // Añadir imagen si existe (desde media.moraleja.cl)
    const imageUrl = this.getImageUrl(libro.portada_libro);
    if (imageUrl) {
      product.images = [
        {
          src: imageUrl,
          alt: libro.nombre_libro || 'Portada del libro',
        },
      ];
    }

    return product;
  },

  /**
   * Helper: Obtener o crear atributo en WooCommerce
   */
  async getOrCreateAttribute(config: any, attributeName: string, slug: string) {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    try {
      // Buscar atributo existente
      const response = await fetch(`${config.url}/wp-json/wc/v3/products/attributes`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        strapi.log.warn(`[woo-sync] Error obteniendo atributos: ${response.status}`);
        return null;
      }
      
      const attributesData = await response.json() as any;
      // Asegurar que sea un array
      const attributes = Array.isArray(attributesData) ? attributesData : (attributesData && Array.isArray(attributesData.data) ? attributesData.data : []);
      let attribute = attributes.find((attr: any) => 
        attr.name.toLowerCase() === attributeName.toLowerCase() || attr.slug === slug
      );

      if (!attribute) {
        // Crear atributo
        const createResponse = await fetch(`${config.url}/wp-json/wc/v3/products/attributes`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: attributeName,
            slug: slug,
            type: 'select',
            has_archives: true,
          }),
        });
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          strapi.log.error(`[woo-sync] Error creando atributo "${attributeName}": ${createResponse.status} ${errorText}`);
          return null;
        }
        
        attribute = await createResponse.json();
        strapi.log.info(`[woo-sync] Atributo "${attributeName}" creado en ${config.url} (ID: ${attribute.id})`);
      }

      return attribute;
    } catch (error) {
      strapi.log.error(`[woo-sync] Error con atributo "${attributeName}":`, error);
      throw error;
    }
  },

  /**
   * Helper: Obtener o crear término de atributo
   */
  async getOrCreateAttributeTerm(config: any, attributeId: number, termName: string, description?: string | null, strapiDocumentId?: string | null) {
    if (!termName || termName.trim() === '') {
      return null;
    }
    
    // Usar el método del api-client que ya tiene la lógica mejorada con documentId
    const apiClient = strapi.service('api::woo-sync.woo-api-client');
    if (apiClient && apiClient.getOrCreateAttributeTerm) {
      return apiClient.getOrCreateAttributeTerm(config, attributeId, termName, description, strapiDocumentId);
    }
    
    // Fallback al método legacy si el api-client no está disponible
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    try {
      // Buscar término existente por slug si tenemos documentId
      if (strapiDocumentId) {
        const slugResponse = await fetch(`${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms?slug=${encodeURIComponent(strapiDocumentId)}`, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (slugResponse.ok) {
          const slugTermsData = await slugResponse.json() as any;
          const slugTerms = Array.isArray(slugTermsData) ? slugTermsData : (slugTermsData && Array.isArray(slugTermsData.data) ? slugTermsData.data : []);
          const termBySlug = slugTerms.find((t: any) => t.slug === strapiDocumentId);
          
          if (termBySlug) {
            // Actualizar si es necesario
            const needsUpdate = termBySlug.name !== termName || (description && termBySlug.description !== description);
            if (needsUpdate) {
              const updatePayload: any = { name: termName };
              if (description) updatePayload.description = description;
              const updateResponse = await fetch(`${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms/${termBySlug.id}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatePayload),
              });
              if (updateResponse.ok) {
                return await updateResponse.json();
              }
            }
            return termBySlug;
          }
        }
      }
      
      // Buscar término existente por nombre
      const response = await fetch(`${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        strapi.log.warn(`[woo-sync] Error obteniendo términos para atributo ${attributeId}: ${response.status}`);
      }
      
      const termsData = await response.json() as any;
      const terms = Array.isArray(termsData) ? termsData : (termsData && Array.isArray(termsData.data) ? termsData.data : []);
      let term = terms.find((t: any) => t.name === termName);

      if (!term) {
        // Crear término con documentId como slug si está disponible
        const slug = strapiDocumentId || termName.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        
        const termData: any = {
          name: termName,
          slug: slug,
        };
        
        if (description && description.trim()) {
          termData.description = description.trim();
        }
        
        const createResponse = await fetch(`${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(termData),
        });
        const createdTerm = await createResponse.json();
        term = createdTerm;
      }

      return term;
    } catch (error) {
      strapi.log.warn(`[woo-sync] Error creando término "${termName}":`, error);
      return null;
    }
  },

  /**
   * Helper para actualizar externalIds sin disparar lifecycles
   */
  async updateExternalIdsWithoutLifecycle(
    contentType: string,
    entityId: number,
    currentExternalIds: Record<string, any>,
    platform: string,
    newWooId: number
  ): Promise<boolean> {
    // Solo actualizar si el ID cambió o no teníamos uno
    const currentWooId = currentExternalIds[platform];
    if (currentWooId === newWooId) {
      return false; // Ya está actualizado
    }

    const updatedExternalIds = { ...currentExternalIds, [platform]: newWooId };
    
    try {
      // Usar db.query directamente para evitar lifecycles completamente
      await strapi.db.query(contentType).updateMany({
        where: { id: entityId },
        data: { externalIds: updatedExternalIds },
      });
      strapi.log.info(`[woo-sync] externalId guardado para ${contentType} ${entityId} en ${platform}: ${newWooId}`);
      return true;
    } catch (error) {
      strapi.log.warn(`[woo-sync] No se pudo guardar externalId para ${contentType} usando db.query:`, error);
      // Fallback: No usar entityService aquí para evitar bucles
      // Si db.query falla, simplemente loguear el error
      return false;
    }
  },

  /**
   * Sincroniza un término de Autor a todas las plataformas WooCommerce configuradas
   */
  async syncAutorTerm(autor: any) {
    if (!autor || !autor.nombre_completo_autor) {
      strapi.log.warn('[woo-sync] Intento de sincronizar autor sin nombre_completo_autor');
      return;
    }

    const termName = autor.nombre_completo_autor;
    // Convertir resegna (blocks) a texto plano para la descripción
    let termDescription: string | null = null;
    if (autor.resegna && Array.isArray(autor.resegna)) {
      termDescription = autor.resegna
        .map((block: any) => {
          if (block.type === 'paragraph' && block.children) {
            return block.children
              .filter((child: any) => child.type === 'text')
              .map((child: any) => child.text)
              .join('');
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    // Sincronizar a todas las plataformas configuradas
    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    const autorId = autor.id || autor.documentId;
    const externalIds = autor.externalIds || {};
    
    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) {
          continue; // Plataforma no configurada, saltar
        }

        const autorAttr = await this.getOrCreateAttribute(wooConfig, 'Autor', 'autor');
        if (!autorAttr || !autorAttr.id) {
          strapi.log.warn(`[woo-sync] No se pudo obtener atributo "Autor" para ${platform}`);
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que eliminar)
        // Si no tenemos externalId, usar getOrCreateAttributeTerm (igual que crear)
        const existingWooId = externalIds[platform];
        let term: any = null;
        const strapiDocumentId = autor.documentId || autor.id;
        
        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como eliminar)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: termName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que crear)
          };
          if (termDescription) updatePayload.description = termDescription;
          
          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${autorAttr.id}/terms/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );
          
          if (updateResponse.ok) {
            term = await updateResponse.json();
            strapi.log.info(`[woo-sync] Autor "${termName}" actualizado en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla (404 = término no existe, fue eliminado), usar getOrCreateAttributeTerm como fallback
            const errorText = await updateResponse.text();
            const is404 = updateResponse.status === 404;
            if (is404) {
              strapi.log.warn(`[woo-sync] Término ${existingWooId} no existe en ${platform} (fue eliminado). Buscando/creando nuevo término...`);
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando autor en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando término...`);
            }
            term = await this.getOrCreateAttributeTerm(wooConfig, autorAttr.id, termName, termDescription, strapiDocumentId);
            if (term && term.id) {
              if (term.id !== existingWooId) {
                strapi.log.info(`[woo-sync] Término recreado con nuevo ID (${existingWooId} → ${term.id}), se actualizará externalId`);
              } else {
                strapi.log.info(`[woo-sync] Término encontrado/recuperado en ${platform} (ID: ${term.id})`);
              }
            }
          }
        } else {
          // No tiene externalId, buscar/crear término usando documentId como slug (igual que crear)
          term = await this.getOrCreateAttributeTerm(wooConfig, autorAttr.id, termName, termDescription, strapiDocumentId);
        }
        
        // Guardar externalId si se obtuvo/creó un término
        if (term && term.id && autorId) {
          await this.updateExternalIdsWithoutLifecycle('api::autor.autor', autorId, externalIds, platform, term.id);
        }
        
        strapi.log.info(`[woo-sync] Autor "${termName}" sincronizado a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando autor "${termName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Sincroniza un término de Obra a todas las plataformas WooCommerce configuradas
   */
  async syncObraTerm(obra: any) {
    if (!obra || !obra.nombre_obra) {
      strapi.log.warn('[woo-sync] Intento de sincronizar obra sin nombre_obra');
      return;
    }

    const termName = obra.nombre_obra;
    const termDescription = obra.descripcion || null;
    const obraId = obra.id || obra.documentId;
    const externalIds = obra.externalIds || {};

    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) continue;

        const obraAttr = await this.getOrCreateAttribute(wooConfig, 'Obra', 'obra');
        if (!obraAttr || !obraAttr.id) {
          strapi.log.warn(`[woo-sync] No se pudo obtener atributo "Obra" para ${platform}`);
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que autor)
        // Si no tenemos externalId, usar getOrCreateAttributeTerm (igual que crear)
        const existingWooId = externalIds[platform];
        let term: any = null;
        const strapiDocumentId = obra.documentId || obra.id;

        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como autor)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: termName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que crear)
          };
          if (termDescription) updatePayload.description = termDescription;

          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${obraAttr.id}/terms/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (updateResponse.ok) {
            term = await updateResponse.json();
            strapi.log.info(`[woo-sync] Obra "${termName}" actualizada en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla, usar getOrCreateAttributeTerm como fallback (igual que crear)
            const errorText = await updateResponse.text();
            const is404 = updateResponse.status === 404;
            if (is404) {
              strapi.log.warn(`[woo-sync] Término ${existingWooId} no existe en ${platform} (fue eliminado). Buscando/creando nuevo término...`);
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando obra en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando término...`);
            }
            term = await this.getOrCreateAttributeTerm(wooConfig, obraAttr.id, termName, termDescription, strapiDocumentId);
            if (term && term.id) {
              if (term.id !== existingWooId) {
                strapi.log.info(`[woo-sync] Término recreado con nuevo ID (${existingWooId} → ${term.id}), se actualizará externalId`);
              } else {
                strapi.log.info(`[woo-sync] Término encontrado/recuperado en ${platform} (ID: ${term.id})`);
              }
            }
          }
        } else {
          // No tiene externalId, buscar/crear término usando documentId como slug (igual que crear)
          term = await this.getOrCreateAttributeTerm(wooConfig, obraAttr.id, termName, termDescription, strapiDocumentId);
        }
        
        // Guardar externalId si se obtuvo/creó un término
        if (term && term.id && obraId) {
          await this.updateExternalIdsWithoutLifecycle('api::obra.obra', obraId, externalIds, platform, term.id);
        }
        
        strapi.log.info(`[woo-sync] Obra "${termName}" sincronizada a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando obra "${termName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Sincroniza un término de Editorial a todas las plataformas WooCommerce configuradas
   */
  async syncEditorialTerm(editorial: any) {
    if (!editorial || !editorial.nombre_editorial) {
      strapi.log.warn('[woo-sync] Intento de sincronizar editorial sin nombre_editorial');
      return;
    }

    const termName = editorial.nombre_editorial;
    const editorialId = editorial.id || editorial.documentId;
    const externalIds = editorial.externalIds || {};

    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) continue;

        const editorialAttr = await this.getOrCreateAttribute(wooConfig, 'Editorial', 'editorial');
        if (!editorialAttr || !editorialAttr.id) {
          strapi.log.warn(`[woo-sync] No se pudo obtener atributo "Editorial" para ${platform}`);
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que autor)
        // Si no tenemos externalId, usar getOrCreateAttributeTerm (igual que crear)
        const existingWooId = externalIds[platform];
        let term: any = null;
        const strapiDocumentId = editorial.documentId || editorial.id;

        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como autor)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: termName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que crear)
          };

          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${editorialAttr.id}/terms/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (updateResponse.ok) {
            term = await updateResponse.json();
            strapi.log.info(`[woo-sync] Editorial "${termName}" actualizada en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla, usar getOrCreateAttributeTerm como fallback (igual que crear)
            const errorText = await updateResponse.text();
            const is404 = updateResponse.status === 404;
            if (is404) {
              strapi.log.warn(`[woo-sync] Término ${existingWooId} no existe en ${platform} (fue eliminado). Buscando/creando nuevo término...`);
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando editorial en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando término...`);
            }
            term = await this.getOrCreateAttributeTerm(wooConfig, editorialAttr.id, termName, undefined, strapiDocumentId);
            if (term && term.id) {
              if (term.id !== existingWooId) {
                strapi.log.info(`[woo-sync] Término recreado con nuevo ID (${existingWooId} → ${term.id}), se actualizará externalId`);
              } else {
                strapi.log.info(`[woo-sync] Término encontrado/recuperado en ${platform} (ID: ${term.id})`);
              }
            }
          }
        } else {
          // No tiene externalId, buscar/crear término usando documentId como slug (igual que crear)
          term = await this.getOrCreateAttributeTerm(wooConfig, editorialAttr.id, termName, undefined, strapiDocumentId);
        }
        
        // Guardar externalId si se obtuvo/creó un término
        if (term && term.id && editorialId) {
          await this.updateExternalIdsWithoutLifecycle('api::editorial.editorial', editorialId, externalIds, platform, term.id);
        }
        
        strapi.log.info(`[woo-sync] Editorial "${termName}" sincronizada a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando editorial "${termName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Sincroniza un término de Sello a todas las plataformas WooCommerce configuradas
   */
  async syncSelloTerm(sello: any) {
    if (!sello || !sello.nombre_sello) {
      strapi.log.warn('[woo-sync] Intento de sincronizar sello sin nombre_sello');
      return;
    }

    const termName = sello.nombre_sello;
    const selloId = sello.id || sello.documentId;
    const externalIds = sello.externalIds || {};

    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) continue;

        const selloAttr = await this.getOrCreateAttribute(wooConfig, 'Sello', 'sello');
        if (!selloAttr || !selloAttr.id) {
          strapi.log.warn(`[woo-sync] No se pudo obtener atributo "Sello" para ${platform}`);
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que autor)
        // Si no tenemos externalId, usar getOrCreateAttributeTerm (igual que crear)
        const existingWooId = externalIds[platform];
        let term: any = null;
        const strapiDocumentId = sello.documentId || sello.id;

        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como autor)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: termName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que crear)
          };

          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${selloAttr.id}/terms/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (updateResponse.ok) {
            term = await updateResponse.json();
            strapi.log.info(`[woo-sync] Sello "${termName}" actualizado en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla, usar getOrCreateAttributeTerm como fallback (igual que crear)
            const errorText = await updateResponse.text();
            const is404 = updateResponse.status === 404;
            if (is404) {
              strapi.log.warn(`[woo-sync] Término ${existingWooId} no existe en ${platform} (fue eliminado). Buscando/creando nuevo término...`);
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando sello en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando término...`);
            }
            term = await this.getOrCreateAttributeTerm(wooConfig, selloAttr.id, termName, undefined, strapiDocumentId);
            if (term && term.id) {
              if (term.id !== existingWooId) {
                strapi.log.info(`[woo-sync] Término recreado con nuevo ID (${existingWooId} → ${term.id}), se actualizará externalId`);
              } else {
                strapi.log.info(`[woo-sync] Término encontrado/recuperado en ${platform} (ID: ${term.id})`);
              }
            }
          }
        } else {
          // No tiene externalId, buscar/crear término usando documentId como slug (igual que crear)
          term = await this.getOrCreateAttributeTerm(wooConfig, selloAttr.id, termName, undefined, strapiDocumentId);
        }
        
        // Guardar externalId si se obtuvo/creó un término
        if (term && term.id && selloId) {
          await this.updateExternalIdsWithoutLifecycle('api::sello.sello', selloId, externalIds, platform, term.id);
        }
        
        strapi.log.info(`[woo-sync] Sello "${termName}" sincronizado a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando sello "${termName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Sincroniza un término de Colección a todas las plataformas WooCommerce configuradas
   */
  async syncColeccionTerm(coleccion: any) {
    if (!coleccion || !coleccion.nombre_coleccion) {
      strapi.log.warn('[woo-sync] Intento de sincronizar colección sin nombre_coleccion');
      return;
    }

    const termName = coleccion.nombre_coleccion;
    const coleccionId = coleccion.id || coleccion.documentId;
    const externalIds = coleccion.externalIds || {};

    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) continue;

        const coleccionAttr = await this.getOrCreateAttribute(wooConfig, 'Colección', 'coleccion');
        if (!coleccionAttr || !coleccionAttr.id) {
          strapi.log.warn(`[woo-sync] No se pudo obtener atributo "Colección" para ${platform}`);
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que autor)
        // Si no tenemos externalId, usar getOrCreateAttributeTerm (igual que crear)
        const existingWooId = externalIds[platform];
        let term: any = null;
        const strapiDocumentId = coleccion.documentId || coleccion.id;

        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como autor)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: termName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que crear)
          };

          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${coleccionAttr.id}/terms/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (updateResponse.ok) {
            term = await updateResponse.json();
            strapi.log.info(`[woo-sync] Colección "${termName}" actualizada en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla, usar getOrCreateAttributeTerm como fallback (igual que crear)
            const errorText = await updateResponse.text();
            const is404 = updateResponse.status === 404;
            if (is404) {
              strapi.log.warn(`[woo-sync] Término ${existingWooId} no existe en ${platform} (fue eliminado). Buscando/creando nuevo término...`);
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando colección en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando término...`);
            }
            term = await this.getOrCreateAttributeTerm(wooConfig, coleccionAttr.id, termName, undefined, strapiDocumentId);
            if (term && term.id) {
              if (term.id !== existingWooId) {
                strapi.log.info(`[woo-sync] Término recreado con nuevo ID (${existingWooId} → ${term.id}), se actualizará externalId`);
              } else {
                strapi.log.info(`[woo-sync] Término encontrado/recuperado en ${platform} (ID: ${term.id})`);
              }
            }
          }
        } else {
          // No tiene externalId, buscar/crear término usando documentId como slug (igual que crear)
          term = await this.getOrCreateAttributeTerm(wooConfig, coleccionAttr.id, termName, undefined, strapiDocumentId);
        }
        
        // Guardar externalId si se obtuvo/creó un término
        if (term && term.id && coleccionId) {
          await this.updateExternalIdsWithoutLifecycle('api::coleccion.coleccion', coleccionId, externalIds, platform, term.id);
        }
        
        strapi.log.info(`[woo-sync] Colección "${termName}" sincronizada a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando colección "${termName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Sincroniza una categoría de producto a todas las plataformas WooCommerce configuradas
   * Usa la misma lógica unificada que syncAutorTerm, syncEditorialTerm, etc.
   */
  async syncCategoryTerm(categoria: any) {
    if (!categoria || !categoria.name) {
      strapi.log.warn('[woo-sync] Intento de sincronizar categoría sin name');
      return;
    }

    const categoryName = categoria.name;
    const categoryDescription = categoria.descripcion || '';
    const categoriaId = categoria.id || categoria.documentId;
    const externalIds = categoria.externalIds || {};
    // Usar documentId como slug (igual que en atributos)
    const strapiDocumentId = categoria.documentId || categoria.id;

    // Obtener categoría completa con relaciones pobladas
    const categoriaCompleta = categoria.id
      ? await strapi.entityService.findOne('api::categoria-producto.categoria-producto' as any, categoria.id, {
          populate: ['categoria_padre', 'imagen'],
        }) as any
      : categoria;

    if (!categoriaCompleta) {
      strapi.log.warn('[woo-sync] No se pudo obtener categoría completa');
      return;
    }

    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) {
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que atributos)
        // Si no tenemos externalId, buscar/crear categoría (igual que crear)
        const existingWooId = externalIds[platform];
        let category: any = null;

        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como atributos)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: categoryName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que atributos)
            description: categoryDescription,
          };

          // Categoría padre
          if (categoriaCompleta.categoria_padre) {
            const parentExternalIds = categoriaCompleta.categoria_padre.externalIds || {};
            const parentWooId = parentExternalIds[platform];
            if (parentWooId) {
              updatePayload.parent = parentWooId;
            }
          }

          // Tipo de visualización
          if (categoriaCompleta.tipo_visualizacion) {
            updatePayload.display = categoriaCompleta.tipo_visualizacion;
          }

          // Imagen
          if (categoriaCompleta.imagen) {
            const imageUrl = this.getImageUrl(categoriaCompleta.imagen);
            if (imageUrl) {
              updatePayload.image = { src: imageUrl };
            }
          }

          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/categories/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (updateResponse.ok) {
            category = await updateResponse.json();
            strapi.log.info(`[woo-sync] Categoría "${categoryName}" actualizada en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla, puede ser 404 (no existe) o error de slug duplicado
            const errorText = await updateResponse.text();
            let errorJson: any = null;
            try {
              errorJson = JSON.parse(errorText);
            } catch {
              // No es JSON válido, usar texto
            }
            const is404 = updateResponse.status === 404;
            const isSlugError = errorJson && (errorJson.code === 'term_exists' || (errorJson.message && (errorJson.message.includes('slug') || errorJson.message.includes('already exists'))));
            
            if (is404) {
              strapi.log.warn(`[woo-sync] Categoría ${existingWooId} no existe en ${platform} (fue eliminada). Buscando/creando nueva categoría...`);
            } else if (isSlugError) {
              // Slug duplicado: buscar el registro correcto por slug
              strapi.log.warn(`[woo-sync] Slug duplicado al actualizar categoría ${existingWooId} en ${platform}. Buscando categoría correcta por slug...`);
              const categoryBySlug = await this.getOrCreateCategory(wooConfig, categoriaCompleta, platform);
              if (categoryBySlug && categoryBySlug.id) {
                category = categoryBySlug;
                if (category.id !== existingWooId) {
                  strapi.log.info(`[woo-sync] Categoría encontrada por slug con ID diferente (${existingWooId} → ${category.id}), se actualizará externalId`);
                }
              }
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando categoría en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando categoría...`);
              category = await this.getOrCreateCategory(wooConfig, categoriaCompleta, platform);
            }
          }
        } else {
          // No tiene externalId, buscar/crear categoría
          category = await this.getOrCreateCategory(wooConfig, categoriaCompleta, platform);
        }

        // Guardar externalId si se obtuvo/creó una categoría
        if (category && category.id && categoriaId) {
          await this.updateExternalIdsWithoutLifecycle('api::categoria-producto.categoria-producto', categoriaId, externalIds, platform, category.id);
        }

        strapi.log.info(`[woo-sync] Categoría "${categoryName}" sincronizada a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando categoría "${categoryName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Helper para buscar o crear una categoría en WooCommerce
   */
  async getOrCreateCategory(wooConfig: any, categoria: any, platform: 'woo_moraleja' | 'woo_escolar'): Promise<any> {
    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
    // Usar documentId como slug (igual que en atributos)
    const categorySlug = categoria.documentId || categoria.id;

    let category = null;

    // PASO 1: Buscar por slug específico primero (igual que atributos)
    if (categorySlug) {
      try {
        const slugResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/categories?slug=${encodeURIComponent(categorySlug)}`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (slugResponse.ok) {
          const slugCategoriesData: any = await slugResponse.json();
          const slugCategories: any[] = Array.isArray(slugCategoriesData)
            ? slugCategoriesData
            : (slugCategoriesData && Array.isArray(slugCategoriesData.data) ? slugCategoriesData.data : []);
          
          const categoryBySlug = slugCategories.find((c: any) => 
            c.slug.toLowerCase() === String(categorySlug).toLowerCase()
          );
          
          if (categoryBySlug) {
            category = categoryBySlug;
            // Si encontramos por slug, verificar si necesita actualización
            const needsUpdate = category.name !== categoria.name || 
              (categoria.descripcion && category.description !== categoria.descripcion);
            
            if (needsUpdate) {
              const updatePayload: any = {
                name: categoria.name,
                slug: categorySlug, // Mantener el slug
                description: categoria.descripcion || '',
              };

              if (categoria.categoria_padre) {
                const parentExternalIds = categoria.categoria_padre.externalIds || {};
                const parentWooId = parentExternalIds[platform];
                if (parentWooId) {
                  updatePayload.parent = parentWooId;
                }
              }

              if (categoria.tipo_visualizacion) {
                updatePayload.display = categoria.tipo_visualizacion;
              }

              if (categoria.imagen) {
                const imageUrl = this.getImageUrl(categoria.imagen);
                if (imageUrl) {
                  updatePayload.image = { src: imageUrl };
                }
              }

              const updateResponse = await fetch(
                `${wooConfig.url}/wp-json/wc/v3/products/categories/${category.id}`,
                {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(updatePayload),
                }
              );

              if (updateResponse.ok) {
                category = await updateResponse.json();
                strapi.log.info(`[woo-sync] Categoría actualizada por slug: "${categoria.name}" (ID: ${category.id})`);
              }
            }
          }
        }
      } catch (error) {
        strapi.log.warn(`[woo-sync] Error buscando categoría por slug: ${error}`);
      }
    }

    // PASO 2: Si no se encontró por slug, buscar por nombre
    if (!category) {
      const searchResponse = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(categoria.name)}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (searchResponse.ok) {
        const categoriesData: any = await searchResponse.json();
        const categories: any[] = Array.isArray(categoriesData)
          ? categoriesData
          : (categoriesData && Array.isArray(categoriesData.data) ? categoriesData.data : []);
        
        // Buscar por nombre
        category = categories.find((c: any) =>
          c.name.toLowerCase() === categoria.name.toLowerCase()
        );
      }
    }

    // Si no existe, crear
    if (!category) {
      const categoryPayload: any = {
        name: categoria.name,
        slug: categorySlug,
        description: categoria.descripcion || '',
      };

      // Categoría padre
      if (categoria.categoria_padre) {
        const parentExternalIds = categoria.categoria_padre.externalIds || {};
        const parentWooId = parentExternalIds[platform];
        if (parentWooId) {
          categoryPayload.parent = parentWooId;
        }
      }

      // Tipo de visualización
      if (categoria.tipo_visualizacion) {
        categoryPayload.display = categoria.tipo_visualizacion;
      }

      // Imagen
      if (categoria.imagen) {
        const imageUrl = this.getImageUrl(categoria.imagen);
        if (imageUrl) {
          categoryPayload.image = { src: imageUrl };
        }
      }

      const createResponse = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/products/categories`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(categoryPayload),
        }
      );

      if (createResponse.ok) {
        category = await createResponse.json();
        strapi.log.info(`[woo-sync] Categoría creada: "${categoria.name}" (ID: ${category.id})`);
      } else {
        const errorText = await createResponse.text();
        strapi.log.warn(`[woo-sync] Error creando categoría "${categoria.name}": ${errorText}`);
      }
    }

    return category;
  },

  /**
   * Sincroniza una etiqueta de producto a todas las plataformas WooCommerce configuradas
   * Usa la misma lógica unificada que syncCategoryTerm, pero sin imágenes
   */
  async syncTagTerm(etiqueta: any) {
    if (!etiqueta || !etiqueta.name) {
      strapi.log.warn('[woo-sync] Intento de sincronizar etiqueta sin name');
      return;
    }

    const tagName = etiqueta.name;
    const tagDescription = etiqueta.descripcion || '';
    const etiquetaId = etiqueta.id || etiqueta.documentId;
    const externalIds = etiqueta.externalIds || {};
    // Usar documentId como slug (igual que categorías y atributos)
    const strapiDocumentId = etiqueta.documentId || etiqueta.id;

    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];
    
    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) {
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que categorías/atributos)
        // Si no tenemos externalId, buscar/crear etiqueta (igual que crear)
        const existingWooId = externalIds[platform];
        let tag: any = null;

        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como categorías/atributos)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: tagName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que categorías/atributos)
            description: tagDescription,
          };

          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/tags/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (updateResponse.ok) {
            tag = await updateResponse.json();
            strapi.log.info(`[woo-sync] Etiqueta "${tagName}" actualizada en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla, puede ser 404 (no existe) o error de slug duplicado
            const errorText = await updateResponse.text();
            let errorJson: any = null;
            try {
              errorJson = JSON.parse(errorText);
            } catch {
              // No es JSON válido, usar texto
            }
            const is404 = updateResponse.status === 404;
            const isSlugError = errorJson && (errorJson.code === 'term_exists' || (errorJson.message && (errorJson.message.includes('slug') || errorJson.message.includes('already exists'))));
            
            if (is404) {
              strapi.log.warn(`[woo-sync] Etiqueta ${existingWooId} no existe en ${platform} (fue eliminada). Buscando/creando nueva etiqueta...`);
            } else if (isSlugError) {
              // Slug duplicado: buscar el registro correcto por slug
              strapi.log.warn(`[woo-sync] Slug duplicado al actualizar etiqueta ${existingWooId} en ${platform}. Buscando etiqueta correcta por slug...`);
              const tagBySlug = await this.getOrCreateTag(wooConfig, etiqueta, platform);
              if (tagBySlug && tagBySlug.id) {
                tag = tagBySlug;
                if (tag.id !== existingWooId) {
                  strapi.log.info(`[woo-sync] Etiqueta encontrada por slug con ID diferente (${existingWooId} → ${tag.id}), se actualizará externalId`);
                }
              }
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando etiqueta en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando etiqueta...`);
              tag = await this.getOrCreateTag(wooConfig, etiqueta, platform);
            }
          }
        } else {
          // No tiene externalId, buscar/crear etiqueta
          tag = await this.getOrCreateTag(wooConfig, etiqueta, platform);
        }

        // Guardar externalId si se obtuvo/creó una etiqueta
        if (tag && tag.id && etiquetaId) {
          await this.updateExternalIdsWithoutLifecycle('api::etiqueta.etiqueta', etiquetaId, externalIds, platform, tag.id);
        }

        strapi.log.info(`[woo-sync] Etiqueta "${tagName}" sincronizada a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando etiqueta "${tagName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Helper para buscar o crear una etiqueta en WooCommerce
   */
  async getOrCreateTag(wooConfig: any, etiqueta: any, platform: 'woo_moraleja' | 'woo_escolar'): Promise<any> {
    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
    // Usar documentId como slug (igual que categorías/atributos)
    const tagSlug = etiqueta.documentId || etiqueta.id;

    let tag = null;

    // PASO 1: Buscar por slug específico primero (igual que atributos y categorías)
    if (tagSlug) {
      try {
        const slugResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/tags?slug=${encodeURIComponent(tagSlug)}`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (slugResponse.ok) {
          const slugTagsData: any = await slugResponse.json();
          const slugTags: any[] = Array.isArray(slugTagsData)
            ? slugTagsData
            : (slugTagsData && Array.isArray(slugTagsData.data) ? slugTagsData.data : []);
          
          const tagBySlug = slugTags.find((t: any) => 
            t.slug.toLowerCase() === String(tagSlug).toLowerCase()
          );
          
          if (tagBySlug) {
            tag = tagBySlug;
            // Si encontramos por slug, verificar si necesita actualización
            const needsUpdate = tag.name !== etiqueta.name || 
              (etiqueta.descripcion && tag.description !== etiqueta.descripcion);
            
            if (needsUpdate) {
              const updatePayload: any = {
                name: etiqueta.name,
                slug: tagSlug, // Mantener el slug
                description: etiqueta.descripcion || '',
              };

              const updateResponse = await fetch(
                `${wooConfig.url}/wp-json/wc/v3/products/tags/${tag.id}`,
                {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(updatePayload),
                }
              );

              if (updateResponse.ok) {
                tag = await updateResponse.json();
                strapi.log.info(`[woo-sync] Etiqueta actualizada por slug: "${etiqueta.name}" (ID: ${tag.id})`);
              }
            }
          }
        }
      } catch (error) {
        strapi.log.warn(`[woo-sync] Error buscando etiqueta por slug: ${error}`);
      }
    }

    // PASO 2: Si no se encontró por slug, buscar por nombre
    if (!tag) {
      const searchResponse = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/products/tags?search=${encodeURIComponent(etiqueta.name)}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (searchResponse.ok) {
        const tagsData: any = await searchResponse.json();
        const tags: any[] = Array.isArray(tagsData)
          ? tagsData
          : (tagsData && Array.isArray(tagsData.data) ? tagsData.data : []);
        
        // Buscar por nombre
        tag = tags.find((t: any) =>
          t.name.toLowerCase() === etiqueta.name.toLowerCase()
        );
      }
    }

    // Si no existe, crear
    if (!tag) {
      const tagPayload: any = {
        name: etiqueta.name,
        slug: tagSlug,
        description: etiqueta.descripcion || '',
      };

      const createResponse = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/products/tags`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tagPayload),
        }
      );

      if (createResponse.ok) {
        tag = await createResponse.json();
        strapi.log.info(`[woo-sync] Etiqueta creada: "${etiqueta.name}" (ID: ${tag.id})`);
      } else {
        const errorText = await createResponse.text();
        strapi.log.warn(`[woo-sync] Error creando etiqueta "${etiqueta.name}": ${errorText}`);
      }
    }

    return tag;
  },

  /**
   * Sincroniza una marca (brand) de producto a todas las plataformas WooCommerce configuradas
   * Usa atributos de producto (como Autor, Editorial, etc.) ya que WooCommerce no tiene brands nativos
   */
  async syncBrandTerm(marca: any) {
    if (!marca || !marca.name) {
      strapi.log.warn('[woo-sync] Intento de sincronizar marca sin name');
      return;
    }

    const termName = marca.name;
    const termDescription = marca.descripcion || null;
    const marcaId = marca.id || marca.documentId;
    const externalIds = marca.externalIds || {};
    const strapiDocumentId = marca.documentId || marca.id;

    const platforms: Array<'woo_moraleja' | 'woo_escolar'> = ['woo_moraleja', 'woo_escolar'];

    for (const platform of platforms) {
      try {
        const wooConfig = this.getWooConfig(platform);
        if (!wooConfig) {
          continue; // Plataforma no configurada, saltar
        }

        // Obtener o crear atributo "Marca"
        const marcaAttr = await this.getOrCreateAttribute(wooConfig, 'Marca', 'marca');
        if (!marcaAttr || !marcaAttr.id) {
          strapi.log.warn(`[woo-sync] No se pudo obtener atributo "Marca" para ${platform}`);
          continue;
        }

        // Si ya tenemos externalId, actualizar directamente usando ese ID (igual que autor)
        // Si no tenemos externalId, usar getOrCreateAttributeTerm (igual que crear)
        const existingWooId = externalIds[platform];
        let term: any = null;

        if (existingWooId) {
          // Actualizar directamente usando el ID guardado (simple y directo, como autor)
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const updatePayload: any = {
            name: termName,
            slug: strapiDocumentId, // Usar documentId como slug (igual que crear)
          };
          if (termDescription) updatePayload.description = termDescription;

          const updateResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${marcaAttr.id}/terms/${existingWooId}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(updatePayload),
            }
          );

          if (updateResponse.ok) {
            term = await updateResponse.json();
            strapi.log.info(`[woo-sync] Marca "${termName}" actualizada en ${platform} (ID: ${existingWooId})`);
          } else {
            // Si falla (404 = término no existe, fue eliminado), usar getOrCreateAttributeTerm como fallback
            const errorText = await updateResponse.text();
            const is404 = updateResponse.status === 404;
            if (is404) {
              strapi.log.warn(`[woo-sync] Término ${existingWooId} no existe en ${platform} (fue eliminado). Buscando/creando nuevo término...`);
            } else {
              strapi.log.warn(`[woo-sync] Error actualizando marca en ${platform} (ID: ${existingWooId}): ${errorText}. Buscando/creando término...`);
            }
            term = await this.getOrCreateAttributeTerm(wooConfig, marcaAttr.id, termName, termDescription, strapiDocumentId);
            if (term && term.id) {
              if (term.id !== existingWooId) {
                strapi.log.info(`[woo-sync] Término recreado con nuevo ID (${existingWooId} → ${term.id}), se actualizará externalId`);
              } else {
                strapi.log.info(`[woo-sync] Término encontrado/recuperado en ${platform} (ID: ${term.id})`);
              }
            }
          }
        } else {
          // No tiene externalId, buscar/crear término usando documentId como slug (igual que crear)
          term = await this.getOrCreateAttributeTerm(wooConfig, marcaAttr.id, termName, termDescription, strapiDocumentId);
        }

        // Guardar externalId si se obtuvo/creó un término
        if (term && term.id && marcaId) {
          await this.updateExternalIdsWithoutLifecycle('api::marca.marca', marcaId, externalIds, platform, term.id);
        }

        strapi.log.info(`[woo-sync] Marca "${termName}" sincronizada a ${platform}`);
      } catch (error) {
        strapi.log.error(`[woo-sync] Error sincronizando marca "${termName}" a ${platform}:`, error);
      }
    }
  },

  /**
   * Sincroniza atributos del libro a WooCommerce
   */
  async syncAttributesForProduct(product: any, libro: any, platform: 'woo_moraleja' | 'woo_escolar', metaData: Array<{ key: string; value: string }>) {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      return;
    }

    // Obtener libro con relaciones pobladas
        const libroCompleto = libro.id
          ? await strapi.entityService.findOne('api::libro.libro', libro.id, {
              populate: ['autor_relacion', 'editorial', 'sello', 'coleccion', 'obra'],
            }) as any
          : libro;

    // Logging para diagnóstico
    strapi.log.info(`[woo-sync] Sincronizando atributos para libro ${libroCompleto?.id || libro?.id}`);
    strapi.log.info(`[woo-sync] Relaciones disponibles: autor=${!!libroCompleto?.autor_relacion}, editorial=${!!libroCompleto?.editorial}, sello=${!!libroCompleto?.sello}, coleccion=${!!libroCompleto?.coleccion}, obra=${!!libroCompleto?.obra}`);
    strapi.log.info(`[woo-sync] Enumerationes: idioma=${libroCompleto?.idioma || 'no'}, tipo_libro=${libroCompleto?.tipo_libro || 'no'}, estado_edicion=${libroCompleto?.estado_edicion || 'no'}`);

    // Autor
    if (libroCompleto?.autor_relacion) {
      strapi.log.info(`[woo-sync] Procesando Autor: ${JSON.stringify(libroCompleto.autor_relacion)}`);
      const autorAttr = await this.getOrCreateAttribute(wooConfig, 'Autor', 'autor');
      const autorAttrs = libroCompleto.autor_relacion.attributes || libroCompleto.autor_relacion;
      const autorName = autorAttrs.nombre_completo_autor || autorAttrs.nombre;
      const autorExternalIds = autorAttrs.externalIds || {};
      const autorWooId = autorExternalIds[platform];
      
      // Extraer descripción de resegna (blocks) - convertir a texto plano
      let autorDescripcion = null;
      if (autorAttrs.resegna && Array.isArray(autorAttrs.resegna)) {
        autorDescripcion = autorAttrs.resegna
          .map((block: any) => {
            if (block.children) {
              return block.children.map((child: any) => child.text || '').join('');
            }
            return '';
          })
          .filter((text: string) => text.trim())
          .join('\n');
      }
      
      if (autorName && autorAttr && autorAttr.id) {
        let termId: number | null = null;
        
        // Si tiene externalId, verificar que existe y usarlo
        if (autorWooId) {
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const checkResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${autorAttr.id}/terms/${autorWooId}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (checkResponse.ok) {
            termId = autorWooId;
            strapi.log.info(`[woo-sync] ✅ Usando término Autor existente: "${autorName}" (ID: ${autorWooId})`);
          } else {
            strapi.log.warn(`[woo-sync] Término Autor ${autorWooId} no existe, buscando/creando nuevo`);
            const term = await this.getOrCreateAttributeTerm(wooConfig, autorAttr.id, autorName, autorDescripcion || undefined);
            termId = term?.id || null;
          }
        } else {
          // No tiene externalId, buscar/crear
          const term = await this.getOrCreateAttributeTerm(wooConfig, autorAttr.id, autorName, autorDescripcion || undefined);
          termId = term?.id || null;
        }
        
        if (termId) {
          product.attributes.push({
            id: autorAttr.id,
            name: 'Autor',
            options: [autorName],
            visible: true,
            variation: false,
          });
        }
      }
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Autor: No hay relación de autor`);
    }

    // Editorial
    if (libroCompleto?.editorial) {
      strapi.log.info(`[woo-sync] Procesando Editorial: ${JSON.stringify(libroCompleto.editorial)}`);
      const editorialAttr = await this.getOrCreateAttribute(wooConfig, 'Editorial', 'editorial');
      const editorialAttrs = libroCompleto.editorial.attributes || libroCompleto.editorial;
      const editorialName = editorialAttrs.nombre_editorial || editorialAttrs.nombre;
      const editorialExternalIds = editorialAttrs.externalIds || {};
      const editorialWooId = editorialExternalIds[platform];
      
      if (editorialName && editorialAttr && editorialAttr.id) {
        let termId: number | null = null;
        
        // Si tiene externalId, verificar que existe y usarlo
        if (editorialWooId) {
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const checkResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${editorialAttr.id}/terms/${editorialWooId}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (checkResponse.ok) {
            termId = editorialWooId;
            strapi.log.info(`[woo-sync] ✅ Usando término Editorial existente: "${editorialName}" (ID: ${editorialWooId})`);
          } else {
            strapi.log.warn(`[woo-sync] Término Editorial ${editorialWooId} no existe, buscando/creando nuevo`);
            const term = await this.getOrCreateAttributeTerm(wooConfig, editorialAttr.id, editorialName);
            termId = term?.id || null;
          }
        } else {
          // No tiene externalId, buscar/crear
          const term = await this.getOrCreateAttributeTerm(wooConfig, editorialAttr.id, editorialName);
          termId = term?.id || null;
        }
        
        if (termId) {
          product.attributes.push({
            id: editorialAttr.id,
            name: 'Editorial',
            options: [editorialName],
            visible: true,
            variation: false,
          });
        }
      }
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Editorial: No hay relación de editorial`);
    }

    // Sello
    if (libroCompleto?.sello) {
      strapi.log.info(`[woo-sync] Procesando Sello: ${JSON.stringify(libroCompleto.sello)}`);
      const selloAttr = await this.getOrCreateAttribute(wooConfig, 'Sello', 'sello');
      const selloAttrs = libroCompleto.sello.attributes || libroCompleto.sello;
      const selloName = selloAttrs.nombre_sello || selloAttrs.nombre;
      const selloExternalIds = selloAttrs.externalIds || {};
      const selloWooId = selloExternalIds[platform];
      
      if (selloName && selloAttr && selloAttr.id) {
        let termId: number | null = null;
        
        // Si tiene externalId, verificar que existe y usarlo
        if (selloWooId) {
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const checkResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${selloAttr.id}/terms/${selloWooId}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (checkResponse.ok) {
            termId = selloWooId;
            strapi.log.info(`[woo-sync] ✅ Usando término Sello existente: "${selloName}" (ID: ${selloWooId})`);
          } else {
            strapi.log.warn(`[woo-sync] Término Sello ${selloWooId} no existe, buscando/creando nuevo`);
            const term = await this.getOrCreateAttributeTerm(wooConfig, selloAttr.id, selloName);
            termId = term?.id || null;
          }
        } else {
          // No tiene externalId, buscar/crear
          const term = await this.getOrCreateAttributeTerm(wooConfig, selloAttr.id, selloName);
          termId = term?.id || null;
        }
        
        if (termId) {
          product.attributes.push({
            id: selloAttr.id,
            name: 'Sello',
            options: [selloName],
            visible: true,
            variation: false,
          });
        }
      }
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Sello: No hay relación de sello`);
    }

    // Colección
    if (libroCompleto?.coleccion) {
      strapi.log.info(`[woo-sync] Procesando Colección: ${JSON.stringify(libroCompleto.coleccion)}`);
      const coleccionAttr = await this.getOrCreateAttribute(wooConfig, 'Colección', 'coleccion');
      const coleccionAttrs = libroCompleto.coleccion.attributes || libroCompleto.coleccion;
      const coleccionName = coleccionAttrs.nombre_coleccion || coleccionAttrs.nombre;
      const coleccionExternalIds = coleccionAttrs.externalIds || {};
      const coleccionWooId = coleccionExternalIds[platform];
      
      if (coleccionName && coleccionAttr && coleccionAttr.id) {
        let termId: number | null = null;
        
        // Si tiene externalId, verificar que existe y usarlo
        if (coleccionWooId) {
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const checkResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${coleccionAttr.id}/terms/${coleccionWooId}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (checkResponse.ok) {
            termId = coleccionWooId;
            strapi.log.info(`[woo-sync] ✅ Usando término Colección existente: "${coleccionName}" (ID: ${coleccionWooId})`);
          } else {
            strapi.log.warn(`[woo-sync] Término Colección ${coleccionWooId} no existe, buscando/creando nuevo`);
            const term = await this.getOrCreateAttributeTerm(wooConfig, coleccionAttr.id, coleccionName);
            termId = term?.id || null;
          }
        } else {
          // No tiene externalId, buscar/crear
          const term = await this.getOrCreateAttributeTerm(wooConfig, coleccionAttr.id, coleccionName);
          termId = term?.id || null;
        }
        
        if (termId) {
          product.attributes.push({
            id: coleccionAttr.id,
            name: 'Colección',
            options: [coleccionName],
            visible: true,
            variation: false,
          });
        }
      }
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Colección: No hay relación de colección`);
    }

    // Obra
    if (libroCompleto?.obra) {
      strapi.log.info(`[woo-sync] Procesando Obra: ${JSON.stringify(libroCompleto.obra)}`);
      const obraAttr = await this.getOrCreateAttribute(wooConfig, 'Obra', 'obra');
      const obraAttrs = libroCompleto.obra.attributes || libroCompleto.obra;
      const obraName = obraAttrs.nombre_obra || obraAttrs.nombre;
      const obraDescripcion = obraAttrs.descripcion || null;
      const obraExternalIds = obraAttrs.externalIds || {};
      const obraWooId = obraExternalIds[platform];
      
      if (obraName && obraAttr && obraAttr.id) {
        let termId: number | null = null;
        
        // Si tiene externalId, verificar que existe y usarlo
        if (obraWooId) {
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const checkResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${obraAttr.id}/terms/${obraWooId}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (checkResponse.ok) {
            termId = obraWooId;
            strapi.log.info(`[woo-sync] ✅ Usando término Obra existente: "${obraName}" (ID: ${obraWooId})`);
          } else {
            strapi.log.warn(`[woo-sync] Término Obra ${obraWooId} no existe, buscando/creando nuevo`);
            const term = await this.getOrCreateAttributeTerm(wooConfig, obraAttr.id, obraName, obraDescripcion);
            termId = term?.id || null;
          }
        } else {
          // No tiene externalId, buscar/crear
          const term = await this.getOrCreateAttributeTerm(wooConfig, obraAttr.id, obraName, obraDescripcion);
          termId = term?.id || null;
        }
        
        if (termId) {
          product.attributes.push({
            id: obraAttr.id,
            name: 'Obra',
            options: [obraName],
            visible: true,
            variation: false,
          });
        }
      }
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Obra: No hay relación de obra`);
    }

    // Idioma (enumeration)
    if (libroCompleto?.idioma) {
      strapi.log.info(`[woo-sync] Procesando Idioma: "${libroCompleto.idioma}"`);
      const idiomaAttr = await this.getOrCreateAttribute(wooConfig, 'Idioma', 'idioma');
      if (idiomaAttr && idiomaAttr.id) {
        await this.getOrCreateAttributeTerm(wooConfig, idiomaAttr.id, libroCompleto.idioma);
        product.attributes.push({
          id: idiomaAttr.id,
          name: 'Idioma',
          options: [libroCompleto.idioma],
          visible: true,
          variation: false,
        });
      }
      metaData.push({ key: 'idioma', value: String(libroCompleto.idioma) });
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Idioma: No hay valor`);
    }

    // Tipo Libro (enumeration)
    if (libroCompleto?.tipo_libro) {
      strapi.log.info(`[woo-sync] Procesando Tipo Libro: "${libroCompleto.tipo_libro}"`);
      const tipoLibroAttr = await this.getOrCreateAttribute(wooConfig, 'Tipo Libro', 'tipo-libro');
      if (tipoLibroAttr && tipoLibroAttr.id) {
        await this.getOrCreateAttributeTerm(wooConfig, tipoLibroAttr.id, libroCompleto.tipo_libro);
        product.attributes.push({
          id: tipoLibroAttr.id,
          name: 'Tipo Libro',
          options: [libroCompleto.tipo_libro],
          visible: true,
          variation: false,
        });
      }
      metaData.push({ key: 'tipo_libro', value: String(libroCompleto.tipo_libro) });
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Tipo Libro: No hay valor`);
    }

    // Estado Edición (enumeration)
    if (libroCompleto?.estado_edicion) {
      strapi.log.info(`[woo-sync] Procesando Estado Edición: "${libroCompleto.estado_edicion}"`);
      const estadoAttr = await this.getOrCreateAttribute(wooConfig, 'Estado Edición', 'estado-edicion');
      if (estadoAttr && estadoAttr.id) {
        await this.getOrCreateAttributeTerm(wooConfig, estadoAttr.id, libroCompleto.estado_edicion);
        product.attributes.push({
          id: estadoAttr.id,
          name: 'Estado Edición',
          options: [libroCompleto.estado_edicion],
          visible: true,
          variation: false,
        });
      }
      metaData.push({ key: 'estado_edicion', value: String(libroCompleto.estado_edicion) });
    } else {
      strapi.log.info(`[woo-sync] ⏭️  Estado Edición: No hay valor`);
    }

    strapi.log.info(`[woo-sync] ✅ Atributos sincronizados: ${product.attributes.length} atributo(s) agregado(s) al producto`);

    // Actualizar meta_data con campos adicionales
    if (libroCompleto?.numero_edicion) {
      metaData.push({ key: 'numero_edicion', value: String(libroCompleto.numero_edicion) });
    }
    if (libroCompleto?.agno_edicion) {
      metaData.push({ key: 'agno_edicion', value: String(libroCompleto.agno_edicion) });
    }
    
    // Agregar metadata para relaciones anidadas
    if (libroCompleto?.sello?.editorial) {
      metaData.push({
        key: '_sello_editorial_id',
        value: libroCompleto.sello.editorial.id.toString()
      });
      metaData.push({
        key: '_sello_editorial_nombre',
        value: libroCompleto.sello.editorial.nombre_editorial
      });
    }

    if (libroCompleto?.coleccion?.editorial) {
      metaData.push({
        key: '_coleccion_editorial_id',
        value: libroCompleto.coleccion.editorial.id.toString()
      });
      metaData.push({
        key: '_coleccion_editorial_nombre',
        value: libroCompleto.coleccion.editorial.nombre_editorial
      });
    }

    // Actualizar meta_data del producto
    product.meta_data = metaData;
  },

  /**
   * Sincroniza canales de Strapi a categorías de WooCommerce
   */
  async syncCanalesToWooCommerce(
    libro: any, 
    product: any, 
    platform: 'woo_moraleja' | 'woo_escolar'
  ) {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) return;
    
    // Obtener libro con canales poblados
    const libroCompleto = libro.id
      ? await strapi.entityService.findOne('api::libro.libro', libro.id, {
          populate: ['canales'],
        }) as any
      : libro;
    
    if (!libroCompleto?.canales || libroCompleto.canales.length === 0) {
      product.categories = [];
      return;
    }
    
    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
    const categories = [];
    
    for (const canal of libroCompleto.canales) {
      const categoryName = canal.nombre || canal.key;
      if (!categoryName) continue;
      
      try {
        // Buscar categoría existente
        const searchResponse = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(categoryName)}`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        let category = null;
        if (searchResponse.ok) {
          const categoriesData: any = await searchResponse.json();
          const categories: any[] = Array.isArray(categoriesData) 
            ? categoriesData 
            : (categoriesData && Array.isArray(categoriesData.data) 
              ? categoriesData.data 
              : []);
          category = categories.find((c: any) => 
            c.name.toLowerCase() === categoryName.toLowerCase()
          );
        }
        
        // Crear si no existe
        if (!category) {
          const createResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/categories`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: categoryName,
                description: '',
              }),
            }
          );
          
          if (createResponse.ok) {
            category = await createResponse.json();
            strapi.log.info(`[woo-sync] Categoría creada: "${categoryName}" (ID: ${category.id})`);
          }
        }
        
        if (category) {
          categories.push({ id: category.id });
        }
      } catch (error) {
        strapi.log.warn(`[woo-sync] Error sincronizando canal "${categoryName}":`, error);
      }
    }
    
    product.categories = categories;
    if (categories.length > 0) {
      strapi.log.info(`[woo-sync] ${categories.length} categoría(s) asignada(s) al producto`);
    }
  },

  /**
   * Sincroniza precios por canal
   */
  async syncPreciosToWooCommerce(
    libro: any, 
    product: any, 
    platform: 'woo_moraleja' | 'woo_escolar'
  ) {
    // Usar campos directos de precio (precio, precio_regular, precio_oferta)
    const libroAttrs = libro.attributes || libro;
    
    // Precio regular
    if (libroAttrs.precio_regular !== undefined && libroAttrs.precio_regular !== null) {
      product.regular_price = String(libroAttrs.precio_regular);
    } else if (libroAttrs.precio !== undefined && libroAttrs.precio !== null) {
      product.regular_price = String(libroAttrs.precio);
    } else {
      product.regular_price = '0';
    }
    
    // Precio de oferta
    if (libroAttrs.precio_oferta !== undefined && libroAttrs.precio_oferta !== null) {
      product.sale_price = String(libroAttrs.precio_oferta);
    } else {
      product.sale_price = ''; // Limpiar precio de oferta si no existe
    }
  },

  /**
   * Sincroniza stocks por ubicación
   */
  async syncStocksToWooCommerce(
    libro: any, 
    product: any, 
    platform: 'woo_moraleja' | 'woo_escolar'
  ) {
    // Usar campos directos de stock (stock_quantity, manage_stock, stock_status)
    const libroAttrs = libro.attributes || libro;
    
    // Gestión de stock
    if (libroAttrs.manage_stock !== undefined) {
      product.manage_stock = libroAttrs.manage_stock;
    } else {
      // Si no está definido, gestionar stock si hay cantidad
      product.manage_stock = libroAttrs.stock_quantity !== undefined && libroAttrs.stock_quantity !== null;
    }
    
    // Cantidad de stock
    if (libroAttrs.stock_quantity !== undefined && libroAttrs.stock_quantity !== null) {
      product.stock_quantity = libroAttrs.stock_quantity;
    } else {
      product.stock_quantity = null;
    }
    
    // Estado del stock
    if (libroAttrs.stock_status) {
      product.stock_status = libroAttrs.stock_status;
    } else if (libroAttrs.stock_quantity !== undefined) {
      // Auto-determinar estado si no está definido
      if (libroAttrs.stock_quantity > 0) {
        product.stock_status = 'instock';
        product.backorders = 'no';
      } else {
        product.stock_status = 'outofstock';
        product.backorders = 'no';
      }
    } else {
      // Sin información de stock
      product.stock_status = 'outofstock';
      product.backorders = 'no';
      product.stock_status = 'outofstock'; // Asegurar stock_status
      product.backorders = 'no';
    }
  },

  /**
   * Sincroniza libros relacionados a related_ids de WooCommerce
   */
  async syncLibrosRelacionadosToWooCommerce(
    libro: any, 
    product: any, 
    platform: 'woo_moraleja' | 'woo_escolar'
  ) {
    // Obtener libro con relaciones pobladas
    const libroCompleto = libro.id
      ? await strapi.entityService.findOne('api::libro.libro', libro.id, {
          populate: ['libros_relacionados', 'libros_relacionados.canales'],
        }) as any
      : libro;
    
    if (!libroCompleto?.libros_relacionados || libroCompleto.libros_relacionados.length === 0) {
      product.related_ids = [];
      return;
    }
    
    const relatedIds = [];
    
    for (const libroRelacionado of libroCompleto.libros_relacionados) {
      // Obtener externalId del libro relacionado
      const externalIds = libroRelacionado.externalIds || {};
      const wooId = externalIds[platform];
      
      if (wooId) {
        relatedIds.push(Number(wooId));
      } else {
        // Si el libro relacionado no está en WooCommerce, intentar sincronizarlo
        strapi.log.info(`[woo-sync] Libro relacionado ${libroRelacionado.id} no está en ${platform}, sincronizando...`);
        
        try {
          // Verificar si el libro tiene canales de WooCommerce
          const libroRelCompleto = await strapi.entityService.findOne('api::libro.libro', libroRelacionado.id, {
            populate: ['canales']
          }) as any;
          
          const hasWooChannel = libroRelCompleto?.canales?.some((c: any) => 
            c.key === 'woo_moraleja' || c.key === 'woo_escolar' ||
            c.slug === 'woo_moraleja' || c.slug === 'woo_escolar'
          );
          
          if (hasWooChannel) {
            const wooProduct = await this.syncProduct(libroRelCompleto, platform);
            if (wooProduct?.id) {
              relatedIds.push(Number(wooProduct.id));
            }
          }
        } catch (error) {
          strapi.log.warn(`[woo-sync] Error sincronizando libro relacionado ${libroRelacionado.id}:`, error);
        }
      }
    }
    
    product.related_ids = relatedIds;
    if (relatedIds.length > 0) {
      strapi.log.info(`[woo-sync] ${relatedIds.length} libro(s) relacionado(s) asignado(s)`);
    }
  },

  /**
   * Sincroniza marcas (Brands) del libro a WooCommerce como Product Attribute
   * Usa el sistema nativo de atributos (sin plugins requeridos)
   */
  async syncMarcasToWooCommerce(
    libro: any, 
    product: any, 
    platform: 'woo_moraleja' | 'woo_escolar'
  ) {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) return;
    
    // Obtener libro con marcas pobladas
    const libroCompleto = libro.id
      ? await strapi.entityService.findOne('api::libro.libro', libro.id, {
          populate: ['marcas'] as any,
        }) as any
      : libro;
    
    if (!libroCompleto?.marcas || libroCompleto.marcas.length === 0) {
      return; // No hay marcas, no hacer nada
    }
    
    // Obtener o crear atributo "Marca"
    const marcaAttr = await this.getOrCreateAttribute(wooConfig, 'Marca', 'marca');
    if (!marcaAttr || !marcaAttr.id) {
      strapi.log.warn(`[woo-sync] No se pudo obtener/crear atributo "Marca" para ${platform}`);
      return;
    }
    
    const marcaNames: string[] = [];
    
    for (const marca of libroCompleto.marcas) {
      try {
        const marcaName = marca.name;
        if (!marcaName) continue;
        
        // Sincronizar término del atributo
        await this.getOrCreateAttributeTerm(
          wooConfig, 
          marcaAttr.id, 
          marcaName, 
          marca.descripcion || undefined
        );
        
        // Guardar externalId en Strapi (usando el ID del término del atributo)
        const externalIds = marca.externalIds || {};
        if (!externalIds[platform]) {
          // Buscar el término para obtener su ID
          const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
          const termsResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/attributes/${marcaAttr.id}/terms?search=${encodeURIComponent(marcaName)}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (termsResponse.ok) {
            const termsData: any = await termsResponse.json();
            const terms: any[] = Array.isArray(termsData) 
              ? termsData 
              : (termsData && Array.isArray(termsData.data) ? termsData.data : []);
            const term = terms.find((t: any) => t.name.toLowerCase() === marcaName.toLowerCase());
            
            if (term) {
              const updatedExternalIds = { ...externalIds, [platform]: term.id };
              await strapi.entityService.update('api::marca.marca' as any, marca.id, {
                data: { externalIds: updatedExternalIds },
              });
            }
          }
        }
        
        marcaNames.push(marcaName);
      } catch (error) {
        strapi.log.warn(`[woo-sync] Error sincronizando marca "${marca.name}":`, error);
      }
    }
    
    // Agregar marcas como atributo del producto
    if (marcaNames.length > 0) {
      product.attributes.push({
        id: marcaAttr.id,
        name: 'Marca',
        options: marcaNames,
        visible: true,
        variation: false,
      });
      strapi.log.info(`[woo-sync] ${marcaNames.length} marca(s) asignada(s) al producto como atributo`);
    }
  },

  /**
   * Sincroniza etiquetas (Tags) del libro a WooCommerce
   */
  async syncEtiquetasToWooCommerce(
    libro: any, 
    product: any, 
    platform: 'woo_moraleja' | 'woo_escolar'
  ) {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) return;
    
    // Obtener libro con etiquetas pobladas
    const libroCompleto = libro.id
      ? await strapi.entityService.findOne('api::libro.libro', libro.id, {
          populate: ['etiquetas'] as any,
        }) as any
      : libro;
    
    if (!libroCompleto?.etiquetas || libroCompleto.etiquetas.length === 0) {
      product.tags = [];
      return;
    }
    
    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
    const tagIds = [];
    
    for (const etiqueta of libroCompleto.etiquetas) {
      try {
        // Sincronizar la etiqueta primero si no tiene externalId
        const externalIds = etiqueta.externalIds || {};
        let wooTagId = externalIds[platform];
        
        if (!wooTagId) {
          // Buscar etiqueta existente por slug o nombre
          const searchResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/tags?search=${encodeURIComponent(etiqueta.name)}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          let tag = null;
          if (searchResponse.ok) {
            const tagsData: any = await searchResponse.json();
            const tags: any[] = Array.isArray(tagsData) 
              ? tagsData 
              : (tagsData && Array.isArray(tagsData.data) 
                ? tagsData.data 
                : []);
            tag = tags.find((t: any) => 
              t.name.toLowerCase() === etiqueta.name.toLowerCase() ||
              t.slug.toLowerCase() === etiqueta.slug.toLowerCase()
            );
          }
          
          // Crear si no existe
          if (!tag) {
            const tagPayload = {
              name: etiqueta.name,
              slug: etiqueta.slug,
              description: etiqueta.descripcion || '',
            };
            
            const createResponse = await fetch(
              `${wooConfig.url}/wp-json/wc/v3/products/tags`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(tagPayload),
              }
            );
            
            if (createResponse.ok) {
              tag = await createResponse.json();
              strapi.log.info(`[woo-sync] Etiqueta creada: "${etiqueta.name}" (ID: ${tag.id})`);
              
              // Guardar externalId en Strapi
              const updatedExternalIds = { ...externalIds, [platform]: tag.id };
              await strapi.entityService.update('api::etiqueta.etiqueta' as any, etiqueta.id, {
                data: { externalIds: updatedExternalIds },
              });
            } else {
              const errorText = await createResponse.text();
              strapi.log.warn(`[woo-sync] Error creando etiqueta "${etiqueta.name}": ${errorText}`);
              continue;
            }
          } else {
            wooTagId = tag.id;
            // Guardar externalId en Strapi
            const updatedExternalIds = { ...externalIds, [platform]: tag.id };
            await strapi.entityService.update('api::etiqueta.etiqueta' as any, etiqueta.id, {
              data: { externalIds: updatedExternalIds },
            });
          }
        }
        
        if (wooTagId) {
          tagIds.push({ id: Number(wooTagId) });
        }
      } catch (error) {
        strapi.log.warn(`[woo-sync] Error sincronizando etiqueta "${etiqueta.name}":`, error);
      }
    }
    
    product.tags = tagIds;
    if (tagIds.length > 0) {
      strapi.log.info(`[woo-sync] ${tagIds.length} etiqueta(s) asignada(s) al producto`);
    }
  },

  /**
   * Sincroniza categorías del libro a WooCommerce
   */
  async syncCategoriasToWooCommerce(
    libro: any, 
    product: any, 
    platform: 'woo_moraleja' | 'woo_escolar'
  ) {
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) return;
    
    // Obtener libro con categorías pobladas
    const libroCompleto = libro.id
      ? await strapi.entityService.findOne('api::libro.libro', libro.id, {
          populate: ['categorias_producto', 'categorias_producto.categoria_padre'] as any,
        }) as any
      : libro;
    
    if (!libroCompleto?.categorias_producto || libroCompleto.categorias_producto.length === 0) {
      // No sobrescribir categories si ya existen (de canales)
      if (!product.categories) {
        product.categories = [];
      }
      return;
    }
    
    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
    const categoryIds = [];
    
    // Mantener categorías existentes (de canales) si las hay
    if (product.categories && Array.isArray(product.categories)) {
      categoryIds.push(...product.categories.map((c: any) => typeof c === 'number' ? c : c.id));
    }
    
    for (const categoria of libroCompleto.categorias_producto) {
      try {
        // Sincronizar la categoría primero si no tiene externalId
        const externalIds = categoria.externalIds || {};
        let wooCategoryId = externalIds[platform];
        
        if (!wooCategoryId) {
          // Buscar categoría existente por slug o nombre
          const searchResponse = await fetch(
            `${wooConfig.url}/wp-json/wc/v3/products/categories?search=${encodeURIComponent(categoria.name)}`,
            {
              headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          let category = null;
          if (searchResponse.ok) {
            const categoriesData: any = await searchResponse.json();
            const categories: any[] = Array.isArray(categoriesData) 
              ? categoriesData 
              : (categoriesData && Array.isArray(categoriesData.data) 
                ? categoriesData.data 
                : []);
            category = categories.find((c: any) => 
              c.name.toLowerCase() === categoria.name.toLowerCase() ||
              c.slug.toLowerCase() === categoria.slug.toLowerCase()
            );
          }
          
          // Crear si no existe
          if (!category) {
            const categoryPayload: any = {
              name: categoria.name,
              slug: categoria.slug,
              description: categoria.descripcion || '',
            };
            
            // Si tiene categoria_padre, buscar su ID en WooCommerce
            if (categoria.categoria_padre) {
              const parentExternalIds = categoria.categoria_padre.externalIds || {};
              const parentWooId = parentExternalIds[platform];
              if (parentWooId) {
                categoryPayload.parent = parentWooId;
              }
            }
            
            // Tipo de visualización
            if (categoria.tipo_visualizacion) {
              categoryPayload.display = categoria.tipo_visualizacion;
            }
            
            // Si tiene imagen, obtener URL
            const imageUrl = this.getImageUrl(categoria.imagen);
            if (imageUrl) {
              categoryPayload.image = { src: imageUrl };
            }
            
            const createResponse = await fetch(
              `${wooConfig.url}/wp-json/wc/v3/products/categories`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${auth}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(categoryPayload),
              }
            );
            
            if (createResponse.ok) {
              category = await createResponse.json();
              strapi.log.info(`[woo-sync] Categoría creada: "${categoria.name}" (ID: ${category.id})`);
              
              // Guardar externalId en Strapi
              const updatedExternalIds = { ...externalIds, [platform]: category.id };
              await strapi.entityService.update('api::categoria-producto.categoria-producto' as any, categoria.id, {
                data: { externalIds: updatedExternalIds },
              });
            } else {
              const errorText = await createResponse.text();
              strapi.log.warn(`[woo-sync] Error creando categoría "${categoria.name}": ${errorText}`);
              continue;
            }
          } else {
            wooCategoryId = category.id;
            // Guardar externalId en Strapi
            const updatedExternalIds = { ...externalIds, [platform]: category.id };
            await strapi.entityService.update('api::categoria-producto.categoria-producto' as any, categoria.id, {
              data: { externalIds: updatedExternalIds },
            });
          }
        }
        
        if (wooCategoryId && !categoryIds.includes(Number(wooCategoryId))) {
          categoryIds.push(Number(wooCategoryId));
        }
      } catch (error) {
        strapi.log.warn(`[woo-sync] Error sincronizando categoría "${categoria.name}":`, error);
      }
    }
    
    product.categories = categoryIds.map((id) => ({ id }));
    if (categoryIds.length > 0) {
      strapi.log.info(`[woo-sync] ${categoryIds.length} categoría(s) asignada(s) al producto`);
    }
  },

  /**
   * Obtiene la configuración de WooCommerce según la plataforma
   */
  getWooConfig(platform: 'woo_moraleja' | 'woo_escolar') {
    const configs: Record<string, any> = {
      woo_moraleja: {
        url: process.env.WOO_MORALEJA_URL,
        consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY,
        consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET,
      },
      woo_escolar: {
        url: process.env.WOO_ESCOLAR_URL,
        consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY,
        consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
      },
    };

    const config = configs[platform];
    if (!config.url || !config.consumerKey || !config.consumerSecret) {
      return null;
    }

    return config;
  },

  /**
   * Crea un producto en WooCommerce
   */
  async createWooProduct(config: any, productData: any) {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    const response = await fetch(`${config.url}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  },

  /**
   * Actualiza un producto en WooCommerce
   */
  async updateWooProduct(config: any, wooId: number | string, productData: any) {
    const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
    
    const response = await fetch(`${config.url}/wp-json/wc/v3/products/${wooId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WooCommerce API error: ${response.status} ${errorText}`);
    }

    return await response.json();
  },
}));

