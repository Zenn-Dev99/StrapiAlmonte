# Estructura de Mappers para WooCommerce

Este documento explica la estructura modular de servicios de mapeo para la sincronización entre Strapi y WooCommerce.

## 📁 Estructura de Archivos

```
strapi/src/api/woo-sync/services/
├── woo-sync.ts              # Servicio principal (orquestación)
└── mappers/
    ├── index.ts             # Exporta todos los mappers
    ├── product-mapper.ts    # Mapeo de productos (libros)
    ├── order-mapper.ts      # Mapeo de pedidos
    ├── line-item-mapper.ts  # Mapeo de items de pedidos
    ├── address-mapper.ts    # Mapeo de direcciones (billing/shipping)
    └── customer-mapper.ts   # Mapeo de clientes
```

## 🎯 Propósito

Cada mapper es responsable de transformar datos entre los formatos de Strapi y WooCommerce para una entidad específica. Esto permite:

- **Separación de responsabilidades**: Cada mapper se enfoca en una sola entidad
- **Mantenibilidad**: Fácil de encontrar y modificar lógica de mapeo específica
- **Testabilidad**: Cada mapper se puede probar independientemente
- **Reutilización**: Los mappers se pueden usar en diferentes contextos

## 📦 Mappers Disponibles

### 1. Product Mapper (`product-mapper.ts`)

**Responsabilidad**: Mapear libros (Strapi) ↔ productos (WooCommerce)

**Métodos principales**:
- `mapLibroToWooProduct(libro, platform)`: Convierte libro de Strapi a formato WooCommerce
- `mapWooProductToLibro(wooProduct, platform)`: Convierte producto de WooCommerce a formato Strapi
- `findActivePrice(precios)`: Encuentra el precio activo y vigente

**Ejemplo de uso**:
```typescript
const mappers = strapi.service('api::woo-sync.mappers');
const wooProduct = await mappers.product.mapLibroToWooProduct(libro, 'woo_moraleja');
```

### 2. Order Mapper (`order-mapper.ts`)

**Responsabilidad**: Mapear pedidos (wo-pedido) ↔ orders (WooCommerce)

**Métodos principales**:
- `mapWoPedidoToWooOrder(woPedido, platform)`: Convierte wo-pedido a formato WooCommerce
- `mapWooOrderToWoPedido(wooOrder, platform)`: Convierte order de WooCommerce a formato Strapi
- `normalizeOrderStatus(status)`: Normaliza estados de pedido a valores válidos de WooCommerce

**Ejemplo de uso**:
```typescript
const mappers = strapi.service('api::woo-sync.mappers');
const wooOrder = await mappers.order.mapWoPedidoToWooOrder(woPedido, 'woo_moraleja');
```

### 3. Line Item Mapper (`line-item-mapper.ts`)

**Responsabilidad**: Mapear items de pedidos ↔ line_items (WooCommerce)

**Métodos principales**:
- `mapItemToWooLineItem(item, platform)`: Convierte item de Strapi a line_item de WooCommerce
- `mapItemsToWooLineItems(items, platform)`: Convierte múltiples items
- `mapWooLineItemToItem(wooLineItem, platform)`: Convierte line_item de WooCommerce a item de Strapi
- `mapWooLineItemsToItems(wooLineItems, platform)`: Convierte múltiples line_items

**Ejemplo de uso**:
```typescript
const mappers = strapi.service('api::woo-sync.mappers');
const lineItems = await mappers.lineItem.mapItemsToWooLineItems(pedido.items, 'woo_moraleja');
```

### 4. Address Mapper (`address-mapper.ts`)

**Responsabilidad**: Mapear direcciones (billing/shipping) entre Strapi y WooCommerce

**Métodos principales**:
- `mapBillingToWoo(billing)`: Convierte billing de Strapi a WooCommerce
- `mapShippingToWoo(shipping)`: Convierte shipping de Strapi a WooCommerce
- `mapWooBillingToStrapi(wooBilling)`: Convierte billing de WooCommerce a Strapi
- `mapWooShippingToStrapi(wooShipping)`: Convierte shipping de WooCommerce a Strapi
- `normalizeAddress(address, type)`: Normaliza direcciones asegurando formato correcto

