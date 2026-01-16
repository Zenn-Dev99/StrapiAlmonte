# 📋 Campos Permitidos en la API de Libros

## ❌ PROBLEMA IDENTIFICADO

**Error:** `Invalid key backorders`

**Causa:** La Intranet está enviando campos que **NO existen** en el esquema de Strapi directamente en `data`.

**Solución:** Enviar solo los campos permitidos en `data`, y todos los campos específicos de WooCommerce dentro de `rawWooData`.

---

## ✅ CAMPOS PERMITIDOS EN `data`

### **Campos Básicos del Libro**

```javascript
{
  data: {
    // ✅ Información básica
    isbn_libro: "9788491820123",           // string (requerido, único)
    nombre_libro: "Cálculo I",             // string (requerido)
    subtitulo_libro: "10ª Edición",        // string (opcional)
    descripcion: "Descripción del libro",  // blocks (opcional)
    
    // ✅ Precio y Stock (campos principales)
    precio: 49990,                         // decimal (opcional)
    precio_regular: 49990,                 // decimal (opcional)
    precio_oferta: 39990,                  // decimal (opcional)
    stock_quantity: 100,                   // integer (opcional)
    manage_stock: true,                    // boolean (opcional)
    stock_status: "instock",               // enum: instock|outofstock|onbackorder
    
    // ✅ Dimensiones y Peso
    weight: 0.5,                           // decimal (opcional)
    length: 21,                            // decimal (opcional)
    width: 15,                             // decimal (opcional)
    height: 2,                             // decimal (opcional)
    
    // ✅ Publicación
    estado_publicacion: "Publicado",       // string (Publicado|Pendiente|Borrador)
    canales: [1, 2],                       // array de IDs (1=moraleja, 2=escolar)
    
    // ✅ rawWooData (TODOS los campos de WooCommerce van aquí)
    rawWooData: {
      // Todos los campos específicos de WooCommerce
      // (ver sección detallada abajo)
    }
  }
}
```

---

## ✅ CAMPOS QUE VAN EN `rawWooData`

**IMPORTANTE:** Todos los campos específicos de WooCommerce deben ir dentro de `rawWooData`, NO directamente en `data`.

```javascript
{
  data: {
    nombre_libro: "Cálculo I",
    precio: 49990,
    
    // ✅ Aquí van TODOS los campos de WooCommerce
    rawWooData: {
      // Información básica
      name: "Cálculo I - 10ª Edición",
      slug: "calculo-i-10-edicion",
      type: "simple",
      status: "publish",                    // publish|draft|pending
      featured: false,
      catalog_visibility: "visible",
      
      // Descripción
      description: "<p>Descripción HTML completa</p>",
      short_description: "<p>Resumen breve</p>",
      
      // Precio
      regular_price: "49990.00",            // string con decimales
      sale_price: "39990.00",               // string con decimales (opcional)
      date_on_sale_from: null,              // fecha inicio oferta (opcional)
      date_on_sale_to: null,                // fecha fin oferta (opcional)
      
      // Stock
      manage_stock: true,
      stock_quantity: 100,
      stock_status: "instock",              // instock|outofstock|onbackorder
      backorders: "no",                     // ✅ AQUÍ va backorders, NO en data
      backorders_allowed: false,
      
      // Dimensiones y Envío
      weight: "0.5",                        // string
      dimensions: {
        length: "21",                       // string
        width: "15",                        // string
        height: "2"                         // string
      },
      shipping_class: "envio-rapido",       // string (opcional)
      shipping_required: true,
      shipping_taxable: true,
      
      // Categorías y Tags
      categories: [
        { id: 25 },
        { id: 30 }
      ],
      tags: [
        { id: 10 },
        { id: 15 }
      ],
      
      // Imágenes
      images: [
        {
          src: "https://example.com/image.jpg",
          name: "Portada",
          alt: "Portada del libro"
        }
      ],
      
      // Atributos
      attributes: [
        {
          id: 1,
          name: "Autor",
          position: 0,
          visible: true,
          variation: false,
          options: ["Juan Pérez"]
        }
      ],
      
      // Otros campos de WooCommerce
      sold_individually: false,
      reviews_allowed: true,
      purchase_note: "",
      menu_order: 0,
      virtual: false,
      downloadable: false,
      tax_status: "taxable",
      tax_class: ""
    }
  }
}
```

