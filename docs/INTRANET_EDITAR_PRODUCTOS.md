# 📝 GUÍA: Editar Productos desde la Intranet

## ✅ RESUMEN

La edición de productos ahora funciona **100% correctamente** gracias a la **preservación automática de `externalIds`** implementada en Strapi.

---

## 🔄 FLUJO DE ACTUALIZACIÓN

```
Intranet envía PUT /api/libros/:id
    ↓
Strapi beforeUpdate ejecuta
    ↓
✅ Preserva externalIds automáticamente si no viene en el payload
    ↓
Strapi afterUpdate ejecuta
    ↓
syncToWooCommerce busca externalIds
    ↓
✅ Encuentra IDs existentes → Actualiza en WooCommerce
    ↓
Producto actualizado correctamente ✅
```

---

## 📊 MÉTODOS DE ACTUALIZACIÓN

### Método 1: Actualización Simple (Recomendado)

**No necesitas incluir `externalIds`**, Strapi los preserva automáticamente.

```javascript
// Actualizar solo los campos que cambien
const payload = {
  data: {
    nombre_libro: "Nuevo título",
    precio: 49990,
    descripcion: "Nueva descripción"
  }
};

await fetch(`https://strapi.moraleja.cl/api/libros/${productoId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});
```

**Resultado:** ✅ Strapi preserva `externalIds` automáticamente y actualiza en WooCommerce.

---

### Método 2: Actualización con `rawWooData` (Para campos avanzados)

Si necesitas actualizar campos específicos de WooCommerce (description, short_description, dimensions, etc.):

```javascript
const payload = {
  data: {
    nombre_libro: "Producto Actualizado",
    rawWooData: {
      name: "Producto Actualizado",
      description: "Descripción HTML completa del producto",
      short_description: "Resumen breve",
      regular_price: "49990.00",
      sale_price: "39990.00",
      weight: "0.5",
      dimensions: {
        length: "21",
        width: "15",
        height: "2"
      },
      shipping_class: "envio-rapido",
      categories: [
        { id: 25 }
      ],
      tags: [
        { id: 10 },
        { id: 15 }
      ]
    }
  }
};

await fetch(`https://strapi.moraleja.cl/api/libros/${productoId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});
```

**Resultado:** ✅ Strapi actualiza en WooCommerce usando `rawWooData` directamente.

---

### Método 3: Actualización Completa (Obtener primero, luego actualizar)

**Útil si quieres verificar datos antes de actualizar:**

```javascript
// 1. Obtener producto actual
const responseGet = await fetch(
  `https://strapi.moraleja.cl/api/libros/${productoId}?populate=*`
);
const productoActual = await responseGet.json();

// 2. Modificar solo lo necesario
const payload = {
  data: {
    ...productoActual.data.attributes,
    nombre_libro: "Título Modificado",
    precio: 59990,
    // externalIds se preserva automáticamente, pero puedes incluirlo si quieres
    externalIds: productoActual.data.attributes.externalIds
  }
};

// 3. Actualizar
await fetch(`https://strapi.moraleja.cl/api/libros/${productoId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});
```

---

## 🔍 VERIFICAR SI LA ACTUALIZACIÓN FUNCIONÓ

### 1. Ver Logs de Strapi (Railway)

```bash
# Buscar en los logs:
✅ [woo-sync] Producto actualizado en woo_moraleja: 100
✅ [woo-sync] Producto actualizado en woo_escolar: 200
✅ [libro] Libro sincronizado a WooCommerce
```

---

### 2. Verificar en WooCommerce

**Moraleja:**
```
https://moraleja.cl/wp-admin/post.php?post=100&action=edit
```

**Escolar:**
```
https://escolar.cl/wp-admin/post.php?post=200&action=edit
```

---

### 3. Verificar `externalIds` en Strapi

```javascript
const response = await fetch(
  `https://strapi.moraleja.cl/api/libros/${productoId}`
);
const producto = await response.json();

