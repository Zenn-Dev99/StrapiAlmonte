# 🔗 Configuración de Webhooks WooCommerce → Strapi

Esta guía explica cómo configurar los webhooks en WooCommerce para que los cambios se sincronicen automáticamente a Strapi local.

## 📋 Resumen

Cuando crees o actualices un **pedido**, **cupón**, **cliente** o **libro** en WooCommerce, se sincronizará automáticamente a Strapi usando los mappers mejorados.

## 🔧 Configuración en WooCommerce

### 1. Acceder a la Configuración de Webhooks

1. En WooCommerce, ve a **WooCommerce → Configuración → Avanzado → Webhooks**
2. Haz clic en **Añadir webhook**

### 2. Configurar Webhook para Productos (Libros)

**Configuración:**
- **Nombre**: `Strapi - Sincronizar Productos (Local)`
- **Estado**: ✅ Activo
- **Tema**: `Producto`
- **Evento**: 
  - ✅ `product.created` (cuando se crea un producto)
  - ✅ `product.updated` (cuando se actualiza un producto)
  - ✅ `product.deleted` (cuando se elimina un producto)
- **URL de entrega**: 
  ```
  http://localhost:1337/api/woo-webhook/product/woo_moraleja
  ```
  O para Escolar:
  ```
  http://localhost:1337/api/woo-webhook/product/woo_escolar
  ```
- **Secreto**: (opcional, para producción)
- **Versión de API**: `WP REST API Integration v3`

### 3. Configurar Webhook para Clientes

**Configuración:**
- **Nombre**: `Strapi - Sincronizar Clientes (Local)`
- **Estado**: ✅ Activo
- **Tema**: `Cliente`
- **Evento**: 
  - ✅ `customer.created`
  - ✅ `customer.updated`
  - ✅ `customer.deleted`
- **URL de entrega**: 
  ```
  http://localhost:1337/api/woo-webhook/customer/woo_moraleja
  ```
  O para Escolar:
  ```
  http://localhost:1337/api/woo-webhook/customer/woo_escolar
  ```

### 4. Configurar Webhook para Cupones

**Configuración:**
- **Nombre**: `Strapi - Sincronizar Cupones (Local)`
- **Estado**: ✅ Activo
- **Tema**: `Cupón`
- **Evento**: 
  - ✅ `coupon.created`
  - ✅ `coupon.updated`
  - ✅ `coupon.deleted`
- **URL de entrega**: 
  ```
  http://localhost:1337/api/woo-webhook/coupon/woo_moraleja
  ```
  O para Escolar:
  ```
  http://localhost:1337/api/woo-webhook/coupon/woo_escolar
  ```

### 5. Configurar Webhook para Pedidos

**Configuración:**
- **Nombre**: `Strapi - Sincronizar Pedidos (Local)`
- **Estado**: ✅ Activo
- **Tema**: `Pedido`
- **Evento**: 
  - ✅ `order.created`
  - ✅ `order.updated`
  - ✅ `order.deleted`
- **URL de entrega**: 
  ```
  http://localhost:1337/api/woo-webhook/order/woo_moraleja
  ```
  O para Escolar:
  ```
  http://localhost:1337/api/woo-webhook/order/woo_escolar
  ```

## 🧪 Probar los Webhooks

### Prueba 1: Crear un Producto (Libro)

1. En WooCommerce, ve a **Productos → Añadir nuevo**
2. Crea un producto con:
   - **Nombre**: "Libro de Prueba"
   - **SKU**: "978-1234567890" (ISBN)
   - **Precio**: 10000
3. Guarda el producto
4. **Verifica en Strapi**: Ve a **Content Manager → Libro** y busca el libro por ISBN

### Prueba 2: Crear un Cliente

1. En WooCommerce, ve a **Clientes → Añadir nuevo**
2. Crea un cliente con:
   - **Email**: "test@example.com"
   - **Nombre**: "Juan"
   - **Apellido**: "Pérez"
