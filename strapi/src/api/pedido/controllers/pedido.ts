/**
 * pedido controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::pedido.pedido' as any, ({ strapi }) => ({
  /**
   * DEBUGGING TEMPORAL: Ver payload RAW que llega desde Intranet
   */
  async debug(ctx: any) {
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🔍 [PEDIDO DEBUG] Payload RAW recibido desde Intranet');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('ctx.request.body:', JSON.stringify(ctx.request.body, null, 2));
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('Verificaciones:');
    console.log('- ctx.request.body existe?', !!ctx.request.body);
    console.log('- ctx.request.body.data existe?', !!ctx.request.body?.data);
    console.log('- ctx.request.body.data.items existe?', !!ctx.request.body?.data?.items);
    console.log('- ctx.request.body.data.productos existe?', !!ctx.request.body?.data?.productos);
    
    if (ctx.request.body?.data?.items) {
      console.log('- items es array?', Array.isArray(ctx.request.body.data.items));
      console.log('- items.length:', ctx.request.body.data.items.length);
      console.log('- items[0]:', JSON.stringify(ctx.request.body.data.items[0], null, 2));
    }
    
    if (ctx.request.body?.data?.productos) {
      console.log('- productos es array?', Array.isArray(ctx.request.body.data.productos));
      console.log('- productos.length:', ctx.request.body.data.productos.length);
      console.log('- productos[0]:', JSON.stringify(ctx.request.body.data.productos[0], null, 2));
    }
    
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    
    return ctx.send({
      message: 'Payload recibido y registrado en logs. Revisa la consola de Railway.',
      received: {
        hasData: !!ctx.request.body?.data,
        hasItems: !!ctx.request.body?.data?.items,
        hasProductos: !!ctx.request.body?.data?.productos,
        itemsLength: ctx.request.body?.data?.items?.length || 0,
        productosLength: ctx.request.body?.data?.productos?.length || 0,
      }
    });
  },

  /**
   * Crear o actualizar pedido desde Next.js (que viene de WooCommerce)
   * Hace match de productos usando woocommerce_id
   */
  async create(ctx: any) {
    const { data } = ctx.request.body;
    
    if (!data) {
      return ctx.badRequest('Se requiere el campo "data" en el body');
    }

    try {
      let pedidoExistente = null;
      
      // Buscar pedido existente por woocommerce_id o numero_pedido
      if (data.woocommerce_id) {
        const pedidos = await strapi.entityService.findMany('api::pedido.pedido' as any, {
          filters: {
            woocommerce_id: { $eq: String(data.woocommerce_id) },
          } as any,
          limit: 1,
        }) as any[];
        
        if (pedidos.length > 0) {
          pedidoExistente = pedidos[0];
          strapi.log.info(`[pedido] Pedido encontrado por woocommerce_id: ${data.woocommerce_id} → ID: ${pedidoExistente.id}`);
        }
      }
      
      // Si no se encontró por woocommerce_id, buscar por numero_pedido
      if (!pedidoExistente && data.numero_pedido) {
        try {
          const pedidos = await strapi.entityService.findMany('api::pedido.pedido' as any, {
            filters: {
              numero_pedido: { $eq: data.numero_pedido },
            },
            limit: 1,
          }) as any[];
          
          if (pedidos.length > 0) {
            pedidoExistente = pedidos[0];
            strapi.log.info(`[pedido] Pedido encontrado por numero_pedido: ${data.numero_pedido} → ID: ${pedidoExistente.id}`);
          }
        } catch (error) {
          strapi.log.debug(`[pedido] No se encontró pedido por numero_pedido: ${data.numero_pedido}`);
        }
      }
      
      // Procesar productos: hacer match con libros usando woocommerce_id
      const itemsProcesados: any[] = [];
      
      // Aceptar tanto "items" como "productos" para compatibilidad
      const productos = data.items || data.productos || [];
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('[pedido.create] 📦 Procesando items del pedido');
      console.log('- data.items existe?', !!data.items);
      console.log('- data.productos existe?', !!data.productos);
      console.log('- items a procesar:', productos.length);
      console.log('═══════════════════════════════════════════════════════');
      
      if (productos && Array.isArray(productos) && productos.length > 0) {
        for (const producto of productos) {
          let libroEncontrado = null;
          
          // Buscar libro por woocommerce_id
          if (producto.woocommerce_id) {
            const libros = await strapi.entityService.findMany('api::libro.libro', {
              filters: {
                woocommerce_id: { $eq: String(producto.woocommerce_id) },
              } as any,
              limit: 1,
            }) as any[];
            
            if (libros.length > 0) {
              libroEncontrado = libros[0];
              strapi.log.info(`[pedido] Libro encontrado por woocommerce_id: ${producto.woocommerce_id} → ID: ${libroEncontrado.id}`);
            }
          }
          
          // Si no se encontró por woocommerce_id, intentar buscar por SKU (ISBN)
          if (!libroEncontrado && producto.sku) {
            try {
              const libros = await strapi.entityService.findMany('api::libro.libro', {
                filters: {
                  isbn_libro: { $eq: producto.sku },
                },
                limit: 1,
              }) as any[];
              
              if (libros.length > 0) {
                libroEncontrado = libros[0];
                strapi.log.info(`[pedido] Libro encontrado por SKU/ISBN: ${producto.sku} → ID: ${libroEncontrado.id}`);
              }
            } catch (error) {
              strapi.log.debug(`[pedido] No se encontró libro por SKU: ${producto.sku}`);
            }
          }
          
          // Crear item del pedido
          const item: any = {
            item_id: producto.item_id || null,
            producto_id: producto.woocommerce_id || producto.producto_id || null,
            sku: producto.sku || null,
            nombre: producto.nombre || 'Producto sin nombre',
            cantidad: producto.cantidad || 1,
            precio_unitario: producto.precio || producto.precio_unitario || 0,
            total: producto.subtotal || producto.total || 0,
            metadata: producto.metadata || null,
          };
          
          // Relacionar libro si se encontró
          if (libroEncontrado) {
            item.libro = libroEncontrado.id;
            item.libro_id = libroEncontrado.id;
          } else {
            strapi.log.warn(`[pedido] No se encontró libro para producto woocommerce_id: ${producto.woocommerce_id || producto.producto_id || 'N/A'}, SKU: ${producto.sku || 'N/A'}`);
          }
          
          itemsProcesados.push(item);
        }
        
        console.log('═══════════════════════════════════════════════════════');
        console.log('[pedido.create] ✅ Items procesados:', itemsProcesados.length);
        console.log('═══════════════════════════════════════════════════════');
      } else {
        console.log('═══════════════════════════════════════════════════════');
        console.log('[pedido.create] ⚠️ NO HAY ITEMS PARA PROCESAR');
        console.log('- data.items:', data.items);
        console.log('- data.productos:', data.productos);
        console.log('═══════════════════════════════════════════════════════');
      }
      
      // Preparar datos del pedido
      const pedidoData: any = {
        ...data,
        items: itemsProcesados,
      };
      
      // Asegurar que woocommerce_id se guarde como string
      if (data.woocommerce_id) {
        pedidoData.woocommerce_id = String(data.woocommerce_id);
      }
      
      // Actualizar externalIds si viene woocommerce_id
      if (data.woocommerce_id) {
        const externalIds = pedidoExistente?.externalIds || {};
        const platform = data.originPlatform || 'woo_moraleja'; // Default si no se especifica
        pedidoData.externalIds = {
          ...externalIds,
          [platform]: data.woocommerce_id,
        };
      }
      
      // Si existe, actualizar
      if (pedidoExistente) {
        const pedidoId = pedidoExistente.id || pedidoExistente.documentId;
        
        const updated = await strapi.entityService.update('api::pedido.pedido' as any, pedidoId, {
          data: pedidoData,
          populate: ctx.query.populate || ['items', 'items.libro', 'customer'],
        });
        
        strapi.log.info(`[pedido] Pedido actualizado: ${pedidoId}`);
        
        return {
          data: updated,
          meta: {
            action: 'updated',
            id: pedidoId,
            productos_encontrados: itemsProcesados.filter(item => item.libro).length,
            productos_no_encontrados: itemsProcesados.filter(item => !item.libro).length,
          },
        };
      }
      
      // Si no existe, crear uno nuevo
      const created = await strapi.entityService.create('api::pedido.pedido' as any, {
        data: pedidoData,
        populate: ctx.query.populate || ['items', 'items.libro', 'customer'],
      });
      
      strapi.log.info(`[pedido] Pedido creado: ${created.id}`);
      
      return {
        data: created,
        meta: {
          action: 'created',
          id: created.id,
          productos_encontrados: itemsProcesados.filter(item => item.libro).length,
          productos_no_encontrados: itemsProcesados.filter(item => !item.libro).length,
        },
      };
    } catch (error: any) {
      strapi.log.error('[pedido] Error en create:', error);
      return ctx.badRequest(error.message || 'Error al crear/actualizar pedido');
    }
  },
}));

