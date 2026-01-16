# 🔄 Refactorización: Sistema de Activación de Libros

## ✅ Cambios Realizados

### PASO 1: Corrección de Schemas ✅

**Archivo modificado**: `strapi/src/api/libro-mira/content-types/libro-mira/schema.json`

**Cambio**: Eliminado completamente el atributo `codigo_activacion_base` del schema de `libro-mira`.

**Razón**: El sistema ahora usa licencias únicas (1:1) en lugar de códigos compartidos por libro.

---

### PASO 2: Controlador de Activación Reescrito ✅

**Archivo modificado**: `strapi/src/api/licencia-estudiante/controllers/licencia-estudiante.ts`

**Nuevo algoritmo**:

1. **Obtener código y usuario**:
   - Código del body (`codigo`)
   - ID del estudiante del body (`persona_mira_id`)

2. **Buscar licencia directamente**:
   - Busca en `licencia-estudiante` donde `codigo_activacion === codigo`
   - **NO busca en libro-mira** (sistema anterior)

3. **Validaciones**:
   - Si no existe la licencia → `404 Not Found` con mensaje "Código inválido"
   - Si la licencia ya tiene `estudiante` asignado → `400 Bad Request` con mensaje "Esta licencia ya fue utilizada"
   - Si `activa === false` → `400 Bad Request` con mensaje "Esta licencia ya fue utilizada"

4. **Activación**:
   - Actualiza la licencia encontrada:
     - `estudiante` = ID del usuario actual
     - `fecha_activacion` = `new Date()`
     - `activa` = `true`
     - Copia `google_drive_folder_id` del libro si la licencia no lo tiene

5. **Respuesta**:
   - Retorna el objeto `libro_mira` completo con `populate` de:
     - `libro` (con `portada_libro`, `autor_relacion`, etc.)
     - Información de la licencia activada

**Endpoint**: `POST /api/licencias-estudiantes/activar`

**Body esperado**:
```json
{
  "data": {
    "codigo": "ABC123",
    "persona_mira_id": 123
  }
}
```

**Respuestas**:

- **200 OK** (Éxito):
```json
{
  "data": {
    "id": 456,
    "codigo_activacion": "ABC123",
    "fecha_activacion": "2026-01-12T...",
    "google_drive_folder_id": "...",
    "activa": true,
    "libro": {
      "id": 789,
      "nombre_libro": "Matemáticas 1° Medio",
      "isbn_libro": "978-...",
      "portada_libro": {...},
      "autor_relacion": {...}
    },
    "libro_mira": {
      "id": 101,
      "activo": true
    }
  },
  "message": "Licencia activada exitosamente"
}
```

- **400 Bad Request** (Código faltante):
```json
{
  "error": {
    "message": "El código de activación es requerido",
    "status": 400
  }
}
```

- **401 Unauthorized** (Estudiante no identificado):
```json
{
  "error": {
    "message": "No se pudo identificar al estudiante. Inicia sesión nuevamente.",
    "status": 401
  }
}
```

- **404 Not Found** (Código inválido):
```json
{
  "error": {
    "message": "Código inválido",
    "status": 404,
    "codigo": "ABC123"
  }
}
```

- **400 Bad Request** (Licencia ya utilizada):
```json
{
  "error": {
    "message": "Esta licencia ya fue utilizada",
    "status": 400,
    "codigo": "ABC123"
  }
}
```

---

### PASO 3: Limpieza de Referencias ✅

**Archivo modificado**: `strapi/src/api/libro-mira/controllers/libro-mira.ts`

**Cambios**:
- Eliminada referencia a `codigo_activacion_base` en el método `find`
- Eliminada referencia a `codigo_activacion_base` en el método `findOne`

---

## 📋 Verificaciones Requeridas en Frontend

### 1. Endpoint de Activación

**Verificar que el frontend llame correctamente**:
- **URL**: `/api/licencias-estudiantes/activar`
- **Método**: `POST`
- **Body**: 
  ```json
  {
    "data": {
      "codigo": "ABC123",
      "persona_mira_id": 123
    }
  }
  ```

### 2. Manejo de Errores

**El frontend debe manejar estos códigos de estado**:

#### 404 Not Found (Código inválido)
```javascript
if (response.status === 404) {
  const error = await response.json();
  // Mostrar: "Código inválido. Verifica que hayas ingresado el código correctamente."
  // Mensaje del backend: error.error.message
}
```