**Ejemplo de uso**:
```typescript
const mappers = strapi.service('api::woo-sync.mappers');
const wooBilling = mappers.address.mapBillingToWoo(pedido.billing);
```

### 5. Customer Mapper (`customer-mapper.ts`)

**Responsabilidad**: Mapear clientes (wo-cliente) ↔ customers (WooCommerce)

**Métodos principales**:
- `mapWoClienteToWooCustomer(woCliente, platform)`: Convierte wo-cliente a formato WooCommerce
- `mapWooCustomerToWoCliente(wooCustomer, platform)`: Convierte customer de WooCommerce a formato Strapi

**Ejemplo de uso**:
```typescript
const mappers = strapi.service('api::woo-sync.mappers');
const wooCustomer = mappers.customer.mapWoClienteToWooCustomer(cliente, 'woo_moraleja');
```

## 🔄 Cómo Usar los Mappers en el Servicio Principal

### Ejemplo: Refactorizar `syncOrderFromWoPedido`

**Antes** (código mezclado):
```typescript
async syncOrderFromWoPedido(woPedido: any, platform: 'woo_moraleja' | 'woo_escolar') {
  // ... código de configuración ...
  
  // Construir line_items manualmente
  const lineItems: any[] = [];
  for (const item of woPedidoCompleto.items) {
    // ... lógica compleja de mapeo ...
  }
  
  // Construir payload manualmente
  const orderPayload: any = {
    status: this.normalizeOrderStatus(woPedido.estado),
    total: String(woPedido.total),
    // ... más campos ...
  };
  
  // Mapear billing/shipping manualmente
  if (woPedido.billing) {
    orderPayload.billing = {
      first_name: woPedido.billing.first_name || '',
      // ... más campos ...
    };
  }
}
```

**Después** (usando mappers):
```typescript
async syncOrderFromWoPedido(woPedido: any, platform: 'woo_moraleja' | 'woo_escolar') {
  const wooConfig = this.getWooConfig(platform);
  if (!wooConfig) {
    throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
  }

  // Obtener mappers
  const mappers = strapi.service('api::woo-sync.mappers');
  
  // Obtener pedido completo
  const woPedidoCompleto = await strapi.entityService.findOne('api::wo-pedido.wo-pedido', woPedido.id, {
    populate: ['items', 'cliente'],
  }) as any;

  // Usar mappers para construir el payload
  const wooOrder = await mappers.order.mapWoPedidoToWooOrder(woPedidoCompleto, platform);
  
  // Mapear line items
  wooOrder.line_items = await mappers.lineItem.mapItemsToWooLineItems(
    woPedidoCompleto.items || [],
    platform
  );
  
  // Mapear direcciones
  if (woPedidoCompleto.billing) {
    wooOrder.billing = mappers.address.mapBillingToWoo(woPedidoCompleto.billing);
  }
  if (woPedidoCompleto.shipping) {
    wooOrder.shipping = mappers.address.mapShippingToWoo(woPedidoCompleto.shipping);
  }
  
  // Mapear cliente
  if (woPedidoCompleto.cliente) {
    wooOrder.customer_id = woPedidoCompleto.cliente.externalIds?.[platform] || null;
  }
  
  // Enviar a WooCommerce
  // ... resto de la lógica de envío ...
}
```

## ✅ Ventajas de esta Estructura

1. **Código más limpio**: El servicio principal se enfoca en orquestación, no en detalles de mapeo
2. **Fácil de testear**: Cada mapper se puede probar independientemente
3. **Fácil de mantener**: Cambios en el mapeo de una entidad no afectan otras
4. **Reutilizable**: Los mappers se pueden usar en webhooks, scripts, etc.
5. **Documentado**: Cada mapper tiene una responsabilidad clara

## 🚀 Próximos Pasos

1. **Refactorizar el servicio principal** para usar los mappers
2. **Agregar tests unitarios** para cada mapper
3. **Crear mappers adicionales** si es necesario (ej: taxonomías, atributos)
4. **Documentar casos especiales** y edge cases en cada mapper

## 📝 Notas

- Los mappers son servicios de Strapi, por lo que tienen acceso a `strapi` para consultas a la BD si es necesario
- Cada mapper debe ser idempotente: el mismo input debe producir el mismo output
- Los mappers deben manejar casos donde los datos pueden estar incompletos o en diferentes formatos
