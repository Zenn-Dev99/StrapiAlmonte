# 📦 Intranet: Uso de `rawWooData` para Sincronización Completa con WooCommerce

## ✅ IMPLEMENTADO

El campo `rawWooData` ya está implementado en Strapi y **funcionando correctamente**.

Cuando envías un producto desde la Intranet con `rawWooData`, Strapi lo usa **directamente** sin reconstruir nada, garantizando que **TODOS** los campos lleguen a WooCommerce exactamente como los envías.

---

## 📊 CÓMO FUNCIONA

### 1. Flujo Normal (SIN `rawWooData`)

```
Intranet → Strapi → buildWooProduct() → Construye producto desde campos individuales → WooCommerce
```

**Problema:** Algunos campos pueden perderse o no mapearse correctamente.

### 2. Flujo con `rawWooData` (NUEVO)

```
Intranet → Strapi (con rawWooData) → Usa rawWooData directamente → WooCommerce
```

**Ventaja:** **TODOS** los campos llegan exactamente como los envías.

---

## 📤 ESTRUCTURA DEL PAYLOAD

### Payload Completo desde Intranet

```json
{
  "data": {
    // Campos básicos de Strapi (requeridos)
    "isbn_libro": "9789563134278",
    "nombre_libro": "Libro de Prueba",
    "estado_publicacion": "Publicado",
    "canales": [1, 2],  // Moraleja y Escolar
    
    // ⚠️ NUEVO: rawWooData con TODOS los datos de WooCommerce
    "rawWooData": {
      // Información básica
      "name": "Libro de Prueba",
      "type": "simple",
      "status": "publish",
      "featured": false,
      "catalog_visibility": "visible",
      
      // ✅ Descripción completa (HTML permitido)
      "description": "<p>Esta es la <strong>descripción completa</strong> del producto.</p><p>Puede tener múltiples párrafos y HTML.</p>",
      
      // ✅ Descripción corta
      "short_description": "Descripción breve que aparece en la lista de productos",
      
      // ✅ SKU
      "sku": "9789563134278",
      
      // ✅ Precios (como strings con 2 decimales)
      "regular_price": "45990.00",
      "sale_price": "39990.00",  // Solo si hay oferta
      
      // ✅ Stock
      "manage_stock": true,
      "stock_quantity": 10,
      "stock_status": "instock",
      "backorders": "no",
      "sold_individually": false,
      
      // ✅ Peso y dimensiones (como strings)
      "weight": "0.5",
      "dimensions": {
        "length": "20",
        "width": "15",
        "height": "2"
      },
      
      // ✅ Clase de envío
      "shipping_class": "standard",
      
      // ✅ Configuración adicional
      "virtual": false,
      "downloadable": false,
      "reviews_allowed": true,
      "menu_order": 0,
      "purchase_note": "",
      
      // Categorías, etiquetas, etc. (IDs de WooCommerce)
      "categories": [
        { "id": 15 }
      ],
      "tags": [
        { "id": 34 }
      ]
    }
  }
}
```

---

## 🔍 CAMPOS CLAVE DE `rawWooData`

### Descripción Completa (`description`)

```javascript
rawWooData: {
  description: "<p>Descripción <strong>completa</strong> del producto.</p>"
}
```

- ✅ Acepta HTML
- ✅ Puede tener múltiples párrafos
- ✅ Acepta etiquetas como `<strong>`, `<em>`, `<ul>`, `<li>`, etc.

### Descripción Corta (`short_description`)

```javascript
rawWooData: {
  short_description: "Breve resumen del producto"
}
```

- ✅ Aparece en la lista de productos
- ⚠️ Recomendado: 150-200 caracteres

### Precios

```javascript
rawWooData: {
  regular_price: "45990.00",  // Precio normal (string con 2 decimales)
  sale_price: "39990.00"      // Precio rebajado (opcional, solo si hay oferta)
}
```

- ⚠️ **Importante:** Deben ser **strings**, no números
- ⚠️ **Formato:** Siempre con 2 decimales: `"45990.00"`, no `45990` ni `"45990"`

