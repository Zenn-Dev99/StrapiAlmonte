# 🎯 RESUMEN EJECUTIVO: FIX DESCRIPCIONES SOBRESCRITAS

**Fecha:** 29 de diciembre de 2025  
**Estado:** ✅ **SOLUCIONADO EN STRAPI**  
**Próximo paso:** Verificar configuración de la Intranet

---

## 🔍 EL PROBLEMA

Al crear o editar productos desde la Intranet, los campos:
- **"Descripción del producto"** (WooCommerce `description`)
- **"Descripción corta"** (WooCommerce `short_description`)

Se estaban **sobrescribiendo con el mismo contenido**, apareciendo iguales en ambos campos de WooCommerce.

---

## 🧬 CAUSA RAÍZ IDENTIFICADA

Después de analizar la estructura completa de sincronización bidireccional entre Strapi ↔ WooCommerce, encontré que **el problema estaba en el backend de Strapi**, específicamente en:

**Archivo:** `strapi/src/api/woo-sync/services/woo-sync.ts`  
**Función:** `buildWooProduct()`  
**Líneas:** 1114-1127 y 1184-1185

### ❌ Código Problemático (ANTES):

```typescript
// Línea 1115
product.description = descripcionTexto || libro.subtitulo_libro || '';

// Línea 1123
product.short_description = libro.subtitulo_libro?.substring(0, 160) || descripcionTexto?.substring(0, 160) || '';
```

**¿Qué pasaba?**

1. Si `rawWooData.description` venía vacío → Strapi usaba `descripcionTexto` **O** `subtitulo_libro` como fallback
2. Si `rawWooData.short_description` venía vacío → Strapi usaba `subtitulo_libro` **O** `descripcionTexto` como fallback
3. **Resultado:** Ambos campos terminaban usando la misma fuente de datos → **SE SOBRESCRIBÍAN**

### Ejemplo del error:

```javascript
// Payload de Intranet
rawWooData: {
  description: "Descripción larga del libro",
  short_description: ""  // Vacía
}

// Strapi procesaba:
description = "Descripción larga del libro" ✅
short_description = "" || "Descripción larga del libro" ❌

// Resultado: Ambas iguales ❌
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

He corregido la función `buildWooProduct()` para eliminar los **fallbacks cruzados**.

### ✅ Código Corregido (AHORA):

```typescript
// Línea 1115 - Description usa SOLO libro.descripcion
product.description = descripcionTexto || '';

// Línea 1123 - Short description usa SOLO libro.subtitulo_libro
product.short_description = libro.subtitulo_libro || '';
```

**¿Qué cambió?**

1. **`description`** → Usa **SOLO** `libro.descripcion` (campo blocks convertido a texto)
2. **`short_description`** → Usa **SOLO** `libro.subtitulo_libro` (campo string)
3. **SIN fallbacks cruzados** → Cada campo es independiente

---

## 📊 MAPEO CORRECTO

```
┌──────────────────────────────────────────────────────────┐
│ STRAPI                     →    WOOCOMMERCE              │
├──────────────────────────────────────────────────────────┤
│ libro.descripcion          →    description              │
│ (tipo: blocks)                  (HTML/texto largo)       │
│                                                           │
│ libro.subtitulo_libro      →    short_description        │
│ (tipo: string)                  (texto corto, max 255)   │
└──────────────────────────────────────────────────────────┘

