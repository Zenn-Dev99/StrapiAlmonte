# 🔄 Flujo Bidireccional: WordPress/WooCommerce ↔ Strapi ↔ Intranet

## 📊 DIAGRAMA DEL FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DEL SISTEMA                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│                      │         │                      │         │                      │
│  WordPress/WooCommerce│◄───────►│      STRAPI          │◄───────►│     INTRANET         │
│  (Frontend Público)  │         │  (Backend Central)   │         │  (Admin Frontend)    │
│                      │         │                      │         │                      │
└──────────────────────┘         └──────────────────────┘         └──────────────────────┘
        │                                  │                                  │
        │                                  │                                  │
        ▼                                  ▼                                  ▼
┌──────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│ • Moraleja           │         │ Content Types:       │         │ • Gestión de         │
│   staging.moraleja.cl│         │   - Pedidos          │         │   Productos          │
│                      │         │   - Productos        │         │ • Gestión de         │
│ • Librería Escolar   │         │   - Clientes         │         │   Pedidos            │
│   escolar.moraleja.cl│         │   - Cupones          │         │ • Gestión de         │
│                      │         │                      │         │   Inventario         │
└──────────────────────┘         └──────────────────────┘         └──────────────────────┘
```

---

## 🔄 SINCRONIZACIÓN BIDIRECCIONAL DE PEDIDOS

### 📥 **FLUJO 1: WooCommerce → Strapi → Intranet**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ESCENARIO: Cliente hace un pedido en el sitio web público                  │
└─────────────────────────────────────────────────────────────────────────────┘

   PASO 1                    PASO 2                    PASO 3
   ──────                    ──────                    ──────
   
┌──────────┐             ┌──────────┐             ┌──────────┐
│ Cliente  │             │WordPress │             │  Strapi  │
│ compra   │────────────►│ crea     │────────────►│ guarda   │
│ en web   │             │ pedido   │  Webhook    │ pedido   │
└──────────┘             └──────────┘             └──────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
                    Pedido #12345 creado      Content Type: Pedido
                    Estado: pending            - numero_pedido: "12345"
                    Total: CLP 45.990          - estado: "pending"
                                                - total: 45990
                                                - originPlatform: "woo_moraleja"
                                                - woocommerce_id: "12345"
                                                
                                                         │
                                                         │
                                                         ▼
                                                  ┌──────────┐
                                                  │Intranet  │
                                                  │consulta  │
                                                  │pedidos   │
                                                  └──────────┘
                                                  GET /api/pedidos
                                                  
                                                  ✅ Ve el pedido #12345
```

**Detalles técnicos:**

1. **Cliente finaliza compra en WordPress:**
   - URL: https://staging.moraleja.cl/checkout/
   - WooCommerce crea el pedido internamente
   - Estado inicial: `pending-payment` o `processing`

2. **WordPress dispara Webhook:**
   ```
   POST https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja
   Content-Type: application/json
   
   {
     "id": 12345,
     "number": "12345",
     "status": "pending",
     "total": "45990",
     "currency": "CLP",
     "line_items": [...],
     "billing": {...},
     "shipping": {...}
   }
   ```

3. **Strapi recibe y procesa:**
   - Archivo: `strapi/src/api/woo-webhook/controllers/woo-webhook.ts`
   - Método: `order(ctx)`
   - Extrae datos del pedido
   - Llama al servicio: `syncOrder(wooOrder, 'woo_moraleja')`

4. **Strapi guarda en BD:**
   - Content Type: `api::pedido.pedido`
   - Campos mapeados de WooCommerce a Strapi:
     ```javascript
     {
       numero_pedido: "12345",
       estado: "pending",
       total: 45990,
       subtotal: 45990,
       moneda: "CLP",
       originPlatform: "woo_moraleja",
       woocommerce_id: "12345",
       externalIds: { woo_moraleja: 12345 },
       items: [...],
       billing: {...},
       shipping: {...}
     }
     ```

5. **Intranet consulta pedidos:**
   ```javascript
   GET https://strapi.moraleja.cl/api/pedidos?filters[originPlatform][$eq]=woo_moraleja
   
   // ✅ Respuesta incluye el pedido #12345
   {
     data: [
       {
         id: 789,
         numero_pedido: "12345",
         estado: "pending",
         total: 45990,
         originPlatform: "woo_moraleja",
         woocommerce_id: "12345"
       }
     ]
   }
   ```

