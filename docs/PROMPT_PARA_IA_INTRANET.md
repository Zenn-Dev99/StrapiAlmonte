# 🚨 PROBLEMA CRÍTICO: Pedidos con Total $0 y Sin Items

## ❌ SITUACIÓN ACTUAL

Los pedidos creados desde la Intranet llegan a Strapi **completamente vacíos** (sin items), lo que causa:

- **Total:** $0
- **Items:** 0 productos
- **WooCommerce:** Pedidos vacíos

Según los logs de Strapi:

```
- Items en pedido.items: 0 items  ← ARRAY VACÍO
⚠️  [pedido.service] EL PEDIDO NO TIENE ITEMS
[pedido.service] 📊 Total de line_items mapeados: 0
```

**Esto confirma que el payload enviado desde la Intranet NO incluye el campo "items" o llega vacío.**

---

## 🛠️ SOLUCIÓN: Implementar Debugging

Strapi tiene un endpoint temporal que muestra **exactamente** qué está recibiendo.

### 📋 PASO 1: Agregar Código de Debugging

**Busca el archivo/función donde creas los pedidos** y agrega este código COMPLETO:

```javascript
// ═══════════════════════════════════════════════════════════════
// FUNCIÓN PARA CREAR PEDIDO CON DEBUGGING
// ═══════════════════════════════════════════════════════════════

async function crearPedido() {
  // 1. Construir items del pedido
  const items = [];
  
  // TODO: Aquí debes agregar tu lógica para obtener los productos del carrito
  // Por ahora, voy a agregar un item de prueba para verificar:
  items.push({
    nombre: "Producto de Prueba",
    cantidad: 1,
    precio_unitario: 10000,
    total: 10000,
    producto_id: 9161,
    sku: "TEST-SKU"
  });

  // 2. Calcular totales
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  // 3. Construir payload
  const payload = {
    data: {
      numero_pedido: `INV-${Date.now()}`,
      estado: 'pending',
      total: total,
      subtotal: subtotal,
      moneda: 'CLP',
      originPlatform: 'woo_escolar', // O 'woo_moraleja' según corresponda
      items: items, // ⚠️ CRÍTICO: Este campo DEBE estar presente
      billing: {
        first_name: 'Test',
        last_name: 'Usuario',
        email: 'test@example.com',
        phone: '+56912345678',
        address_1: 'Calle Test 123',
        city: 'Santiago',
        state: 'RM',
        postcode: '7500000',
        country: 'CL'
      },
      shipping: {
        first_name: 'Test',
        last_name: 'Usuario',
        address_1: 'Calle Test 123',
        city: 'Santiago',
        state: 'RM',
        postcode: '7500000',
        country: 'CL'
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // DEBUGGING: IMPRIMIR EN CONSOLA
  // ═══════════════════════════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DEBUGGING: Payload ANTES de enviar a Strapi');
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 Payload completo:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Verificaciones:');
  console.log('- payload existe?', !!payload);
  console.log('- payload.data existe?', !!payload.data);
  console.log('- payload.data.items existe?', !!payload.data?.items);
  console.log('- payload.data.items es array?', Array.isArray(payload.data?.items));
  console.log('- payload.data.items.length:', payload.data?.items?.length || 0);
  
  if (payload.data?.items && payload.data.items.length > 0) {
    console.log('- items[0]:', payload.data.items[0]);
  }
  console.log('═══════════════════════════════════════════════════════');

  // ═══════════════════════════════════════════════════════════════
  // VALIDACIÓN: No enviar si items está vacío
  // ═══════════════════════════════════════════════════════════════
  
  if (!payload.data.items || !Array.isArray(payload.data.items) || payload.data.items.length === 0) {
    console.error('❌ ERROR CRÍTICO: El payload NO tiene items o está vacío');
    console.error('❌ NO SE PUEDE CREAR EL PEDIDO');
    alert('Error: El pedido no tiene productos. Debes agregar al menos un producto.');
    return;
  }

  console.log('✅ Validación OK: Items presentes');

  // ═══════════════════════════════════════════════════════════════
  // PASO 2: ENVIAR AL ENDPOINT DE DEBUG (TEMPORAL)
  // ═══════════════════════════════════════════════════════════════
  
  console.log('📤 Enviando al endpoint de DEBUG...');
  
  try {
    const debugResponse = await fetch('https://strapi.moraleja.cl/api/pedidos/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!debugResponse.ok) {
      throw new Error(`Debug endpoint error: ${debugResponse.status}`);
    }

    const debugResult = await debugResponse.json();

    console.log('═══════════════════════════════════════════════════════');
    console.log('📥 RESPUESTA DEL DEBUG ENDPOINT:');
    console.log(JSON.stringify(debugResult, null, 2));
    console.log('═══════════════════════════════════════════════════════');

    // Analizar respuesta del debug
    if (debugResult.received) {
      console.log('🔍 Análisis de lo que Strapi recibió:');
      console.log('- hasData:', debugResult.received.hasData);
      console.log('- hasItems:', debugResult.received.hasItems);
      console.log('- hasProductos:', debugResult.received.hasProductos);
      console.log('- itemsLength:', debugResult.received.itemsLength);
      console.log('- productosLength:', debugResult.received.productosLength);

      // Verificar si hay problema
      if (!debugResult.received.hasItems && !debugResult.received.hasProductos) {
        console.error('❌ CONFIRMADO: Strapi NO recibió items ni productos');
        console.error('❌ El problema está en cómo se construye o envía el payload');
        alert('ERROR CONFIRMADO: Strapi no está recibiendo los items. Revisa la consola (F12).');
        return;
      }

      if (debugResult.received.itemsLength === 0 && debugResult.received.productosLength === 0) {
        console.error('❌ CONFIRMADO: El array de items está VACÍO en Strapi');
        console.error('❌ Los items se están perdiendo durante el envío');
        alert('ERROR CONFIRMADO: Los items llegan vacíos a Strapi. Revisa la consola (F12).');
        return;
      }

      console.log('✅ DEBUG OK: Strapi recibió los items correctamente');
      console.log(`✅ Total de items detectados: ${debugResult.received.itemsLength || debugResult.received.productosLength}`);
    }

  } catch (error) {
    console.error('❌ Error al llamar al debug endpoint:', error);
    alert('Error al conectar con el servidor de debug. Revisa la consola (F12).');
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 3: ENVIAR AL ENDPOINT REAL (solo si el debug fue exitoso)
  // ═══════════════════════════════════════════════════════════════
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📤 Enviando al endpoint REAL de creación...');
  console.log('═══════════════════════════════════════════════════════');

  try {
    const response = await fetch('https://strapi.moraleja.cl/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ PEDIDO CREADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Resultado:', JSON.stringify(result, null, 2));
    console.log('Número de pedido:', result.data?.numero_pedido);
    console.log('ID:', result.data?.id);
    console.log('═══════════════════════════════════════════════════════');

    alert(`✅ Pedido creado exitosamente: ${result.data?.numero_pedido}`);

  } catch (error) {
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ ERROR AL CREAR PEDIDO');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error:', error);
    console.error('═══════════════════════════════════════════════════════');
    alert(`Error al crear el pedido: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// FIN DEL CÓDIGO DE DEBUGGING
