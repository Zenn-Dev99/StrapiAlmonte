# 🗑️ Eliminación de Content Types Redundantes

## 📋 Resumen

Se eliminaron los Content Types relacionados con "News" y "Destacados" porque eran redundantes y ya no se usan para recibir datos de WooCommerce. Todos los datos de productos ahora se manejan directamente desde el Content Type `libro`.

## ✅ Content Types Eliminados

### 1. News (Blog/Noticias)

Estos Content Types se crearon originalmente para recibir contenido de WooCommerce, pero ya no son necesarios:

- **`news-article`** (Web Moraleja · News · Article)
  - Descripción: Noticias y artículos del blog
  - Eliminado porque no se usa para productos de WooCommerce

- **`news-author`** (Web Moraleja · News · Author)
  - Descripción: Autores de noticias
  - Eliminado porque no se usa para productos de WooCommerce

- **`news-category`** (Web Moraleja · News · Category)
  - Descripción: Categorías de noticias
  - Eliminado porque no se usa para productos de WooCommerce

- **`news-tag`** (Web Moraleja · News · Tag)
  - Descripción: Tags de noticias
  - Eliminado porque no se usa para productos de WooCommerce

### 2. Destacados

- **`home-product-highlight`** (Web Moraleja · Destacados Home)
  - Descripción: Tarjetas destacadas para la portada de la intranet
  - Eliminado porque es redundante (los productos destacados se manejan con el campo `featured` en `libro`)

## 🗂️ Componentes Eliminados

También se eliminaron los componentes relacionados con News que ya no se usan:

- `components/news/cta-block.json` - Call to action block para artículos
- `components/news/seo-meta.json` - Meta tags SEO para noticias
- `components/news/social-link.json` - Enlaces sociales para autores

## 📁 Archivos Eliminados

### Directorios completos eliminados:

```
strapi/src/api/
├── news-article/          ❌ Eliminado
├── news-author/           ❌ Eliminado
├── news-category/         ❌ Eliminado
├── news-tag/              ❌ Eliminado
└── home-product-highlight/ ❌ Eliminado

strapi/src/components/
└── news/                  ❌ Eliminado
    ├── cta-block.json
    ├── seo-meta.json
    └── social-link.json
```

## 🔄 Alternativas Actuales

### Para Productos Destacados

**Antes:**
```typescript
// Usar home-product-highlight
const destacados = await strapi.entityService.findMany('api::home-product-highlight.home-product-highlight');
```

**Ahora:**
```typescript
// Usar campo featured en libro
const destacados = await strapi.entityService.findMany('api::libro.libro', {
  filters: { featured: true },
});
```

### Para Datos de WooCommerce

**Antes:**
- Se intentaba recibir datos en Content Types de News (no funcionaba)

**Ahora:**
- Todos los datos de productos vienen directamente al Content Type `libro`
- Sincronización bidireccional: `libro` ↔ WooCommerce Products
- Ver documentación: `docs/MAPEO_LIBROS_WOOCOMMERCE.md`

## ⚠️ Notas Importantes

### Si Necesitas Funcionalidad de Blog/Noticias

Si en el futuro necesitas un blog o sistema de noticias, puedes:

1. **Crear nuevos Content Types** específicos para ese propósito
2. **No mezclar** con la lógica de productos de WooCommerce
3. **Usar nombres claros** que no generen confusión (ej: `blog-post`, `blog-author`)

### Migración de Datos (Si Existen)

Si tenías datos en estos Content Types:

1. **News Articles**: Si eran artículos de blog, considera exportarlos antes de eliminar
2. **Home Product Highlights**: Los productos destacados ahora se manejan con `libro.featured = true`
3. **No hay datos de WooCommerce**: Estos Content Types nunca recibieron datos de WooCommerce

## ✅ Beneficios

1. **Interfaz más limpia**: Menos Content Types redundantes en el admin
2. **Menos confusión**: Solo un Content Type para productos (`libro`)
3. **Mantenimiento simplificado**: Menos código que mantener
4. **Fuente única de verdad**: Todos los productos vienen de `libro` ↔ WooCommerce

## 📚 Archivos Relacionados

- `docs/MAPEO_LIBROS_WOOCOMMERCE.md` - Documentación del mapeo bidireccional
- `docs/ELIMINACION_CAMPOS_REDUNDANTES.md` - Eliminación de campos redundantes en libros

---

**Fecha:** 2025-12-22  
**Autor:** Auto (Cursor AI)  
**Versión:** 1.0


