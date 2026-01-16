/**
 * Servicio de mapeo para Items de Pedidos (Line Items) entre Strapi y WooCommerce
 */

export default ({ strapi }) => ({
  /**
   * Mapea un item de pedido de Strapi a formato WooCommerce (line_item)
   */
  async mapItemToWooLineItem(item: any, platform: 'woo_moraleja' | 'woo_escolar'): Promise<any | null> {
    // Buscar product_id válido
    let productId: number | null = null;
    
    // 1. Desde item.producto_id
    if (item.producto_id && item.producto_id > 0) {
      productId = parseInt(String(item.producto_id), 10);
    }
    
    // 2. Desde libro relacionado
    if ((!productId || productId === 0) && item.libro) {
      const libroId = typeof item.libro === 'object' 
        ? (item.libro.documentId || item.libro.id || item.libro)
        : item.libro;
      
      if (libroId) {
        try {
          // En Strapi v5, entityService.findOne puede aceptar documentId directamente
          let libro: any = null;
          try {
            libro = await strapi.entityService.findOne('api::libro.libro', libroId) as any;
          } catch (error) {
            strapi.log.warn(`[line-item-mapper] Error obteniendo libro ${libroId}:`, error);
          }
          
          if (libro?.externalIds?.[platform]) {
            productId = parseInt(String(libro.externalIds[platform]), 10);
          } else {
            // OPCIÓN C: Si el libro no tiene externalIds, intentar sincronizarlo automáticamente
            strapi.log.info(`[line-item-mapper] 📦 Libro ${libroId} no tiene externalIds para ${platform}, intentando sincronizar...`);
            
            try {
              // Verificar que el libro esté en un canal de WooCommerce
              const libroAttrs = libro.attributes || libro;
              const canales = libroAttrs?.canales || libro.canales || [];
              const tieneCanalWoo = canales.some((c: any) => {
                const canalKey = c.key || c.slug || c.nombre?.toLowerCase();
                return canalKey === platform || canalKey === 'woo_moraleja' || canalKey === 'woo_escolar';
              });
              
              if (tieneCanalWoo) {
                // Obtener servicio de sincronización
                const wooSyncService = strapi.service('api::woo-sync.woo-sync');
                if (wooSyncService && (wooSyncService as any).syncProduct) {
                  const libroParaSync = {
                    id: libro.id || libroId,
                    ...libroAttrs,
                  };
                  
                  await (wooSyncService as any).syncProduct(libroParaSync, platform);
                  strapi.log.info(`[line-item-mapper] ✅ Libro ${libroId} sincronizado automáticamente`);
                  
                  // Obtener el libro actualizado con externalIds
                  // En Strapi v5, entityService.findOne puede aceptar documentId directamente
                  const libroActualizado = await strapi.entityService.findOne('api::libro.libro', libroId) as any;
                  
                  if (libroActualizado?.externalIds?.[platform]) {
                    productId = parseInt(String(libroActualizado.externalIds[platform]), 10);
                    strapi.log.info(`[line-item-mapper] ✅ product_id obtenido después de sincronizar: ${productId}`);
                  }
                }
              } else {
                strapi.log.warn(`[line-item-mapper] ⚠️  Libro ${libroId} no está en un canal de WooCommerce`);
              }
            } catch (syncError: any) {
              strapi.log.warn(`[line-item-mapper] ⚠️  Error sincronizando libro ${libroId}: ${syncError?.message || syncError}`);
            }
          }
        } catch (error) {
          strapi.log.warn(`[line-item-mapper] Error obteniendo libro ${libroId}:`, error);
        }
      }
    }
    
    // 3. Buscar por SKU en Strapi
    if ((!productId || productId === 0) && item.sku) {
      try {
        const libros = await strapi.entityService.findMany('api::libro.libro', {
          filters: { isbn_libro: item.sku },
        }) as any[];
        if (libros.length > 0 && libros[0].externalIds?.[platform]) {
          productId = parseInt(String(libros[0].externalIds[platform]), 10);
        }
      } catch (error) {
        strapi.log.warn(`[line-item-mapper] Error buscando libro por SKU ${item.sku}:`, error);
      }
    }
    
    // 4. Si aún no hay product_id, buscar en WooCommerce por SKU
    // Nota: Esto requiere acceso a la configuración de WooCommerce
    // Por ahora retornamos null y el servicio principal puede manejarlo
    // TODO: Pasar wooConfig al mapper o hacer la búsqueda en el servicio principal
    
    // Si no hay product_id válido, retornar null
    if (!productId || productId === 0) {
      const itemInfo = {
        nombre: item.nombre || 'sin nombre',
        sku: item.sku || 'sin SKU',
        producto_id: item.producto_id || 'no definido',
        libro_id: item.libro ? (item.libro.id || item.libro) : 'no relacionado',
      };
      
      strapi.log.error(`[line-item-mapper] ❌ No se pudo encontrar product_id válido para item:`, itemInfo);
      return null;
    }
    
    // Construir line_item
    const lineItem: any = {
      product_id: productId,
      quantity: item.cantidad || 1,
    };
    
    // Campos opcionales
    if (item.nombre) {
      lineItem.name = item.nombre;
    }
    if (item.sku) {
      lineItem.sku = item.sku;
    }
    if (item.precio_unitario) {
      lineItem.price = String(item.precio_unitario);
    }
    if (item.total) {
      lineItem.total = String(item.total);
    }
    
    return lineItem;
  },

  /**
   * Mapea múltiples items de Strapi a line_items de WooCommerce
   */
  async mapItemsToWooLineItems(items: any[], platform: 'woo_moraleja' | 'woo_escolar'): Promise<any[]> {
    const lineItems: any[] = [];
    
    for (const item of items) {
      const lineItem = await this.mapItemToWooLineItem(item, platform);
      if (lineItem) {
        lineItems.push(lineItem);
      }
    }
    
    return lineItems;
  },

  /**
   * Mapea un line_item de WooCommerce a formato Strapi (item)
   */
  mapWooLineItemToItem(wooLineItem: any, platform: 'woo_moraleja' | 'woo_escolar'): any {
    const item: any = {
      item_id: wooLineItem.id || null,
      producto_id: wooLineItem.product_id || null,
      sku: wooLineItem.sku || '',
      nombre: wooLineItem.name || '',
      cantidad: wooLineItem.quantity || 1,
      precio_unitario: parseFloat(wooLineItem.price || '0'),
      total: parseFloat(wooLineItem.total || '0'),
      metadata: {},
    };
    
    // Buscar libro relacionado por SKU o product_id
    if (item.sku || item.producto_id) {
      // Se puede buscar el libro en el servicio que llama a este mapper
      // o hacerlo aquí si es necesario
    }
    
    return item;
  },

  /**
   * Mapea múltiples line_items de WooCommerce a items de Strapi
   */
  mapWooLineItemsToItems(wooLineItems: any[], platform: 'woo_moraleja' | 'woo_escolar'): any[] {
    return wooLineItems.map(wooItem => this.mapWooLineItemToItem(wooItem, platform));
  },
});
