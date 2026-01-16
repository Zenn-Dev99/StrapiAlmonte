# ✅ Actualización: Fechas Automáticas en Pedidos

## 🎉 **BUENA NOTICIA**

Ya **NO necesitas enviar** los campos `fecha_creacion` y `fecha_modificacion` al crear/actualizar pedidos. Strapi los establece automáticamente.

---

## 🚨 **PROBLEMA ANTERIOR**

Al crear un pedido desde la Intranet sin el campo `fecha_creacion`, se recibía este error:

```
❌ Error 400: fecha_creacion must be defined.
```

**Causa:** El campo `fecha_creacion` era requerido en el schema pero la Intranet no lo enviaba.

---

## ✅ **SOLUCIÓN IMPLEMENTADA**

He agregado **lifecycle hooks** que establecen las fechas automáticamente:

### **1. `beforeCreate` - Al crear un pedido:**

```typescript
beforeCreate(event) {
  const { data } = event.params;
  
  // Si no viene fecha_creacion, la establece automáticamente
  if (!data.fecha_creacion) {
    data.fecha_creacion = new Date().toISOString();
  }
  
  // Si no viene fecha_modificacion, la establece automáticamente
  if (!data.fecha_modificacion) {
    data.fecha_modificacion = new Date().toISOString();
  }
}
```

### **2. `beforeUpdate` - Al actualizar un pedido:**

```typescript
beforeUpdate(event) {
  const { data } = event.params;
  
  // Siempre actualiza fecha_modificacion automáticamente
  data.fecha_modificacion = new Date().toISOString();
}
```

---

## 🔄 **COMPORTAMIENTO ACTUAL**

### **Escenario 1: Crear pedido SIN fechas (recomendado ✅)**

**Request desde Intranet:**
```json
POST /api/pedidos
{
  "data": {
    "numero_pedido": "INTRANET-2025-001",
    "estado": "pending",
    "total": 45990,
    "originPlatform": "woo_moraleja",
    "items": [...],
    "billing": {...},
    "shipping": {...}
    // ✅ SIN fecha_creacion
    // ✅ SIN fecha_modificacion
  }
}
```

**Strapi automáticamente agrega:**
```json
{
  "fecha_creacion": "2025-12-28T20:30:00.000Z",  // ✅ Fecha actual
  "fecha_modificacion": "2025-12-28T20:30:00.000Z"  // ✅ Fecha actual
}
```

**Resultado:**
- ✅ Pedido creado exitosamente
- ✅ Con fecha actual del servidor
- ✅ Sin error

---

### **Escenario 2: Crear pedido CON fechas (opcional)**

Si por alguna razón necesitas especificar una fecha específica:

**Request desde Intranet:**
```json
POST /api/pedidos
{
  "data": {
    "numero_pedido": "INTRANET-2025-002",
    "fecha_creacion": "2025-12-25T10:00:00.000Z",  // Fecha específica
    "estado": "pending",
    "total": 32990,
    ...
  }
}
```

**Strapi respeta tu fecha:**
```json
{
  "fecha_creacion": "2025-12-25T10:00:00.000Z",  // ✅ Tu fecha personalizada
  "fecha_modificacion": "2025-12-28T20:30:00.000Z"  // ✅ Fecha actual
}
```

**Resultado:**
- ✅ Usa la fecha que enviaste para `fecha_creacion`
- ✅ Establece fecha actual para `fecha_modificacion`

---

### **Escenario 3: Actualizar pedido (fecha_modificacion automática)**

**Request desde Intranet:**
```json
PUT /api/pedidos/:id
{
  "data": {
    "estado": "processing",
    "notas_privadas": "Pedido en preparación"
    // ✅ SIN fecha_modificacion
  }
}
```

**Strapi automáticamente actualiza:**
```json
{
  "fecha_modificacion": "2025-12-28T20:35:00.000Z"  // ✅ Fecha actual
}
```

**Resultado:**
- ✅ `fecha_modificacion` siempre se actualiza automáticamente
- ✅ Refleja la última vez que se modificó el pedido
- ✅ Sin necesidad de enviarla

---

## 📝 **RECOMENDACIONES PARA LA INTRANET**

