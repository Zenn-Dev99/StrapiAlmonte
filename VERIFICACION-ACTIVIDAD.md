# Verificación del Content-Type "Actividad"

## ✅ Información del Content-Type Creado

### Configuración en el Código

**Ubicación:** `strapi/src/api/actividad/`

**Schema JSON:**
- **singularName:** `actividad`
- **pluralName:** `actividades`
- **displayName:** `Actividad`
- **collectionName:** `actividades`
- **API ID:** `api::actividad.actividad`

### Endpoint de la API

**Nombre exacto del endpoint:** `/api/actividades` (plural)

**URLs a verificar:**
- ✅ Correcto: `https://strapi.moraleja.cl/api/actividades`
- ❌ Incorrecto: `https://strapi.moraleja.cl/api/actividads` (no existe)

### Archivos Creados

1. ✅ `strapi/src/api/actividad/content-types/actividad/schema.json`
2. ✅ `strapi/src/api/actividad/controllers/actividad.ts`
3. ✅ `strapi/src/api/actividad/services/actividad.ts`
4. ✅ `strapi/src/api/actividad/routes/actividad.ts`

---

## 📋 Checklist de Verificación en Strapi Admin

### 1. Verificar que el Content-Type Existe

**Pasos:**
1. Ir a **Content-Type Builder** en Strapi Admin
2. Buscar "Actividad" en la lista
3. ✅ Debe aparecer con el nombre "Actividad" (singular)

**Si NO aparece:**
- El build puede no haberse completado
- Strapi puede necesitar reiniciarse
- Verificar que los archivos estén en el servidor

### 2. Verificar Endpoint de la API

**En la consola del navegador (Strapi Admin):**
```javascript
// Probar el endpoint
fetch('https://strapi.moraleja.cl/api/actividades')
  .then(r => r.json())
  .then(console.log)
```

**URLs correctas:**
- ✅ `https://strapi.moraleja.cl/api/actividades` (GET - listar)
- ✅ `https://strapi.moraleja.cl/api/actividades/:id` (GET - obtener una)
- ✅ `https://strapi.moraleja.cl/api/actividades` (POST - crear)
- ✅ `https://strapi.moraleja.cl/api/actividades/:id` (PUT - actualizar)
- ✅ `https://strapi.moraleja.cl/api/actividades/:id` (DELETE - eliminar)

### 3. Verificar Registros Existentes

**Pasos:**
1. Ir a **Content Manager** → **Actividad**
2. Verificar si hay registros creados
3. Contar cuántos hay

**Si no hay registros:**
- Es normal si es un content-type nuevo
- Puedes crear uno de prueba para verificar que funciona

### 4. Verificar Permisos

**Pasos:**
1. Ir a **Settings** → **Users & Permissions Plugin** → **Roles**
2. Seleccionar el rol apropiado:
   - **Public** (si es público)
   - **Authenticated** (si requiere autenticación)
3. Buscar "Actividad" en la lista de permisos
4. Verificar que estén habilitados:
   - ✅ `find` (listar)
   - ✅ `findOne` (obtener una)
   - ✅ `create` (crear)
   - ✅ `update` (actualizar)
   - ✅ `delete` (eliminar)

**Si los permisos NO están configurados:**
- El endpoint puede devolver 403 Forbidden
- Necesitas habilitarlos manualmente

### 5. Verificar Errores en Logs

**En Railway (o donde esté desplegado):**
1. Revisar los logs del servidor
2. Buscar errores relacionados con "actividad" o "actividades"
3. Verificar errores de TypeScript o compilación

**Errores comunes:**
- `ContentType not found` - El content-type no se registró correctamente
- `403 Forbidden` - Permisos no configurados
- `404 Not Found` - Endpoint incorrecto o content-type no existe

---

## 🔍 Comandos para Verificar desde el Código

### Verificar que el schema es válido:
```bash
cd strapi
cat src/api/actividad/content-types/actividad/schema.json | jq .
```

### Verificar que los archivos existen:
```bash
ls -la strapi/src/api/actividad/
```

### Probar el endpoint localmente (si tienes acceso):
```bash
curl http://localhost:1337/api/actividades
```

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: El content-type no aparece en Strapi Admin

**Causas posibles:**
- Build no completado
- Strapi no reiniciado después del deploy
- Archivos no están en el servidor

**Solución:**
1. Verificar que el build se completó exitosamente
2. Reiniciar Strapi
3. Verificar que los archivos están en el servidor

### Problema 2: Endpoint devuelve 404

**Causas posibles:**
- URL incorrecta (usar `/api/actividades` no `/api/actividads`)
- Content-type no registrado
- Build fallido

**Solución:**
1. Verificar la URL exacta: `/api/actividades`
2. Verificar que el build se completó
3. Revisar logs de Strapi

### Problema 3: Endpoint devuelve 403 Forbidden

**Causas posibles:**
- Permisos no configurados
- Token de autenticación inválido

**Solución:**
1. Configurar permisos en Settings → Users & Permissions
2. Verificar el token de autenticación

### Problema 4: Errores de TypeScript en el build

**Causas posibles:**
- Falta `as any` en los factories
- Errores de sintaxis

**Solución:**
1. Verificar que todos los archivos usan `as any`
2. Revisar errores de compilación

---

## 📊 Resumen de Información

| Concepto | Valor |
|----------|-------|
| **Nombre Singular** | `actividad` |
| **Nombre Plural** | `actividades` |
| **Display Name** | `Actividad` |
| **API ID** | `api::actividad.actividad` |
| **Endpoint API** | `/api/actividades` |
| **Collection Name** | `actividades` |
| **Draft & Publish** | ✅ Habilitado |

---

## ✅ Próximos Pasos

1. **Verificar en Strapi Admin** que el content-type aparece
2. **Configurar permisos** en Settings → Users & Permissions
3. **Probar el endpoint** desde la consola del navegador
4. **Crear un registro de prueba** para verificar que funciona
5. **Revisar logs** si hay errores

---

## 📝 Notas

- El content-type fue creado con `draftAndPublish: true`, por lo que los registros necesitan ser publicados
- El campo `creado_por` es requerido y debe relacionarse con un colaborador
- Todas las relaciones son opcionales excepto `creado_por`
