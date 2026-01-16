# 📚 Mapeo Bidireccional: Libros (Strapi) ↔ Productos (WooCommerce)

## 📋 Resumen Ejecutivo

Este documento describe la implementación completa del mapeo bidireccional entre los **Content Types de Libros en Strapi** y los **Productos en WooCommerce**, incluyendo:

- ✅ Mapeo completo de todos los campos
- ✅ Protección de campos estáticos (ISBN)
- ✅ Sincronización bidireccional
- ✅ Lógica de resolución de conflictos

---

## 🗺️ Mapeo de Campos

### Strapi → WooCommerce (`mapLibroToWooProduct`)

| Campo Strapi | Campo WooCommerce | Tipo | Notas |
|--------------|-------------------|------|-------|
| `isbn_libro` | `sku` | string | **Campo estático protegido** |
| `nombre_libro` | `name` | string | Nombre del producto |
| `subtitulo_libro` | `meta_data[subtitulo_libro]` | string | Guardado en meta_data |
| `descripcion` | `description` | HTML | Convierte blocks (RichText) a HTML |
| `precio` / `precio_regular` | `regular_price` | decimal | Prioridad: `precio` > `precio_regular` |
| `precio_oferta` | `sale_price` | decimal | Precio de oferta |
| `stock_quantity` | `stock_quantity` | integer | Cantidad en stock |
| `manage_stock` | `manage_stock` | boolean | Si se gestiona stock |
| `stock_status` | `stock_status` | enum | `instock`, `outofstock`, `onbackorder` |
| `weight` | `weight` | decimal | Peso del producto |
| `length` | `length` | decimal | Largo |
| `width` | `width` | decimal | Ancho |
| `height` | `height` | decimal | Alto |
| `portada_libro` | `images[0]` | media | Imagen principal |
| `imagenes_interior` | `images[1..n]` | media[] | Imágenes adicionales |
| `estado_publicacion` | `status` | enum | `Publicado`→`publish`, `Pendiente`→`pending`, `Borrador`→`draft` |
| `featured` | `featured` | boolean | Producto destacado |
| `catalog_visibility` | `catalog_visibility` | enum | Visibilidad en catálogo |
| `virtual` | `virtual` | boolean | Producto virtual |
| `downloadable` | `downloadable` | boolean | Producto descargable |
| `tax_status` | `tax_status` | enum | Estado de impuestos |
| `tax_class` | `tax_class` | string | Clase de impuesto |
| `numero_edicion` | `meta_data[numero_edicion]` | integer | Guardado en meta_data |
| `agno_edicion` | `meta_data[agno_edicion]` | integer | Guardado en meta_data |
| `idioma` | `meta_data[idioma]` | enum | Guardado en meta_data |
| `tipo_libro` | `meta_data[tipo_libro]` | enum | Guardado en meta_data |
| `estado_edicion` | `meta_data[estado_edicion]` | enum | Guardado en meta_data |
| `id_autor` | `meta_data[id_autor]` | integer | Solo referencia |
| `id_editorial` | `meta_data[id_editorial]` | integer | Solo referencia |
| `id_sello` | `meta_data[id_sello]` | integer | Solo referencia |
| `id_coleccion` | `meta_data[id_coleccion]` | integer | Solo referencia |
| `id_obra` | `meta_data[id_obra]` | integer | Solo referencia |

### WooCommerce → Strapi (`mapWooProductToLibro`)