console.log('externalIds:', producto.data.attributes.externalIds);
// Debe mostrar:
// {
//   "woo_moraleja": 100,
//   "woo_escolar": 200
// }
```

---

## ⚠️ CASOS ESPECIALES

### Cambiar el estado de publicación

**Si cambias el estado a "Pendiente" o "Borrador":**

```javascript
const payload = {
  data: {
    estado_publicacion: "Pendiente"
  }
};
```

**Resultado:** ⚠️ El producto NO se sincroniza a WooCommerce (permanece como está en WooCommerce).

---

**Si cambias el estado de "Pendiente" a "Publicado":**

```javascript
const payload = {
  data: {
    estado_publicacion: "Publicado"
  }
};
```

**Resultado:** ✅ El producto se sincroniza/actualiza en WooCommerce.

---

### Agregar o quitar canales

**Agregar un canal nuevo:**

```javascript
// Obtener producto actual
const response = await fetch(
  `https://strapi.moraleja.cl/api/libros/${productoId}?populate=*`
);
const producto = await response.json();

// Agregar nuevo canal (ej: escolar)
const canalesActuales = producto.data.attributes.canales.data.map(c => c.id);
const canalesNuevos = [...canalesActuales, 2]; // ID 2 = escolar

const payload = {
  data: {
    canales: canalesNuevos,
    estado_publicacion: "Publicado" // Debe estar publicado para sincronizar
  }
};

await fetch(`https://strapi.moraleja.cl/api/libros/${productoId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});
```

**Resultado:** ✅ Se crea el producto en el nuevo canal y se actualiza `externalIds`.

---

**Quitar un canal:**

```javascript
const payload = {
  data: {
    canales: [1] // Solo moraleja (ID 1)
  }
};
```

**Resultado:** ⚠️ El producto se actualiza en moraleja, pero NO se elimina de escolar en WooCommerce (requiere eliminación manual).

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### Error: "Producto duplicado en WooCommerce"

**Causa:** Los `externalIds` se perdieron o son incorrectos.

**Solución:**
1. Verificar en Strapi Admin que el producto tiene `externalIds`
2. Si están vacíos, buscar el ID del producto en WooCommerce manualmente
3. Actualizar el producto en Strapi con los IDs correctos:

```javascript
const payload = {
  data: {
    externalIds: {
      woo_moraleja: 100, // ID real de WooCommerce Moraleja
      woo_escolar: 200   // ID real de WooCommerce Escolar
    }
  }
};
```

---

### Error: "Estado de publicación incorrecto"

**Causa:** El producto está en estado "Pendiente" o "Borrador".

**Solución:** Cambiar a "Publicado":

```javascript
const payload = {
  data: {
    estado_publicacion: "Publicado"
  }
};
```

---

### Error: "Sin canales asignados"

**Causa:** El producto no tiene canales (moraleja o escolar).

**Solución:** Asignar al menos un canal:

```javascript
const payload = {
  data: {
    canales: [1, 2] // 1 = moraleja, 2 = escolar
  }
};
```

---

## 📋 CHECKLIST DE ACTUALIZACIÓN EXITOSA

Antes de actualizar, verificar:

- [x] El producto existe en Strapi
- [x] Tiene `estado_publicacion: "Publicado"`
- [x] Tiene al menos un canal asignado (moraleja o escolar)
- [x] Los `externalIds` existen (Strapi los preserva automáticamente)

Después de actualizar:

- [x] Ver logs de Strapi: debe aparecer "✅ Producto actualizado en woo_..."
- [x] Verificar en WooCommerce que los cambios se reflejaron
- [x] Verificar que NO se creó un producto duplicado

---

## 🎯 RESUMEN PARA DESARROLLADORES

### ¿Qué hace Strapi automáticamente?

1. ✅ **Preserva `externalIds`** aunque no lo incluyas en el payload
2. ✅ **Detecta si el producto ya existe en WooCommerce** usando `externalIds`
3. ✅ **Actualiza en WooCommerce** en lugar de crear uno nuevo
4. ✅ **Maneja errores de imagen** automáticamente (reintenta sin imagen)
5. ✅ **Logs detallados** para debugging

### ¿Qué debes hacer desde la Intranet?

1. ✅ **Enviar PUT con los campos que cambien**
2. ❌ **NO necesitas incluir `externalIds`** (se preservan automáticamente)
3. ✅ **Opcional:** Usar `rawWooData` para campos avanzados de WooCommerce
4. ✅ **Verificar logs** de Strapi para confirmar actualización exitosa

---

## ✅ CONCLUSIÓN

La edición de productos funciona **100% correctamente**. Gracias a la **preservación automática de `externalIds`**, no tienes que preocuparte por incluirlos en el payload. Simplemente envía los campos que quieras actualizar y Strapi se encarga del resto.

**🎉 Actualización simplificada, sin productos duplicados, sin complicaciones.**

