#!/usr/bin/env node

/**
 * Script para importar pedidos existentes de WooCommerce de Moraleja a Strapi
 * 
 * Uso:
 *   node scripts/importar-pedidos-moraleja.mjs [limit]
 * 
 * Ejemplos:
 *   node scripts/importar-pedidos-moraleja.mjs        # Importar últimos 10 pedidos
 *   node scripts/importar-pedidos-moraleja.mjs 50     # Importar últimos 50 pedidos
 *   node scripts/importar-pedidos-moraleja.mjs all    # Importar TODOS los pedidos
 */

import Strapi from '@strapi/strapi';
import axios from 'axios';

async function main() {
  const limit = process.argv[2] === 'all' ? 999999 : parseInt(process.argv[2]) || 10;

  console.log('═══════════════════════════════════════════════════════');
  console.log('📥 IMPORTACIÓN DE PEDIDOS DE MORALEJA');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Límite: ${limit === 999999 ? 'TODOS' : limit} pedidos\n`);

  // Verificar variables de entorno
  const wooMoralejaUrl = process.env.WOO_MORALEJA_URL;
  const wooMoralejaKey = process.env.WOO_MORALEJA_CONSUMER_KEY;
  const wooMoralejaSecret = process.env.WOO_MORALEJA_CONSUMER_SECRET;

  if (!wooMoralejaUrl || !wooMoralejaKey || !wooMoralejaSecret) {
    console.error('❌ Variables de entorno no configuradas');
    console.error('   Necesitas configurar:');
    console.error('   - WOO_MORALEJA_URL');
    console.error('   - WOO_MORALEJA_CONSUMER_KEY');
    console.error('   - WOO_MORALEJA_CONSUMER_SECRET');
    process.exit(1);
  }

  // Iniciar Strapi
  console.log('📦 Iniciando Strapi...');
  const appContext = await Strapi().load();
  const app = appContext.container;
  console.log('✅ Strapi iniciado\n');

  try {
    const auth = {
      username: wooMoralejaKey,
      password: wooMoralejaSecret,
    };

    console.log('🔍 Obteniendo pedidos de WooCommerce de Moraleja...');
    
    let allOrders = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await axios.get(`${wooMoralejaUrl}/wp-json/wc/v3/orders`, {
        auth,
        params: {
          per_page: perPage,
          page,
          orderby: 'date',
          order: 'desc',
        },
      });

      const orders = response.data;
      allOrders = allOrders.concat(orders);

      console.log(`   Página ${page}: ${orders.length} pedidos`);

      if (orders.length < perPage || allOrders.length >= limit) {
        break;
      }

      page++;
    }

    // Aplicar límite
    allOrders = allOrders.slice(0, limit);

    console.log(`\n✅ Total de pedidos obtenidos: ${allOrders.length}\n`);

    if (allOrders.length === 0) {
      console.log('⚠️  No hay pedidos para importar');
      await app.destroy();
      process.exit(0);
    }

    console.log('📥 Importando pedidos a Strapi...\n');

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < allOrders.length; i++) {
      const order = allOrders[i];
      const progress = `[${i + 1}/${allOrders.length}]`;

      try {
        // Verificar si el pedido ya existe
        const existingPedidos = await app.entityService.findMany('api::pedido.pedido', {
          filters: {
            $or: [
              { woocommerce_id: String(order.id) },
              { numero_pedido: String(order.number || order.id) },
            ],
          },
          limit: 1,
        });

        if (existingPedidos.length > 0) {
          console.log(`${progress} ⏭️  Pedido #${order.number} ya existe (Strapi ID: ${existingPedidos[0].id})`);
          skipped++;
          continue;
        }

        // Sincronizar usando el servicio de woo-webhook
        const wooWebhookService = app.service('api::woo-webhook.woo-webhook');
        await wooWebhookService.syncOrder(order, 'woo_moraleja');

        console.log(`${progress} ✅ Pedido #${order.number} importado (WooCommerce ID: ${order.id})`);
        imported++;

      } catch (error) {
        console.error(`${progress} ❌ Error importando pedido #${order.number}:`, error.message);
        errors++;
      }
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('RESUMEN DE IMPORTACIÓN');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`✅ Importados: ${imported}`);
    console.log(`⏭️  Omitidos (ya existían): ${skipped}`);
    console.log(`❌ Errores: ${errors}`);
    console.log(`📊 Total procesados: ${allOrders.length}\n`);

    if (imported > 0) {
      console.log('🎉 Importación completada exitosamente');
      console.log('   Puedes ver los pedidos en Strapi Admin → Content Manager → Pedido\n');
    }

  } catch (error) {
    console.error('❌ Error durante la importación:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    await app.destroy();
    process.exit(1);
  }

  await app.destroy();
  console.log('═══════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error ejecutando importación:', error);
  process.exit(1);
});

