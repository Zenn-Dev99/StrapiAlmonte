# 🗺️ Guía: Mapear WooCommerce desde Entorno Local

## ✅ Respuesta Corta

**SÍ, puedes mapear WooCommerce desde tu entorno local** sin tocar producción. El sistema de mappers está completamente implementado y funciona desde local.

## 🔧 Configuración Necesaria

### 1. Agregar Credenciales de WooCommerce al `.env`

Edita `strapi/.env` y descomenta/agrega las variables:

```env
# Tienda Moraleja
WOO_MORALEJA_URL=https://moraleja.cl
WOO_MORALEJA_CONSUMER_KEY=ck_tu_consumer_key_aqui
WOO_MORALEJA_CONSUMER_SECRET=cs_tu_consumer_secret_aqui

# Tienda Librería Escolar
WOO_ESCOLAR_URL=https://libreriaescolar.cl
WOO_ESCOLAR_CONSUMER_KEY=ck_tu_consumer_key_aqui
WOO_ESCOLAR_CONSUMER_SECRET=cs_tu_consumer_secret_aqui
```

### 2. Obtener las Credenciales de WooCommerce

1. Ve al admin de WooCommerce (Moraleja o Escolar)
2. **WooCommerce → Configuración → Avanzado → REST API**
3. Crea una nueva clave API con permisos de **Lectura/Escritura**
4. Copia el **Consumer Key** y **Consumer Secret**

## 🧪 Verificar Conexión

Antes de mapear, verifica que la conexión funcione:

```bash
cd strapi

# Probar conexión con Moraleja
npm run woo:test:moraleja

# Probar conexión con Escolar
npm run woo:test:escolar

# Verificar configuración general
npm run woo:config
```

## 🗺️ Cómo Funciona el Mapeo

El sistema tiene **mappers modulares** que transforman datos entre Strapi y WooCommerce:

### Mappers Disponibles:

1. **Product Mapper** - Mapea libros (Strapi) ↔ productos (WooCommerce)
2. **Order Mapper** - Mapea pedidos (wo-pedido) ↔ orders (WooCommerce)
3. **Line Item Mapper** - Mapea items de pedidos
4. **Address Mapper** - Mapea direcciones (billing/shipping)
5. **Customer Mapper** - Mapea clientes (wo-cliente) ↔ customers (WooCommerce)

### Ubicación de los Mappers:

```
strapi/src/api/woo-sync/services/mappers/
├── product-mapper.ts
├── order-mapper.ts
├── line-item-mapper.ts
├── address-mapper.ts
└── customer-mapper.ts
```

## 📝 Ejemplos de Uso

### 1. Mapear un Producto (Libro) a WooCommerce

```typescript
// En un controller o service de Strapi
const mappers = strapi.service('api::woo-sync.mappers');
const libro = await strapi.entityService.findOne('api::libro.libro', libroId);

// Mapear a formato WooCommerce
const wooProduct = await mappers.product.mapLibroToWooProduct(
  libro, 
  'woo_moraleja' // o 'woo_escolar'
);
```

### 2. Mapear un Pedido a WooCommerce

```typescript
const mappers = strapi.service('api::woo-sync.mappers');
const woPedido = await strapi.entityService.findOne('api::wo-pedido.wo-pedido', pedidoId, {
  populate: ['items', 'cliente', 'billing', 'shipping']
});

// Mapear pedido completo
const wooOrder = await mappers.order.mapWoPedidoToWooOrder(woPedido, 'woo_moraleja');
```

### 3. Usar el Servicio de Sincronización

```typescript
const wooSync = strapi.service('api::woo-sync.woo-sync');

// Sincronizar un producto
await wooSync.syncProduct(libroId, 'woo_moraleja');

// Sincronizar un pedido
await wooSync.syncOrder(woPedidoId, 'woo_moraleja');
```

## 🛠️ Scripts Disponibles

```bash
# Configurar y verificar WooCommerce
npm run woo:config

# Probar conexión con tiendas
npm run woo:test:moraleja
npm run woo:test:escolar

# Verificar mapeo
npm run woo:verify
npm run woo:verify:all

# Ver instrucciones
npm run woo:instructions
```

## ⚠️ Importante: Seguridad

### ✅ Lo que SÍ puedes hacer desde local:

- **Leer** datos de WooCommerce (productos, pedidos, clientes)
- **Mapear** datos entre Strapi y WooCommerce
- **Probar** cambios en mappers sin afectar producción
- **Sincronizar** datos desde tu Strapi local hacia WooCommerce

### ⚠️ Lo que debes tener en cuenta:

- **Los cambios SÍ se aplican en WooCommerce** si usas las credenciales de producción
- Si quieres probar sin modificar producción, usa un **entorno de staging** de WooCommerce
- Las credenciales de WooCommerce tienen los permisos que les asignaste (lectura/escritura)

### 🔒 Recomendación:

Si quieres probar mapeos sin riesgo:
1. Crea credenciales de API en un **entorno de staging/test** de WooCommerce
2. Usa esas credenciales en tu `.env` local
3. Así puedes probar sin afectar producción

## 📚 Documentación Adicional

- [Estructura de Mappers](./docs/ESTRUCTURA_MAPPERS_WOOCOMMERCE.md)
- [Ejemplo de Uso de Mappers](./docs/EJEMPLO_USO_MAPPERS.md)
- [Análisis de Arquitectura](./docs/ANALISIS_ARQUITECTURA_STRAPI_WOOCOMMERCE.md)

## 🎯 Resumen

1. ✅ **Sí puedes mapear WooCommerce desde local**
2. ✅ **Configura las credenciales en `.env`**
3. ✅ **Verifica la conexión con `npm run woo:test:moraleja`**
4. ✅ **Usa los mappers para transformar datos**
5. ⚠️ **Ten cuidado con los cambios - se aplican en WooCommerce si usas credenciales de producción**

---

**¡Listo para mapear! 🚀**


