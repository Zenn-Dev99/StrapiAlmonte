# 🔍 Solución: Content Types del CRM no aparecen en Strapi Admin

## ❓ Problema

Los content types del CRM (Lead, Oportunidad, Deal, Cotizacioncrm, Propuesta, Actividad) no se ven en la interfaz de administración de Strapi.

## ✅ Soluciones

### Solución 1: Rebuild de Strapi (MÁS COMÚN)

Después de crear nuevos content types, Strapi necesita reconstruir el admin panel:

```bash
# Desde el directorio strapi/
cd strapi

# Opción A: Rebuild completo
npm run build

# Opción B: Reiniciar Strapi en modo desarrollo (rebuild automático)
npm run develop
```

**Nota:** Si estás en producción, necesitas hacer build y reiniciar el servicio.

---

### Solución 2: Verificar que los archivos existen

Asegúrate de que los content types estén en la ubicación correcta:

```
strapi/src/api/
├── lead/
│   └── content-types/
│       └── lead/
│           └── schema.json ✅
├── oportunidad/
│   └── content-types/
│       └── oportunidad/
│           └── schema.json ✅
├── deal/
│   └── content-types/
│       └── deal/
│           └── schema.json ✅
├── cotizacioncrm/
│   └── content-types/
│       └── cotizacioncrm/
│           └── schema.json ✅
├── propuesta/
│   └── content-types/
│       └── propuesta/
│           └── schema.json ✅
└── actividad/
    └── content-types/
        └── actividad/
            └── schema.json ✅
```

---

### Solución 3: Configurar permisos

Los content types pueden existir pero no tener permisos configurados. Ve a:

**Settings → Users & Permissions → Roles → Authenticated (o tu rol)**

Y habilita los permisos para:
- `lead` (find, findOne, create, update, delete)
- `oportunidad` (find, findOne, create, update, delete)
- `deal` (find, findOne, create, update, delete)
- `cotizacioncrm` (find, findOne, create, update, delete)
- `propuesta` (find, findOne, create, update, delete)
- `actividad` (find, findOne, create, update, delete)

---

### Solución 4: Verificar pluginOptions

Los schemas actuales tienen `pluginOptions: {}` vacío, lo que está correcto. Si quisieras ocultarlos (no recomendado), sería:

```json
{
  "pluginOptions": {
    "content-manager": {
      "visible": false
    }
  }
}
```

**Estado actual:** ✅ Todos tienen `pluginOptions: {}` (visible por defecto)

---

### Solución 5: Limpiar cache y rebuild

```bash
# Desde strapi/
rm -rf .cache
rm -rf build
rm -rf dist
npm run build
# O en desarrollo:
npm run develop
```

---

### Solución 6: Verificar draftAndPublish

Algunos content types tienen `draftAndPublish: true`, lo que significa que necesitan estar publicados para verse:

**Content types con draftAndPublish:**
- ✅ `oportunidad` → `draftAndPublish: true` (necesita publicación)
- ✅ Los demás tienen `draftAndPublish: false` (visibles sin publicar)

**Solución:** Si tienes `oportunidad`, asegúrate de crear al menos un registro y publicarlo.

---

## 🔍 Verificación Rápida

### 1. Verificar que los content types están cargados

En la consola de Strapi al iniciar, deberías ver logs indicando que se cargaron las APIs.

### 2. Verificar vía API

Prueba directamente la API:

```bash
# Si Strapi está corriendo
curl http://localhost:1337/api/leads
curl http://localhost:1337/api/oportunidades
curl http://localhost:1337/api/deals
curl http://localhost:1337/api/cotizacionescrm
curl http://localhost:1337/api/propuestas
curl http://localhost:1337/api/actividades
```

Si las APIs responden, los content types están cargados pero pueden no estar visibles en el admin.

### 3. Verificar en Content-Type Builder

Ve a **Content-Type Builder** en el admin panel. Los content types del CRM deberían aparecer allí si están correctamente configurados.

---

## 📋 Checklist

- [ ] Los archivos `schema.json` existen en las ubicaciones correctas
- [ ] Strapi ha sido reconstruido (`npm run build` o `npm run develop`)
- [ ] Strapi está corriendo y no hay errores en la consola
- [ ] Los permisos están configurados para tu rol
- [ ] Si usas `draftAndPublish: true`, has creado y publicado al menos un registro
- [ ] Has limpiado cache si es necesario

---

## 🚀 Comando Rápido (Todo en uno)

```bash
cd strapi
rm -rf .cache build dist
npm run build
# Luego reinicia Strapi
npm run develop
```

---

## 📝 Nota sobre draftAndPublish

Si un content type tiene `draftAndPublish: true`:
- Necesitas crear y publicar al menos un registro para que aparezca en el menú
- O puedes cambiar `draftAndPublish: false` en el schema si no necesitas esa funcionalidad

**Content types actuales:**
- `lead`: `draftAndPublish: false` ✅
- `oportunidad`: `draftAndPublish: true` ⚠️
- `deal`: `draftAndPublish: false` ✅
- `cotizacioncrm`: `draftAndPublish: false` ✅
- `propuesta`: `draftAndPublish: false` ✅
- `actividad`: `draftAndPublish: false` ✅

---

**Última actualización:** 7 de enero de 2026