// ═══════════════════════════════════════════════════════════════
```

---

## 📋 PASO 2: Ejecutar y Reportar

1. **Reemplaza o modifica** tu función actual de crear pedidos con el código de arriba
2. **Abre la consola del navegador** (F12)
3. **Crea un pedido de prueba** con AL MENOS 1 producto
4. **Copia TODO lo que aparece en la consola** (desde el inicio hasta el final)
5. **Comparte aquí** la salida completa

---

## 🔍 QUÉ ESPERAR EN LA CONSOLA

### ✅ SI TODO ESTÁ BIEN (esperado):

```
═══════════════════════════════════════════════════════
🔍 DEBUGGING: Payload ANTES de enviar a Strapi
═══════════════════════════════════════════════════════
📦 Payload completo:
{
  "data": {
    "numero_pedido": "INV-1735428000000",
    "items": [
      {
        "nombre": "Producto de Prueba",
        "cantidad": 1,
        "precio_unitario": 10000,
        "total": 10000
      }
    ]
  }
}
═══════════════════════════════════════════════════════
✅ Verificaciones:
- payload existe? true
- payload.data existe? true
- payload.data.items existe? true
- payload.data.items es array? true
- payload.data.items.length: 1
- items[0]: { nombre: "Producto de Prueba", ... }
═══════════════════════════════════════════════════════
✅ Validación OK: Items presentes
📤 Enviando al endpoint de DEBUG...
═══════════════════════════════════════════════════════
📥 RESPUESTA DEL DEBUG ENDPOINT:
{
  "message": "Payload recibido y registrado en logs...",
  "received": {
    "hasData": true,
    "hasItems": true,        ← ✅ DEBE SER TRUE
    "hasProductos": false,
    "itemsLength": 1,        ← ✅ DEBE SER > 0
    "productosLength": 0
  }
}
═══════════════════════════════════════════════════════
✅ DEBUG OK: Strapi recibió los items correctamente
✅ Total de items detectados: 1
```

### ❌ SI HAY PROBLEMA (situación actual):

```
═══════════════════════════════════════════════════════
✅ Verificaciones:
- payload existe? true
- payload.data existe? true
- payload.data.items existe? false     ← ❌ PROBLEMA AQUÍ
- payload.data.items es array? false
- payload.data.items.length: 0
═══════════════════════════════════════════════════════
❌ ERROR CRÍTICO: El payload NO tiene items o está vacío
```

---

## 📝 ESTRUCTURA CORRECTA DE ITEMS

El campo `items` debe tener esta estructura **exacta**:

```javascript
items: [
  {
    nombre: "Nombre del producto",        // ✅ Obligatorio
    cantidad: 1,                          // ✅ Obligatorio, número > 0
    precio_unitario: 45990,               // ✅ Obligatorio, número > 0
    total: 45990,                         // ✅ Obligatorio, número > 0
    producto_id: 9161,                    // ⚠️ Recomendado (ID en Strapi)
    sku: "9789563134278"                  // ⚠️ Recomendado (ISBN o SKU)
  }
]
```

---

## 🚨 ERRORES COMUNES A EVITAR

### ❌ Error 1: Campo con nombre incorrecto
```javascript
// INCORRECTO:
data: {
  productos: [...],   // ← Debe ser "items"
  line_items: [...],  // ← Debe ser "items"
}