3. Guarda el cliente
4. **Verifica en Strapi**: Ve a **Content Manager → WO-Clientes** y busca por email

### Prueba 3: Crear un Cupón

1. En WooCommerce, ve a **Cupones → Añadir nuevo**
2. Crea un cupón con:
   - **Código**: "PRUEBA10"
   - **Tipo de descuento**: "Porcentaje"
   - **Importe**: 10
3. Guarda el cupón
4. **Verifica en Strapi**: Ve a **Content Manager → WO-Cupones** y busca por código

### Prueba 4: Crear un Pedido

1. En WooCommerce, crea un pedido manualmente o completa un checkout
2. **Verifica en Strapi**: Ve a **Content Manager → WO-Pedidos** y busca el pedido por número

## 📊 Verificar Logs

Los webhooks registran toda la actividad. Para ver los logs:

1. En Strapi, revisa la consola donde está corriendo el servidor
2. Busca mensajes que empiecen con `[woo-webhook]`
3. Deberías ver mensajes como:
   ```
   [woo-webhook] ⚡ Endpoint product alcanzado
   [woo-webhook] Producto extraído desde woo_moraleja
   [woo-webhook] Libro creado: 123 (WooCommerce ID: 456)
   ```

## 🔍 Solución de Problemas

### El webhook no se está recibiendo

1. **Verifica que Strapi esté corriendo** en `http://localhost:1337`
2. **Verifica la URL del webhook** en WooCommerce (debe coincidir exactamente)
3. **Revisa los logs de Strapi** para ver si llega el request
4. **Prueba manualmente** haciendo un POST a la URL con Postman o curl:
   ```bash
   curl -X POST http://localhost:1337/api/woo-webhook/product/woo_moraleja \
     -H "Content-Type: application/json" \
     -d '{"id": 123, "name": "Test", "sku": "TEST123"}'
   ```

### El webhook llega pero no se crea el registro

1. **Revisa los logs de Strapi** para ver el error específico
2. **Verifica que el mapper esté funcionando** correctamente
3. **Verifica que los campos requeridos** estén presentes (ej: ISBN para libros)

### Error 404 en el webhook

1. **Verifica que la ruta sea correcta**: `/api/woo-webhook/product/woo_moraleja`
2. **Verifica que el parámetro `platform`** sea `woo_moraleja` o `woo_escolar`
3. **Verifica que el servidor de Strapi** esté corriendo

## 🌐 Para Producción (Railway)

Cuando despliegues a producción, cambia las URLs a:

```
https://tu-dominio.railway.app/api/woo-webhook/product/woo_moraleja
https://tu-dominio.railway.app/api/woo-webhook/customer/woo_moraleja
https://tu-dominio.railway.app/api/woo-webhook/coupon/woo_moraleja
https://tu-dominio.railway.app/api/woo-webhook/order/woo_moraleja
```

## ✅ Checklist de Configuración

- [ ] Webhook de productos configurado y activo
- [ ] Webhook de clientes configurado y activo
- [ ] Webhook de cupones configurado y activo
- [ ] Webhook de pedidos configurado y activo
- [ ] Probado crear un producto y verificar en Strapi
- [ ] Probado crear un cliente y verificar en Strapi
- [ ] Probado crear un cupón y verificar en Strapi
- [ ] Probado crear un pedido y verificar en Strapi
- [ ] Logs de Strapi muestran actividad de webhooks

## 📝 Notas Importantes

1. **Los mappers mejorados** ahora mapean TODOS los campos disponibles
2. **Los campos estáticos están protegidos**: 
   - `isbn_libro` en libros
   - `correo_electronico` en clientes
   - `codigo` en cupones
   - `numero_pedido` en pedidos
3. **Los datos raw** se guardan en `rawWooData` para trazabilidad
4. **Los externalIds** se actualizan automáticamente para mantener la relación

