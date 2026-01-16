# 📖 Guía de Manejo: Libros, Obras, Editoriales, Autores

Guía práctica para entender y trabajar con la estructura de datos del catálogo de libros.

---

## 🎯 Resumen Ejecutivo

Tienes **6 Content Types principales** relacionados con libros:

1. **OBRA** - Contenido abstracto (ej: "El Quijote")
2. **LIBRO** - Edición específica con ISBN (ej: "El Quijote - Planeta 2020")
3. **EDITORIAL** - Casa editorial (ej: "Planeta")
4. **SELLO** - Subdivisión de editorial (ej: "Planeta Junior")
5. **COLECCIÓN** - Serie de libros (ej: "Plan Lector")
6. **AUTOR** - Autor/a de obras y libros

---

## 🏗️ Estructura Visual

```
┌─────────────────────────────────────────────────────────┐
│                    OBRA (Abstracto)                     │
│  "El Quijote"                                           │
│  - codigo_obra: "OB-001"                                │
│  - nombre_obra: "El Quijote"                            │
│  - autores: [Miguel de Cervantes]                       │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ oneToMany
                    │ (Una obra tiene muchas ediciones)
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌─────────▼────────┐
│  LIBRO 1       │    │  LIBRO 2         │
│  (Edición)     │    │  (Edición)       │
│                │    │                  │
│  ISBN: 978-... │    │  ISBN: 978-...   │
│  Planeta 2020  │    │  Santillana 2021 │
└───────┬────────┘    └─────────┬────────┘
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌─────────▼────────┐
│  EDITORIAL     │    │     AUTOR        │
│  "Planeta"     │    │  "Cervantes"     │
│                │    │                  │
│  └─ SELLO      │    │  └─ OBRAS        │
│     "Planeta   │    │     "El Quijote" │
│      Junior"   │    │                  │
│                │    │  └─ LIBROS       │
│  └─ COLECCIÓN  │    │     (ediciones)  │
│     "Plan      │    │                  │
│      Lector"   │    │                  │
└────────────────┘    └──────────────────┘
```

---

## 📋 Cómo Funciona Cada Content Type

### 1. **OBRA** - El Contenido Abstracto

**¿Qué es?**
- La obra literaria en sí, sin importar la edición
- No tiene ISBN (es abstracto)
- Puede tener múltiples ediciones

**Ejemplo**:
```
OBRA: "El Quijote"
  - codigo_obra: "OB-001"
  - nombre_obra: "El Quijote"
  - autores: [Miguel de Cervantes]
  - ediciones: [Libro 1, Libro 2, Libro 3...]
```

**Cuándo crear una Obra**:
- Cuando tienes un nuevo título/contenido literario
- Antes de crear las ediciones (libros)

---

### 2. **LIBRO** - La Edición Específica

**¿Qué es?**
- Una edición específica de una obra
- Tiene ISBN único (requerido)
- Es lo que se vende (producto físico/digital)

**Ejemplo**:
```
LIBRO: "El Quijote - Planeta 2020"
  - isbn_libro: "978-84-08-12345-6" (ÚNICO)
  - nombre_libro: "El Quijote"
  - obra: "El Quijote" (OB-001)
  - editorial: "Planeta"
  - sello: "Planeta Clásicos"
  - coleccion: "Biblioteca Clásica"
  - autor_relacion: "Miguel de Cervantes"
```

**Cuándo crear un Libro**:
- Cuando tienes una nueva edición con ISBN diferente
- Cuando vas a sincronizar con WooCommerce (solo libros se sincronizan)

**⚠️ Importante**:
- Cada libro debe tener un ISBN único
- Un mismo libro (obra) puede tener múltiples ediciones (libros) con diferentes ISBNs

---

### 3. **EDITORIAL** - La Casa Editorial

**¿Qué es?**
- La empresa que publica los libros
- Puede tener múltiples sellos y colecciones

**Ejemplo**:
```
EDITORIAL: "Planeta"
  - id_editorial: "ED-001"
  - nombre_editorial: "Planeta"
  - sellos: ["Planeta Junior", "Planeta Cómic"]
  - colecciones: ["Biblioteca Clásica", "Plan Lector"]
  - libros: [Libro 1, Libro 2, ...]
```