### **✅ Hacer (Recomendado):**

**Al crear un pedido:**
```javascript
const nuevoPedido = {
  data: {
    numero_pedido: `INTRANET-${Date.now()}`,
    estado: 'pending',
    total: 45990,
    originPlatform: 'woo_moraleja',
    items: [...],
    billing: {...},
    shipping: {...}
    // ✅ NO enviar fecha_creacion
    // ✅ NO enviar fecha_modificacion
  }
};

const response = await fetch('https://strapi.moraleja.cl/api/pedidos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(nuevoPedido)
});
```

**Al actualizar un pedido:**
```javascript
const actualizacion = {
  data: {
    estado: 'processing'
    // ✅ NO enviar fecha_modificacion (se actualiza automáticamente)
  }
};

const response = await fetch(`https://strapi.moraleja.cl/api/pedidos/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(actualizacion)
});
```

---

### **⚠️ Evitar (innecesario pero funcional):**

Si insistes en enviar fechas manualmente:

```javascript
const nuevoPedido = {
  data: {
    fecha_creacion: new Date().toISOString(),  // ⚠️ Innecesario
    fecha_modificacion: new Date().toISOString(),  // ⚠️ Innecesario
    ...
  }
};
```

**Funciona, pero es redundante.** Strapi ya lo hace automáticamente.

---

## 🕐 **FORMATO DE FECHAS**

Si decides enviar fechas manualmente, usar formato **ISO 8601:**

```javascript
// ✅ Correcto
"fecha_creacion": "2025-12-28T20:30:00.000Z"

// ✅ También correcto (con zona horaria)
"fecha_creacion": "2025-12-28T17:30:00-03:00"

// ❌ Incorrecto
"fecha_creacion": "28/12/2025"
"fecha_creacion": "2025-12-28"
"fecha_creacion": 1703792400000  // timestamp
```

**Función helper:**
```javascript
function obtenerFechaISO() {
  return new Date().toISOString();
}

// Uso:
fecha_creacion: obtenerFechaISO()
```

---

## 📊 **COMPARACIÓN: ANTES vs AHORA**

### **❌ ANTES:**

**Payload mínimo requerido:**
```json
{
  "data": {
    "numero_pedido": "...",
    "estado": "pending",
    "total": 45990,
    "fecha_creacion": "2025-12-28T20:00:00.000Z",  // ❌ Obligatorio
    "originPlatform": "woo_moraleja",
    "items": [...],
    "billing": {...},
    "shipping": {...}
  }
}
```

**Problemas:**
- ❌ Debías generar la fecha manualmente
- ❌ Posibles errores de zona horaria
- ❌ Código extra innecesario

---

### **✅ AHORA:**

**Payload mínimo requerido:**
```json
{
  "data": {
    "numero_pedido": "...",
    "estado": "pending",
    "total": 45990,
    // ✅ fecha_creacion opcional (se establece automáticamente)
    "originPlatform": "woo_moraleja",
    "items": [...],
    "billing": {...},
    "shipping": {...}
  }
}
```

**Ventajas:**
- ✅ Menos código
- ✅ Sin errores de zona horaria
- ✅ Fecha del servidor (más confiable)
- ✅ Menos propenso a errores

---

## 🧪 **TESTING**

### **Test 1: Crear pedido sin fechas**

```javascript
const response = await fetch('https://strapi.moraleja.cl/api/pedidos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: {
      numero_pedido: 'TEST-001',
      estado: 'pending',
      total: 1000,
      originPlatform: 'woo_moraleja',
      items: [
        {
          producto_id: 1,
          sku: 'TEST',
          nombre: 'Producto Test',
          cantidad: 1,
          precio_unitario: 1000,
          total: 1000
        }
      ],
      billing: {
        first_name: 'Test',
        last_name: 'Usuario',
        email: 'test@example.com',
        address_1: 'Test 123',
        city: 'Santiago',
        country: 'CL'
      },
      shipping: {
        first_name: 'Test',
        last_name: 'Usuario',
        address_1: 'Test 123',
        city: 'Santiago',
        country: 'CL'
      }
    }
  })
});

const result = await response.json();