---

### 📤 **FLUJO 2: Intranet → Strapi → WooCommerce**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ESCENARIO: Administrador crea un pedido desde la Intranet                  │
└─────────────────────────────────────────────────────────────────────────────┘

   PASO 1                    PASO 2                    PASO 3
   ──────                    ──────                    ──────
   
┌──────────┐             ┌──────────┐             ┌──────────┐
│Intranet  │             │  Strapi  │             │WordPress │
│ crea     │────────────►│ guarda   │────────────►│ crea     │
│ pedido   │  POST API   │ pedido   │  Lifecycle  │ pedido   │
└──────────┘             └──────────┘   Hook       └──────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
                    Content Type: Pedido      Pedido #12346 creado
                    - numero_pedido: "INT-001"  en WooCommerce
                    - estado: "pending"         ID: 12346
                    - total: 32990
                    - originPlatform: "woo_moraleja"
                    
                              │
                              │ Lifecycle: afterCreate
                              ▼
                    Strapi detecta nuevo pedido
                    Llama: syncToWooCommerce()
                              │
                              │
                              ▼
                    POST a WooCommerce API:
                    /wp-json/wc/v3/orders
                              │
                              │
                              ▼
                    ┌──────────────────────────┐
                    │ WooCommerce responde:    │
                    │ {                        │
                    │   "id": 12346,           │
                    │   "number": "12346"      │
                    │ }                        │
                    └──────────────────────────┘
                              │
                              │
                              ▼
                    Strapi actualiza pedido:
                    - woocommerce_id: "12346"
                    - externalIds: { woo_moraleja: 12346 }
```

**Detalles técnicos:**

1. **Intranet envía pedido a Strapi:**
   ```javascript
   POST https://strapi.moraleja.cl/api/pedidos
   Content-Type: application/json
   
   {
     "data": {
       "numero_pedido": "INTRANET-2025-001",
       "estado": "pending",
       "fecha_creacion": "2025-12-28T10:30:00.000Z",
       "total": 32990,
       "subtotal": 32990,
       "moneda": "CLP",
       "originPlatform": "woo_moraleja",  // ⚠️ CRÍTICO
       "items": [
         {
           "producto_id": 456,
           "sku": "LIBRO-002",
           "nombre": "Lenguaje PAES 2025",
           "cantidad": 1,
           "precio_unitario": 32990,
           "total": 32990
         }
       ],
       "billing": {
         "first_name": "María",
         "last_name": "González",
         "email": "maria@example.com",
         "phone": "+56987654321",
         "address_1": "Calle Falsa 123",
         "city": "Santiago",
         "state": "RM",
         "postcode": "7500000",
         "country": "CL"
       },
       "shipping": {
         "first_name": "María",
         "last_name": "González",
         "address_1": "Calle Falsa 123",
         "city": "Santiago",
         "state": "RM",
         "postcode": "7500000",
         "country": "CL"
       },
       "metodo_pago": "cod",
       "metodo_pago_titulo": "Pago contra entrega"
     }
   }
   ```

2. **Strapi guarda el pedido:**
   - Controller: `strapi/src/api/pedido/controllers/pedido.ts`
   - EntityService crea el registro en BD
   - ID generado: 123

3. **Lifecycle Hook se dispara automáticamente:**
   - Archivo: `strapi/src/api/pedido/content-types/pedido/lifecycles.ts`
   - Hook: `afterCreate(event)`
   - Detecta: `event.result.originPlatform === 'woo_moraleja'`
   - Ejecuta: `syncToWooCommerce(event.result)`

4. **Strapi llama al servicio de sincronización:**
   - Archivo: `strapi/src/api/pedido/services/pedido.ts`
   - Método: `syncToWooCommerce(pedido)`
   - Obtiene config de WooCommerce:
     ```javascript
     {
       url: process.env.WOO_MORALEJA_URL,
       consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY,
       consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET
     }
     ```

5. **Strapi hace POST a WooCommerce:**
   ```javascript
   POST https://staging.moraleja.cl/wp-json/wc/v3/orders
   Authorization: Basic base64(consumerKey:consumerSecret)
   Content-Type: application/json
   
   {
     "status": "pending",
     "currency": "CLP",
     "customer_id": 0,
     "line_items": [
       {
         "product_id": 456,
         "quantity": 1,
         "total": "32990"
       }
     ],
     "billing": {
       "first_name": "María",
       "last_name": "González",
       "email": "maria@example.com",
       "phone": "+56987654321",
       "address_1": "Calle Falsa 123",
       "city": "Santiago",
       "state": "RM",
       "postcode": "7500000",
       "country": "CL"
     },
     "shipping": {
       "first_name": "María",
       "last_name": "González",
       "address_1": "Calle Falsa 123",
       "city": "Santiago",
       "state": "RM",
       "postcode": "7500000",
       "country": "CL"
     },
     "payment_method": "cod",
     "payment_method_title": "Pago contra entrega"
   }
   ```

6. **WooCommerce responde:**
   ```json
   {
     "id": 12346,
     "number": "12346",
     "status": "pending",
     ...
   }
   ```

7. **Strapi actualiza el pedido con el ID de WooCommerce:**
   ```javascript
   await strapi.entityService.update('api::pedido.pedido', pedido.id, {
     data: {
       woocommerce_id: "12346",
       externalIds: { woo_moraleja: 12346 }
     }
   });
   ```

8. **Resultado final:**
   - ✅ Pedido creado en Strapi (ID: 123)
   - ✅ Pedido creado en WooCommerce (ID: 12346)
   - ✅ Ambos IDs vinculados en Strapi
   - ✅ Intranet puede consultar y ver ambos IDs

---

## 🔄 **ACTUALIZACIÓN BIDIRECCIONAL**

### 📥 **Actualizar en WordPress → Se refleja en Strapi**

```
┌──────────────────────────────────────────────────────────────┐
│  Admin cambia estado del pedido #12345 en WordPress          │
└──────────────────────────────────────────────────────────────┘

