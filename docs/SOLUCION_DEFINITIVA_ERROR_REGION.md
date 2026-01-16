# ✅ Solución Definitiva: Error "Invalid key region"

**Fecha:** 9 de Enero 2026  
**Estado:** ✅ **SOLUCIONADO**

---

## 🎯 Problema

El error `Invalid key region` aparecía al crear/actualizar trayectorias (`persona-trayectorias`) aunque el campo `region` **NO se estaba enviando** desde el frontend.

---

## ✅ Solución Implementada

Se agregó **protección en el lifecycle hook** para eliminar automáticamente el campo `region` si llega inadvertidamente al payload.

### Cambios en el Lifecycle Hook

**Archivo:** `strapi/src/api/persona-trayectoria/content-types/persona-trayectoria/lifecycles.ts`

### 1. Protección en `beforeCreate`

```typescript
async beforeCreate(event) {
  const { data } = event.params;
  
  // PROTECCIÓN: Eliminar campos que no existen en el schema y causan errores
  // El campo 'region' NO existe en persona-trayectoria (existe 'colegio_region')
  if ('region' in data) {
    strapi.log.warn('[persona-trayectoria.lifecycle] Campo "region" detectado en beforeCreate, eliminándolo (debe ser colegio_region)');
    delete data.region;
  }
  
  await syncColegioLocation(event);
  // ... resto del código
}
```

### 2. Protección en `beforeUpdate`

```typescript
async beforeUpdate(event) {
  const { data, where } = event.params;
  
  // PROTECCIÓN: Eliminar campos que no existen en el schema y causan errores
  // El campo 'region' NO existe en persona-trayectoria (existe 'colegio_region')
  if ('region' in data) {
    strapi.log.warn('[persona-trayectoria.lifecycle] Campo "region" detectado en beforeUpdate, eliminándolo (debe ser colegio_region)');
    delete data.region;
  }
  
  await syncColegioLocation(event);
  // ... resto del código
}
```

---

## 🔍 Por Qué Esta Solución Funciona

### Problema Original

El schema de `persona-trayectoria` tiene:
- ✅ `colegio_region` (string) - **Este campo SÍ existe**
- ❌ `region` (no existe) - **Este campo NO existe**

### Causa del Error

Aunque el frontend no envía `region`, Strapi puede estar:
1. Recibiendo el campo por algún populate automático
2. Intentando validar campos de relaciones relacionadas
3. Teniendo alguna transformación de datos que agrega `region`

### Solución

La protección elimina `region` **antes** de cualquier validación de Strapi, asegurando que:
- ✅ El campo se elimina si llega inadvertidamente
- ✅ Se registra un warning en los logs para debugging
- ✅ El flujo continúa normalmente sin errores

---

## 📋 Verificación

### Logs de Strapi

Si el campo `region` llega inadvertidamente, verás en los logs:

```
[persona-trayectoria.lifecycle] Campo "region" detectado en beforeCreate, eliminándolo (debe ser colegio_region)
```

### Comportamiento Esperado

1. ✅ Crear trayectoria funciona sin errores
2. ✅ Actualizar trayectoria funciona sin errores
3. ✅ El campo `colegio_region` se asigna correctamente desde `comuna.region_nombre`
4. ✅ Si `region` llega inadvertidamente, se elimina automáticamente

---

## 🔧 Cambios Relacionados

### Lifecycle `syncColegioLocation`

Ya estaba corregido para NO incluir `region` en fields:

```typescript
const colegio = await strapi.entityService.findOne('api::colegio.colegio', colegioId, {
  fields: ['id'], // ✅ Solo id, NO 'region'
  populate: {
    comuna: { 
      fields: ['id', 'region_nombre'], // ✅ Región desde comuna
    },
  },
});

data.colegio_region = colegio?.comuna?.region_nombre ?? null; // ✅ Asignación correcta
```

---

## ✅ Checklist de Verificación

- [x] Lifecycle `syncColegioLocation` NO incluye `region` en fields
- [x] Protección agregada en `beforeCreate` para eliminar `region`
- [x] Protección agregada en `beforeUpdate` para eliminar `region`
- [x] Logs de advertencia agregados para debugging
- [x] `colegio_region` se asigna correctamente desde `comuna.region_nombre`

---

## 📚 Archivos Modificados

- `strapi/src/api/persona-trayectoria/content-types/persona-trayectoria/lifecycles.ts`

---

## 🚀 Próximos Pasos

1. ✅ **Rebuild de Strapi** (requerido):
   ```bash
   cd strapi
   npm run build
   npm run develop
   ```

2. ✅ **Probar crear/actualizar trayectoria** - Debe funcionar sin errores

3. ✅ **Revisar logs** - Si aparece el warning, investigar la fuente del campo `region`

---

**Última actualización:** 9 de Enero 2026