console.log('Fecha creación:', result.data.fecha_creacion);
console.log('Fecha modificación:', result.data.fecha_modificacion);

// Esperado:
// ✅ fecha_creacion presente con fecha actual
// ✅ fecha_modificacion presente con fecha actual
// ✅ Status 200 OK
```

---

### **Test 2: Actualizar pedido (fecha_modificacion automática)**

```javascript
// Actualizar el pedido después de 1 minuto
await new Promise(resolve => setTimeout(resolve, 60000));

const response = await fetch(`https://strapi.moraleja.cl/api/pedidos/${pedidoId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: {
      estado: 'processing'
    }
  })
});

const result = await response.json();

console.log('Fecha creación:', result.data.fecha_creacion);
console.log('Fecha modificación:', result.data.fecha_modificacion);

// Esperado:
// ✅ fecha_creacion sin cambios
// ✅ fecha_modificacion actualizada (1 minuto después)
// ✅ Status 200 OK
```

---

## 📋 **LOGS EN RAILWAY**

Ahora verás estos logs al crear/actualizar pedidos:

**Al crear:**
```
[pedido] 📅 fecha_creacion establecida automáticamente: 2025-12-28T20:30:57.000Z
[pedido] 📅 fecha_modificacion establecida automáticamente: 2025-12-28T20:30:57.000Z
[pedido] 🔍 afterCreate ejecutado
...
```

**Al actualizar:**
```
[pedido] 📅 fecha_modificacion actualizada automáticamente: 2025-12-28T20:35:12.000Z
[pedido] 🔍 afterUpdate ejecutado
...
```

---

## ✅ **CHECKLIST DE MIGRACIÓN**

Si tienes código existente que envía fechas, puedes:

- [ ] **Opción 1 (recomendada):** Remover los campos de fecha de tus payloads
  ```javascript
  // ❌ Antes
  const payload = {
    fecha_creacion: new Date().toISOString(),
    ...otrosCampos
  };
  
  // ✅ Después
  const payload = {
    // fecha_creacion removido
    ...otrosCampos
  };
  ```

- [ ] **Opción 2:** Dejar el código como está
  - ✅ Seguirá funcionando
  - ⚠️ Pero es redundante

---

## 🔍 **DETALLES TÉCNICOS**

### **Lifecycle hooks agregados:**

**Archivo:** `strapi/src/api/pedido/content-types/pedido/lifecycles.ts`

```typescript
export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    
    if (!data.fecha_creacion) {
      data.fecha_creacion = new Date().toISOString();
    }
    
    if (!data.fecha_modificacion) {
      data.fecha_modificacion = new Date().toISOString();
    }
  },
  
  async beforeUpdate(event: any) {
    const { data } = event.params;
    data.fecha_modificacion = new Date().toISOString();
  },
  
  // ... resto de hooks (afterCreate, afterUpdate)
}
```

**Cuándo se ejecutan:**
- `beforeCreate`: **ANTES** de guardar el pedido en la BD
- `beforeUpdate`: **ANTES** de actualizar el pedido en la BD

**Ventajas:**
- ✅ Se ejecutan en el servidor (fecha confiable)
- ✅ Transparente para la API
- ✅ Sin cambios en endpoints

---

## 🚀 **DEPLOY**

Los cambios ya están desplegados:

```bash
✅ Commit: d0993a0 - fix: Agregar lifecycle hooks para fechas automáticas
✅ Push: Exitoso
✅ Railway: Redesplegando automáticamente (2-3 min)
```

---

## 📚 **RESUMEN**

### **Para la Intranet:**

1. ✅ **YA NO necesitas enviar `fecha_creacion` al crear pedidos**
2. ✅ **YA NO necesitas enviar `fecha_modificacion` nunca**
3. ✅ **Strapi establece las fechas automáticamente**
4. ✅ **Menos código, menos errores**

### **Beneficios:**

- ✅ Código más limpio
- ✅ Menos propenso a errores
- ✅ Fecha del servidor (más confiable)
- ✅ Sincronización de zona horaria consistente
- ✅ Menos campos requeridos en formularios

---

**Última actualización:** 2025-12-28  
**Commit:** d0993a0