WordPress                Webhook                    Strapi
────────                 ───────                    ──────

Admin cambia      ────►  POST /woo-webhook/    ────►  Strapi actualiza
estado a                 order/woo_moraleja          pedido existente
"processing"                                          
                         {                            UPDATE pedidos
                           "id": 12345,               SET estado = 'processing'
                           "status":                  WHERE woocommerce_id = '12345'
                             "processing"
                         }                            ✅ Pedido actualizado
```

**Código en Strapi:**
- Archivo: `strapi/src/api/woo-webhook/services/woo-webhook.ts`
- Método: `syncOrder(wooOrder, platform)`
- Busca pedido existente por `woocommerce_id` o `numero_pedido`
- Si existe: actualiza (UPDATE)
- Si no existe: crea (INSERT)

### 📤 **Actualizar en Strapi/Intranet → Se refleja en WordPress**

```
┌──────────────────────────────────────────────────────────────┐
│  Admin cambia notas del pedido en Intranet                   │
└──────────────────────────────────────────────────────────────┘

Intranet              Strapi                       WordPress
────────              ──────                       ─────────

Admin actualiza  ────►  PUT /api/pedidos/123  ────►  PUT /wp-json/wc/v3/
notas privadas         {                              orders/12346
                         "data": {                    
                           "notas_privadas":          {
                             "Cliente VIP"              "customer_note":
                         }                                "Cliente VIP"
                       }                              }
                       
                       Lifecycle: afterUpdate        ✅ Pedido actualizado
                       Llama: syncToWooCommerce()
