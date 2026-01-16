# 📢 ACTUALIZACIÓN IMPORTANTE: Edición de Productos Mejorada

## ✅ CAMBIOS IMPLEMENTADOS EN STRAPI

### 1. **Preservación Automática de `externalIds`** 🎉

**ANTES:**
- Tenías que obtener el producto completo antes de actualizar
- Debías incluir `externalIds` en cada actualización
- Si no lo incluías, se creaban productos duplicados en WooCommerce

**AHORA:**
- ✅ Strapi preserva `externalIds` automáticamente
- ✅ **Ya NO necesitas incluir `externalIds` al actualizar**
- ✅ No se crearán productos duplicados

---

### 2. **Actualización Simplificada**

**Ejemplo de actualización (nuevo método recomendado):**

```javascript
// ✅ SIMPLE: Solo envía los campos que cambien
const payload = {
  data: {
    nombre_libro: "Título Editado",
    precio: 49990,
    descripcion: "Nueva descripción"
    // ✅ NO necesitas incluir externalIds
  }
};

await fetch(`https://strapi.moraleja.cl/api/libros/${productoId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

**Resultado:** ✅ Strapi actualiza el producto en WooCommerce correctamente, sin crear duplicados.

---

### 3. **`rawWooData` Sigue Funcionando**

Si necesitas actualizar campos específicos de WooCommerce (description, short_description, dimensions, etc.), sigue usando `rawWooData`:

```javascript
const payload = {
  data: {
    nombre_libro: "Producto Actualizado",
    rawWooData: {
      name: "Producto Actualizado",
      description: "Descripción HTML completa",
      short_description: "Resumen breve",
      regular_price: "49990.00",
      sale_price: "39990.00",
      weight: "0.5",
      dimensions: {
        length: "21",
        width: "15",
        height: "2"
      },
      shipping_class: "envio-rapido"
    }
    // ✅ NO necesitas incluir externalIds
  }
};
```

---

### 4. **Manejo Automático de Errores de Imagen**

- ✅ Si hay errores de permisos de imagen, Strapi reintenta automáticamente sin la imagen
- ✅ El producto se crea/actualiza correctamente de todas formas
- ✅ Los logs son más claros (advertencia en lugar de error)

---

## 🎯 QUÉ HACER AHORA

### Para CREAR productos:
```javascript
// Método actual (sigue igual)
const payload = {
  data: {
    isbn_libro: "123456789",
    nombre_libro: "Nuevo Producto",
    precio: 49990,
    estado_publicacion: "Publicado",
    canales: [1, 2], // 1 = moraleja, 2 = escolar
    rawWooData: {
      // ... datos completos de WooCommerce
    }
  }
};

await fetch('https://strapi.moraleja.cl/api/libros', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

---

### Para ACTUALIZAR productos:

**Opción 1: Actualización Simple (RECOMENDADO) 🌟**
```javascript
// ✅ Más simple, más rápido
const payload = {
  data: {
    nombre_libro: "Título Editado",
    precio: 59990
    // ✅ NO incluir externalIds (se preservan automáticamente)
  }
};

await fetch(`https://strapi.moraleja.cl/api/libros/${productoId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

**Opción 2: Actualización con rawWooData (para campos avanzados)**
```javascript
const payload = {
  data: {
    nombre_libro: "Título Editado",
    rawWooData: {
      name: "Título Editado",
      description: "Nueva descripción completa",
      short_description: "Nuevo resumen",
      regular_price: "59990.00",
      weight: "0.8",
      dimensions: {
        length: "25",
        width: "18",
        height: "3"
      }
    }
    // ✅ NO incluir externalIds (se preservan automáticamente)
  }
};
```

---

## ⚠️ IMPORTANTE

### Campos que SE DEBEN ENVIAR (cuando crees productos):
- ✅ `isbn_libro`
- ✅ `nombre_libro`
- ✅ `estado_publicacion: "Publicado"` (para que se sincronice)
- ✅ `canales: [1, 2]` (al menos uno: 1=moraleja, 2=escolar)
- ✅ `rawWooData` (si quieres control total de campos WooCommerce)

### Campos que YA NO necesitas enviar (al actualizar):
- ❌ `externalIds` → Strapi lo preserva automáticamente
- ❌ Relaciones que no cambien
- ❌ Campos que no hayas modificado

---

## 📋 RESUMEN PARA LA IA DE INTRANET

**Cambios clave:**
1. ✅ **externalIds** se preservan automáticamente → NO necesitas incluirlos al actualizar
2. ✅ **Actualización simplificada** → Solo envía los campos que cambien
3. ✅ **rawWooData** funciona igual que antes
4. ✅ **Sin productos duplicados** → Strapi detecta automáticamente si el producto ya existe en WooCommerce
5. ✅ **Errores de imagen manejados** → El producto se crea/actualiza aunque falle la imagen

**Beneficios:**
- 🚀 Menos código necesario
- 🚀 Actualizaciones más rápidas
- 🚀 Menos errores
- 🚀 No más productos duplicados

---

## 🎉 CONCLUSIÓN

**La edición de productos ahora es mucho más simple y segura.**

Puedes actualizar productos enviando solo los campos que cambien, sin preocuparte por incluir `externalIds` o que se creen duplicados.

**Todo funciona automáticamente.** ✅

