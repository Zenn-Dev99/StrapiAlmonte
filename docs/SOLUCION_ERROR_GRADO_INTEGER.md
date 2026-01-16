# 🔧 Solución: Error al Migrar Campo "grado" a Integer

**Fecha:** 10 de Enero 2026  
**Problema:** Strapi no puede migrar el campo `grado` de `string` a `integer` porque hay valores inválidos en la base de datos.

---

## 🐛 Error Observado

```
error: alter table "public"."cursos" alter column "grado" type integer using ("grado"::integer) - invalid input syntax for type integer: "sd"
```

**Causa:** Hay registros en la tabla `cursos` con valores como "sd" que no pueden convertirse a integer.

---

## ✅ Solución

### Paso 1: Ejecutar Script de Limpieza (PRIMERO)

**IMPORTANTE:** El schema está temporalmente como `string` para permitir que el script se ejecute.

Ejecutar el script de limpieza:

```bash
cd strapi
node scripts/limpiar-grado-cursos.mjs
```

**Qué hace el script:**
1. Analiza todos los cursos y sus valores de `grado`
2. Identifica valores inválidos (no numéricos, vacíos, o fuera del rango 1-8)
3. Convierte valores válidos que están como string a integer (vía Strapi entityService)
4. Pone `NULL` en valores inválidos

### Paso 2: Cambiar Schema a Integer

Una vez ejecutado el script, **CAMBIAR MANUALMENTE** el schema:

```json
// En strapi/src/api/curso/content-types/curso/schema.json
"grado": {
  "type": "integer",
  "min": 1,
  "max": 8
}
```

### Paso 3: Rebuild de Strapi

Ahora Strapi podrá hacer la migración correctamente:

```bash
cd strapi
npm run build
npm run develop
```

---

## 📋 Valores Válidos

El campo `grado` acepta:
- **Integer:** 1, 2, 3, 4, 5, 6, 7, 8
- **NULL:** Para valores inválidos o desconocidos

**Rango:** Mínimo 1, máximo 8 (según schema)

---

## ⚠️ Notas Importantes

1. **Valores inválidos:** Cualquier valor que no sea un número entre 1-8 será puesto en `NULL`
2. **Datos existentes:** Los cursos con valores inválidos perderán el valor de `grado` (quedará NULL)
3. **Backup:** Se recomienda hacer backup de la base de datos antes de ejecutar el script

---

## 🔍 Verificación Post-Migración

Después de ejecutar el script y rebuild, verificar:

```sql
-- Verificar que no hay valores inválidos
SELECT COUNT(*) FROM cursos WHERE grado IS NOT NULL AND (grado < 1 OR grado > 8);

-- Ver distribución de valores
SELECT grado, COUNT(*) FROM cursos WHERE grado IS NOT NULL GROUP BY grado ORDER BY grado;
```

---

**Última actualización:** 10 de Enero 2026
