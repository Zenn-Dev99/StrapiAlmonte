# 🔄 Configuración Bidireccional Moraleja ↔ Strapi

## 📋 **PROBLEMA IDENTIFICADO**

Los pedidos NO se están sincronizando bidireccional con **https://staging.moraleja.cl/**  
✅ Solo funciona con **Librería Escolar**  
❌ No funciona con **Moraleja**

---

## 🔧 **SOLUCIÓN: Configurar Variables de Entorno + Webhooks**

### **PASO 1: Verificar Variables de Entorno en Railway**

#### **1.1 - Ir a Railway**
1. Abrir: https://railway.app/
2. Seleccionar el proyecto de **Strapi**
3. Ir a la pestaña **"Variables"**

#### **1.2 - Verificar que EXISTAN estas variables:**

```bash
# ═══════════════════════════════════════════════════════
# WooCommerce - Moraleja (staging.moraleja.cl)
# ═══════════════════════════════════════════════════════
WOO_MORALEJA_URL=https://staging.moraleja.cl
WOO_MORALEJA_CONSUMER_KEY=ck_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
WOO_MORALEJA_CONSUMER_SECRET=cs_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ═══════════════════════════════════════════════════════
# WooCommerce - Librería Escolar (escolar.moraleja.cl)
# ═══════════════════════════════════════════════════════
WOO_ESCOLAR_URL=https://escolar.moraleja.cl
WOO_ESCOLAR_CONSUMER_KEY=ck_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
WOO_ESCOLAR_CONSUMER_SECRET=cs_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

#### **1.3 - Si NO EXISTEN, hay que crearlas:**

**¿Cómo obtener las credenciales de WooCommerce?**

1. **Ir a WordPress de Moraleja:**
   - URL: https://staging.moraleja.cl/wp-admin
   - Login con credenciales de administrador

2. **WooCommerce → Settings → Advanced → REST API**

3. **Click en "Add key"**
   - **Description:** `Strapi Integration`
   - **User:** Selecciona tu usuario admin
   - **Permissions:** `Read/Write`

4. **Click "Generate API key"**
   - Copiar el **Consumer key** (ck_...)
   - Copiar el **Consumer secret** (cs_...)
   - ⚠️ **IMPORTANTE:** Guardar en lugar seguro, no se vuelven a mostrar

5. **Agregar en Railway:**
   - Variables → New Variable
   - Agregar cada una de las variables mencionadas arriba

6. **Redeploy:**
   - Railway detectará los cambios y redesplegará automáticamente
   - O forzar redeploy desde el botón "Deploy"

---

### **PASO 2: Configurar Webhooks en WooCommerce de Moraleja**

Para que los cambios en **WooCommerce de Moraleja** se sincronicen **automáticamente a Strapi**, necesitamos configurar webhooks.

#### **2.1 - Ir a WooCommerce de Moraleja**
1. https://staging.moraleja.cl/wp-admin
2. **WooCommerce → Settings → Advanced → Webhooks**

#### **2.2 - Crear Webhook para PRODUCTOS**
1. **Click en "Add webhook"**
2. Configurar:
   ```
   Name: Strapi Sync - Product Created
   Status: Active
   Topic: Product created
   Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/product/woo_moraleja
   Secret: (dejar vacío o poner un secreto opcional)
   API Version: WP REST API Integration v3
   ```
3. **Save webhook**

4. **Repetir para los demás eventos:**
   - **Product updated:**  
     `Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/product/woo_moraleja`
   
   - **Product deleted:**  
     `Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/product/woo_moraleja`

#### **2.3 - Crear Webhook para PEDIDOS**
1. **Click en "Add webhook"**
2. Configurar:
   ```
   Name: Strapi Sync - Order Created
   Status: Active
   Topic: Order created
   Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja
   Secret: (dejar vacío)
   API Version: WP REST API Integration v3
   ```
3. **Save webhook**

4. **Repetir para los demás eventos:**
   - **Order updated:**  
     `Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`
   
   - **Order deleted:**  
     `Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`

#### **2.4 - Crear Webhook para CUPONES (opcional)**
Si usas cupones:
1. **Click en "Add webhook"**
2. Configurar:
   ```
   Name: Strapi Sync - Coupon Created
   Status: Active
   Topic: Coupon created
   Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/coupon/woo_moraleja
   Secret: (dejar vacío)
   API Version: WP REST API Integration v3
   ```
3. **Repetir para coupon updated y deleted**

#### **2.5 - Crear Webhook para CLIENTES (opcional)**
Si sincronizas clientes:
1. **Click en "Add webhook"**
2. Configurar:
   ```
   Name: Strapi Sync - Customer Created
   Status: Active
   Topic: Customer created
   Delivery URL: https://strapi.moraleja.cl/api/woo-webhook/customer/woo_moraleja
   Secret: (dejar vacío)
   API Version: WP REST API Integration v3
   ```
3. **Repetir para customer updated y deleted**

---

### **PASO 3: Verificar que las Rutas están Activas en Strapi**

Las rutas ya están implementadas en el código. Puedes verificar en los logs de Railway:

```bash
# Productos
POST /api/woo-webhook/product/woo_moraleja
PUT /api/woo-webhook/product/woo_moraleja
DELETE /api/woo-webhook/product/:id/woo_moraleja