---

## ❌ CAMPOS QUE NO DEBES ENVIAR EN `data`

Estos campos **NO existen** en el esquema de Strapi y causan error 400:

```javascript
{
  data: {
    // ❌ NO enviar estos campos directamente en data:
    backorders: "no",              // Va en rawWooData
    backorders_allowed: false,     // Va en rawWooData
    sold_individually: false,      // Va en rawWooData
    reviews_allowed: true,         // Va en rawWooData
    catalog_visibility: "visible", // Va en rawWooData
    featured: false,               // Va en rawWooData
    virtual: false,                // Va en rawWooData
    downloadable: false,           // Va en rawWooData
    tax_status: "taxable",         // Va en rawWooData
    tax_class: "",                 // Va en rawWooData
    shipping_class: "",            // Va en rawWooData
    
    // ❌ Tampoco enviar estos campos de metadatos:
    date_on_sale_from: null,
    date_on_sale_to: null,
    purchase_note: "",
    menu_order: 0
  }
}
```

---

## ✅ EJEMPLO COMPLETO DE ACTUALIZACIÓN CORRECTA

### **Actualizar solo precio:**

```javascript
// ✅ CORRECTO
const payload = {
  data: {
    precio: 59990,
    rawWooData: {
      name: "Cálculo I",
      regular_price: "59990.00",
      description: "Descripción",
      short_description: "Resumen"
    }
  }
};

await fetch(`https://strapi.moraleja.cl/api/libros/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

---

### **Actualizar precio y stock:**

```javascript
// ✅ CORRECTO
const payload = {
  data: {
    precio: 59990,
    stock_quantity: 50,
    manage_stock: true,
    stock_status: "instock",
    
    rawWooData: {
      name: "Cálculo I",
      regular_price: "59990.00",
      description: "Descripción",
      short_description: "Resumen",
      manage_stock: true,
      stock_quantity: 50,
      stock_status: "instock",
      backorders: "no"  // ✅ AQUÍ va backorders
    }
  }
};
```

---

### **Actualizar producto completo:**

```javascript
// ✅ CORRECTO
const payload = {
  data: {
    nombre_libro: "Cálculo I - Editado",
    precio: 59990,
    stock_quantity: 50,
    estado_publicacion: "Publicado",
    canales: [1, 2],
    
    rawWooData: {
      name: "Cálculo I - Editado",
      description: "<p>Descripción HTML completa del libro</p>",
      short_description: "<p>Resumen breve del contenido</p>",
      regular_price: "59990.00",
      sale_price: "49990.00",
      manage_stock: true,
      stock_quantity: 50,
      stock_status: "instock",
      backorders: "no",              // ✅ En rawWooData
      backorders_allowed: false,     // ✅ En rawWooData
      weight: "0.8",
      dimensions: {
        length: "25",
        width: "18",
        height: "3"
      },
      shipping_class: "envio-rapido",
      categories: [{ id: 25 }],
      tags: [{ id: 10 }]
    }
  }
};
```

---

## ❌ EJEMPLO DE PAYLOAD INCORRECTO (causa error)

```javascript
// ❌ INCORRECTO - Causa error 400
const payload = {
  data: {
    nombre_libro: "Cálculo I",
    precio: 59990,
    backorders: "no",  // ❌ ERROR: Este campo no existe en el esquema
    
    rawWooData: {
      name: "Cálculo I",
      regular_price: "59990.00"
    }
  }
};

// Error: Invalid key backorders
```

---

## 🔍 CÓMO DETECTAR EL ERROR

