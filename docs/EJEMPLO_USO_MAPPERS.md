# Ejemplo de Uso de Mappers

Este documento muestra ejemplos prácticos de cómo usar los servicios de mapeo.

## 📋 Ejemplo 1: Sincronizar un Pedido a WooCommerce

```typescript
// En strapi/src/api/woo-sync/services/woo-sync.ts

async syncOrderFromWoPedido(woPedido: any, platform: 'woo_moraleja' | 'woo_escolar') {
  const wooConfig = this.getWooConfig(platform);
  if (!wooConfig) {
    throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
  }

  // Obtener el servicio de mappers
  const mappers = strapi.service('api::woo-sync.mappers');
  
  // Obtener pedido completo con relaciones
  const woPedidoCompleto = await strapi.entityService.findOne('api::wo-pedido.wo-pedido', woPedido.id, {
    populate: ['items', 'cliente'],
  }) as any;

  // 1. Mapear el pedido principal usando order-mapper
  const wooOrder = await mappers.order.mapWoPedidoToWooOrder(woPedidoCompleto, platform);
  
  // 2. Mapear los items usando line-item-mapper
  wooOrder.line_items = await mappers.lineItem.mapItemsToWooLineItems(
    woPedidoCompleto.items || [],
    platform
  );
  
  // Validar que hay items válidos
  if (wooOrder.line_items.length === 0) {
    throw new Error('No se puede crear/actualizar un pedido sin productos válidos');
  }
  
  // 3. Mapear direcciones usando address-mapper
  if (woPedidoCompleto.billing) {
    wooOrder.billing = mappers.address.mapBillingToWoo(woPedidoCompleto.billing);
  }
  if (woPedidoCompleto.shipping) {
    wooOrder.shipping = mappers.address.mapShippingToWoo(woPedidoCompleto.shipping);
  }
  
  // 4. Mapear cliente (solo el ID)
  if (woPedidoCompleto.cliente) {
    const clienteExtIds = woPedidoCompleto.cliente.externalIds || {};
    const customerId = clienteExtIds[platform];
    
    if (customerId) {
      // Validar que el cliente existe en WooCommerce
      const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
      const customerCheck = await fetch(
        `${wooConfig.url}/wp-json/wc/v3/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (customerCheck.ok) {
        wooOrder.customer_id = parseInt(String(customerId), 10);
      } else {
        strapi.log.warn(`[woo-sync] Customer ID ${customerId} no existe en WooCommerce`);
      }
    }
  }
  
  // 5. Enviar a WooCommerce
  const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
  const externalIds = (woPedido.externalIds || {}) as Record<string, unknown>;
  const wooId = woPedido.wooId || externalIds[platform];
  
  let result;
  if (wooId) {
    // Actualizar pedido existente
    const response = await fetch(
      `${wooConfig.url}/wp-json/wc/v3/orders/${wooId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wooOrder),
      }
    );
    result = await response.json();
  } else {
    // Crear nuevo pedido
    const response = await fetch(
      `${wooConfig.url}/wp-json/wc/v3/orders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wooOrder),
      }
    );
    result = await response.json();
    
    // Guardar externalId
    if (result.id) {
      await strapi.entityService.update('api::wo-pedido.wo-pedido', woPedido.id, {
        data: {
          externalIds: { ...externalIds, [platform]: result.id },
          wooId: result.id,
        },
      });
    }
  }
  
  return result;
}
```

## 📋 Ejemplo 2: Sincronizar un Producto (Libro) a WooCommerce

```typescript
async syncProduct(libro: any, platform: 'woo_moraleja' | 'woo_escolar') {
  const wooConfig = this.getWooConfig(platform);
  if (!wooConfig) {
    throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
  }

  // Obtener mappers
  const mappers = strapi.service('api::woo-sync.mappers');
  
  // Obtener libro completo con relaciones
  const libroCompleto = await strapi.entityService.findOne('api::libro.libro', libro.id, {
    populate: ['autor_relacion', 'editorial', 'marcas', 'etiquetas', 'categorias_producto', 'precios'],
  }) as any;
  
  // Mapear libro a producto de WooCommerce
  const wooProduct = await mappers.product.mapLibroToWooProduct(libroCompleto, platform);
  
  // Agregar categorías, tags, atributos (usar otros servicios si es necesario)
  // ... lógica adicional ...
  
  // Enviar a WooCommerce
  const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
  const externalIds = libroCompleto.externalIds || {};
  const wooId = externalIds[platform];
  
  let result;
  if (wooId) {
    // Actualizar
    const response = await fetch(
      `${wooConfig.url}/wp-json/wc/v3/products/${wooId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wooProduct),
      }
    );
    result = await response.json();
  } else {
    // Crear
    const response = await fetch(
      `${wooConfig.url}/wp-json/wc/v3/products`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wooProduct),
      }
    );
    result = await response.json();
    
    // Guardar externalId
    if (result.id) {
      await strapi.entityService.update('api::libro.libro', libro.id, {
        data: {
          externalIds: { ...externalIds, [platform]: result.id },
        },
      });
    }
  }
  
  return result;
}
```

## 📋 Ejemplo 3: Procesar un Webhook de WooCommerce

```typescript
// En strapi/src/api/woo-webhook/services/woo-webhook.ts

async syncOrder(wooOrder: any, platform: 'woo_moraleja' | 'woo_escolar') {
  // Obtener mappers
  const mappers = strapi.service('api::woo-sync.mappers');
  
  // 1. Mapear order de WooCommerce a wo-pedido
  const woPedidoData = mappers.order.mapWooOrderToWoPedido(wooOrder, platform);
  
  // 2. Mapear line_items a items
  if (wooOrder.line_items && Array.isArray(wooOrder.line_items)) {
    woPedidoData.items = mappers.lineItem.mapWooLineItemsToItems(wooOrder.line_items, platform);
  }
  
  // 3. Mapear direcciones
  if (wooOrder.billing) {
    woPedidoData.billing = mappers.address.mapWooBillingToStrapi(wooOrder.billing);
  }
  if (wooOrder.shipping) {
    woPedidoData.shipping = mappers.address.mapWooShippingToStrapi(wooOrder.shipping);
  }
  
  // 4. Mapear cliente si existe
  if (wooOrder.customer_id) {
    // Buscar o crear cliente
    // ...
  }
  
  // 5. Crear/actualizar pedido en Strapi
  const existingPedido = await strapi.entityService.findMany('api::wo-pedido.wo-pedido', {
    filters: {
      numero_pedido: woPedidoData.numero_pedido,
    },
  }) as any[];
  
  if (existingPedido.length > 0) {
    // Actualizar
    await strapi.entityService.update('api::wo-pedido.wo-pedido', existingPedido[0].id, {
      data: {
        ...woPedidoData,
        skipWooSync: true, // Evitar bucle
      },
    });
  } else {
    // Crear
    await strapi.entityService.create('api::wo-pedido.wo-pedido', {
      data: {
        ...woPedidoData,
        skipWooSync: true, // Evitar bucle
      },
    });
  }
}
```

## 📋 Ejemplo 4: Usar Mappers en Scripts

```typescript
// En scripts/test-mapeo-pedido.mjs

import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_KEY = process.env.STRAPI_API_KEY;

async function testMappers() {
  // Obtener un pedido de prueba
  const response = await fetch(`${STRAPI_URL}/api/wo-pedidos/1?populate=*`, {
    headers: {
      'Authorization': `Bearer ${STRAPI_API_KEY}`,
    },
  });
  const pedido = await response.json();
  
  // Llamar al servicio de mappers (esto requiere acceso a Strapi internamente)
  // En un script externo, podrías crear una ruta API que use los mappers
  console.log('Pedido:', pedido);
  
  // O usar los mappers directamente si tienes acceso a strapi
  // const mappers = strapi.service('api::woo-sync.mappers');
  // const wooOrder = await mappers.order.mapWoPedidoToWooOrder(pedido.data, 'woo_moraleja');
  // console.log('WooCommerce Order:', wooOrder);
}
```

## 🔧 Acceso a los Mappers

Los mappers están disponibles como un servicio de Strapi:

```typescript
// En cualquier servicio, controller, o lifecycle
const mappers = strapi.service('api::woo-sync.mappers');

// Usar los mappers
const wooProduct = await mappers.product.mapLibroToWooProduct(libro, 'woo_moraleja');
const wooOrder = await mappers.order.mapWoPedidoToWooOrder(pedido, 'woo_moraleja');
const lineItems = await mappers.lineItem.mapItemsToWooLineItems(items, 'woo_moraleja');
const billing = mappers.address.mapBillingToWoo(pedido.billing);
const customer = mappers.customer.mapWoClienteToWooCustomer(cliente, 'woo_moraleja');
```

## ✅ Ventajas de Usar Mappers

1. **Código más limpio**: No mezclas lógica de mapeo con lógica de negocio
2. **Fácil de testear**: Puedes probar cada mapper independientemente
3. **Reutilizable**: Los mismos mappers se usan en diferentes contextos
4. **Mantenible**: Cambios en el mapeo están centralizados
5. **Documentado**: Cada mapper tiene una responsabilidad clara