#### 400 Bad Request (Licencia ya utilizada)
```javascript
if (response.status === 400) {
  const error = await response.json();
  // Mostrar: "Esta licencia ya fue utilizada. Cada código solo puede ser usado una vez."
  // Mensaje del backend: error.error.message
}
```

#### 401 Unauthorized (Estudiante no identificado)
```javascript
if (response.status === 401) {
  const error = await response.json();
  // Mostrar: "No se pudo identificar tu sesión. Por favor, inicia sesión nuevamente."
  // Redirigir a /login
}
```

### 3. Respuesta Exitosa

**El frontend debe usar la respuesta para mostrar el libro activado**:

```javascript
if (response.ok) {
  const result = await response.json();
  const libro = result.data.libro;
  
  // Mostrar información del libro:
  // - libro.nombre_libro
  // - libro.portada_libro (imagen)
  // - libro.autor_relacion.nombre_completo_autor
  // - libro.isbn_libro
  
  // Actualizar lista de libros activados del usuario
  // Redirigir a dashboard o mostrar mensaje de éxito
}
```

### 4. Ejemplo de Implementación Frontend

```typescript
async function activarLibro(codigo: string, personaMiraId: number) {
  try {
    const response = await fetch('/api/licencias-estudiantes/activar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          codigo: codigo.trim().toUpperCase(),
          persona_mira_id: personaMiraId,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 404) {
        throw new Error('Código inválido. Verifica que hayas ingresado el código correctamente.');
      } else if (response.status === 400) {
        throw new Error('Esta licencia ya fue utilizada. Cada código solo puede ser usado una vez.');
      } else if (response.status === 401) {
        // Redirigir a login
        window.location.href = '/login';
        return;
      } else {
        throw new Error(error.error?.message || 'Error al activar el libro');
      }
    }

    const result = await response.json();
    const libro = result.data.libro;
    
    // Mostrar éxito y actualizar UI
    showSuccessMessage(`¡Libro "${libro.nombre_libro}" activado exitosamente!`);
    refreshLibrosActivos(); // Actualizar lista de libros
    
    return result.data;
  } catch (error: any) {
    showErrorMessage(error.message);
    throw error;
  }
}
```

---

## 🔍 Diferencias Clave con el Sistema Anterior

| Aspecto | Sistema Anterior ❌ | Sistema Nuevo ✅ |
|---------|---------------------|------------------|
| **Búsqueda** | Buscaba en `libro-mira` por `codigo_activacion_base` | Busca directamente en `licencia-estudiante` por `codigo_activacion` |
| **Código** | Compartido (mismo código para todos los estudiantes) | Único (1 código = 1 estudiante) |
| **Creación** | Creaba nueva licencia en cada activación | Actualiza licencia existente |
| **Validación** | Solo verificaba si el libro estaba activo | Verifica si la licencia ya fue usada |
| **Duplicados** | Permitía múltiples activaciones del mismo código | Bloquea reutilización de códigos |

---

## ⚠️ Importante: Migración de Datos

**Si ya existen licencias creadas con el sistema anterior**, necesitarás:

1. **Crear licencias únicas** para cada código que se haya usado
2. **Asignar códigos únicos** a cada licencia existente
3. **Marcar como activas** las licencias que ya fueron activadas

**Script de migración sugerido** (ejecutar una vez):

```javascript
// Buscar todas las licencias existentes
const licencias = await strapi.entityService.findMany('api::licencia-estudiante.licencia-estudiante', {
  // ... filtros
});

// Para cada licencia, asegurar que tenga un código único
for (const licencia of licencias) {
  if (!licencia.codigo_activacion) {
    // Generar código único
    const codigoUnico = `LIC-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    await strapi.entityService.update('api::licencia-estudiante.licencia-estudiante', licencia.id, {
      data: {
        codigo_activacion: codigoUnico,
      },
    });
  }
}
```

---

## ✅ Checklist de Verificación

- [x] Schema `libro-mira` actualizado (sin `codigo_activacion_base`)
- [x] Controlador `activar` reescrito con nueva lógica
- [x] Referencias a `codigo_activacion_base` eliminadas de controladores
- [ ] Frontend actualizado para manejar nuevos errores (404, 400)
- [ ] Frontend verifica que el endpoint sigue siendo `/api/licencias-estudiantes/activar`
- [ ] Pruebas de activación con código válido
- [ ] Pruebas de activación con código inválido (404)
- [ ] Pruebas de activación con código ya usado (400)
- [ ] Migración de datos si es necesario

---

**Fecha de refactorización**: 2026-01-12
**Estado**: ✅ Backend completado, ⏳ Frontend pendiente de verificación
