# 🧪 Scripts de Testeo y Utilidades

Este documento lista los scripts esenciales disponibles para probar y gestionar la sincronización con WooCommerce.

## 📋 Scripts Disponibles

### 1. `test-autor-completo.mjs`

**Propósito**: Prueba completa de operaciones CRUD para autores

**Uso**:
```bash
node scripts/test-autor-completo.mjs --platform=woo_moraleja
# o
node scripts/test-autor-completo.mjs --platform=woo_escolar
```

**Qué prueba**:
- ✅ CREAR: Crea un autor en Strapi y verifica sincronización a WooCommerce
- ✅ ACTUALIZAR: Actualiza el nombre y verifica que NO se crea duplicado
- ✅ ELIMINAR: Elimina el autor y verifica que el término se elimina de WooCommerce

**Requisitos**:
- Variables de entorno configuradas (STRAPI_URL, STRAPI_API_TOKEN, WOO_*_*)

---

### 2. `test-actualizar-autor.mjs`

**Propósito**: Prueba específica y detallada de la actualización de autores

**Uso**:
```bash
node scripts/test-actualizar-autor.mjs
```

**Qué hace**:
- Crea un autor
- Verifica término en WooCommerce antes de actualizar
- Actualiza el autor
- Verifica término en WooCommerce después de actualizar (por ID, slug, nombre)
- Muestra información detallada para diagnóstico

**Requisitos**:
- Variables de entorno configuradas (STRAPI_URL, STRAPI_API_TOKEN, WOO_*_*)

---

### 3. `resincronizar-autores.mjs`

**Propósito**: Resincroniza todos los autores desde Strapi a WooCommerce

**Uso**:
```bash
node scripts/resincronizar-autores.mjs
```

**Qué hace**:
- Obtiene todos los autores de Strapi
- Para cada autor, hace un UPDATE (dispara sincronización automática)
- Útil para limpiar/resincronizar después de cambios en la lógica

**Requisitos**:
- Variables de entorno configuradas (STRAPI_URL, STRAPI_API_TOKEN)

---

## 🔧 Variables de Entorno Necesarias

Todos los scripts requieren estas variables:

```bash
STRAPI_URL="https://strapi.moraleja.cl"
STRAPI_API_TOKEN="tu_token_aqui"

# Para scripts que prueban WooCommerce:
WOO_MORALEJA_URL="https://staging.moraleja.cl"
WOO_MORALEJA_CONSUMER_KEY="ck_..."
WOO_MORALEJA_CONSUMER_SECRET="cs_..."
WOO_ESCOLAR_URL="https://staging.escolar.cl"
WOO_ESCOLAR_CONSUMER_KEY="ck_..."
WOO_ESCOLAR_CONSUMER_SECRET="cs_..."
```

---

## 📝 Notas

- Los scripts de testeo crean entidades temporales que se pueden eliminar después
- Los scripts verifican directamente en WooCommerce usando la API REST
- Los scripts incluyen esperas (timeouts) para permitir que la sincronización se complete
