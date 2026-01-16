/**
 * pedido service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::pedido.pedido', ({ strapi }) => ({
  
  /**
   * Sincroniza un pedido de Strapi a WooCommerce
   */
  async syncToWooCommerce(pedido: any) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 [PEDIDO - syncToWooCommerce] Iniciando sincronización');
    console.log(`Pedido ID: ${pedido.id || pedido.documentId || 'sin ID'}`);
    console.log(`Número de pedido: ${pedido.numero_pedido || 'sin número'}`);
    console.log(`Platform: ${pedido.originPlatform || 'sin platform'}`);
    console.log('═══════════════════════════════════════════════════════');
    
    const platform = pedido.originPlatform;
    
    if (!platform || !['woo_moraleja', 'woo_escolar'].includes(platform)) {
      console.log('❌ [pedido.service] Platform no válido, omitiendo sincronización');
      strapi.log.warn(`[pedido.service] Platform no válido para pedido ${pedido.numero_pedido}: ${platform}`);
      return null;
    }
    
    // Obtener configuración de WooCommerce
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig || !wooConfig.url || !wooConfig.consumerKey || !wooConfig.consumerSecret) {
      console.error('❌ [pedido.service] Configuración de WooCommerce incompleta');
      strapi.log.error(`[pedido.service] Configuración de WooCommerce no encontrada o incompleta para ${platform}`);
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }
    
    console.log(`✅ [pedido.service] Configuración de ${platform} encontrada`);
    console.log(`   URL: ${wooConfig.url}`);
    
    // Obtener el pedido completo con relaciones pobladas
    let pedidoCompleto = pedido;
    
    if (pedido.id || pedido.documentId) {
      try {
        const pedidoId = pedido.id || pedido.documentId;
        console.log(`[pedido.service] Obteniendo pedido completo con ID: ${pedidoId}`);
        
        pedidoCompleto = await strapi.entityService.findOne('api::pedido.pedido', pedidoId, {
          populate: {
            customer: true,
            items: true,
          },
        }) as any;
        
        console.log(`✅ [pedido.service] Pedido completo obtenido`);
        console.log(`   Customer: ${pedidoCompleto?.customer ? 'presente' : 'ausente'}`);
        console.log(`   Items: ${pedidoCompleto?.items?.length || 0}`);
        
        // Log detallado de items
        if (pedidoCompleto?.items && pedidoCompleto.items.length > 0) {
          console.log(`   Items detallados:`);
          pedidoCompleto.items.forEach((item: any, idx: number) => {
            console.log(`      ${idx + 1}. ${item.nombre || 'sin nombre'} - Qty: ${item.cantidad || 0} - Precio: ${item.precio_unitario || 0}`);
          });
        } else {
          console.warn(`   ⚠️  NO HAY ITEMS en el pedido poblado`);
        }
      } catch (error: any) {
        console.warn(`⚠️  [pedido.service] Error al obtener pedido completo, usando pedido original`);
        strapi.log.warn(`[pedido.service] Error al popular pedido ${pedido.numero_pedido}:`, error);
      }
    }
    
    // Preparar payload para WooCommerce
    console.log('[pedido.service] 🔨 Construyendo payload de WooCommerce...');
    const wooOrder = this.buildWooOrder(pedidoCompleto);
    
    console.log('[pedido.service] Payload construido:');
    console.log(`   Status: ${wooOrder.status}`);
    console.log(`   Line items: ${wooOrder.line_items?.length || 0}`);
    console.log(`   Customer ID: ${wooOrder.customer_id || 'sin customer_id'}`);
    
    const externalIds = pedidoCompleto.externalIds || {};
    const wooId = pedidoCompleto.woocommerce_id || externalIds[platform];
    
    let result;
    
    try {
      if (wooId) {
        // Actualizar pedido existente en WooCommerce
        console.log(`[pedido.service] 📝 Actualizando pedido ${wooId} en ${platform}...`);
        result = await this.updateWooOrder(wooConfig, wooId, wooOrder);
        console.log(`✅ [pedido.service] Pedido actualizado exitosamente en ${platform}`);
        strapi.log.info(`[pedido.service] Pedido ${pedidoCompleto.numero_pedido} actualizado en ${platform}: ${wooId}`);
      } else {
        // Crear nuevo pedido en WooCommerce
        console.log(`[pedido.service] ➕ Creando nuevo pedido en ${platform}...`);
        result = await this.createWooOrder(wooConfig, wooOrder);
        
        const newWooId = result.id;
        const newNumero = String(result.number || result.id);
        
        console.log(`✅ [pedido.service] Pedido creado en ${platform}`);
        console.log(`   WooCommerce ID: ${newWooId}`);
        console.log(`   Número de pedido: ${newNumero}`);
        
        // Actualizar externalIds y woocommerce_id en Strapi
        const updatedExternalIds = { ...externalIds, [platform]: newWooId };
        
        await strapi.entityService.update('api::pedido.pedido', pedidoCompleto.id || pedidoCompleto.documentId, {
          data: {
            woocommerce_id: String(newWooId),
            numero_pedido: newNumero,
            externalIds: updatedExternalIds,
          },
        } as any);
        
        console.log(`✅ [pedido.service] Strapi actualizado con WooCommerce ID`);
        strapi.log.info(`[pedido.service] Pedido ${newNumero} creado en ${platform}: ${newWooId}`);
      }
      
      console.log('═══════════════════════════════════════════════════════');
      return { wooId: result.id, platform, result };
      
    } catch (error: any) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ [pedido.service] ERROR en sincronización');
      console.error(`Mensaje: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      console.error('═══════════════════════════════════════════════════════');
      strapi.log.error(`[pedido.service] Error al sincronizar pedido ${pedidoCompleto.numero_pedido}:`, error);
      throw error;
    }
  },
  
  /**
   * Obtiene la configuración de WooCommerce según la plataforma
   */
  getWooConfig(platform: 'woo_moraleja' | 'woo_escolar') {
    if (platform === 'woo_moraleja') {
      return {
        url: process.env.WOO_MORALEJA_URL,
        consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY,
        consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET,
      };
    } else if (platform === 'woo_escolar') {
      return {
        url: process.env.WOO_ESCOLAR_URL,
        consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY,
        consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
      };
    }
    return null;
  },
  
  /**
   * Valida si un email es válido
   */
  isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    
    // Regex básica para validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },
  
  /**
   * Sanitiza el objeto billing/shipping para WooCommerce
   * Valida el email y limpia campos vacíos
   */
  sanitizeBillingShipping(data: any, tipo: 'billing' | 'shipping'): any | null {
    if (!data || typeof data !== 'object') {
      return null;
    }
    
    const sanitized: any = {};
    
    // Lista de campos válidos de WooCommerce
    const validFields = [
      'first_name', 'last_name', 'company', 'address_1', 'address_2',
      'city', 'state', 'postcode', 'country', 'email', 'phone'
    ];
    
    // Copiar solo campos válidos y no vacíos
    for (const field of validFields) {
      const value = data[field];
      
      // Email requiere validación especial
      if (field === 'email') {
        if (value && this.isValidEmail(value)) {
          sanitized.email = value.trim();
        } else if (value) {
          console.warn(`[pedido.service] ⚠️  Email inválido en ${tipo}: "${value}" - será omitido`);
          // NO agregar email inválido
        }
      } else if (value !== undefined && value !== null && value !== '') {
        sanitized[field] = typeof value === 'string' ? value.trim() : value;
      }
    }
    
    // Si quedó vacío (solo tenía email inválido), retornar null
    if (Object.keys(sanitized).length === 0) {
      return null;
    }
    
    return sanitized;
  },
  
  /**
   * Construye el payload de WooCommerce a partir de un pedido de Strapi
   */
  buildWooOrder(pedido: any) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('[pedido.service] 🔨 Construyendo payload de WooCommerce');
    console.log('[pedido.service] 📦 Datos del pedido recibidos:');
    console.log(`   - ID: ${pedido.id || pedido.documentId}`);
    console.log(`   - Número: ${pedido.numero_pedido}`);
    console.log(`   - Estado: ${pedido.estado}`);
    console.log(`   - Total: ${pedido.total}`);
    console.log(`   - Subtotal: ${pedido.subtotal}`);
    console.log(`   - Moneda: ${pedido.moneda}`);
    console.log(`   - Items en pedido.items:`, pedido.items ? `${pedido.items.length} items` : 'NO HAY ITEMS');
    
    // Log detallado de cada item
    if (pedido.items && pedido.items.length > 0) {
      console.log('[pedido.service] 📋 Detalle de items:');
      pedido.items.forEach((item: any, index: number) => {
        console.log(`   Item ${index + 1}:`);
        console.log(`      - nombre: ${item.nombre || 'SIN NOMBRE'}`);
        console.log(`      - producto_id: ${item.producto_id || 'SIN ID'}`);
        console.log(`      - sku: ${item.sku || 'SIN SKU'}`);
        console.log(`      - cantidad: ${item.cantidad || 'SIN CANTIDAD'}`);
        console.log(`      - precio_unitario: ${item.precio_unitario || 'SIN PRECIO'}`);
        console.log(`      - total: ${item.total || 'SIN TOTAL'}`);
      });
    } else {
      console.warn('⚠️  [pedido.service] EL PEDIDO NO TIENE ITEMS - WooCommerce creará pedido vacío');
    }
    
    // Mapear items (products de Strapi → line_items de WooCommerce)
    const line_items = (pedido.items || []).map((item: any, index: number) => {
      const lineItem: any = {
        quantity: item.cantidad || 1,
        name: item.nombre || `Producto ${index + 1}`,
      };
      
      // Solo agregar product_id si existe
      if (item.producto_id) {
        lineItem.product_id = item.producto_id;
      }
      
      // Solo agregar SKU si existe
      if (item.sku) {
        lineItem.sku = item.sku;
      }
      
      // Precios
      if (item.precio_unitario !== undefined && item.precio_unitario !== null) {
        lineItem.price = String(item.precio_unitario);
      }
      
      if (item.total !== undefined && item.total !== null) {
        lineItem.subtotal = String(item.total);
        lineItem.total = String(item.total);
      }
      
      console.log(`[pedido.service] ✅ Line item ${index + 1} mapeado:`, JSON.stringify(lineItem));
      
      return lineItem;
    });
    
    console.log(`[pedido.service] 📊 Total de line_items mapeados: ${line_items.length}`);
    
    const wooOrder: any = {
      status: pedido.estado || 'pending', // 'pending', 'processing', 'completed', etc.
      currency: pedido.moneda || 'CLP',
      line_items,
    };
    
    // Agregar método de pago si existe
    if (pedido.metodo_pago) {
      wooOrder.payment_method = pedido.metodo_pago;
      wooOrder.payment_method_title = pedido.metodo_pago_titulo || pedido.metodo_pago;
    }
    
    // Agregar nota del cliente si existe
    if (pedido.nota_cliente) {
      wooOrder.customer_note = pedido.nota_cliente;
    }
    
    // Agregar billing si existe (con validación de email)
    if (pedido.billing && typeof pedido.billing === 'object') {
      const sanitizedBilling = this.sanitizeBillingShipping(pedido.billing, 'billing');
      if (sanitizedBilling) {
        wooOrder.billing = sanitizedBilling;
        console.log('[pedido.service] ✅ Billing validado y agregado');
      } else {
        console.warn('[pedido.service] ⚠️  Billing omitido (datos inválidos o vacíos)');
      }
    }
    
    // Agregar shipping si existe (con validación)
    if (pedido.shipping && typeof pedido.shipping === 'object') {
      const sanitizedShipping = this.sanitizeBillingShipping(pedido.shipping, 'shipping');
      if (sanitizedShipping) {
        wooOrder.shipping = sanitizedShipping;
        console.log('[pedido.service] ✅ Shipping validado y agregado');
      } else {
        console.warn('[pedido.service] ⚠️  Shipping omitido (datos inválidos o vacíos)');
      }
    }
    
    // Agregar customer_id si existe (relación con customer que tiene externalIds)
    if (pedido.customer) {
      const customer = pedido.customer;
      const customerExternalIds = customer.externalIds || {};
      const wooCustomerId = customerExternalIds[pedido.originPlatform];
      
      if (wooCustomerId) {
        wooOrder.customer_id = wooCustomerId;
        console.log(`[pedido.service] ✅ Customer ID de WooCommerce encontrado: ${wooCustomerId}`);
      } else {
        console.log(`[pedido.service] ⚠️  No se encontró customer_id de WooCommerce para ${pedido.originPlatform}`);
      }
    }
    
    // Si el pedido tiene estado completed o processing y tiene total, marcarlo como pagado
    if ((pedido.estado === 'completed' || pedido.estado === 'processing') && pedido.total > 0) {
      wooOrder.set_paid = true;
      console.log('[pedido.service] 💳 Pedido marcado como pagado (set_paid: true)');
    }
    
    // Log del payload final
    console.log('[pedido.service] 📤 Payload final para WooCommerce:');
    console.log(`   - status: ${wooOrder.status}`);
    console.log(`   - currency: ${wooOrder.currency}`);
    console.log(`   - line_items: ${wooOrder.line_items.length} items`);
    console.log(`   - set_paid: ${wooOrder.set_paid || false}`);
    console.log(`   - billing: ${wooOrder.billing ? 'presente' : 'ausente'}`);
    console.log(`   - shipping: ${wooOrder.shipping ? 'presente' : 'ausente'}`);
    console.log(`   - customer_id: ${wooOrder.customer_id || 'no especificado'}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    
    return wooOrder;
  },
  
  /**
   * Crea un pedido en WooCommerce
   */
  async createWooOrder(wooConfig: any, wooOrder: any) {
    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
    
    console.log(`[pedido.service] Enviando POST a ${wooConfig.url}/wp-json/wc/v3/orders`);
    console.log(`[pedido.service] Payload:`, JSON.stringify(wooOrder, null, 2));
    
    const response = await fetch(`${wooConfig.url}/wp-json/wc/v3/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(wooOrder),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [pedido.service] Error ${response.status} al crear pedido:`);
      
      try {
        const errorJson = JSON.parse(errorText);
        
        // Si es error de validación (400), mostrar detalles específicos
        if (response.status === 400 && errorJson.data && errorJson.data.params) {
          console.error('❌ [pedido.service] Parámetros inválidos:');
          for (const [param, message] of Object.entries(errorJson.data.params)) {
            console.error(`   - ${param}: ${message}`);
          }
          
          // Si el problema es billing/shipping con email inválido, logearlo claramente
          if (errorJson.data.details) {
            console.error('❌ [pedido.service] Detalles del error:');
            console.error(JSON.stringify(errorJson.data.details, null, 2));
          }
        } else {
          console.error(errorText);
        }
      } catch (e) {
        // Si no es JSON válido, mostrar el texto plano
        console.error(errorText);
      }
      
      throw new Error(`Error al crear pedido en WooCommerce (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [pedido.service] Pedido creado exitosamente en WooCommerce');
    return result;
  },
  
  /**
   * Actualiza un pedido en WooCommerce
   */
  async updateWooOrder(wooConfig: any, wooId: string | number, wooOrder: any) {
    const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
    
    console.log(`[pedido.service] Enviando PUT a ${wooConfig.url}/wp-json/wc/v3/orders/${wooId}`);
    console.log(`[pedido.service] Payload:`, JSON.stringify(wooOrder, null, 2));
    
    const response = await fetch(`${wooConfig.url}/wp-json/wc/v3/orders/${wooId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(wooOrder),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [pedido.service] Error ${response.status} al actualizar pedido:`);
      
      try {
        const errorJson = JSON.parse(errorText);
        
        // Si es error de validación (400), mostrar detalles específicos
        if (response.status === 400 && errorJson.data && errorJson.data.params) {
          console.error('❌ [pedido.service] Parámetros inválidos:');
          for (const [param, message] of Object.entries(errorJson.data.params)) {
            console.error(`   - ${param}: ${message}`);
          }
          
          // Si el problema es billing/shipping con email inválido, logearlo claramente
          if (errorJson.data.details) {
            console.error('❌ [pedido.service] Detalles del error:');
            console.error(JSON.stringify(errorJson.data.details, null, 2));
          }
        } else {
          console.error(errorText);
        }
      } catch (e) {
        // Si no es JSON válido, mostrar el texto plano
        console.error(errorText);
      }
      
      throw new Error(`Error al actualizar pedido en WooCommerce (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [pedido.service] Pedido actualizado exitosamente en WooCommerce');
    return result;
  },
  
}));
