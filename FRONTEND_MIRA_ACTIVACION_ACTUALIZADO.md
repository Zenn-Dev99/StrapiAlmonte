# 🔄 Actualización Frontend MIRA Almonte - Sistema de Activación

## 📋 Cambios Requeridos

El backend ha sido refactorizado para usar **licencias únicas (1:1)** en lugar de códigos compartidos. El frontend debe actualizarse para manejar los nuevos códigos de error.

---

## 🔍 Ubicación del Código

Busca el archivo que contiene la función de activación de libros. Probablemente esté en:
- `src/app/(mira|dashboard|estudiante)/**/activar-libro.tsx`
- `src/components/**/ActivarLibro.tsx`
- `src/pages/**/activar.tsx`
- O cualquier archivo que llame a `/api/licencias-estudiantes/activar`

---

## ✅ Código Actualizado

### Función de Activación (TypeScript/React)

```typescript
/**
 * Activa un libro usando un código de activación único
 * NUEVO: Ahora busca directamente en licencias, no en libros
 */
async function activarLibro(codigo: string, personaMiraId: number) {
  try {
    // Limpiar y normalizar código
    const codigoLimpio = codigo.trim().toUpperCase();

    // Validación básica
    if (!codigoLimpio) {
      throw new Error('Por favor, ingresa un código de activación');
    }

    if (!personaMiraId) {
      throw new Error('No se pudo identificar tu sesión. Por favor, inicia sesión nuevamente.');
    }

    // Llamar al endpoint de activación
    const response = await fetch('/api/licencias-estudiantes/activar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          codigo: codigoLimpio,
          persona_mira_id: personaMiraId,
        },
      }),
    });

    // Manejar respuesta
    const responseData = await response.json();

    // ===== NUEVOS CÓDIGOS DE ERROR =====
    
    // 404: Código inválido (no existe la licencia)
    if (response.status === 404) {
      const errorMessage = responseData.error?.message || 'Código inválido';
      throw new Error(`${errorMessage}. Verifica que hayas ingresado el código correctamente.`);
    }

    // 400: Licencia ya utilizada o libro inactivo
    if (response.status === 400) {
      const errorMessage = responseData.error?.message || 'Error al activar el libro';
      
      if (errorMessage.includes('ya fue utilizada')) {
        throw new Error('Esta licencia ya fue utilizada. Cada código solo puede ser usado una vez.');
      } else if (errorMessage.includes('no está disponible')) {
        throw new Error('El libro no está disponible para activación en este momento.');
      } else {
        throw new Error(errorMessage);
      }
    }

    // 401: Estudiante no identificado
    if (response.status === 401) {
      // Redirigir a login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('No se pudo identificar tu sesión. Redirigiendo al login...');
    }

    // 500: Error interno
    if (response.status === 500) {
      const errorMessage = responseData.error?.message || 'Error interno del servidor';
      throw new Error(`Error al procesar la activación: ${errorMessage}`);
    }

    // Si no es 200, lanzar error genérico
    if (!response.ok) {
      const errorMessage = responseData.error?.message || `Error ${response.status}`;
      throw new Error(errorMessage);
    }

    // ===== ÉXITO =====
    // La respuesta incluye el libro completo con toda su información
    const libroActivado = responseData.data;
    
    return {
      success: true,
      libro: libroActivado.libro, // Objeto completo del libro
      licencia: {
        id: libroActivado.id,
        codigo_activacion: libroActivado.codigo_activacion,
        fecha_activacion: libroActivado.fecha_activacion,
        activa: libroActivado.activa,
      },
      message: responseData.message || 'Libro activado exitosamente',
    };

  } catch (error: any) {
    // Manejar errores de red
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    }

    // Re-lanzar errores que ya tienen mensaje
    throw error;
  }
}
```

---

## 🎨 Ejemplo de Componente React Completo

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ActivarLibroFormProps {
  personaMiraId: number;
  onLibroActivado?: (libro: any) => void;
}

export default function ActivarLibroForm({ personaMiraId, onLibroActivado }: ActivarLibroFormProps) {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const codigoLimpio = codigo.trim().toUpperCase();

      if (!codigoLimpio) {
        setError('Por favor, ingresa un código de activación');
        setLoading(false);
        return;
      }

      if (!personaMiraId) {
        setError('No se pudo identificar tu sesión. Por favor, inicia sesión nuevamente.');
        // Redirigir a login después de 2 segundos
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        setLoading(false);
        return;
      }

      // Llamar al endpoint
      const response = await fetch('/api/licencias-estudiantes/activar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            codigo: codigoLimpio,
            persona_mira_id: personaMiraId,
          },
        }),
      });

      const responseData = await response.json();

      // Manejar errores
      if (response.status === 404) {
        setError('Código inválido. Verifica que hayas ingresado el código correctamente.');
        setLoading(false);
        return;
      }

      if (response.status === 400) {
        const errorMessage = responseData.error?.message || 'Error al activar el libro';
        
        if (errorMessage.includes('ya fue utilizada')) {
          setError('Esta licencia ya fue utilizada. Cada código solo puede ser usado una vez.');
        } else if (errorMessage.includes('no está disponible')) {
          setError('El libro no está disponible para activación en este momento.');
        } else {
          setError(errorMessage);
        }
        setLoading(false);
        return;
      }

      if (response.status === 401) {
        setError('Tu sesión ha expirado. Redirigiendo al login...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorMessage = responseData.error?.message || `Error ${response.status}`;
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Éxito
      const libroActivado = responseData.data;
      setSuccess(true);
      setCodigo('');

      // Llamar callback si existe
      if (onLibroActivado) {
        onLibroActivado(libroActivado.libro);
      }

      // Mostrar mensaje de éxito y actualizar lista de libros
      // (aquí puedes agregar lógica para refrescar la lista de libros activados)

    } catch (err: any) {
      // Manejar errores de red
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Error de conexión. Verifica tu conexión a internet.');
      } else {
        setError(err.message || 'Error desconocido al activar el libro');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="activar-libro-form">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="codigo" className="form-label">
            Código de Activación
          </label>
          <input
            type="text"
            id="codigo"
            className="form-control"
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.toUpperCase());
              setError(null);
              setSuccess(false);
            }}
            placeholder="Ingresa el código de activación"
            disabled={loading}
            required
          />
          <small className="form-text text-muted">
            Ingresa el código único que viene con tu libro
          </small>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="alert">
            ¡Libro activado exitosamente!
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !codigo.trim()}
        >
          {loading ? 'Activando...' : 'Activar Libro'}
        </button>
      </form>
    </div>
  );
}
```

---

## 🔧 Si usas un Hook Personalizado

```typescript
// hooks/useActivarLibro.ts
import { useState } from 'react';

