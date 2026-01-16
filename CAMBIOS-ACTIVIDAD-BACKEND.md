# Cambios en el Content-Type "Actividad" - Aviso para Frontend/Intranet

## 📢 Cambios Aplicados en el Backend

Se realizaron correcciones importantes en el content-type "Actividad" que afectan cómo se debe usar desde el frontend.

---

## ✅ Cambios Realizados

### 1. **`draftAndPublish` cambiado a `false`**

**Antes:**
- Las actividades se creaban en estado "draft" y requerían publicación manual

**Ahora:**
- Las actividades se guardan directamente sin necesidad de publicar
- ✅ **No necesitas hacer un POST adicional para publicar**

**Impacto en Frontend:**
- Ya no necesitas enviar `publishedAt` o hacer un segundo request para publicar
- Las actividades estarán disponibles inmediatamente después de crearlas

---

### 2. **Campo `creado_por` ya NO es requerido**

**Antes:**
- El campo `creado_por` era obligatorio
- Si no se enviaba, la creación fallaba

**Ahora:**
- El campo `creado_por` es opcional
- ✅ **Puedes crear actividades sin especificar quién las creó**

**Impacto en Frontend:**
- Ya no es necesario enviar `creado_por` en el request
- Si lo envías, se guardará; si no, la actividad se creará igual

---

### 3. **Valores por defecto automáticos**

**Nuevo:** Se agregó un lifecycle hook que establece automáticamente:

- **`fecha`**: Si no se envía, se usa la fecha/hora actual
- **`tipo`**: Si no se envía, se usa "nota" por defecto
- **`estado`**: Si no se envía, se usa "pendiente" por defecto

**Impacto en Frontend:**
- Puedes crear actividades con solo `titulo` (que es el único campo realmente requerido)
- Los demás campos se completan automáticamente si no los envías

---

## 📋 Campos Requeridos (Actualizado)

### Campos OBLIGATORIOS:
- ✅ `titulo` (string) - **Único campo realmente requerido**

### Campos OPCIONALES (con valores por defecto):
- `fecha` (datetime) - Se establece automáticamente si no se envía
- `tipo` (enum) - Se establece a "nota" si no se envía
- `estado` (enum) - Se establece a "pendiente" si no se envía
- `descripcion` (text) - Opcional
- `notas` (text) - Opcional
- `creado_por` (relation) - Opcional (antes era requerido)
- `relacionado_con_contacto` (relation) - Opcional
- `relacionado_con_lead` (relation) - Opcional
- `relacionado_con_oportunidad` (relation) - Opcional
- `relacionado_con_colegio` (relation) - Opcional

---

## 🔧 Ejemplo de Request Simplificado

### Antes (requería más campos):
```json
{
  "data": {
    "titulo": "Llamada de seguimiento",
    "fecha": "2025-01-15T10:00:00Z",
    "tipo": "llamada",
    "estado": "pendiente",
    "creado_por": 123  // Era obligatorio
  }
}
```

### Ahora (mínimo requerido):
```json
{
  "data": {
    "titulo": "Llamada de seguimiento"
  }
}
```

**O con campos adicionales si los necesitas:**
```json
{
  "data": {
    "titulo": "Llamada de seguimiento",
    "descripcion": "Cliente interesado en renovar",
    "relacionado_con_contacto": 456,
    "relacionado_con_oportunidad": 789
  }
}
```

---

## 🚀 Endpoint de la API

**URL Base:** `https://strapi.moraleja.cl/api/actividades`

**Métodos disponibles:**
- `GET /api/actividades` - Listar todas
- `GET /api/actividades/:id` - Obtener una
- `POST /api/actividades` - Crear nueva
- `PUT /api/actividades/:id` - Actualizar
- `DELETE /api/actividades/:id` - Eliminar

---

## ⚠️ Notas Importantes

1. **No necesitas publicar manualmente** - Las actividades se guardan directamente
2. **`creado_por` es opcional** - Ya no causa errores si no se envía
3. **Valores por defecto automáticos** - `fecha`, `tipo` y `estado` se establecen automáticamente
4. **Solo `titulo` es obligatorio** - Puedes crear actividades con el mínimo de información

---

## 🔍 Verificación

Para verificar que todo funciona:

1. **Crear una actividad mínima:**
   ```bash
   curl -X POST https://strapi.moraleja.cl/api/actividades \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"data": {"titulo": "Prueba de actividad"}}'
   ```

2. **Verificar que se guardó:**
   ```bash
   curl https://strapi.moraleja.cl/api/actividades \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

## 📝 Estado Actual del Frontend

Según el código revisado:
- ✅ Hay tabs de "Actividades" en `PersonaDetail.tsx` y `ColegioDetail.tsx`
- ⚠️ Están marcados como TODO - aún no implementados
- 💡 Ahora es más fácil implementarlos porque los requerimientos son más simples

---

## 🎯 Recomendaciones para Implementación

1. **Crear componente de Timeline de Actividades**
   - Listar actividades relacionadas con una persona/colegio/lead/oportunidad
   - Filtrar por `relacionado_con_contacto`, `relacionado_con_colegio`, etc.

2. **Formulario simplificado de creación**
   - Solo requiere `titulo` como mínimo
   - Los demás campos son opcionales

3. **No olvidar:**
   - Ya no necesitas manejar publicación manual
   - `creado_por` es opcional (pero puedes enviarlo si tienes la info del usuario actual)

---

## 📞 Si hay problemas

Si después del deploy las actividades no se guardan:

1. Verificar permisos en Strapi Admin:
   - Settings → Users & Permissions → Roles
   - Habilitar: find, findOne, create, update, delete

2. Verificar logs del servidor para errores

3. Probar el endpoint directamente desde la consola del navegador
