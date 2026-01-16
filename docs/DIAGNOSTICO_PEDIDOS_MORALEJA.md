# 🔍 Diagnóstico: Pedidos de Moraleja NO aparecen en Strapi

## 📋 **SÍNTOMA**

Los pedidos de **WooCommerce de Moraleja** (https://staging.moraleja.cl/) **NO se están sincronizando** a Strapi.

## 🕵️ **SCRIPTS DE DIAGNÓSTICO**

He creado 2 scripts para ayudarte a diagnosticar y resolver el problema:

---

## 🔧 **Script 1: Diagnóstico Completo**

**Ubicación:** `strapi/scripts/diagnostico-moraleja.mjs`

### **¿Qué hace?**

Verifica automáticamente:
1. ✅ Variables de entorno configuradas
2. ✅ Conexión con WooCommerce de Moraleja
3. ✅ Pedidos existentes en WooCommerce
4. ✅ Pedidos sincronizados en Strapi
5. ✅ Webhooks configurados en WooCommerce

### **Cómo ejecutarlo:**

#### **Opción A - Local (si tienes Strapi corriendo localmente):**

```bash
cd strapi
node scripts/diagnostico-moraleja.mjs
```

#### **Opción B - En Railway (ejecutar en el contenedor):**

1. Ir a Railway → Tu proyecto de Strapi
2. Click en los 3 puntos → "Terminal"
3. Ejecutar:
   ```bash
   cd strapi
   node scripts/diagnostico-moraleja.mjs
   ```

### **Ejemplo de salida:**

```
═══════════════════════════════════════════════════════
🔍 DIAGNÓSTICO DE CONFIGURACIÓN MORALEJA
═══════════════════════════════════════════════════════

PASO 1: Verificando Variables de Entorno
═══════════════════════════════════════════════════════

WOO_MORALEJA_URL: ✅ https://staging.moraleja.cl
WOO_MORALEJA_CONSUMER_KEY: ✅ ck_abc123...
WOO_MORALEJA_CONSUMER_SECRET: ✅ cs_xyz789...

✅ Variables de entorno configuradas correctamente

═══════════════════════════════════════════════════════
PASO 2: Probando Conexión con WooCommerce de Moraleja
═══════════════════════════════════════════════════════

✅ Conexión exitosa con WooCommerce de Moraleja
   Versión de WooCommerce: 8.5.2
   Versión de WordPress: 6.4.3

═══════════════════════════════════════════════════════
PASO 3: Obteniendo Pedidos de WooCommerce de Moraleja
═══════════════════════════════════════════════════════

✅ Se encontraron 25 pedidos en WooCommerce de Moraleja

Últimos pedidos:
   - Pedido #1234 (ID: 1234) - processing - CLP 45990
   - Pedido #1235 (ID: 1235) - completed - CLP 32990
   ...

═══════════════════════════════════════════════════════
PASO 4: Verificando Pedidos en Strapi
═══════════════════════════════════════════════════════

Pedidos de Moraleja en Strapi: 0

❌ PROBLEMA ENCONTRADO:
   Hay pedidos en WooCommerce de Moraleja, pero NO están en Strapi.

🔧 POSIBLES CAUSAS:
   1. Los webhooks NO están configurados en WooCommerce
   2. Los webhooks están configurados pero apuntan a una URL incorrecta
   ...
```

---

## 📥 **Script 2: Importación Manual de Pedidos**

**Ubicación:** `strapi/scripts/importar-pedidos-moraleja.mjs`

### **¿Qué hace?**

Importa manualmente pedidos existentes de WooCommerce de Moraleja a Strapi.

**⚠️ Úsalo solo si:**
- Los webhooks no estaban configurados desde el principio
- Hay pedidos viejos que nunca se sincronizaron
- Quieres hacer una importación inicial

### **Cómo ejecutarlo:**

#### **Importar últimos 10 pedidos:**

```bash
cd strapi
node scripts/importar-pedidos-moraleja.mjs
```

#### **Importar últimos 50 pedidos:**

```bash
node scripts/importar-pedidos-moraleja.mjs 50
```

#### **Importar TODOS los pedidos:**

```bash
node scripts/importar-pedidos-moraleja.mjs all
```

### **Ejemplo de salida:**

```
═══════════════════════════════════════════════════════
📥 IMPORTACIÓN DE PEDIDOS DE MORALEJA
═══════════════════════════════════════════════════════

Límite: 50 pedidos

📦 Iniciando Strapi...
✅ Strapi iniciado

🔍 Obteniendo pedidos de WooCommerce de Moraleja...
   Página 1: 50 pedidos

✅ Total de pedidos obtenidos: 50

📥 Importando pedidos a Strapi...

[1/50] ✅ Pedido #1234 importado (WooCommerce ID: 1234)
[2/50] ⏭️  Pedido #1235 ya existe (Strapi ID: 123)
[3/50] ✅ Pedido #1236 importado (WooCommerce ID: 1236)
...

═══════════════════════════════════════════════════════
RESUMEN DE IMPORTACIÓN
═══════════════════════════════════════════════════════

✅ Importados: 45
⏭️  Omitidos (ya existían): 5
❌ Errores: 0
📊 Total procesados: 50

🎉 Importación completada exitosamente
   Puedes ver los pedidos en Strapi Admin → Content Manager → Pedido
```

---

## 🔍 **CAUSAS COMUNES DEL PROBLEMA**

### **1. Variables de Entorno NO Configuradas (más común)**

**Síntoma:**
```
❌ Variables de entorno NO configuradas
```

**Solución:**
1. Ir a Railway → Tu proyecto de Strapi → Variables
2. Agregar:
   ```
   WOO_MORALEJA_URL=https://staging.moraleja.cl
   WOO_MORALEJA_CONSUMER_KEY=ck_...
   WOO_MORALEJA_CONSUMER_SECRET=cs_...
   ```
3. Redeploy

**Cómo obtener las credenciales:**
- Ver: `docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md` → Paso 1

---

### **2. Webhooks NO Configurados en WooCommerce**

**Síntoma:**
```
❌ NO hay webhooks de pedidos configurados en WooCommerce de Moraleja
```

**Solución:**
1. Ir a: https://staging.moraleja.cl/wp-admin
2. WooCommerce → Settings → Advanced → Webhooks
3. Crear webhooks:
   - **Order created:**
     - Delivery URL: `https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`
     - Status: Active
   - **Order updated:**
     - Delivery URL: `https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`
     - Status: Active
   - **Order deleted:**
     - Delivery URL: `https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`
     - Status: Active

**Instrucciones detalladas:**
- Ver: `docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md` → Paso 2

---

### **3. URL de Webhook Incorrecta**

**Síntoma:**
```
⚠️  URL incorrecta. Debería ser: https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja
```

**Solución:**
1. Ir a WooCommerce → Settings → Advanced → Webhooks
2. Editar cada webhook
3. Cambiar la URL a: `https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`
4. Guardar

---

### **4. Webhooks Inactivos**

**Síntoma:**
```
❌ order.created - disabled
```

**Solución:**
1. Ir a WooCommerce → Settings → Advanced → Webhooks
2. Click en el webhook deshabilitado
3. Cambiar **Status** a **Active**
4. Guardar

---

### **5. Credenciales Inválidas (401 Unauthorized)**

**Síntoma:**
```
❌ Error al conectar con WooCommerce de Moraleja
   401: Unauthorized
```

**Solución:**
1. Las claves API son incorrectas
2. Regenerar claves en WordPress:
   - WooCommerce → Settings → Advanced → REST API
   - Generar nuevas claves
3. Actualizar en Railway:
   ```
   WOO_MORALEJA_CONSUMER_KEY=ck_NUEVA_CLAVE
   WOO_MORALEJA_CONSUMER_SECRET=cs_NUEVA_CLAVE
   ```
4. Redeploy

---

## 🧪 **FLUJO DE PRUEBA COMPLETO**

### **Paso 1: Ejecutar diagnóstico**

```bash
node scripts/diagnostico-moraleja.mjs
```

### **Paso 2: Resolver problemas encontrados**

Seguir las soluciones indicadas en el diagnóstico.

### **Paso 3: Importar pedidos existentes (opcional)**

Si hay pedidos viejos que nunca se sincronizaron:

```bash
node scripts/importar-pedidos-moraleja.mjs 50
```

### **Paso 4: Crear pedido de prueba**

1. Ir a: https://staging.moraleja.cl/wp-admin/post-new.php?post_type=shop_order
2. Crear un pedido de prueba
3. Guardar

### **Paso 5: Verificar en logs de Railway**

1. Railway → Strapi → Logs
2. Buscar:
   ```
   [woo-webhook] Pedido extraído desde woo_moraleja
   [woo-webhook] Pedido sincronizado exitosamente
   ```

### **Paso 6: Verificar en Strapi Admin**

1. Strapi Admin → Content Manager → Pedido
2. Debe aparecer el pedido recién creado
3. Verificar que `originPlatform` sea `woo_moraleja`

---

## 📊 **CHECKLIST DE VERIFICACIÓN**

Usa esta lista para verificar que todo esté configurado:

### **En Railway:**
- [ ] Variable `WOO_MORALEJA_URL` configurada
- [ ] Variable `WOO_MORALEJA_CONSUMER_KEY` configurada
- [ ] Variable `WOO_MORALEJA_CONSUMER_SECRET` configurada
- [ ] Redeploy realizado después de agregar variables

### **En WooCommerce de Moraleja:**
- [ ] Webhook "Order created" existe y está activo
- [ ] Webhook "Order updated" existe y está activo
- [ ] Webhook "Order deleted" existe y está activo
- [ ] Todos apuntan a: `https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja`

### **Pruebas:**
- [ ] Script de diagnóstico ejecutado sin errores
- [ ] Pedido de prueba creado en WooCommerce
- [ ] Pedido aparece en Strapi Admin
- [ ] Logs de Railway muestran sincronización exitosa

---

## 📞 **NECESITAS AYUDA?**

Si después de seguir todos estos pasos el problema persiste:

1. **Ejecuta el diagnóstico:**
   ```bash
   node scripts/diagnostico-moraleja.mjs > diagnostico.txt
   ```

2. **Copia los logs de Railway:**
   - Filtra por "woo_moraleja" o "order"

3. **Verifica los logs de delivery en WooCommerce:**
   - WooCommerce → Settings → Advanced → Webhooks
   - Click en cada webhook → Ver logs

4. **Comparte:**
   - El archivo `diagnostico.txt`
   - Los logs de Railway
   - Los logs de delivery de WooCommerce

---

## 📚 **DOCUMENTACIÓN RELACIONADA**

- **Configuración completa:** `docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md`
- **Schema de Pedido:** `strapi/src/api/pedido/content-types/pedido/schema.json`
- **Webhook Handler:** `strapi/src/api/woo-webhook/controllers/woo-webhook.ts`
- **Sincronización:** `strapi/src/api/woo-webhook/services/woo-webhook.ts`

---

**Última actualización:** 2025-12-28