```

**Código en Strapi:**
- Archivo: `strapi/src/api/pedido/content-types/pedido/lifecycles.ts`
- Hook: `afterUpdate(event)`
- Llama: `pedidoService.syncToWooCommerce(event.result)`
- Archivo: `strapi/src/api/pedido/services/pedido.ts`
- Método: `updateWooOrder(wooConfig, wooId, wooOrder)`
- Hace PUT a WooCommerce REST API

---

## 📊 **CAMPOS SINCRONIZADOS**

### Mapeo de campos: WooCommerce ↔ Strapi

| WooCommerce | Strapi (Pedido) | Dirección |
|-------------|-----------------|-----------|
| `id` | `woocommerce_id` | ↔ |
| `number` | `numero_pedido` | ↔ |
| `status` | `estado` | ↔ |
| `date_created` | `fecha_creacion` | ↔ |
| `date_modified` | `fecha_modificacion` | ↔ |
| `total` | `total` | ↔ |
| `subtotal` | `subtotal` | ↔ |
| `total_tax` | `impuestos` | ↔ |
| `shipping_total` | `envio` | ↔ |
| `discount_total` | `descuento` | ↔ |
| `currency` | `moneda` | ↔ |
| `payment_method` | `metodo_pago` | ↔ |
| `payment_method_title` | `metodo_pago_titulo` | ↔ |
| `shipping_lines[0].method_title` | `metodo_envio` | ↔ |
| `customer_note` | `nota_cliente` | ↔ |
| `line_items` | `items` (component) | ↔ |
| `billing` | `billing` (JSON) | ↔ |
| `shipping` | `shipping` (JSON) | ↔ |
| `customer_id` | `customer` (relation) | ↔ |

### Campo exclusivo de Strapi:

| Campo | Descripción | Valor |
|-------|-------------|-------|
| `originPlatform` | Plataforma de origen | `woo_moraleja` o `woo_escolar` |
| `externalIds` | IDs en múltiples plataformas | `{ woo_moraleja: 123, woo_escolar: 456 }` |
| `notas_privadas` | Notas internas (no visibles al cliente) | Texto libre |

---

## 🔐 **SEGURIDAD Y AUTENTICACIÓN**

### Webhooks de WooCommerce → Strapi

```
POST https://strapi.moraleja.cl/api/woo-webhook/order/woo_moraleja
Authorization: (ninguna - endpoint público con auth: false)
X-WC-Webhook-Source: https://staging.moraleja.cl
X-WC-Webhook-Topic: order.created
X-WC-Webhook-Signature: sha256_hash (opcional)
```

**Configuración en Strapi:**
- Archivo: `strapi/src/api/woo-webhook/routes/woo-webhook.ts`
- `auth: false` - Los webhooks no usan JWT de Strapi
- Opcional: validar signature con secret compartido

### Strapi → WooCommerce API

```
POST https://staging.moraleja.cl/wp-json/wc/v3/orders
Authorization: Basic base64(consumer_key:consumer_secret)
```

**Variables de entorno:**
```bash
WOO_MORALEJA_URL=https://staging.moraleja.cl
WOO_MORALEJA_CONSUMER_KEY=ck_...
WOO_MORALEJA_CONSUMER_SECRET=cs_...
```

### Intranet → Strapi API

```
GET/POST/PUT https://strapi.moraleja.cl/api/pedidos
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (opcional)
```

**Configuración:**
- Si usas autenticación: JWT token
- Si no: endpoints públicos (no recomendado en producción)
- Permisos configurados en Strapi Admin

---

## 🧪 **EJEMPLOS PRÁCTICOS PARA INTRANET**

### Ejemplo 1: Listar todos los pedidos de Moraleja

```javascript
async function obtenerPedidosMoraleja() {
  const response = await fetch(
    'https://strapi.moraleja.cl/api/pedidos?' +
    'filters[originPlatform][$eq]=woo_moraleja&' +
    'populate[customer]=*&' +
    'populate[items]=*&' +
    'sort=fecha_creacion:desc&' +
    'pagination[pageSize]=25'
  );
  
  const { data } = await response.json();
  
  // data contiene los pedidos con customer e items poblados
  return data;
}
```

### Ejemplo 2: Crear pedido desde Intranet

```javascript
async function crearPedidoDesdeIntranet(datosPedido) {
  const response = await fetch('https://strapi.moraleja.cl/api/pedidos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        numero_pedido: `INTRANET-${Date.now()}`,
        estado: 'pending',
        fecha_creacion: new Date().toISOString(),
        total: datosPedido.total,
        subtotal: datosPedido.subtotal,
        moneda: 'CLP',
        originPlatform: 'woo_moraleja', // ⚠️ IMPORTANTE
        items: datosPedido.items,
        billing: datosPedido.billing,
        shipping: datosPedido.shipping,
        metodo_pago: 'cod',
        metodo_pago_titulo: 'Pago contra entrega',
      }
    })
  });
  
  const result = await response.json();
  
  if (response.ok) {
    console.log('✅ Pedido creado en Strapi:', result.data.id);
    console.log('🔄 Sincronizándose a WooCommerce...');
    
    // Esperar 3 segundos y verificar sincronización
    setTimeout(async () => {
      const pedido = await fetch(
        `https://strapi.moraleja.cl/api/pedidos/${result.data.id}`
      );
      const { data } = await pedido.json();
      
      if (data.woocommerce_id) {
        console.log('✅ Sincronizado a WooCommerce:', data.woocommerce_id);
      } else {
        console.log('⏳ Aún sincronizando...');
      }
    }, 3000);
    
    return result.data;
  } else {
    throw new Error(result.error.message);
  }
}
```

### Ejemplo 3: Actualizar estado de pedido

```javascript
async function actualizarEstadoPedido(pedidoId, nuevoEstado) {
  const response = await fetch(
    `https://strapi.moraleja.cl/api/pedidos/${pedidoId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          estado: nuevoEstado, // 'processing', 'completed', etc.
        }
      })
    }
  );
  
  const result = await response.json();
  
  if (response.ok) {
    console.log('✅ Estado actualizado en Strapi');
    console.log('🔄 Sincronizando a WooCommerce...');
    return result.data;
  } else {
    throw new Error(result.error.message);
  }
}
```

### Ejemplo 4: Buscar pedido por número

```javascript
async function buscarPedidoPorNumero(numeroPedido) {
  const response = await fetch(
    `https://strapi.moraleja.cl/api/pedidos?` +
    `filters[numero_pedido][$eq]=${numeroPedido}&` +
    `populate[customer]=*&` +
    `populate[items]=*`
  );
  
  const { data } = await response.json();
  
  if (data.length > 0) {
    return data[0]; // Primer resultado
  } else {
    throw new Error('Pedido no encontrado');
  }
}
```

---

## ✅ **CHECKLIST PARA INTRANET**

### Al crear un pedido:
- [ ] ✅ Especificar `originPlatform` (`woo_moraleja` o `woo_escolar`)
- [ ] ✅ Generar `numero_pedido` único
- [ ] ✅ Incluir al menos 1 item en `items`
- [ ] ✅ Validar que `total > 0`
- [ ] ✅ Incluir datos mínimos de `billing` (nombre, email, dirección)
- [ ] ✅ Manejar respuesta (éxito/error)
- [ ] ✅ Mostrar confirmación al usuario

### Al listar pedidos:
- [ ] ✅ Filtrar por `originPlatform` si es necesario
- [ ] ✅ Usar `populate` para obtener relaciones
- [ ] ✅ Implementar paginación
- [ ] ✅ Ordenar por `fecha_creacion:desc`

### Al actualizar pedidos:
- [ ] ✅ Validar que el pedido existe
- [ ] ✅ Solo actualizar campos necesarios
- [ ] ✅ Manejar errores de sincronización
- [ ] ✅ Mostrar feedback al usuario

---

## 🚨 **ERRORES COMUNES Y SOLUCIONES**

### Error: Pedido se crea en Strapi pero no en WooCommerce

**Causa:** Variables de entorno no configuradas o incorrectas

**Solución:**
```bash
# Verificar en Railway que existan:
WOO_MORALEJA_URL=https://staging.moraleja.cl
WOO_MORALEJA_CONSUMER_KEY=ck_...
WOO_MORALEJA_CONSUMER_SECRET=cs_...
```

### Error: `originPlatform` es requerido

**Causa:** Falta especificar a qué WooCommerce sincronizar

**Solución:**
```javascript
{
  data: {
    originPlatform: 'woo_moraleja', // ⚠️ OBLIGATORIO
    ...
  }
}
```

### Error: Pedidos de WordPress no aparecen en Intranet

**Causa:** Webhooks no configurados en WooCommerce

**Solución:** Ver `docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md`

---

## 📚 **RECURSOS ADICIONALES**

- **Configuración completa:** `docs/CONFIGURACION_MORALEJA_BIDIRECCIONAL.md`
- **Diagnóstico:** `docs/DIAGNOSTICO_PEDIDOS_MORALEJA.md`
- **Schema del Content Type:** `strapi/src/api/pedido/content-types/pedido/schema.json`
- **Lifecycles:** `strapi/src/api/pedido/content-types/pedido/lifecycles.ts`
- **Servicio de sincronización:** `strapi/src/api/pedido/services/pedido.ts`
- **Webhook handler:** `strapi/src/api/woo-webhook/controllers/woo-webhook.ts`

---

**Última actualización:** 2025-12-28