**Cuándo crear una Editorial**:
- Cuando trabajas con una nueva casa editorial
- Antes de crear sellos o colecciones

---

### 4. **SELLO** - Subdivisión de Editorial

**¿Qué es?**
- Una marca o subdivisión de una editorial
- Pertenece a una editorial (required)

**Ejemplo**:
```
SELLO: "Planeta Junior"
  - id_sello: "SE-001"
  - nombre_sello: "Planeta Junior"
  - editorial: "Planeta" (required)
  - colecciones: ["Plan Lector Junior"]
  - libros: [Libro 1, Libro 2, ...]
```

**Cuándo crear un Sello**:
- Cuando una editorial tiene diferentes marcas/líneas
- Opcional: un libro puede tener editorial sin sello

---

### 5. **COLECCIÓN** - Serie de Libros

**¿Qué es?**
- Una serie o colección de libros
- Pertenece a una editorial (required)
- Puede pertenecer a un sello (opcional)

**Ejemplo**:
```
COLECCIÓN: "Plan Lector"
  - id_coleccion: "CO-001"
  - nombre_coleccion: "Plan Lector"
  - editorial: "Planeta" (required)
  - sello: "Planeta Junior" (opcional)
  - libros: [Libro 1, Libro 2, ...]
```

**Cuándo crear una Colección**:
- Cuando varios libros pertenecen a la misma serie
- Opcional: un libro puede no tener colección

---

### 6. **AUTOR** - El Autor/a

**¿Qué es?**
- La persona que escribe las obras
- Puede tener múltiples obras y libros

**Ejemplo**:
```
AUTOR: "Miguel de Cervantes"
  - id_autor: "AU-001"
  - nombre_completo_autor: "Miguel de Cervantes"
  - obras: ["El Quijote", "Novelas Ejemplares"]
  - libros: [Libro 1, Libro 2, ...] (todas las ediciones)
```

**Cuándo crear un Autor**:
- Cuando trabajas con un nuevo autor
- Antes de crear obras o libros

---

## 🔄 Flujo de Trabajo Recomendado

### Crear un Nuevo Libro (Edición)

**Paso 1**: Verificar/Crear Autor
```
1. Buscar si el autor existe
2. Si no existe, crear Autor
```

**Paso 2**: Verificar/Crear Obra
```
1. Buscar si la obra existe
2. Si no existe, crear Obra
3. Relacionar Obra con Autor(es)
```

**Paso 3**: Verificar/Crear Editorial
```
1. Buscar si la editorial existe
2. Si no existe, crear Editorial
```

**Paso 4**: Verificar/Crear Sello (opcional)
```
1. Si el libro tiene sello:
   - Buscar si el sello existe
   - Si no existe, crear Sello
   - Relacionar Sello con Editorial
```

**Paso 5**: Verificar/Crear Colección (opcional)
```
1. Si el libro pertenece a una colección:
   - Buscar si la colección existe
   - Si no existe, crear Colección
   - Relacionar Colección con Editorial (y Sello si aplica)
```

**Paso 6**: Crear Libro (Edición)
```
1. Crear Libro con:
   - ISBN (único, requerido)
   - nombre_libro
   - Relacionar con: obra, autor_relacion, editorial, sello (opcional), coleccion (opcional)
   - Asignar canales (moraleja, escolar)
2. Guardar → Se sincroniza automáticamente a WooCommerce
```

---

## 🎯 Casos de Uso Comunes

### Caso 1: Libro Nuevo (Obra Nueva)

```
1. Crear Autor: "Gabriel García Márquez"
2. Crear Obra: "Cien años de soledad"
   - Relacionar con Autor
3. Crear Editorial: "Sudamericana" (si no existe)
4. Crear Libro: "Cien años de soledad - Sudamericana 2020"
   - ISBN: 978-84-376-0494-7
   - Relacionar con: Obra, Autor, Editorial
   - Asignar canales
```