interface UseActivarLibroReturn {
  activar: (codigo: string, personaMiraId: number) => Promise<any>;
  loading: boolean;
  error: string | null;
  success: boolean;
  reset: () => void;
}

export function useActivarLibro(): UseActivarLibroReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const activar = async (codigo: string, personaMiraId: number) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const codigoLimpio = codigo.trim().toUpperCase();

      if (!codigoLimpio) {
        throw new Error('Por favor, ingresa un código de activación');
      }

      if (!personaMiraId) {
        throw new Error('No se pudo identificar tu sesión');
      }

      const response = await fetch('/api/licencias-estudiantes/activar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            codigo: codigoLimpio,
            persona_mira_id: personaMiraId,
          },
        }),
      });

      const responseData = await response.json();

      // Manejar errores
      if (response.status === 404) {
        throw new Error('Código inválido. Verifica que hayas ingresado el código correctamente.');
      }

      if (response.status === 400) {
        const errorMessage = responseData.error?.message || 'Error al activar el libro';
        
        if (errorMessage.includes('ya fue utilizada')) {
          throw new Error('Esta licencia ya fue utilizada. Cada código solo puede ser usado una vez.');
        } else if (errorMessage.includes('no está disponible')) {
          throw new Error('El libro no está disponible para activación en este momento.');
        } else {
          throw new Error(errorMessage);
        }
      }

      if (response.status === 401) {
        throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      }

      if (!response.ok) {
        throw new Error(responseData.error?.message || `Error ${response.status}`);
      }

      // Éxito
      setSuccess(true);
      return responseData.data;

    } catch (err: any) {
      const errorMessage = err.message || 'Error desconocido al activar el libro';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
    setLoading(false);
  };

  return {
    activar,
    loading,
    error,
    success,
    reset,
  };
}
```

---

## 📝 Cambios Clave a Implementar

### 1. **Manejo de Errores 404**
```typescript
// ANTES: Podría no manejar este caso
// AHORA: Debe mostrar mensaje específico
if (response.status === 404) {
  // Mostrar: "Código inválido. Verifica que hayas ingresado el código correctamente."
}
```

### 2. **Manejo de Errores 400 (Licencia ya usada)**
```typescript
// ANTES: Podría mostrar error genérico
// AHORA: Debe mostrar mensaje específico
if (response.status === 400 && errorMessage.includes('ya fue utilizada')) {
  // Mostrar: "Esta licencia ya fue utilizada. Cada código solo puede ser usado una vez."
}
```

### 3. **Manejo de Errores 401**
```typescript
// ANTES: Podría no redirigir
// AHORA: Debe redirigir a login
if (response.status === 401) {
  // Redirigir a /login
  router.push('/login');
}
```

### 4. **Respuesta Exitosa**
```typescript
// La respuesta ahora incluye el libro completo
const libroActivado = responseData.data;
// libroActivado.libro contiene: nombre_libro, portada_libro, autor_relacion, etc.
```

---

## ✅ Checklist de Verificación

- [ ] Buscar archivo que llama a `/api/licencias-estudiantes/activar`
- [ ] Actualizar manejo de errores 404 (Código inválido)
- [ ] Actualizar manejo de errores 400 (Licencia ya utilizada)
- [ ] Actualizar manejo de errores 401 (Redirigir a login)
- [ ] Verificar que el código se envía en mayúsculas y sin espacios
- [ ] Verificar que `persona_mira_id` se envía correctamente
- [ ] Probar con código válido
- [ ] Probar con código inválido (404)
- [ ] Probar con código ya usado (400)
- [ ] Probar sin sesión (401)
- [ ] Verificar que se muestra el libro activado correctamente

---

## 🔍 Cómo Encontrar el Código Actual

1. **Buscar en el proyecto**:
   ```bash
   grep -r "licencias-estudiantes/activar" .
   grep -r "activar.*libro" . --include="*.tsx" --include="*.ts"
   ```

2. **Buscar componentes relacionados**:
   - `ActivarLibro`
   - `ActivationForm`
   - `BookActivation`
   - `Dashboard` (puede tener el formulario de activación)

3. **Buscar hooks o servicios**:
   - `useActivarLibro`
   - `activateBook`
   - `libroService`

---

**Fecha de actualización**: 2026-01-12
**Estado**: ✅ Backend listo, ⏳ Frontend pendiente de actualización
