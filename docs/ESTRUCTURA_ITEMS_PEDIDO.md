# 📦 Estructura Correcta de Items en Pedidos

## 🚨 **PROBLEMA IDENTIFICADO**

Los pedidos creados desde la Intranet están llegando a WooCommerce **sin productos (line_items) y sin totales ($0)**.

**Causa probable:** El campo `items` no se está enviando correctamente o está vacío en el payload.

---

## ✅ **SOLUCIÓN: Estructura Correcta del Payload**

### **Estructura completa de un pedido con items:**

```json
POST /api/pedidos
{
  "data": {
    "numero_pedido": "INTRANET-001",
    "estado": "pending",
    "fecha_creacion": "2025-12-28T20:00:00.000Z",  // Opcional (se establece automáticamente)
    "total": 45990,
    "subtotal": 45990,
    "moneda": "CLP",
    "originPlatform": "woo_moraleja",
    
    "items": [
      {
        "producto_id": 123,
        "sku": "LIBRO-MAT-M1",
        "nombre": "Matemática M1 PAES 2025",
        "cantidad": 1,
        "precio_unitario": 45990,
        "total": 45990,
        "subtotal": 45990,
        "impuestos": 0
      },
      {
        "producto_id": 456,
        "sku": "LIBRO-LEN",
        "nombre": "Lenguaje PAES 2025",
        "cantidad": 2,
        "precio_unitario": 32990,
        "total": 65980,
        "subtotal": 65980,
        "impuestos": 0
      }
    ],
    
    "billing": {
      "first_name": "Juan",
      "last_name": "Pérez",
      "email": "juan.perez@example.com",
      "phone": "+56912345678",
      "address_1": "Av. Providencia 123",
      "city": "Santiago",
      "state": "RM",
      "postcode": "7500000",
      "country": "CL"
    },
    
    "shipping": {
      "first_name": "Juan",
      "last_name": "Pérez",
      "address_1": "Av. Providencia 123",
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

---

## 📋 **ESTRUCTURA DEL CAMPO `items`**

### **Cada item DEBE tener estos campos:**

| Campo | Tipo | Descripción | Requerido | Ejemplo |
|-------|------|-------------|-----------|---------|
| `producto_id` | number | ID del producto en WooCommerce | ⚠️ Recomendado | `123` |
| `sku` | string | SKU del producto | ⚠️ Recomendado | `"LIBRO-MAT-M1"` |
| `nombre` | string | Nombre del producto | ✅ OBLIGATORIO | `"Matemática M1 PAES 2025"` |
| `cantidad` | number | Cantidad de unidades | ✅ OBLIGATORIO | `1` |
| `precio_unitario` | number | Precio por unidad | ✅ OBLIGATORIO | `45990` |
| `total` | number | Total del line item | ✅ OBLIGATORIO | `45990` |
| `subtotal` | number | Subtotal sin impuestos | ⚠️ Opcional | `45990` |
| `impuestos` | number | Impuestos del item | ⚠️ Opcional | `0` |

### **⚠️ IMPORTANTE:**

- **`items` DEBE ser un array** (incluso con 1 solo item)
- **`items` NO DEBE estar vacío** (`[]`)
- **Cada item DEBE tener `nombre`, `cantidad`, `precio_unitario` y `total`**
- **El `total` del pedido DEBE ser la suma de todos los `total` de los items**

---

## ❌ **EJEMPLOS DE PAYLOADS INCORRECTOS**

### **Error 1: items vacío**

```json
{
  "data": {
    "numero_pedido": "INTRANET-001",
    "estado": "pending",
    "total": 45990,
    "originPlatform": "woo_moraleja",
    "items": [],  // ❌ VACÍO - pedido se creará sin productos
    "billing": {...}
  }
}
```

**Resultado:**
- ❌ Pedido creado en WooCommerce sin productos
- ❌ Total: $0
- ❌ Subtotal: $0

---

### **Error 2: items sin campos requeridos**

```json
{
  "data": {
    "numero_pedido": "INTRANET-001",
    "items": [
      {
        "producto_id": 123
        // ❌ Falta: nombre, cantidad, precio_unitario, total
      }
    ]
  }
}
```

**Resultado:**
- ❌ Item se creará sin nombre: "Producto 1"
- ❌ Cantidad por defecto: 1
- ❌ Sin precio: $0

---

### **Error 3: items es null o undefined**

```json
{
  "data": {
    "numero_pedido": "INTRANET-001",
    "estado": "pending",
    "total": 45990,
    "originPlatform": "woo_moraleja"
    // ❌ items no está presente
  }
}
```

**Resultado:**
- ❌ Pedido creado sin productos
- ❌ WooCommerce mostrará pedido vacío

---

### **Error 4: total no coincide con suma de items**

```json
{
  "data": {
    "total": 100000,  // ❌ Total incorrecto
    "items": [
      {
        "nombre": "Producto 1",
        "cantidad": 1,
        "precio_unitario": 45990,
        "total": 45990  // ✅ Total real: 45990
      }
    ]
  }
}
```

**Resultado:**
- ⚠️ WooCommerce calculará el total desde los items (45990)
- ⚠️ El total del pedido (100000) será ignorado
- ✅ El pedido final tendrá total correcto: 45990

---

## ✅ **EJEMPLOS DE PAYLOADS CORRECTOS**

### **Ejemplo 1: Pedido con 1 item**

```json
{
  "data": {
    "numero_pedido": "INTRANET-2025-001",
    "estado": "pending",
    "total": 45990,
    "subtotal": 45990,
    "moneda": "CLP",
    "originPlatform": "woo_moraleja",
    
    "items": [
      {
        "producto_id": 123,
        "sku": "LIBRO-MAT-M1",
        "nombre": "Matemática M1 PAES 2025",
        "cantidad": 1,
        "precio_unitario": 45990,
        "total": 45990,
        "subtotal": 45990,
        "impuestos": 0
      }
    ],
    
    "billing": {
      "first_name": "Juan",
      "last_name": "Pérez",
      "email": "juan.perez@example.com",
      "address_1": "Av. Providencia 123",
      "city": "Santiago",
      "country": "CL"
    },
    
    "shipping": {
      "first_name": "Juan",
      "last_name": "Pérez",
      "address_1": "Av. Providencia 123",
      "city": "Santiago",
      "country": "CL"
    }
  }
}
```

**Resultado:**
- ✅ Pedido creado con 1 producto
- ✅ Total: $45.990
- ✅ Subtotal: $45.990

---

### **Ejemplo 2: Pedido con múltiples items**

```json
{
  "data": {
    "numero_pedido": "INTRANET-2025-002",
    "estado": "pending",
    "total": 111970,  // 45990 + 65980
    "subtotal": 111970,
    "moneda": "CLP",
    "originPlatform": "woo_moraleja",
    
    "items": [
      {
        "producto_id": 123,
        "sku": "LIBRO-MAT-M1",
        "nombre": "Matemática M1 PAES 2025",
        "cantidad": 1,
        "precio_unitario": 45990,
        "total": 45990
      },
      {
        "producto_id": 456,
        "sku": "LIBRO-LEN",
        "nombre": "Lenguaje PAES 2025",
        "cantidad": 2,
        "precio_unitario": 32990,
        "total": 65980  // 32990 * 2
      }
    ],
    
    "billing": {
      "first_name": "María",
      "last_name": "González",
      "email": "maria@example.com",
      "address_1": "Calle Falsa 123",
      "city": "Santiago",
      "country": "CL"
    },
    
    "shipping": {
      "first_name": "María",
      "last_name": "González",
      "address_1": "Calle Falsa 123",
      "city": "Santiago",
      "country": "CL"
    }
  }
}
```

**Resultado:**
- ✅ Pedido creado con 2 productos
- ✅ Item 1: Matemática M1 x1 = $45.990
- ✅ Item 2: Lenguaje x2 = $65.980
- ✅ Total: $111.970

---

### **Ejemplo 3: Pedido sin producto_id (producto nuevo/manual)**

```json
{
  "data": {
    "numero_pedido": "INTRANET-2025-003",
    "items": [
      {
        // Sin producto_id ni sku (producto manual)
        "nombre": "Producto Personalizado",
        "cantidad": 1,
        "precio_unitario": 25000,
        "total": 25000
      }
    ]
  }
}
```

**Resultado:**
- ✅ Pedido creado con producto manual
- ✅ WooCommerce crea un "Fee" o item sin vincular a producto existente
- ✅ Total: $25.000

---

## 🧮 **CÁLCULO DE TOTALES**

### **Fórmula:**

```javascript
// Total de cada item
item.total = item.precio_unitario * item.cantidad

