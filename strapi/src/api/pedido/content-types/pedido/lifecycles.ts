/**
 * Lifecycles para sincronización automática de pedidos con WooCommerce
 */

export default {
  /**
   * beforeCreate: Establece fechas automáticamente si no vienen en el payload
   */
  async beforeCreate(event: any) {
    const { data } = event.params;
    
    // Establecer fecha_creacion si no está presente
    if (!data.fecha_creacion) {
      data.fecha_creacion = new Date().toISOString();
      console.log('[pedido] 📅 fecha_creacion establecida automáticamente:', data.fecha_creacion);
    }
    
    // Establecer fecha_modificacion si no está presente
    if (!data.fecha_modificacion) {
      data.fecha_modificacion = new Date().toISOString();
      console.log('[pedido] 📅 fecha_modificacion establecida automáticamente:', data.fecha_modificacion);
    }
  },
  
  /**
   * beforeUpdate: Actualiza fecha_modificacion automáticamente
   */
  async beforeUpdate(event: any) {
    const { data } = event.params;
    
    // Siempre actualizar fecha_modificacion
    data.fecha_modificacion = new Date().toISOString();
    console.log('[pedido] 📅 fecha_modificacion actualizada automáticamente:', data.fecha_modificacion);
  },

  async afterCreate(event: any) {
    const { result } = event;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('[pedido] 🔍 afterCreate ejecutado');
    console.log('[pedido] Pedido ID:', result.id);
    console.log('[pedido] documentId:', result.documentId);
    console.log('[pedido] Número de pedido:', result.numero_pedido);
    console.log('[pedido] Estado:', result.estado);
    console.log('[pedido] Origin Platform:', result.originPlatform);
    console.log('[pedido] External IDs:', JSON.stringify(result.externalIds || {}));
    console.log('[pedido] WooCommerce ID:', result.woocommerce_id);
    
    // Solo sincronizar si tiene originPlatform válido
    const platform = result.originPlatform;
    
    if (!platform || !['woo_moraleja', 'woo_escolar'].includes(platform)) {
      console.log('[pedido] ⏭️  No se sincroniza: originPlatform no válido o es "otros"');
      console.log('═══════════════════════════════════════════════════════');
      return;
    }
    
    // Solo sincronizar si NO viene de WooCommerce (no tiene externalId para esta plataforma)
    const externalIds = result.externalIds || {};
    
    if (externalIds[platform] || result.woocommerce_id) {
      console.log('[pedido] ⏭️  No se sincroniza: ya tiene externalId o woocommerce_id (viene de WooCommerce)');
      console.log('═══════════════════════════════════════════════════════');
      return;
    }
    
    console.log(`[pedido] ✅ Iniciando sincronización a ${platform}...`);
    
    try {
      // Llamar al servicio de sincronización
      const syncResult = await strapi.service('api::pedido.pedido').syncToWooCommerce(result);
      
      if (syncResult && syncResult.wooId) {
        console.log(`[pedido] ✅ Pedido sincronizado exitosamente`);
        console.log(`[pedido] WooCommerce ID:`, syncResult.wooId);
        console.log(`[pedido] Plataforma:`, syncResult.platform);
        strapi.log.info(`[pedido] ✅ Pedido ${result.numero_pedido} sincronizado a ${platform}: ${syncResult.wooId}`);
      } else {
        console.log(`[pedido] ⚠️  syncToWooCommerce() retornó null o vacío`);
        strapi.log.warn(`[pedido] syncToWooCommerce retornó resultado vacío para pedido ${result.numero_pedido}`);
      }
    } catch (error: any) {
      console.error('❌ [pedido] ERROR en syncToWooCommerce:');
      console.error(error);
      strapi.log.error('[pedido] Error en afterCreate sync:', error);
    }
    
    console.log('═══════════════════════════════════════════════════════');
  },

  async afterUpdate(event: any) {
    const { result } = event;
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('[pedido] 🔍 afterUpdate ejecutado');
    console.log('[pedido] Pedido ID:', result.id);
    console.log('[pedido] documentId:', result.documentId);
    console.log('[pedido] Número de pedido:', result.numero_pedido);
    console.log('[pedido] Estado:', result.estado);
    console.log('[pedido] Origin Platform:', result.originPlatform);
    console.log('[pedido] WooCommerce ID:', result.woocommerce_id);
    
    const platform = result.originPlatform;
    
    if (!platform || !['woo_moraleja', 'woo_escolar'].includes(platform)) {
      console.log('[pedido] ⏭️  No se sincroniza: originPlatform no válido');
      console.log('═══════════════════════════════════════════════════════');
      return;
    }
    
    const externalIds = result.externalIds || {};
    const wooId = result.woocommerce_id || externalIds[platform];
    
    if (!wooId) {
      console.log('[pedido] ⏭️  No se sincroniza: no tiene woocommerce_id ni externalId');
      console.log('[pedido] ℹ️  Este pedido probablemente se creó en Strapi y falló la primera sincronización');
      console.log('═══════════════════════════════════════════════════════');
      return;
    }
    
    console.log(`[pedido] ✅ Iniciando actualización en ${platform} (WooCommerce ID: ${wooId})...`);
    
    try {
      const syncResult = await strapi.service('api::pedido.pedido').syncToWooCommerce(result);
      
      if (syncResult && syncResult.wooId) {
        console.log(`[pedido] ✅ Pedido actualizado exitosamente en WooCommerce`);
        console.log(`[pedido] WooCommerce ID:`, syncResult.wooId);
        strapi.log.info(`[pedido] ✅ Pedido ${result.numero_pedido} actualizado en ${platform}`);
      } else {
        console.log(`[pedido] ⚠️  syncToWooCommerce() retornó resultado vacío`);
        strapi.log.warn(`[pedido] syncToWooCommerce retornó resultado vacío para pedido ${result.numero_pedido}`);
      }
    } catch (error: any) {
      console.error('❌ [pedido] ERROR al actualizar en WooCommerce:');
      console.error(error);
      strapi.log.error('[pedido] Error en afterUpdate sync:', error);
    }
    
    console.log('═══════════════════════════════════════════════════════');
  },
};