### Peso y Dimensiones

```javascript
rawWooData: {
  weight: "0.5",  // En kg (string)
  dimensions: {
    length: "20",  // En cm (string)
    width: "15",   // En cm (string)
    height: "2"    // En cm (string)
  }
}
```

- ⚠️ **Importante:** Todos como **strings**
- ✅ Unidades: peso en kg, dimensiones en cm

### Clase de Envío (`shipping_class`)

```javascript
rawWooData: {
  shipping_class: "standard"  // Slug de la clase de envío
}
```

- ✅ Valores comunes: `"standard"`, `"express"`, `"free"`, etc.
- ⚠️ Debe existir en WooCommerce

---

## 🚀 EJEMPLO COMPLETO DE IMPLEMENTACIÓN

```javascript
// ═══════════════════════════════════════════════════════
// Función para crear producto con rawWooData
// ═══════════════════════════════════════════════════════

async function crearProductoCompleto(datosProducto) {
  // 1. Obtener IDs de canales
  if (!CANALES) {
    await inicializarCanales();
  }
  
  // 2. Construir rawWooData con TODOS los datos de WooCommerce
  const rawWooData = {
    // Información básica
    name: datosProducto.nombre,
    type: "simple",
    status: "publish",
    featured: datosProducto.destacado || false,
    catalog_visibility: "visible",
    
    // Descripciones
    description: datosProducto.descripcionCompleta || "",
    short_description: datosProducto.descripcionCorta || "",
    
    // SKU y precios
    sku: datosProducto.isbn,
    regular_price: datosProducto.precio.toFixed(2),  // Convertir a string con 2 decimales
    sale_price: datosProducto.precioRebajado ? datosProducto.precioRebajado.toFixed(2) : undefined,
    
    // Stock
    manage_stock: true,
    stock_quantity: datosProducto.stock || 0,
    stock_status: (datosProducto.stock || 0) > 0 ? "instock" : "outofstock",
    backorders: "no",
    sold_individually: false,
    
    // Peso y dimensiones
    weight: datosProducto.peso ? datosProducto.peso.toFixed(2) : undefined,
    dimensions: datosProducto.dimensiones ? {
      length: datosProducto.dimensiones.largo.toFixed(2),
      width: datosProducto.dimensiones.ancho.toFixed(2),
      height: datosProducto.dimensiones.alto.toFixed(2)
    } : undefined,
    
    // Clase de envío
    shipping_class: datosProducto.claseEnvio || "standard",
    
    // Configuración
    virtual: false,
    downloadable: false,
    reviews_allowed: true,
    menu_order: 0,
    purchase_note: datosProducto.notaCompra || ""
  };
  
  // 3. Construir payload completo para Strapi
  const payload = {
    data: {
      // Campos de Strapi
      isbn_libro: datosProducto.isbn,
      nombre_libro: datosProducto.nombre,
      subtitulo_libro: datosProducto.subtitulo || null,
      precio: datosProducto.precio,
      stock_quantity: datosProducto.stock || 0,
      estado_publicacion: "Publicado",
      canales: [CANALES.moraleja, CANALES.escolar],
      
      // Relaciones
      autor_relacion: datosProducto.autorId || null,
      editorial: datosProducto.editorialId || null,
      categorias_producto: datosProducto.categoriasIds || [],
      
      // ⚠️ CRÍTICO: rawWooData con TODOS los datos de WooCommerce
      rawWooData: rawWooData
    }
  };
  
  // 4. Logging para debugging
  console.log('═══════════════════════════════════════════════════════');
  console.log('📤 Creando producto con rawWooData');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Nombre:', payload.data.nombre_libro);
  console.log('ISBN:', payload.data.isbn_libro);
  console.log('rawWooData presente:', !!payload.data.rawWooData);
  console.log('rawWooData keys:', Object.keys(payload.data.rawWooData || {}));
  console.log('═══════════════════════════════════════════════════════');
  
  // 5. Enviar a Strapi
  const response = await fetch('https://strapi.moraleja.cl/api/libros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${await response.text()}`);
  }
  
  const result = await response.json();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ PRODUCTO CREADO EN STRAPI');
  console.log('ID:', result.data.id);
  console.log('⏳ Sincronizando con WooCommerce...');
  console.log('═══════════════════════════════════════════════════════');
  
  return result.data;
}
```

---

## 🔍 VERIFICAR QUE FUNCIONA

### 1. En la Consola del Navegador (F12)

Deberías ver:

```
📤 Creando producto con rawWooData
rawWooData presente: true
rawWooData keys: ["name", "description", "short_description", "regular_price", ...]
✅ PRODUCTO CREADO EN STRAPI
⏳ Sincronizando con WooCommerce...
```

### 2. En los Logs de Railway (Strapi)

Busca estas líneas:

```
[woo-sync] ✅ Usando rawWooData desde Intranet
[woo-sync] 📦 rawWooData: { ... }
[woo-sync] ✅ Producto construido desde rawWooData
✅ [woo-sync] Producto creado en woo_moraleja: 12345
```

### 3. En WooCommerce

Verifica que el producto tiene:
- ✅ Descripción completa (pestaña "Description")
- ✅ Descripción corta (en la lista de productos)
- ✅ Precio rebajado (si se especificó)
- ✅ Peso y dimensiones (pestaña "Shipping")
- ✅ Clase de envío

---

## ⚠️ ERRORES COMUNES

### Error 1: Precios como números en lugar de strings

❌ **INCORRECTO:**
```javascript
rawWooData: {
  regular_price: 45990,  // Número
  sale_price: 39990      // Número
}
```

✅ **CORRECTO:**
```javascript
rawWooData: {
  regular_price: "45990.00",  // String con 2 decimales
  sale_price: "39990.00"      // String con 2 decimales
}
```

### Error 2: Dimensiones sin convertir a strings

❌ **INCORRECTO:**
```javascript
rawWooData: {
  dimensions: {
    length: 20,  // Número
    width: 15,   // Número
    height: 2    // Número
  }
}
```

✅ **CORRECTO:**
```javascript
rawWooData: {
  dimensions: {
    length: "20",  // String
    width: "15",   // String
    height: "2"    // String
  }
}
```

### Error 3: No enviar `estado_publicacion` y `canales`

❌ **INCORRECTO:**
```javascript
{
  data: {
    isbn_libro: "...",
    rawWooData: { ... }
    // ❌ Faltan estado_publicacion y canales
  }
}
```

✅ **CORRECTO:**
```javascript
{
  data: {
    isbn_libro: "...",
    estado_publicacion: "Publicado",  // ⚠️ OBLIGATORIO
    canales: [1, 2],                  // ⚠️ OBLIGATORIO
    rawWooData: { ... }
  }
}
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Implementar función para construir `rawWooData`
- [ ] Convertir precios a strings con `.toFixed(2)`
- [ ] Convertir peso y dimensiones a strings
- [ ] Incluir `description` completa
- [ ] Incluir `short_description`
- [ ] Incluir `sale_price` si hay oferta
- [ ] Incluir siempre `estado_publicacion: "Publicado"`
- [ ] Incluir siempre `canales: [1, 2]`
- [ ] Probar creando un producto
- [ ] Verificar logs de Strapi que dice "Usando rawWooData"
- [ ] Verificar en WooCommerce que todos los campos aparecen

---

## 🎯 RESUMEN

**Ventajas de usar `rawWooData`:**
- ✅ **TODOS** los campos llegan a WooCommerce
- ✅ Control total sobre el formato
- ✅ No depende del mapeo interno de Strapi
- ✅ Funciona tanto para crear como para actualizar

**Implementación:**
1. Construir objeto `rawWooData` con todos los datos de WooCommerce
2. Convertir números a strings donde sea necesario
3. Incluir en el payload a Strapi
4. Strapi lo usará directamente

Una vez implementado, **TODOS** los campos se sincronizarán correctamente. 🎉

