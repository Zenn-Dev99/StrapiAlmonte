# ✅ Corrección del Content Type "cursos"

**Fecha:** 9 de Enero 2026  
**Estado:** ✅ **CORREGIDO**

---

## 🐛 Problemas Identificados

El frontend estaba recibiendo estos errores:
1. ❌ `Invalid key materiales` - al intentar populate[materiales]
2. ❌ `Invalid key nombre` - al intentar enviar campo nombre
3. ❌ `Invalid key curso_nombre` - al intentar enviar campo curso_nombre
4. ❌ `Invalid key titulo` - al intentar enviar campo titulo

---

## 🔍 Análisis del Schema Original

### Schema ANTES de la corrección:

```json
{
  "attributes": {
    "colegio": { "type": "relation", ... },
    "nivel_ref": { "type": "relation", ... },
    "titulo": { "type": "string" },
    "letra": { "type": "string" },
    "anio": { "type": "integer" },
    // ❌ FALTABA: nombre_curso, nivel, grado, activo, materiales
  }
}
```

**Problemas encontrados:**
1. ❌ NO existía el campo `nombre_curso` (required)
2. ❌ NO existía el campo `nivel` (string)
3. ❌ NO existía el campo `grado` (string)
4. ❌ NO existía el campo `activo` (boolean)
5. ❌ NO existía el componente `materiales`
6. ❌ NO existía la relación inversa en `colegio`
7. ❌ `draftAndPublish` estaba en `false`

---

## ✅ Solución Implementada

### 1. **Agregados Campos Faltantes al Schema**

**Archivo:** `strapi/src/api/curso/content-types/curso/schema.json`

```json
{
  "options": {
    "draftAndPublish": true  // ✅ Habilitado
  },
  "attributes": {
    "nombre_curso": {  // ✅ NUEVO - Campo requerido
      "type": "string",
      "required": true
    },
    "nivel": {  // ✅ NUEVO
      "type": "string"
    },
    "grado": {  // ✅ NUEVO
      "type": "string"
    },
    "activo": {  // ✅ NUEVO
      "type": "boolean",
      "default": true
    },
    "colegio": {  // ✅ ACTUALIZADO - Agregado inversedBy
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::colegio.colegio",
      "inversedBy": "cursos"  // ✅ Agregado
    },
    "materiales": {  // ✅ NUEVO - Componente repeatable
      "type": "component",
      "repeatable": true,
      "component": "curso.material"
    },
    // ✅ Campos existentes mantenidos para compatibilidad:
    "titulo": { "type": "string" },
    "letra": { "type": "string" },
    "anio": { "type": "integer" },
    // ...
  }
}
```

### 2. **Creado Componente "curso.material"**

**Archivo:** `strapi/src/components/curso/material.json`

```json
{
  "collectionName": "components_curso_materials",
  "info": {
    "displayName": "Material",
    "description": "Material necesario para el curso"
  },
  "attributes": {
    "material_nombre": {  // ✅ Text, required
      "type": "string",
      "required": true
    },
    "tipo": {  // ✅ Enum: util, libro, cuaderno, otro
      "type": "enumeration",
      "enum": ["util", "libro", "cuaderno", "otro"],
      "required": true,
      "default": "util"
    },
    "cantidad": {  // ✅ Number, default: 1, min: 1
      "type": "integer",
      "default": 1,
      "min": 1
    },
    "obligatorio": {  // ✅ Boolean, default: true
      "type": "boolean",
      "default": true
    },
    "descripcion": {  // ✅ Text, optional
      "type": "text"
    }
  }
}
```

### 3. **Agregada Relación Inversa en Colegio**

**Archivo:** `strapi/src/api/colegio/content-types/colegio/schema.json`

```json
{
  "attributes": {
    // ... otros campos ...
    "cursos": {  // ✅ NUEVO
      "type": "relation",
      "relation": "oneToMany",
      "target": "api::curso.curso",
      "mappedBy": "colegio"
    }
  }
}
```

---

## 📋 Campos Disponibles Ahora

### Campos Principales (Nuevos)

- ✅ `nombre_curso` (Text, **required**) - Nombre del curso
- ✅ `nivel` (Text, optional) - Nivel educativo
- ✅ `grado` (Text, optional) - Grado específico
- ✅ `activo` (Boolean, default: true) - Estado del curso
- ✅ `materiales` (Component, repeatable) - Lista de materiales

### Relaciones

- ✅ `colegio` (manyToOne) - Relación con colegios (con `inversedBy`)
- ✅ `nivel_ref` (manyToOne) - Relación con nivel (mantenida)

### Campos Legacy (Mantenidos para Compatibilidad)

- ✅ `titulo` (Text) - Título del curso
- ✅ `letra` (Text) - Letra del curso
- ✅ `anio` (Integer) - Año
- ✅ `curso_letra_anio` (Text)
- ✅ `matricula` (Integer)
- ✅ `nota` (Text)

---

## 🔧 Correcciones Aplicadas

### ✅ Error 1: Invalid key materiales
**Causa:** El componente `materiales` no existía  
**Solución:** Creado componente `curso.material` y agregado al schema