| Campo WooCommerce | Campo Strapi | Tipo | Protección |
|-------------------|--------------|------|------------|
| `sku` | `isbn_libro` | string | ⚠️ **PROTEGIDO** - Solo se actualiza si no existe |
| `name` | `nombre_libro` | string | Siempre se actualiza |
| `short_description` | `descripcion_corta` | string | Siempre se actualiza |
| `description` | `descripcion` | HTML | Siempre se actualiza |
| `regular_price` | `precio` + `precio_regular` | decimal | Siempre se actualiza |
| `sale_price` | `precio_oferta` | decimal | Siempre se actualiza |
| `stock_quantity` | `stock_quantity` | integer | Siempre se actualiza |
| `manage_stock` | `manage_stock` | boolean | Siempre se actualiza |
| `stock_status` | `stock_status` | enum | Siempre se actualiza |
| `weight` | `weight` | decimal | Siempre se actualiza |
| `length` | `length` | decimal | Siempre se actualiza |
| `width` | `width` | decimal | Siempre se actualiza |
| `height` | `height` | decimal | Siempre se actualiza |
| `status` | `estado_publicacion` | enum | Siempre se actualiza |
| `featured` | `featured` | boolean | Siempre se actualiza |
| `catalog_visibility` | `catalog_visibility` | enum | Siempre se actualiza |
| `virtual` | `virtual` | boolean | Siempre se actualiza |
| `downloadable` | `downloadable` | boolean | Siempre se actualiza |
| `tax_status` | `tax_status` | enum | Siempre se actualiza |
| `tax_class` | `tax_class` | string | Siempre se actualiza |
| `images[0].src` | `imagen_portada_url` | string | URL de referencia |
| `meta_data[subtitulo_libro]` | `subtitulo_libro` | string | Desde meta_data |
| `meta_data[numero_edicion]` | `numero_edicion` | integer | Desde meta_data |
| `meta_data[agno_edicion]` | `agno_edicion` | integer | Desde meta_data |
| `meta_data[idioma]` | `idioma` | enum | Desde meta_data |
| `meta_data[tipo_libro]` | `tipo_libro` | enum | Desde meta_data |
| `meta_data[estado_edicion]` | `estado_edicion` | enum | Desde meta_data |
| `id` | `externalIds[platform]` | integer | Siempre se actualiza |

---

## 🔒 Protección de Campos Estáticos

### Campos Protegidos

Los siguientes campos **NO se pueden modificar** una vez que el libro existe en Strapi:

1. **`isbn_libro`** (ISBN)
   - Es el identificador único del libro
   - Se usa como SKU en WooCommerce
   - **Protección**: Si un libro ya tiene ISBN, no se puede cambiar ni desde Strapi ni desde WooCommerce

### Lógica de Protección

#### En `beforeUpdate` (Lifecycle)

```typescript
// Si se intenta modificar ISBN y ya existe
if (data.isbn_libro !== undefined && libroExistente.isbn_libro) {
  const isbnNuevo = String(data.isbn_libro).trim();
  const isbnExistente = String(libroExistente.isbn_libro).trim();
  
  if (isbnNuevo !== isbnExistente) {
    // ⚠️ BLOQUEAR: Eliminar isbn_libro de data
    delete data.isbn_libro;
    // Log advertencia
  }
}
```

#### En `mapWooProductToLibro` (Mapper)

```typescript
// Solo actualizar ISBN si no existe en Strapi
if (wooProduct.sku) {
  const isbnWoo = String(wooProduct.sku).trim();
  const isbnExistente = libroExistente?.isbn_libro;
  
  if (!isbnExistente) {
    // ✅ Permitir: No existe ISBN, usar el de WooCommerce
    libro.isbn_libro = isbnWoo;
  } else if (isbnExistente !== isbnWoo) {
    // ⚠️ BLOQUEAR: Mantener ISBN de Strapi
    // NO actualizar isbn_libro
    // Log advertencia
  }
}
```

### Comportamiento

| Escenario | Acción | Resultado |
|-----------|--------|-----------|
| Libro nuevo sin ISBN | WooCommerce envía SKU | ✅ Se crea con ISBN de WooCommerce |
| Libro existe con ISBN | WooCommerce envía SKU diferente | ⚠️ Se mantiene ISBN de Strapi, se loguea advertencia |
| Libro existe con ISBN | Intento de modificar desde Strapi | ⚠️ Se bloquea, se mantiene ISBN original |
| Libro existe con ISBN | WooCommerce envía mismo SKU | ✅ No hay conflicto, no se actualiza |

---

## 🔄 Sincronización Bidireccional

### Flujo: Strapi → WooCommerce

**Cuándo se sincroniza:**
- Al crear un libro con `estado_publicacion = "Publicado"`
- Al actualizar un libro con `estado_publicacion = "Publicado"`
- Solo si el libro tiene canales asignados (`moraleja` o `escolar`)