### Caso 2: Nueva Edición de Obra Existente

```
1. Buscar Obra existente: "El Quijote"
2. Crear Libro: "El Quijote - Nueva Editorial 2021"
   - ISBN: 978-84-08-99999-9 (nuevo ISBN)
   - Relacionar con: Obra existente, Autor, Nueva Editorial
   - Asignar canales
```

### Caso 3: Libro con Sello y Colección

```
1. Verificar Editorial: "Planeta"
2. Verificar/Crear Sello: "Planeta Junior"
3. Verificar/Crear Colección: "Plan Lector"
4. Crear Libro:
   - Relacionar con: Editorial, Sello, Colección
```

---

## ⚠️ Puntos Importantes

### 1. Obra vs Libro

**❌ Confusión común**:
- "Libro" no es lo mismo que "Obra"

**✅ Correcto**:
- **Obra** = Contenido abstracto (ej: "El Quijote")
- **Libro** = Edición específica con ISBN (ej: "El Quijote - Planeta 2020 - ISBN 978...")

**Ejemplo**:
- Una Obra: "El Quijote"
- Múltiples Libros (ediciones):
  - "El Quijote - Planeta 2020" (ISBN 1)
  - "El Quijote - Santillana 2021" (ISBN 2)
  - "El Quijote - Zig-Zag 2022" (ISBN 3)

### 2. Jerarquía Editorial → Sello → Colección

```
EDITORIAL (required)
  └─ SELLO (opcional)
      └─ COLECCIÓN (opcional)
```

**Reglas**:
- Un libro puede tener Editorial sin Sello
- Un libro puede tener Sello sin Colección
- Pero Colección requiere Editorial
- Sello requiere Editorial

### 3. Sincronización con WooCommerce

**Importante**:
- ✅ Solo se sincronizan **Libros** (ediciones con ISBN)
- ❌ Las Obras NO se sincronizan (son abstractas)
- ✅ Las relaciones (Editorial, Autor) se pueden mapear a categorías/atributos en WooCommerce

### 4. Duplicación de Datos

**Problema**:
- `nombre_completo_autor` en Libro (texto plano)
- `autor_relacion` en Libro (relación)

**Solución**:
- Usar `autor_relacion` como fuente de verdad
- `nombre_completo_autor` es solo backup
- Preferir siempre la relación sobre el texto

---

## 🔍 Búsquedas Comunes

### Buscar todas las ediciones de una obra
```
GET /api/libros?filters[obra][id][$eq]=1
```

### Buscar todos los libros de una editorial
```
GET /api/libros?filters[editorial][id][$eq]=1
```

### Buscar todos los libros de un autor
```
GET /api/libros?filters[autor_relacion][id][$eq]=1
```

### Buscar todas las obras de un autor
```
GET /api/obras?filters[autores][id][$eq]=1
```

---

## 📚 Referencias

- [ESTRUCTURA_LIBROS.md](./ESTRUCTURA_LIBROS.md) - Documentación técnica completa
- [MAPEO_CAMPOS_STRAPI_WOOCOMMERCE.md](./MAPEO_CAMPOS_STRAPI_WOOCOMMERCE.md) - Mapeo con WooCommerce
- [CONFIGURACION_WOOCOMMERCE.md](./CONFIGURACION_WOOCOMMERCE.md) - Configuración WooCommerce

---

## ✅ Checklist de Trabajo

### Al crear un nuevo libro:
- [ ] Verificar/Crear Autor
- [ ] Verificar/Crear Obra
- [ ] Verificar/Crear Editorial
- [ ] Verificar/Crear Sello (si aplica)
- [ ] Verificar/Crear Colección (si aplica)
- [ ] Crear Libro con ISBN único
- [ ] Asignar canales (moraleja, escolar)
- [ ] Verificar sincronización con WooCommerce

### Al editar un libro existente:
- [ ] Verificar que el ISBN siga siendo único
- [ ] Actualizar relaciones si cambió editorial/sello/colección
- [ ] Verificar que los canales estén correctos
- [ ] Verificar sincronización con WooCommerce