### ✅ Error 2: Invalid key nombre/curso_nombre
**Causa:** El campo no existía en el schema  
**Solución:** Agregado campo `nombre_curso` (required)

### ✅ Error 3: Invalid key titulo
**Causa:** Aunque existe `titulo`, el frontend puede necesitar `nombre_curso`  
**Solución:** Agregado `nombre_curso` como campo principal (ambos campos disponibles ahora)

---

## 📊 Schema Final (Completo)

```json
{
  "kind": "collectionType",
  "collectionName": "cursos",
  "info": {
    "singularName": "curso",
    "pluralName": "cursos",
    "displayName": "Colegio · Cursos"
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "nombre_curso": {
      "type": "string",
      "required": true
    },
    "nivel": {
      "type": "string"
    },
    "grado": {
      "type": "string"
    },
    "activo": {
      "type": "boolean",
      "default": true
    },
    "colegio": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::colegio.colegio",
      "inversedBy": "cursos"
    },
    "materiales": {
      "type": "component",
      "repeatable": true,
      "component": "curso.material"
    },
    "nivel_ref": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::nivel.nivel"
    },
    "titulo": {
      "type": "string"
    },
    "letra": {
      "type": "string"
    },
    "anio": {
      "type": "integer"
    },
    "curso_letra_anio": {
      "type": "string"
    },
    "matricula": {
      "type": "integer"
    },
    "nota": {
      "type": "text"
    }
  }
}
```

---

## 🚀 Próximos Pasos Requeridos

### 1. **Rebuild de Strapi (OBLIGATORIO)**

```bash
cd strapi
npm run build
```

**⚠️ IMPORTANTE:** Sin este paso, los cambios NO aparecerán en Strapi Admin.

### 2. **Reiniciar Strapi**

```bash
npm run develop
```

### 3. **Configurar Permisos**

En Strapi Admin → Settings → Users & Permissions Plugin → Roles:

**Para el rol `Authenticated` o `Public`:**

Habilitar permisos para `api::curso.curso`:
- ✅ `find` - Listar cursos
- ✅ `findOne` - Ver detalle de curso
- ✅ `create` - Crear cursos
- ✅ `update` - Actualizar cursos
- ✅ `delete` - Eliminar cursos

### 4. **Probar desde Strapi Admin**

1. Ir a Content Manager → Curso
2. Crear un nuevo curso
3. Verificar que aparezcan todos los campos nuevos
4. Verificar que el componente `materiales` funcione

### 5. **Probar desde API**

```bash
# Listar cursos
GET /api/cursos

# Crear curso
POST /api/cursos
{
  "data": {
    "nombre_curso": "1° Básico A",
    "nivel": "Básico",
    "grado": "1° Básico",
    "activo": true,
    "colegio": 123,
    "materiales": [
      {
        "material_nombre": "Lápiz grafito",
        "tipo": "util",
        "cantidad": 2,
        "obligatorio": true
      }
    ]
  }
}

# Populate materiales
GET /api/cursos?populate[materiales]=true
```

---

## 📝 Información para el Frontend

### Nombre Exacto de Campos

- ✅ **Campo del nombre:** `nombre_curso` (NO `nombre`, NO `curso_nombre`, NO `titulo`)
- ✅ **Componente materiales:** `materiales` (componente repeatable `curso.material`)

### Payload para Crear Curso

```json
{
  "data": {
    "nombre_curso": "1° Básico A",  // ✅ Usar nombre_curso
    "nivel": "Básico",
    "grado": "1° Básico",
    "activo": true,
    "colegio": { "connect": [123] },  // ✅ Relación con colegio
    "materiales": [  // ✅ Componente repeatable
      {
        "material_nombre": "Lápiz grafito",
        "tipo": "util",
        "cantidad": 2,
        "obligatorio": true,
        "descripcion": "Lápiz grafito HB"
      }
    ]
  }
}
```

### Populate Correcto

```typescript
// Para obtener materiales
populate[materiales]=true

// Para obtener colegio y materiales
populate[0]=colegio&populate[1]=materiales

// Populate completo
populate=deep
```

---

## ✅ Verificación Post-Corrección

- [x] Schema actualizado con `nombre_curso`
- [x] Componente `curso.material` creado
- [x] Campo `materiales` agregado al schema
- [x] Relación inversa agregada en `colegio`
- [x] `draftAndPublish` habilitado
- [ ] **Pendiente:** Rebuild de Strapi
- [ ] **Pendiente:** Configurar permisos
- [ ] **Pendiente:** Probar crear curso desde Strapi Admin
- [ ] **Pendiente:** Probar desde API

---

## 🔗 Archivos Modificados

- ✅ `strapi/src/api/curso/content-types/curso/schema.json` - Actualizado
- ✅ `strapi/src/components/curso/material.json` - Creado (nuevo)
- ✅ `strapi/src/api/colegio/content-types/colegio/schema.json` - Actualizado (relación inversa)

---

**Última actualización:** 9 de Enero 2026  
**Estado:** ✅ Correcciones aplicadas - Pendiente rebuild y prueba