// Subtotal del pedido (suma de todos los items)
pedido.subtotal = items.reduce((sum, item) => sum + item.total, 0)

// Total del pedido (subtotal + envío + impuestos - descuentos)
pedido.total = pedido.subtotal + pedido.envio + pedido.impuestos - pedido.descuento
```

### **Ejemplo de cálculo:**

```javascript
const items = [
  { precio_unitario: 45990, cantidad: 1, total: 45990 },
  { precio_unitario: 32990, cantidad: 2, total: 65980 }
];

const subtotal = 45990 + 65980; // 111970
const envio = 5000;
const impuestos = 0;
const descuento = 1970;

const total = 111970 + 5000 + 0 - 1970; // 115000
```

---

## 🔍 **DEBUGGING: Verificar Payload Antes de Enviar**

### **Función helper para validar items:**

```javascript
function validarItems(items) {
  if (!items || !Array.isArray(items)) {
    console.error('❌ items no es un array');
    return false;
  }
  
  if (items.length === 0) {
    console.error('❌ items está vacío');
    return false;
  }
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (!item.nombre) {
      console.error(`❌ Item ${i + 1}: falta nombre`);
      return false;
    }
    
    if (!item.cantidad || item.cantidad <= 0) {
      console.error(`❌ Item ${i + 1}: cantidad inválida (${item.cantidad})`);
      return false;
    }
    
    if (item.precio_unitario === undefined || item.precio_unitario < 0) {
      console.error(`❌ Item ${i + 1}: precio_unitario inválido (${item.precio_unitario})`);
      return false;
    }
    
    if (item.total === undefined || item.total < 0) {
      console.error(`❌ Item ${i + 1}: total inválido (${item.total})`);
      return false;
    }
    
    // Verificar que total = precio_unitario * cantidad
    const totalEsperado = item.precio_unitario * item.cantidad;
    if (Math.abs(item.total - totalEsperado) > 0.01) {
      console.warn(`⚠️  Item ${i + 1}: total (${item.total}) no coincide con precio * cantidad (${totalEsperado})`);
    }
  }
  
  console.log(`✅ Items válidos: ${items.length} items`);
  return true;
}