# Pedidos
POST /api/woo-webhook/order/woo_moraleja
PUT /api/woo-webhook/order/woo_moraleja
DELETE /api/woo-webhook/order/:id/woo_moraleja

# Cupones
POST /api/woo-webhook/coupon/woo_moraleja
PUT /api/woo-webhook/coupon/woo_moraleja
DELETE /api/woo-webhook/coupon/:id/woo_moraleja

# Clientes
POST /api/woo-webhook/customer/woo_moraleja
PUT /api/woo-webhook/customer/woo_moraleja
DELETE /api/woo-webhook/customer/:id/woo_moraleja
```

---

## 🧪 **PRUEBAS DE SINCRONIZACIÓN**

### **Prueba 1: Crear un Pedido en WooCommerce de Moraleja**

1. **Ir a:** https://staging.moraleja.cl/wp-admin/post-new.php?post_type=shop_order
2. **Crear un pedido de prueba:**
   - Cliente: Seleccionar o crear
   - Productos: Agregar al menos 1 producto
   - Estado: Pendiente de pago
   - **Guardar**

3. **Ver logs en Railway:**
   - Debe aparecer:
     ```
     [woo-webhook] 📦 Pedido recibido desde woo_moraleja
     [woo-webhook] Número de pedido: #123
     [woo-webhook] Estado: pending
     [woo-webhook] ✅ Pedido sincronizado a Strapi
     ```

4. **Verificar en Strapi Admin:**
   - Content Manager → Pedido
   - Debe aparecer el pedido recién creado
   - `originPlatform`: `woo_moraleja`
   - `numero_pedido`: #123

### **Prueba 2: Crear un Pedido desde la Intranet hacia Moraleja**

1. **Desde la Intranet, crear un pedido con:**
   ```json
   {
     "data": {
       "numero_pedido": "INTRANET-TEST-001",
       "estado": "pending",
       "total": 15990,
       "subtotal": 15990,
       "moneda": "CLP",
       "originPlatform": "woo_moraleja",  // ⚠️ IMPORTANTE
       "items": [
         {
           "producto_id": 123,
           "sku": "LIBRO-TEST",
           "nombre": "Libro de Prueba",
           "cantidad": 1,
           "precio_unitario": 15990,
           "total": 15990
         }
       ],
       "billing": {
         "first_name": "Test",
         "last_name": "Usuario",
         "email": "test@moraleja.cl",
         "phone": "+56912345678",
         "address_1": "Calle Test 123",
         "city": "Santiago",
         "state": "RM",
         "postcode": "1234567",
         "country": "CL"
       },
       "shipping": {
         "first_name": "Test",
         "last_name": "Usuario",
         "address_1": "Calle Test 123",
         "city": "Santiago",
         "state": "RM",
         "postcode": "1234567",
         "country": "CL"
       },
       "metodo_pago": "cod",
       "metodo_pago_titulo": "Pago contra entrega"
     }
   }
   ```

2. **Ver logs en Railway:**
   ```
   [pedido] 🔍 afterCreate ejecutado
   [pedido] Platform: woo_moraleja
   [pedido] ✅ Iniciando sincronización a woo_moraleja...
   [pedido.service] Pedido creado en woo_moraleja
   WooCommerce ID: 456
   ```

3. **Verificar en WooCommerce:**
   - https://staging.moraleja.cl/wp-admin/edit.php?post_type=shop_order
   - Debe aparecer el pedido creado desde la Intranet

---

## 📊 **RESUMEN DE FLUJOS BIDIRECCIONALES**

### **WooCommerce (Moraleja) → Strapi**
✅ Webhooks capturan cambios en WooCommerce  
✅ Strapi procesa y almacena en Content Types  
✅ Intranet lee desde Strapi

### **Intranet → Strapi → WooCommerce (Moraleja)**
✅ Intranet crea/actualiza en Strapi  
✅ Lifecycle hooks detectan cambios  
✅ Strapi sincroniza automáticamente a WooCommerce

---

## 🔍 **DEBUGGING**

### **Si no funciona la sincronización WooCommerce → Strapi:**

1. **Verificar que los webhooks estén "Active"** en WooCommerce
2. **Ver logs de Delivery en WooCommerce:**
   - WooCommerce → Settings → Advanced → Webhooks
   - Click en el webhook
   - Scroll down → Ver "Logs"
   - Debe mostrar entregas exitosas (200 OK)
3. **Si hay errores (400, 404, 500):**
   - Verificar la URL del webhook
   - Verificar que Strapi esté corriendo
   - Ver logs de Railway para más detalles

### **Si no funciona la sincronización Strapi → WooCommerce:**

1. **Verificar variables de entorno en Railway:**
   ```bash
   WOO_MORALEJA_URL=https://staging.moraleja.cl
   WOO_MORALEJA_CONSUMER_KEY=ck_...
   WOO_MORALEJA_CONSUMER_SECRET=cs_...
   ```

2. **Ver logs de Railway:**
   - Buscar líneas con `[pedido.service]` o `[libro]`
   - Debe mostrar:
     ```
     ✅ Configuración de woo_moraleja encontrada
     URL: https://staging.moraleja.cl
     ```

3. **Si dice "Configuración de WooCommerce incompleta":**
   - Faltan variables de entorno
   - Agregar en Railway y redeploy

4. **Verificar que el pedido/producto tenga `originPlatform: "woo_moraleja"`**
   - Sin esto, Strapi no sabe a qué WooCommerce sincronizar

---

## ✅ **CHECKLIST DE CONFIGURACIÓN**

### **Variables de Entorno (Railway)**
- [ ] `WOO_MORALEJA_URL` configurado
- [ ] `WOO_MORALEJA_CONSUMER_KEY` configurado
- [ ] `WOO_MORALEJA_CONSUMER_SECRET` configurado
- [ ] Redeploy realizado después de agregar variables

### **Webhooks (WooCommerce de Moraleja)**
- [ ] Webhook "Product created" → `/api/woo-webhook/product/woo_moraleja`
- [ ] Webhook "Product updated" → `/api/woo-webhook/product/woo_moraleja`
- [ ] Webhook "Product deleted" → `/api/woo-webhook/product/:id/woo_moraleja`
- [ ] Webhook "Order created" → `/api/woo-webhook/order/woo_moraleja`
- [ ] Webhook "Order updated" → `/api/woo-webhook/order/woo_moraleja`
- [ ] Webhook "Order deleted" → `/api/woo-webhook/order/:id/woo_moraleja`
- [ ] Todos los webhooks en estado "Active"

### **Pruebas**
- [ ] Crear pedido en WooCommerce → Aparece en Strapi
- [ ] Crear pedido en Intranet → Aparece en WooCommerce
- [ ] Actualizar pedido en WooCommerce → Se actualiza en Strapi
- [ ] Actualizar pedido en Strapi → Se actualiza en WooCommerce

---

## 📞 **SOPORTE**

Si después de seguir todos estos pasos aún no funciona:

1. **Copiar los logs de Railway** (filtrar por "woo_moraleja" o "pedido")
2. **Verificar los logs de Delivery de los webhooks** en WooCommerce
3. **Compartir con el equipo de desarrollo**

---

**Última actualización:** 2025-12-28

