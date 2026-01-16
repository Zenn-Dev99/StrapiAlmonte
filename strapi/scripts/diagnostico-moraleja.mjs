#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar la configuración de Moraleja
 * 
 * Uso:
 *   node scripts/diagnostico-moraleja.mjs
 */

import Strapi from '@strapi/strapi';
import axios from 'axios';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DE CONFIGURACIÓN MORALEJA');
  console.log('═══════════════════════════════════════════════════════\n');

  // Iniciar Strapi
  console.log('📦 Iniciando Strapi...');
  const appContext = await Strapi().load();
  const app = appContext.container;
  
  console.log('✅ Strapi iniciado\n');

  // ═══════════════════════════════════════════════════════════════════
  // PASO 1: Verificar variables de entorno
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('PASO 1: Verificando Variables de Entorno');
  console.log('═══════════════════════════════════════════════════════\n');

  const wooMoralejaUrl = process.env.WOO_MORALEJA_URL;
  const wooMoralejaKey = process.env.WOO_MORALEJA_CONSUMER_KEY;
  const wooMoralejaSecret = process.env.WOO_MORALEJA_CONSUMER_SECRET;

  console.log('WOO_MORALEJA_URL:', wooMoralejaUrl ? `✅ ${wooMoralejaUrl}` : '❌ NO CONFIGURADA');
  console.log('WOO_MORALEJA_CONSUMER_KEY:', wooMoralejaKey ? `✅ ${wooMoralejaKey.substring(0, 10)}...` : '❌ NO CONFIGURADA');
  console.log('WOO_MORALEJA_CONSUMER_SECRET:', wooMoralejaSecret ? `✅ ${wooMoralejaSecret.substring(0, 10)}...` : '❌ NO CONFIGURADA');

  if (!wooMoralejaUrl || !wooMoralejaKey || !wooMoralejaSecret) {
    console.log('\n❌ PROBLEMA ENCONTRADO:');
    console.log('   Las variables de entorno de WooCommerce de Moraleja NO están configuradas.');
    console.log('\n🔧 SOLUCIÓN:');
    console.log('   1. Ir a Railway → Tu proyecto de Strapi → Variables');
    console.log('   2. Agregar las siguientes variables:');
    console.log('      WOO_MORALEJA_URL=https://staging.moraleja.cl');
    console.log('      WOO_MORALEJA_CONSUMER_KEY=ck_...');
    console.log('      WOO_MORALEJA_CONSUMER_SECRET=cs_...');
    console.log('   3. Redeploy');
    console.log('\n   Ver docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md para más detalles');
    await app.destroy();
    process.exit(1);
  }

  console.log('\n✅ Variables de entorno configuradas correctamente\n');

  // ═══════════════════════════════════════════════════════════════════
  // PASO 2: Probar conexión con WooCommerce
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('PASO 2: Probando Conexión con WooCommerce de Moraleja');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const auth = {
      username: wooMoralejaKey,
      password: wooMoralejaSecret,
    };

    console.log(`🔗 Conectando a: ${wooMoralejaUrl}/wp-json/wc/v3/system_status`);
    
    const response = await axios.get(`${wooMoralejaUrl}/wp-json/wc/v3/system_status`, { auth });
    
    console.log('✅ Conexión exitosa con WooCommerce de Moraleja');
    console.log(`   Versión de WooCommerce: ${response.data.environment?.version || 'desconocida'}`);
    console.log(`   Versión de WordPress: ${response.data.environment?.wp_version || 'desconocida'}\n`);
  } catch (error) {
    console.log('❌ Error al conectar con WooCommerce de Moraleja');
    console.log(`   ${error.response?.status || 'Sin respuesta'}: ${error.response?.statusText || error.message}`);
    
    if (error.response?.status === 401) {
      console.log('\n❌ PROBLEMA ENCONTRADO:');
      console.log('   Las credenciales (Consumer Key/Secret) son inválidas.');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   1. Ir a https://staging.moraleja.cl/wp-admin');
      console.log('   2. WooCommerce → Settings → Advanced → REST API');
      console.log('   3. Generar nuevas claves');
      console.log('   4. Actualizar variables en Railway');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n❌ PROBLEMA ENCONTRADO:');
      console.log('   La URL de WooCommerce es incorrecta o no es accesible.');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   Verificar que WOO_MORALEJA_URL sea: https://staging.moraleja.cl');
    }
    
    await app.destroy();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PASO 3: Obtener pedidos de WooCommerce
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('PASO 3: Obteniendo Pedidos de WooCommerce de Moraleja');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const auth = {
      username: wooMoralejaKey,
      password: wooMoralejaSecret,
    };

    const response = await axios.get(`${wooMoralejaUrl}/wp-json/wc/v3/orders`, {
      auth,
      params: {
        per_page: 5,
        orderby: 'date',
        order: 'desc',
      },
    });

    const orders = response.data;
    
    console.log(`✅ Se encontraron ${orders.length} pedidos en WooCommerce de Moraleja\n`);

    if (orders.length === 0) {
      console.log('⚠️  No hay pedidos en WooCommerce de Moraleja');
      console.log('   Crea un pedido de prueba en https://staging.moraleja.cl/wp-admin\n');
    } else {
      console.log('Últimos pedidos:');
      for (const order of orders) {
        console.log(`   - Pedido #${order.number} (ID: ${order.id}) - ${order.status} - Total: ${order.currency} ${order.total}`);
      }
      console.log('');
    }

    // ═══════════════════════════════════════════════════════════════════
    // PASO 4: Verificar si los pedidos están en Strapi
    // ═══════════════════════════════════════════════════════════════════
    console.log('═══════════════════════════════════════════════════════');
    console.log('PASO 4: Verificando Pedidos en Strapi');
    console.log('═══════════════════════════════════════════════════════\n');

    const pedidosEnStrapi = await app.entityService.findMany('api::pedido.pedido', {
      filters: {
        originPlatform: 'woo_moraleja',
      },
      limit: 100,
    });

    console.log(`Pedidos de Moraleja en Strapi: ${pedidosEnStrapi.length}`);

    if (pedidosEnStrapi.length === 0 && orders.length > 0) {
      console.log('\n❌ PROBLEMA ENCONTRADO:');
      console.log('   Hay pedidos en WooCommerce de Moraleja, pero NO están en Strapi.');
      console.log('\n🔧 POSIBLES CAUSAS:');
      console.log('   1. Los webhooks NO están configurados en WooCommerce');
      console.log('   2. Los webhooks están configurados pero apuntan a una URL incorrecta');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   1. Ir a https://staging.moraleja.cl/wp-admin');
      console.log('   2. WooCommerce → Settings → Advanced → Webhooks');
      console.log('   3. Verificar que existan webhooks con:');
      console.log('      - Topic: Order created, Order updated, Order deleted');
      console.log('      - Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja');
      console.log('      - Status: Active');
      console.log('   4. Si no existen, crearlos según docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md');
      console.log('\n   Alternativamente, puedes importar manualmente los pedidos existentes:');
      console.log('   POST https://strapi.moraleja.cl/api/woo-webhook/import-orders/woo_moraleja');
    } else if (pedidosEnStrapi.length > 0) {
      console.log('✅ Hay pedidos de Moraleja en Strapi\n');
      console.log('Últimos pedidos sincronizados:');
      for (const pedido of pedidosEnStrapi.slice(0, 5)) {
        console.log(`   - ${pedido.numero_pedido} - ${pedido.estado} - ${pedido.moneda} ${pedido.total}`);
      }
    }

    console.log('');

  } catch (error) {
    console.log('❌ Error al obtener pedidos de WooCommerce');
    console.log(`   ${error.message}`);
    await app.destroy();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PASO 5: Verificar webhooks
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('PASO 5: Verificando Webhooks en WooCommerce de Moraleja');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const auth = {
      username: wooMoralejaKey,
      password: wooMoralejaSecret,
    };

    const response = await axios.get(`${wooMoralejaUrl}/wp-json/wc/v3/webhooks`, {
      auth,
      params: {
        per_page: 100,
      },
    });

    const webhooks = response.data;
    const orderWebhooks = webhooks.filter(wh => wh.topic.startsWith('order.'));

    console.log(`Total de webhooks configurados: ${webhooks.length}`);
    console.log(`Webhooks de pedidos: ${orderWebhooks.length}\n`);

    if (orderWebhooks.length === 0) {
      console.log('❌ PROBLEMA ENCONTRADO:');
      console.log('   NO hay webhooks de pedidos configurados en WooCommerce de Moraleja.');
      console.log('\n🔧 SOLUCIÓN:');
      console.log('   Configurar webhooks según docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md');
      console.log('   Los webhooks necesarios son:');
      console.log('   - order.created → https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja');
      console.log('   - order.updated → https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja');
      console.log('   - order.deleted → https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja');
    } else {
      console.log('Webhooks de pedidos encontrados:');
      for (const webhook of orderWebhooks) {
        const isCorrect = webhook.delivery_url.includes('/api/woo-webhook/order/woo_moraleja');
        const statusIcon = webhook.status === 'active' ? '✅' : '❌';
        const urlIcon = isCorrect ? '✅' : '⚠️';
        
        console.log(`   ${statusIcon} ${urlIcon} ${webhook.topic} - ${webhook.status}`);
        console.log(`      URL: ${webhook.delivery_url}`);
        
        if (!isCorrect) {
          console.log(`      ⚠️  URL incorrecta. Debería ser: https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`);
        }
      }
      
      const allCorrect = orderWebhooks.every(
        wh => wh.delivery_url.includes('/api/woo-webhook/order/woo_moraleja') && wh.status === 'active'
      );
      
      if (allCorrect) {
        console.log('\n✅ Todos los webhooks están configurados correctamente');
      } else {
        console.log('\n⚠️  Algunos webhooks tienen problemas de configuración');
      }
    }

  } catch (error) {
    console.log('⚠️  No se pudieron obtener los webhooks');
    console.log(`   ${error.message}`);
    console.log('\n   Verifica manualmente en:');
    console.log('   https://staging.moraleja.cl/wp-admin/admin.php?page=wc-settings&tab=advanced&section=webhooks');
  }

  console.log('\n');

  // ═══════════════════════════════════════════════════════════════════
  // RESUMEN
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('RESUMEN');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📋 Próximos pasos recomendados:');
  console.log('   1. Si hay pedidos en WooCommerce pero no en Strapi:');
  console.log('      → Configurar webhooks según la documentación');
  console.log('   2. Crear un pedido de prueba en WooCommerce y verificar logs');
  console.log('   3. Ver logs de Railway para detectar errores');
  console.log('\n📚 Documentación completa:');
  console.log('   docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md\n');

  console.log('═══════════════════════════════════════════════════════');
  console.log('Diagnóstico completado');
  console.log('═══════════════════════════════════════════════════════\n');

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error ejecutando diagnóstico:', error);
  process.exit(1);
});