// CORRECTO:
data: {
  items: [...],       // ✅ Exactamente "items"
}
```

### ❌ Error 2: Items con precio $0
```javascript
// INCORRECTO:
{
  nombre: "Producto",
  cantidad: 1,
  precio_unitario: 0,  // ← NO puede ser 0
  total: 0             // ← NO puede ser 0
}

// CORRECTO:
{
  nombre: "Producto",
  cantidad: 1,
  precio_unitario: 45990,  // ✅ Precio real
  total: 45990             // ✅ Total calculado
}
```

### ❌ Error 3: Olvidar agregar items al payload
```javascript
// INCORRECTO:
const items = construirItems();
const payload = {
  data: {
    numero_pedido: "...",
    total: 45990
    // ❌ Olvidaste: items: items
  }
};

// CORRECTO:
const items = construirItems();
const payload = {
  data: {
    numero_pedido: "...",
    total: 45990,
    items: items  // ✅ Agregado
  }
};
```

---

## 📤 INFORMACIÓN REQUERIDA

Para poder ayudarte, NECESITO que compartas:

1. ✅ **Salida COMPLETA de la consola** (F12) después de crear un pedido
2. ✅ **Respuesta del debug endpoint** (aparece en la consola)
3. ✅ **Código actual** donde construyes el payload (si es posible)

---

## 🎯 RESUMEN

1. **Implementa el código de debugging** completo (PASO 1)
2. **Abre la consola del navegador** (F12)
3. **Crea un pedido de prueba**
4. **Copia TODA la salida de la consola**
5. **Comparte aquí la salida**

**Sin ver el payload real que estás enviando, no puedo corregir el problema.**

El endpoint de debug está disponible en: `https://strapi.moraleja.cl/api/pedidos/debug`

---

**¿Necesitas ayuda para implementar este código? Comparte el archivo o función donde creas los pedidos y te ayudo a integrarlo.**

