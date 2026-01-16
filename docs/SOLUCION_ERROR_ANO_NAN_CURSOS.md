# 🔧 Solución: Error "año must be a 'number' type, but the final value was: 'NaN'"

**Fecha:** 10 de Enero 2026  
**Problema:** Error al actualizar cursos con `versiones_materiales` cuando el campo `año` no está incluido en el payload.

---

## 🐛 Problema Identificado

### Error:
```
año must be a 'number' type, but the final value was: 'NaN'.
```

### Causa:
El campo `año` está configurado como `required: true` en el schema de `cursos`. Cuando se hace un PUT para actualizar solo `versiones_materiales` sin incluir `año`:

1. Strapi valida que `año` sea requerido
2. Si el curso existente no tiene `año` o es `null/undefined`, Strapi intenta convertirlo a número
3. La conversión resulta en `NaN`, causando el error

### Cuándo ocurre:
- ✅ Solo cuando se sube un PDF (actualización de `versiones_materiales`)
- ❌ NO ocurre al crear cursos (el lifecycle establece el año automáticamente)
- ❌ NO ocurre al editar cursos normalmente (se incluye el año)

---

## ✅ Solución Aplicada

### Cambio realizado:
**Archivo:** `strapi/src/api/curso/content-types/curso/schema.json`

**Antes:**
```json
{
  "año": {
    "type": "integer",
    "required": true,  // ← Problema: requerido
    "min": 2000,
    "max": 2100
  }
}
```

**Después:**
```json
{
  "año": {
    "type": "integer",
    "required": false,  // ← Solución: opcional
    "min": 2000,
    "max": 2100
  }
}
```

### Justificación:

1. **Flexibilidad:** Permite que cursos existan sin año (cursos históricos, en configuración, etc.)
2. **Actualizaciones parciales:** Permite actualizar solo `versiones_materiales` sin tener que incluir todos los campos
3. **Compatibilidad:** Los cursos existentes no se ven afectados
4. **Lifecycle:** El lifecycle `beforeCreate` sigue estableciendo el año actual automáticamente para nuevos cursos

---

## 📋 Estado Actual del Campo `año`

### Configuración Final:
```json
{
  "año": {
    "type": "integer",
    "required": false,  // Opcional
    "min": 2000,        // Validación mínima
    "max": 2100         // Validación máxima
  }
}
```

### Comportamiento:

1. **Al crear un curso:**
   - Si no se proporciona `año`, el lifecycle `beforeCreate` establece el año actual automáticamente
   - Si se proporciona, se usa el valor proporcionado

2. **Al actualizar un curso:**
   - Si se incluye `año`, se actualiza
   - Si NO se incluye `año`, se mantiene el valor existente (o `null` si no existe)
   - NO causa error si el curso no tiene `año`

3. **Validación:**
   - Si se proporciona `año`, debe ser un número entre 2000 y 2100
   - Si es `null` o no se proporciona, es válido (campo opcional)

---

## 🔍 Lifecycle Hooks Actuales

### `beforeCreate` (Líneas 47-62):
```typescript
async beforeCreate(event) {
  const data = event.params?.data || {};
  
  // Establecer año actual si no se proporciona
  if (!data.año) {
    data.año = new Date().getFullYear();
  }
  // ... resto del código
}
```

**Comportamiento:** ✅ Establece año actual automáticamente para nuevos cursos

### `beforeUpdate` (Líneas 63-80):
```typescript
async beforeUpdate(event) {
  const data = event.params?.data || {};
  
  // Recalcular si cambia nivel_ref, letra o año, o si falta
  if ('nivel_ref' in data || 'letra' in data || 'año' in data || !data.titulo) {
    data.titulo = await buildTitulo(data);
  }
  // ... resto del código
}
```

**Comportamiento:** ✅ NO establece año automáticamente (correcto, para no sobrescribir datos existentes)

---

## 🚀 Próximos Pasos

### 1. Rebuild de Strapi (REQUERIDO)

```bash
cd strapi
npm run build
npm run develop
```

**⚠️ IMPORTANTE:** Después del rebuild, el campo `año` será opcional.

### 2. Verificación Post-Rebuild

**Prueba 1: Actualizar curso sin año (debe funcionar)**
```bash
PUT /api/cursos/{id}
{
  "data": {
    "versiones_materiales": [
      {
        "id": 1,
        "nombre_archivo": "test.pdf",
        // ... resto de datos
      }
    ]
  }
}
```

**Resultado esperado:** ✅ Sin error, el curso se actualiza correctamente

**Prueba 2: Crear curso sin año (debe establecer año actual)**
```bash
POST /api/cursos
{
  "data": {
    "nombre_curso": "Test",
    "colegio": 1
    // sin campo "año"
  }
}
```

**Resultado esperado:** ✅ El curso se crea con `año` = año actual (2025 o 2026)

**Prueba 3: Actualizar curso con año (debe actualizar)**
```bash
PUT /api/cursos/{id}
{
  "data": {
    "año": 2026
  }
}
```

**Resultado esperado:** ✅ El año se actualiza correctamente

---

## 📝 Notas Importantes

1. **Cursos existentes:**
   - Los cursos que ya tienen `año` no se ven afectados
   - Los cursos sin `año` ahora son válidos (pueden tener `año: null`)

2. **Frontend:**
   - El frontend puede omitir `año` del payload cuando actualiza solo `versiones_materiales`
   - El frontend puede seguir enviando `año` si quiere actualizarlo

3. **Validación:**
   - Si se proporciona `año`, debe ser válido (2000-2100)
   - Si no se proporciona, no hay validación (campo opcional)

4. **Lifecycle:**
   - El lifecycle `beforeCreate` sigue estableciendo el año automáticamente
   - Esto asegura que nuevos cursos siempre tengan año (a menos que se especifique otro)

---

## ✅ Checklist de Verificación

- [x] Campo `año` cambiado a `required: false`
- [ ] Rebuild de Strapi completado
- [ ] Prueba: Actualizar curso sin año → ✅ Funciona
- [ ] Prueba: Crear curso sin año → ✅ Establece año actual
- [ ] Prueba: Actualizar curso con año → ✅ Actualiza correctamente
- [ ] Prueba: Subir PDF (actualizar versiones_materiales) → ✅ Sin error

---

**Última actualización:** 10 de Enero 2026
