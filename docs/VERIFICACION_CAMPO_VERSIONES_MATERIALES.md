# ✅ Verificación: Campo versiones_materiales en Cursos

**Fecha:** 10 de Enero 2026  
**Campo:** `versiones_materiales` (tipo JSON)  
**Content Type:** `cursos` (api::curso.curso)

---

## ✅ Verificaciones Completadas en Código

### 1. Campo en Schema ✅

**Archivo:** `strapi/src/api/curso/content-types/curso/schema.json`

```json
{
  "versiones_materiales": {
    "type": "json"
  }
}
```

**Estado:** ✅ Campo agregado correctamente

---

### 2. Controllers y Services ✅

**Archivos:**
- `strapi/src/api/curso/controllers/curso.ts` - Usa `createCoreController` (estándar)
- `strapi/src/api/curso/services/curso.ts` - Usa `createCoreService` (estándar)

**Estado:** ✅ No hay lógica personalizada que bloquee el campo. Los controllers y services estándar de Strapi manejan automáticamente todos los campos del schema, incluyendo campos JSON.

---

### 3. Routes ✅

**Archivo:** `strapi/src/api/curso/routes/curso.ts`

**Estado:** ✅ Usa `createCoreRouter` (estándar). Las rutas están configuradas correctamente.

---

## ⚠️ Verificaciones Pendientes (Requieren Acceso a Strapi Admin)

### 1. Permisos de API

**Ubicación:** Strapi Admin → **Settings** → **Users & Permissions Plugin** → **Roles**

**Para cada rol (especialmente `Authenticated` y `Public` si aplica):**

1. Buscar la sección **"Cursos"** (o `api::curso.curso`)
2. Verificar que estén habilitados:
   - ✅ `find` (GET /api/cursos)
   - ✅ `findOne` (GET /api/cursos/:id)
   - ✅ `create` (POST /api/cursos)
   - ✅ `update` (PUT /api/cursos/:id)
   - ✅ `delete` (DELETE /api/cursos/:id) - opcional

**Nota:** En Strapi v4, cuando habilitas permisos para un content type, todos los campos del schema (incluidos JSON) son accesibles automáticamente. No hay necesidad de habilitar campos individualmente a menos que se use el sistema de "Field-level permissions" (raro en Strapi v4).

---

### 2. Verificación en Admin Panel

**Ubicación:** Strapi Admin → **Content Manager** → **Cursos**

1. Crear o editar un curso
2. Verificar que el campo `versiones_materiales` aparece
3. El campo debería aparecer como un editor JSON (textarea para JSON raw)

**Estado:** ⏳ Pendiente de verificación manual

---

### 3. Prueba desde API

**Prueba 1: GET (Leer)**

```bash
curl -X GET "https://strapi.moraleja.cl/api/cursos/[ID]?publicationState=preview" \
  -H "Authorization: Bearer [TOKEN]"
```

**Verificar que la respuesta incluye:**
```json
{
  "data": {
    "id": ...,
    "attributes": {
      "versiones_materiales": null,  // o el array si tiene datos
      // ... otros campos
    }
  }
}
```

**Prueba 2: PUT (Escribir)**

```bash
curl -X PUT "https://strapi.moraleja.cl/api/cursos/[ID]" \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "versiones_materiales": [
        {
          "id": 1,
          "nombre_archivo": "test.pdf",
          "fecha_subida": "2025-01-12T00:00:00.000Z",
          "fecha_actualizacion": "2025-01-12T00:00:00.000Z",
          "materiales": [],
          "metadata": {
            "nombre": "test.pdf",
            "tamaño": 12345,
            "tipo": "application/pdf"
          }
        }
      ]
    }
  }'
```

**Verificar:**
- ✅ No hay error "Invalid key versiones_materiales"
- ✅ El campo se guarda correctamente
- ✅ El campo se devuelve en GET posterior

---

## 📋 Estructura de Datos Esperada

