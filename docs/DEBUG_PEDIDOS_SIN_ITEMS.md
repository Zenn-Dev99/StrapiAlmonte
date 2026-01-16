# 🔍 DEBUG: Pedidos con Total $0 y Sin Items

## ❌ PROBLEMA ACTUAL

Los pedidos creados desde la Intranet llegan a Strapi **SIN items** (array vacío), lo que causa:
- Total: $0
- Sin productos en el pedido
- Pedidos vacíos en WooCommerce

## 📊 DIAGNÓSTICO

Según los logs de Strapi, cuando se recibe un pedido desde la Intranet:

```
- Items en pedido.items: 0 items  ← ARRAY VACÍO
⚠️  [pedido.service] EL PEDIDO NO TIENE ITEMS
[pedido.service] 📊 Total de line_items mapeados: 0
```

**Esto significa que el payload que envías NO incluye el campo "items" o está vacío.**

---

## 🛠️ SOLUCIÓN: Usar Endpoint de Debug

Strapi ahora tiene un endpoint temporal de debugging que muestra exactamente qué está llegando.

### PASO 1: Modificar tu código temporalmente

**ANTES de enviar al endpoint real**, envía primero al endpoint de debug:

```javascript
// 1. Construir el payload (tu código actual)
const payload = {
  data: {
    numero_pedido: `INV-${Date.now()}`,
    estado: 'pending',
    total: calcularTotal(), // Ejemplo: 45990
    subtotal: calcularSubtotal(), // Ejemplo: 45990
    moneda: 'CLP',
    originPlatform: 'woo_escolar', // o 'woo_moraleja'
    items: construirItems(), // ⚠️ CRÍTICO: AQUÍ ESTÁ EL PROBLEMA
    billing: {
      first_name: 'Gonzalo',
      last_name: 'Maturana',
      email: 'test@example.com',
      phone: '+56912345678',
      address_1: 'Dirección 123',
      city: 'Santiago',
      state: 'RM',
      postcode: '7500000',
      country: 'CL'
    },
    shipping: { /* ... */ }
  }
};

// 2. DEBUGGING: Imprimir payload en consola
console.log('═══════════════════════════════════════════════════════');
console.log('🔍 PAYLOAD A ENVIAR:');
console.log(JSON.stringify(payload, null, 2));
console.log('═══════════════════════════════════════════════════════');
console.log('✅ Verificaciones antes de enviar:');
console.log('- payload.data existe?', !!payload.data);
console.log('- payload.data.items existe?', !!payload.data?.items);
console.log('- payload.data.items es array?', Array.isArray(payload.data?.items));
console.log('- payload.data.items.length:', payload.data?.items?.length || 0);
if (payload.data?.items && payload.data.items.length > 0) {
  console.log('- items[0]:', payload.data.items[0]);
}
console.log('═══════════════════════════════════════════════════════');

// 3. VALIDACIÓN: No enviar si items está vacío
if (!payload.data.items || !Array.isArray(payload.data.items) || payload.data.items.length === 0) {
  console.error('❌ ERROR CRÍTICO: El payload NO tiene items o está vacío');
  alert('Error: El pedido no tiene productos. Agrega al menos un producto antes de crear el pedido.');
  return; // DETENER AQUÍ
}

// 4. TEMPORAL: Enviar primero al endpoint de DEBUG
console.log('📤 Enviando al endpoint de debug...');
try {
  const debugResponse = await fetch('https://strapi.moraleja.cl/api/pedidos/debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const debugResult = await debugResponse.json();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📥 RESPUESTA DEL DEBUG ENDPOINT:');
  console.log(JSON.stringify(debugResult, null, 2));
  console.log('═══════════════════════════════════════════════════════');
  
  // Verificar resultado
  if (!debugResult.received.hasItems && !debugResult.received.hasProductos) {
    console.error('❌ CONFIRMADO: Strapi NO recibió items');
    alert('Error: El payload enviado NO contiene items. Revisa la consola (F12) para más detalles.');
    return; // NO ENVIAR AL ENDPOINT REAL
  }
  
  if (debugResult.received.itemsLength === 0 && debugResult.received.productosLength === 0) {
    console.error('❌ CONFIRMADO: El array de items está VACÍO');
    alert('Error: El array de items está vacío. Revisa la función que construye los items.');
    return; // NO ENVIAR AL ENDPOINT REAL
  }
  
  console.log('✅ DEBUG OK: Items detectados correctamente');
  console.log(`✅ Total de items: ${debugResult.received.itemsLength || debugResult.received.productosLength}`);
  
} catch (error) {
  console.error('❌ Error al llamar al debug endpoint:', error);
}

// 5. Si el debug fue exitoso, enviar al endpoint REAL
console.log('📤 Enviando al endpoint REAL de creación...');
const response = await fetch('https://strapi.moraleja.cl/api/pedidos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

if (response.ok) {
  const result = await response.json();
  console.log('✅ Pedido creado exitosamente:', result.data.numero_pedido);
  alert('Pedido creado exitosamente');
} else {
  const error = await response.text();
  console.error('❌ Error al crear pedido:', error);
  alert('Error al crear el pedido. Revisa la consola.');
}
```

---

## 🔎 QUÉ BUSCAR EN LA CONSOLA

Abre la consola del navegador (F12) y busca:

### ✅ CORRECTO (items presentes):

```json
{
  "message": "Payload recibido y registrado en logs...",
  "received": {
    "hasData": true,
    "hasItems": true,        ← DEBE SER true
    "hasProductos": false,
    "itemsLength": 2,        ← DEBE SER > 0
    "productosLength": 0
  }
}
```