**Proceso:**
1. Se ejecuta en `afterCreate` / `afterUpdate` (lifecycles)
2. Se verifica `estado_publicacion === "Publicado"`
3. Se obtienen los canales del libro
4. Para cada canal WooCommerce:
   - Se mapea el libro a formato WooCommerce (`mapLibroToWooProduct`)
   - Se busca si existe producto en WooCommerce (`externalIds[platform]`)
   - Si existe: **UPDATE** en WooCommerce
   - Si no existe: **CREATE** en WooCommerce y se guarda `externalIds`

**Archivos:**
- `strapi/src/api/libro/content-types/libro/lifecycles.ts` (afterCreate/afterUpdate)
- `strapi/src/api/libro/services/libro.ts` (syncToWooCommerce)
- `strapi/src/api/woo-sync/services/woo-product-sync.ts` (syncProduct)
- `strapi/src/api/woo-sync/services/mappers/product-mapper.ts` (mapLibroToWooProduct)

### Flujo: WooCommerce → Strapi

**Cuándo se sincroniza:**
- Cuando WooCommerce envía un webhook (producto creado/actualizado)
- Cuando se ejecuta manualmente un script de sincronización

**Proceso:**
1. WooCommerce envía webhook con datos del producto
2. Se busca libro en Strapi por:
   - `externalIds[platform]` (si existe)
   - `isbn_libro` (SKU de WooCommerce)
3. Se mapea producto WooCommerce a libro Strapi (`mapWooProductToLibro`)
4. **Protección de ISBN**: Si el libro ya tiene ISBN, no se modifica
5. Si existe: **UPDATE** en Strapi
6. Si no existe: **CREATE** en Strapi (solo si tiene SKU válido)

**Archivos:**
- `strapi/src/api/woo-webhook/services/woo-webhook.ts` (webhook handler)
- `strapi/src/api/woo-sync/services/mappers/product-mapper.ts` (mapWooProductToLibro)

---

## 📊 Resolución de Conflictos

### Prioridad de Datos

1. **ISBN**: Siempre gana Strapi si ya existe
2. **Precios**: WooCommerce → Strapi (si viene de webhook)
3. **Stock**: WooCommerce → Strapi (si viene de webhook)
4. **Descripciones**: WooCommerce → Strapi (si viene de webhook)
5. **Otros campos**: WooCommerce → Strapi (si viene de webhook)

### Estrategia de Sincronización