### **Error en consola:**
```
[Strapi Client PUT] ❌ Error en respuesta: {
  details: { key: "backorders", source: "body" }
}
status: 400
statusText: 'Bad Request'

Error: Invalid key backorders
```

### **Causa:**
El campo `backorders` está en `data` en lugar de `rawWooData`.

### **Solución:**
Mover `backorders` dentro de `rawWooData`.

---

## 📊 RESUMEN RÁPIDO

| Campo | ¿Dónde va? | Tipo |
|-------|-----------|------|
| `nombre_libro` | `data` | string |
| `precio` | `data` | decimal |
| `stock_quantity` | `data` | integer |
| `weight` | `data` | decimal |
| `length`, `width`, `height` | `data` | decimal |
| `estado_publicacion` | `data` | string |
| `canales` | `data` | array |
| **`backorders`** | **`rawWooData`** | string |
| **`backorders_allowed`** | **`rawWooData`** | boolean |
| **`shipping_class`** | **`rawWooData`** | string |
| **`sold_individually`** | **`rawWooData`** | boolean |
| **`reviews_allowed`** | **`rawWooData`** | boolean |
| **`featured`** | **`rawWooData`** | boolean |
| **Todos los demás campos de WooCommerce** | **`rawWooData`** | varios |

---

## 🎯 REGLA GENERAL

**Si el campo existe en el esquema de Strapi → va en `data`**
**Si el campo es específico de WooCommerce → va en `rawWooData`**

---

## ✅ SOLUCIÓN PARA TU ERROR ACTUAL

**Tu payload actual (INCORRECTO):**
```javascript
{
  data: {
    precio: 59990,
    backorders: "no"  // ❌ ERROR
  }
}
```

**Payload corregido (CORRECTO):**
```javascript
{
  data: {
    precio: 59990,
    rawWooData: {
      name: "Nombre del producto",
      regular_price: "59990.00",
      description: "Descripción",
      short_description: "Resumen",
      backorders: "no"  // ✅ CORRECTO
    }
  }
}
```

---

## 🚀 IMPLEMENTAR EN LA INTRANET

### **En el hook useActualizarProducto:**

```javascript
const actualizarProducto = async (productoId, datosFormulario) => {
  // Construir payload correctamente
  const payload = {
    data: {
      // ✅ Campos directos en data (solo los que existen en el esquema)
      nombre_libro: datosFormulario.nombre_libro,
      precio: datosFormulario.precio,
      stock_quantity: datosFormulario.stock,
      estado_publicacion: datosFormulario.estado_publicacion,
      canales: datosFormulario.canales,
      
      // ✅ Todos los campos de WooCommerce en rawWooData
      rawWooData: {
        name: datosFormulario.nombre_libro,
        description: datosFormulario.descripcion,
        short_description: datosFormulario.descripcion?.substring(0, 150),
        regular_price: datosFormulario.precio.toString(),
        sale_price: datosFormulario.precio_oferta || "",
        manage_stock: true,
        stock_quantity: datosFormulario.stock,
        stock_status: datosFormulario.stock > 0 ? "instock" : "outofstock",
        backorders: "no",              // ✅ Aquí va backorders
        backorders_allowed: false,     // ✅ Aquí va backorders_allowed
        weight: datosFormulario.peso || "",
        dimensions: {
          length: datosFormulario.largo || "",
          width: datosFormulario.ancho || "",
          height: datosFormulario.alto || ""
        },
        shipping_class: datosFormulario.clase_envio || ""
      }
    }
  };
  
  const response = await fetch(
    `https://strapi.moraleja.cl/api/libros/${productoId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    console.error('Error:', error);
    throw new Error(error.error?.message || 'Error al actualizar');
  }
  
  return await response.json();
};
```

---

## ✅ CONCLUSIÓN

**El campo `backorders` (y otros campos de WooCommerce) deben ir dentro de `rawWooData`, NO directamente en `data`.**

Actualiza tu código de la Intranet para construir el payload correctamente y el error desaparecerá.