El campo `versiones_materiales` acepta un array de objetos con esta estructura:

```json
[
  {
    "id": 1,
    "nombre_archivo": "lista_utiles_2025.pdf",
    "fecha_subida": "2025-01-12T17:00:00.000Z",
    "fecha_actualizacion": "2025-01-12T17:00:00.000Z",
    "materiales": [
      {
        "material_nombre": "Lápiz grafito",
        "tipo": "util",
        "cantidad": 20,
        "obligatorio": true,
        "descripcion": "Lápiz tipo B"
      }
    ],
    "metadata": {
      "nombre": "lista_utiles_2025.pdf",
      "tamaño": 123456,
      "tipo": "application/pdf"
    }
  }
]
```

---

## 🔍 Posibles Problemas y Soluciones

### Problema 1: El campo no aparece en las respuestas de la API

**Causa:** Permisos no configurados o curso en estado "Draft" sin `publicationState=preview`

**Solución:**
1. Verificar permisos en Strapi Admin
2. Usar `?publicationState=preview` en las peticiones GET

---

### Problema 2: Error "Invalid key versiones_materiales"

**Causa:** El schema no se ha aplicado (falta rebuild de Strapi)

**Solución:**
```bash
cd strapi
npm run build
npm run develop
```

---

### Problema 3: El campo se guarda pero no se devuelve en GET

**Causa:** Permisos de lectura no configurados o curso en estado "Draft"

**Solución:**
1. Verificar permisos `find` y `findOne` en Strapi Admin
2. Usar `?publicationState=preview` para incluir drafts

---

### Problema 4: Error al guardar JSON mal formateado

**Causa:** Strapi valida que el JSON sea válido

**Solución:** Asegurarse de que el JSON enviado sea válido. El frontend debe validar la estructura antes de enviar.

---

## ✅ Checklist de Verificación

### Código (Ya Verificado) ✅
- [x] Campo existe en schema
- [x] Controllers estándar (no hay lógica personalizada)
- [x] Services estándar
- [x] Routes estándar

### Strapi Admin (Pendiente de Verificación Manual) ⏳
- [ ] Permisos habilitados para `find`
- [ ] Permisos habilitados para `findOne`
- [ ] Permisos habilitados para `create`
- [ ] Permisos habilitados para `update`
- [ ] Campo visible en Content Manager
- [ ] Se puede guardar JSON desde Admin Panel

### API (Pendiente de Pruebas) ⏳
- [ ] GET devuelve el campo `versiones_materiales`
- [ ] PUT acepta el campo `versiones_materiales`
- [ ] No hay errores "Invalid key"
- [ ] El campo se guarda y se devuelve correctamente

---

## 🚀 Próximos Pasos

1. **Rebuild de Strapi** (si aún no se ha hecho):
   ```bash
   cd strapi
   npm run build
   npm run develop
   ```

2. **Verificar permisos en Strapi Admin:**
   - Settings → Users & Permissions Plugin → Roles
   - Verificar que los permisos de `cursos` estén habilitados

3. **Probar desde API:**
   - Hacer peticiones GET y PUT para verificar que funciona

4. **Probar desde Frontend:**
   - Intentar crear/actualizar un curso con `versiones_materiales`

---

## 📝 Notas Importantes

1. **Campos JSON en Strapi v4:** Los campos JSON son accesibles automáticamente cuando los permisos del content type están habilitados. No hay necesidad de configuración adicional de permisos a nivel de campo.

2. **Validación:** Strapi solo valida que el JSON sea válido sintácticamente. La validación de estructura (que tenga los campos correctos) debe hacerse en el frontend.

3. **Draft & Publish:** Como `cursos` tiene `draftAndPublish: true`, asegúrate de usar `?publicationState=preview` en las peticiones GET para incluir contenido en estado "Draft".

4. **Default Value:** El campo es opcional (`required: false`), por lo que puede ser `null` si no se ha asignado.

---

**Última actualización:** 10 de Enero 2026