// Uso antes de enviar
const payload = {
  data: {
    numero_pedido: "...",
    items: [...]
  }
};

if (validarItems(payload.data.items)) {
  // Enviar a Strapi
  const response = await fetch('/api/pedidos', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
} else {
  alert('Error: Los items del pedido no son válidos');
}
```

---

## 📊 **LOGS EN RAILWAY**

Después del deploy, al crear un pedido verás estos logs:

### **✅ Pedido con items correctos:**

```
═══════════════════════════════════════════════════════
[pedido.service] 🔨 Construyendo payload de WooCommerce
[pedido.service] 📦 Datos del pedido recibidos:
   - ID: abc123
   - Número: INTRANET-001
   - Estado: pending
   - Total: 45990
   - Subtotal: 45990
   - Moneda: CLP
   - Items en pedido.items: 2 items
[pedido.service] 📋 Detalle de items:
   Item 1:
      - nombre: Matemática M1 PAES 2025
      - producto_id: 123
      - sku: LIBRO-MAT-M1
      - cantidad: 1
      - precio_unitario: 45990
      - total: 45990
   Item 2:
      - nombre: Lenguaje PAES 2025
      - producto_id: 456
      - sku: LIBRO-LEN
      - cantidad: 2
      - precio_unitario: 32990
      - total: 65980
[pedido.service] ✅ Line item 1 mapeado: {"quantity":1,"name":"Matemática M1 PAES 2025",...}
[pedido.service] ✅ Line item 2 mapeado: {"quantity":2,"name":"Lenguaje PAES 2025",...}
[pedido.service] 📊 Total de line_items mapeados: 2
═══════════════════════════════════════════════════════
```

---

### **❌ Pedido sin items (problema):**

```
═══════════════════════════════════════════════════════
[pedido.service] 🔨 Construyendo payload de WooCommerce
[pedido.service] 📦 Datos del pedido recibidos:
   - ID: abc123
   - Número: INTRANET-001
   - Estado: pending
   - Total: 45990
   - Subtotal: 45990
   - Moneda: CLP
   - Items en pedido.items: NO HAY ITEMS  // ❌ PROBLEMA
⚠️  [pedido.service] EL PEDIDO NO TIENE ITEMS - WooCommerce creará pedido vacío
[pedido.service] 📊 Total de line_items mapeados: 0  // ❌ 0 items
═══════════════════════════════════════════════════════
```

**Si ves este log, significa que `items` está vacío o no se envió.**

---

## ✅ **CHECKLIST ANTES DE CREAR PEDIDO**

- [ ] `items` es un array (no null, no undefined)
- [ ] `items` tiene al menos 1 elemento
- [ ] Cada item tiene `nombre`
- [ ] Cada item tiene `cantidad` > 0
- [ ] Cada item tiene `precio_unitario` >= 0
- [ ] Cada item tiene `total` >= 0
- [ ] `total` de cada item = `precio_unitario` * `cantidad`
- [ ] `subtotal` del pedido = suma de todos los `total` de items
- [ ] `total` del pedido = `subtotal` + `envio` + `impuestos` - `descuento`
- [ ] `originPlatform` está presente (`woo_moraleja` o `woo_escolar`)

---

## 🚀 **PRÓXIMOS PASOS**

1. **Verificar el código frontend que construye el payload**
2. **Asegurarse de que `items` se está enviando correctamente**
3. **Probar con el payload de ejemplo**
4. **Ver los logs en Railway para confirmar que los items llegan**
5. **Compartir los logs si el problema persiste**

---

## 📞 **SI EL PROBLEMA PERSISTE**

Después del redeploy (2-3 min), crea un pedido de prueba y comparte:

1. **El payload que estás enviando** (request completo)
2. **Los logs de Railway** (filtrar por "pedido.service")
3. **Screenshot del pedido en WooCommerce**

Esto nos permitirá identificar exactamente dónde se pierden los items.

---

**Última actualización:** 2025-12-28  
**Commit:** 0535356