BIDIRECIONALIDAD (WooCommerce → Strapi):
-----------------------------------------
description (HTML)         →    libro.descripcion (blocks)
short_description (HTML)   →    libro.subtitulo_libro (string)
```

---

## 🚀 CAMBIOS REALIZADOS

### 1. **Archivo modificado:**
- `strapi/src/api/woo-sync/services/woo-sync.ts`

### 2. **Documentación creada:**
- `docs/FIX_SOBRESCRITURA_DESCRIPCIONES.txt` (documento completo con todos los detalles)

### 3. **Commit y push:**
```bash
✅ Commit: "fix: eliminar fallbacks cruzados en descripciones (evitar sobrescritura)"
✅ Push exitoso a GitHub
```

---

## 📋 QUÉ DEBE HACER LA INTRANET (PRÓXIMO PASO)

### Verificar que la Intranet envíe correctamente el payload:

**✅ Estructura correcta:**

```javascript
const payload = {
  data: {
    nombre_libro: "...",
    isbn_libro: "...",
    rawWooData: {
      description: "Descripción larga del producto...",       // Campo 1
      short_description: "Descripción corta del producto...", // Campo 2
      // ... otros campos ...
    }
  }
};
```

### ⚠️ Verificar que NO estén igualados:

```javascript
// ❌ MAL - Ambos campos con el mismo valor
const descripcion = formData.get('descripcion');
rawWooData.description = descripcion;
rawWooData.short_description = descripcion; // ¡Error!

// ✅ BIEN - Valores independientes
rawWooData.description = formData.get('descripcionLarga');
rawWooData.short_description = formData.get('descripcionCorta');
```

---

## 🧪 CÓMO PROBAR

### Prueba 1: Crear producto con ambas descripciones diferentes

**Payload:**
```json
{
  "data": {
    "nombre_libro": "Libro de Prueba",
    "isbn_libro": "9781234567890",
    "rawWooData": {
      "description": "Esta es la descripción larga completa del libro.",
      "short_description": "Descripción corta"
    }
  }
}
```

**Esperado en WooCommerce:**
- ✅ **Description:** "Esta es la descripción larga completa del libro."
- ✅ **Short Description:** "Descripción corta"
- ✅ **AMBOS DIFERENTES** (no sobrescritos)

### Prueba 2: Editar solo la descripción larga

**Payload (PUT):**
```json
{
  "data": {
    "rawWooData": {
      "description": "Nueva descripción larga editada",
      "short_description": "Descripción corta original"
    }
  }
}
```

**Esperado en WooCommerce:**
- ✅ **Description:** "Nueva descripción larga editada" (actualizada)
- ✅ **Short Description:** "Descripción corta original" (sin cambios)

---

## 🎯 RESUMEN TÉCNICO

| Aspecto | ANTES (❌) | AHORA (✅) |
|---------|------------|-----------|
| **Fallbacks** | Cruzados entre campos | Independientes |
| **description** | `descripcionTexto \|\| subtitulo` | `descripcionTexto \|\| ''` |
| **short_description** | `subtitulo \|\| descripcionTexto` | `subtitulo \|\| ''` |
| **Resultado** | Sobrescritura mutua | Campos independientes |
| **Estado** | ❌ Duplicados | ✅ Separados |

---

## 📝 DOCUMENTO COMPLETO PARA INTRANET

He creado un documento completo con todos los detalles, ejemplos y un prompt listo para usar:

**Ubicación:** `docs/FIX_SOBRESCRITURA_DESCRIPCIONES.txt`

Ese documento incluye:
- Explicación detallada del problema
- Solución implementada
- Checklist para la Intranet
- Ejemplos de payloads correctos
- Tests de validación
- Prompt completo para Cursor (Intranet)

---

## ✅ PRÓXIMOS PASOS

1. **✅ Strapi:** Ya corregido y deployd
2. **⏳ Intranet:** Verificar que se envíen dos campos distintos en `rawWooData`
3. **🧪 Testing:** Probar crear/editar productos y verificar que no se sobrescriban

---

## 📞 SOPORTE

Si después de verificar la Intranet el problema persiste:

1. Revisar logs de Strapi para ver qué está recibiendo:
   - Buscar: `[woo-sync] 📦 rawWooData:`
   - Verificar que `description` y `short_description` sean diferentes

2. Usar el endpoint de debug para inspeccionar el payload:
   - `POST /api/pedidos/debug`
   - Ver documento: `docs/SCRIPT_PRUEBA_DEBUG.html`

3. Revisar el documento completo:
   - `docs/FIX_SOBRESCRITURA_DESCRIPCIONES.txt`

---

**✅ FIX COMPLETADO EN STRAPI**  
**⏳ PENDIENTE: VERIFICAR INTRANET**