```
┌─────────────────────────────────────────────────────────┐
│                    Sincronización                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Strapi → WooCommerce (Push)                            │
│  ├─ Trigger: afterCreate / afterUpdate                   │
│  ├─ Condición: estado_publicacion === "Publicado"       │
│  └─ Acción: CREATE/UPDATE en WooCommerce                │
│                                                          │
│  WooCommerce → Strapi (Pull)                             │
│  ├─ Trigger: Webhook / Script manual                    │
│  ├─ Protección: ISBN no se modifica si existe           │
│  └─ Acción: CREATE/UPDATE en Strapi                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🐛 Posibles Problemas y Soluciones

### Problema 1: ISBN se modifica desde WooCommerce

**Síntoma:**
- Libro en Strapi tiene ISBN "1234567890"
- WooCommerce tiene SKU "9876543210"
- Al sincronizar, el ISBN cambia

**Causa:**
- Falta protección en `mapWooProductToLibro`

**Solución:**
- ✅ Implementada: Verificar `libroExistente` antes de actualizar ISBN
- ✅ Implementada: Protección en `beforeUpdate` lifecycle

### Problema 2: Campos no se mapean correctamente

**Síntoma:**
- Algunos campos de WooCommerce no aparecen en Strapi

**Causa:**
- Falta mapeo en `mapWooProductToLibro`

**Solución:**
- ✅ Implementada: Mapeo completo de todos los campos
- ✅ Implementada: Soporte para `meta_data` de WooCommerce

### Problema 3: Sincronización bidireccional crea duplicados

**Síntoma:**
- Se crean libros duplicados al sincronizar

**Causa:**
- No se busca correctamente por `externalIds` o `isbn_libro`

**Solución:**
- ✅ Implementada: Búsqueda por `externalIds[platform]` primero
- ✅ Implementada: Búsqueda por `isbn_libro` como fallback

### Problema 4: Descripciones RichText no se convierten

**Síntoma:**
- `descripcion` (blocks) no se muestra correctamente en WooCommerce

**Causa:**
- Falta conversión de blocks a HTML

**Solución:**
- ✅ Implementada: Función `blocksToHtml()` que convierte blocks a HTML

---

## 🔍 Mejoras Futuras

### 1. Sincronización de Relaciones

**Estado actual:**
- Los IDs de relaciones (autor, editorial, etc.) se guardan en `meta_data` pero no se sincronizan automáticamente

**Mejora propuesta:**
- Sincronizar términos de WooCommerce (categorías, tags, atributos) con relaciones de Strapi
- Mapear autores de WooCommerce a `autor_relacion` en Strapi
- Mapear categorías de WooCommerce a `categorias_producto` en Strapi

### 2. Descarga Automática de Imágenes

**Estado actual:**
- Las URLs de imágenes se guardan en `imagen_portada_url` pero no se descargan

**Mejora propuesta:**
- Descargar imágenes de WooCommerce y subirlas a Strapi automáticamente
- Actualizar `portada_libro` con la imagen descargada

### 3. Sincronización Incremental

**Estado actual:**
- Se sincroniza todo el objeto cada vez

**Mejora propuesta:**
- Sincronizar solo campos que han cambiado
- Usar `contentHash` para detectar cambios

### 4. Manejo de Variantes

**Estado actual:**
- Solo se soportan productos simples

**Mejora propuesta:**
- Soportar productos variables de WooCommerce
- Mapear variantes a diferentes ediciones del libro

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Crear libro y sincronizar a WooCommerce

```typescript
// Crear libro en Strapi
const libro = await strapi.entityService.create('api::libro.libro', {
  data: {
    isbn_libro: '9781234567890',
    nombre_libro: 'Mi Libro',
    precio: 15000,
    stock_quantity: 100,
    estado_publicacion: 'Publicado',
    canales: [canalMoralejaId], // Canal de WooCommerce
  },
});

// Se sincroniza automáticamente a WooCommerce en afterCreate
```

### Ejemplo 2: Actualizar desde WooCommerce (webhook)

```typescript
// WooCommerce envía webhook con producto actualizado
// El webhook handler busca el libro por externalIds o ISBN
// Si existe, actualiza campos (excepto ISBN si ya existe)
// Si no existe, crea nuevo libro
```

### Ejemplo 3: Protección de ISBN

```typescript
// Intento de modificar ISBN existente
await strapi.entityService.update('api::libro.libro', libroId, {
  data: {
    isbn_libro: '9789876543210', // Diferente al existente
  },
});

// ⚠️ Resultado: ISBN NO se modifica, se mantiene el original
// Se loguea advertencia
```

---

## 📚 Archivos Modificados

1. **`strapi/src/api/woo-sync/services/mappers/product-mapper.ts`**
   - ✅ Mejorado `mapLibroToWooProduct`: Mapea todos los campos
   - ✅ Mejorado `mapWooProductToLibro`: Mapea todos los campos + protección de ISBN
   - ✅ Agregado `getImageUrl()`: Helper para obtener URLs de imágenes
   - ✅ Agregado `blocksToHtml()`: Convierte RichText blocks a HTML

2. **`strapi/src/api/libro/content-types/libro/lifecycles.ts`**
   - ✅ Agregada protección de ISBN en `beforeUpdate`
   - ✅ Verificación de conflictos de ISBN

---

## ✅ Checklist de Implementación

- [x] Mapeo completo Strapi → WooCommerce
- [x] Mapeo completo WooCommerce → Strapi
- [x] Protección de campos estáticos (ISBN)
- [x] Conversión de RichText a HTML
- [x] Soporte para meta_data de WooCommerce
- [x] Manejo de imágenes múltiples
- [x] Logging de advertencias
- [x] Documentación completa

---

**Última actualización:** 2025-12-22  
**Autor:** Auto (Cursor AI)  
**Versión:** 1.0