### ❌ INCORRECTO (items vacíos - situación actual):

```json
{
  "message": "Payload recibido y registrado en logs...",
  "received": {
    "hasData": true,
    "hasItems": false,       ← ESTE ES EL PROBLEMA
    "hasProductos": false,
    "itemsLength": 0,        ← ARRAY VACÍO
    "productosLength": 0
  }
}
```

---

## 📝 ESTRUCTURA CORRECTA DE ITEMS

El campo `items` debe ser un **array de objetos** con esta estructura:

```javascript
{
  data: {
    numero_pedido: "INV-123",
    total: 45990,
    items: [  // ⚠️ DEBE LLAMARSE "items" (no "productos" ni "line_items")
      {
        nombre: "Libro de Matemáticas",
        cantidad: 1,
        precio_unitario: 45990,  // ⚠️ DEBE SER > 0
        total: 45990,             // ⚠️ DEBE SER > 0
        producto_id: 9161,        // ID del producto en Strapi
        sku: "9789563134278"      // ISBN o SKU
      },
      {
        nombre: "Libro de Historia",
        cantidad: 2,
        precio_unitario: 32990,
        total: 65980,
        producto_id: 9162,
        sku: "9789563134285"
      }
    ],
    billing: { /* ... */ },
    shipping: { /* ... */ }
  }
}
```

---

## 🚨 ERRORES COMUNES

### Error 1: Campo con nombre incorrecto

❌ **INCORRECTO:**
```javascript
{
  data: {
    productos: [...],  // ← Nombre incorrecto
    line_items: [...], // ← Nombre incorrecto
    articulos: [...]   // ← Nombre incorrecto
  }
}
```

✅ **CORRECTO:**
```javascript
{
  data: {
    items: [...]  // ← DEBE llamarse "items"
  }
}
```

---

### Error 2: Items con precio $0

❌ **INCORRECTO:**
```javascript
{
  items: [
    {
      nombre: "Producto",
      cantidad: 1,
      precio_unitario: 0,  // ← INCORRECTO
      total: 0             // ← INCORRECTO
    }
  ]
}
```

✅ **CORRECTO:**
```javascript
{
  items: [
    {
      nombre: "Producto",
      cantidad: 1,
      precio_unitario: 45990,  // ← Precio real
      total: 45990             // ← Total calculado
    }
  ]
}
```

**SOLUCIÓN:** Debes **consultar el precio del producto** desde Strapi ANTES de crear el item:

```javascript
// Obtener precio actual del producto desde Strapi
const response = await fetch(`https://strapi.moraleja.cl/api/libros/${productoId}?populate=precios`);
const libro = await response.json();

// Obtener el precio vigente (el último activo)
const precioVigente = libro.data.precios
  .filter(p => p.activo)
  .sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio))[0];

// Usar el precio en el item
const item = {
  nombre: libro.data.titulo,
  cantidad: 1,
  precio_unitario: precioVigente.precio_venta,  // ✅ Precio real
  total: precioVigente.precio_venta * 1,        // ✅ Total calculado
  producto_id: libro.data.id,
  sku: libro.data.isbn_libro
};
```

---

### Error 3: Items se pierde al construir el payload

❌ **INCORRECTO:**
```javascript
const items = construirItems(); // [{ nombre: "...", ... }]

const payload = {
  data: {
    numero_pedido: "...",
    total: 45990
    // ❌ Olvidaste agregar items aquí
  }
};
```

✅ **CORRECTO:**
```javascript
const items = construirItems();

const payload = {
  data: {
    numero_pedido: "...",
    total: 45990,
    items: items  // ✅ Agregado correctamente
  }
};
```

---

### Error 4: Items no está definido

❌ **INCORRECTO:**
```javascript
let items; // undefined

const payload = {
  data: {
    items: items  // ← undefined
  }
};
```

✅ **CORRECTO:**
```javascript
const items = []; // Inicializar como array vacío

// Agregar productos
items.push({
  nombre: "Producto 1",
  cantidad: 1,
  precio_unitario: 45990,
  total: 45990
});

const payload = {
  data: {
    items: items  // ✅ Array con productos
  }
};
```

---

## 🎯 ACCIÓN INMEDIATA REQUERIDA

1. **Agrega el código de debugging** completo (del PASO 1 arriba)
2. **Crea un pedido de prueba** en la Intranet
3. **Abre la consola del navegador** (F12)
4. **Copia y pega aquí** TODA la salida de la consola
5. **Copia y pega** la respuesta del debug endpoint

Con esa información podré ver exactamente qué está fallando en tu código.

---

## 📋 CHECKLIST

Antes de enviar un pedido, verifica:

- [ ] `payload.data.items` existe
- [ ] `payload.data.items` es un array
- [ ] `payload.data.items.length > 0`
- [ ] Cada item tiene `nombre`, `cantidad`, `precio_unitario`, `total`
- [ ] `precio_unitario > 0` y `total > 0`
- [ ] El console.log muestra los items correctamente
- [ ] El debug endpoint confirma que los items llegan a Strapi

---

## 🆘 NECESITO ESTA INFORMACIÓN

Para poder ayudarte, necesito que compartas:

1. **Salida completa de la consola** (F12) al crear un pedido
2. **Respuesta del debug endpoint**
3. **El código donde construyes el payload** (función completa)

Sin ver el código real y el payload que envías, no puedo ayudarte más. El problema está definitivamente en tu código frontend de la Intranet.

