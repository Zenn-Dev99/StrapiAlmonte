'use client';

/**
 * Componente para activar libros en MIRA Almonte
 * 
 * INSTRUCCIONES DE USO:
 * 1. Copia este archivo a tu proyecto frontend (ej: src/components/ActivarLibro.tsx)
 * 2. Asegúrate de tener:
 *    - Next.js con App Router (para useRouter)
 *    - Estado global o contexto para personaMiraId (o pásalo como prop)
 *    - JWT token en localStorage o cookies para autenticación
 * 3. Importa y usa este componente donde necesites activar libros
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ActivarLibroProps {
  personaMiraId?: number; // Opcional: si no se pasa, se intenta obtener del JWT o estado global
  onLibroActivado?: (libro: any) => void; // Callback cuando se activa exitosamente
  onError?: (error: string) => void; // Callback para errores
}

export default function ActivarLibro({ 
  personaMiraId: propPersonaMiraId, 
  onLibroActivado,
  onError 
}: ActivarLibroProps) {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [libroActivado, setLibroActivado] = useState<any>(null);
  const router = useRouter();

  /**
   * Obtiene el personaMiraId desde diferentes fuentes:
   * 1. Prop pasado al componente
   * 2. Estado global (contexto, zustand, etc.)
   * 3. JWT token decodificado
   * 4. localStorage/sessionStorage
   */
  const obtenerPersonaMiraId = (): number | null => {
    // 1. Si viene como prop, usarlo
    if (propPersonaMiraId) {
      return propPersonaMiraId;
    }

    // 2. Intentar obtener desde estado global (ajusta según tu implementación)
    // Ejemplo con contexto:
    // const { personaMiraId } = useAuth(); // o useMiraContext()
    // if (personaMiraId) return personaMiraId;

    // 3. Intentar obtener desde localStorage/sessionStorage
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('personaMiraId') || sessionStorage.getItem('personaMiraId');
      if (storedId) {
        const id = parseInt(storedId, 10);
        if (!isNaN(id)) return id;
      }

      // 4. Intentar obtener desde JWT (si tienes función para decodificar)
      // const jwt = localStorage.getItem('jwt') || sessionStorage.getItem('jwt');
      // if (jwt) {
      //   const decoded = decodeJWT(jwt); // Implementa tu función de decodificación
      //   if (decoded?.id) return decoded.id;
      // }
    }

    return null;
  };

  /**
   * Obtiene el JWT token para enviarlo en el header Authorization
   */
  const obtenerJWT = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('jwt') || 
             sessionStorage.getItem('jwt') || 
             localStorage.getItem('token') || 
             sessionStorage.getItem('token');
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLibroActivado(null);
    setLoading(true);

    try {
      const codigoLimpio = codigo.trim().toUpperCase();

      // Validación básica
      if (!codigoLimpio) {
        const errorMsg = 'Por favor, ingresa un código de activación';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        setLoading(false);
        return;
      }

      // Obtener personaMiraId
      const personaMiraId = obtenerPersonaMiraId();

      if (!personaMiraId) {
        const errorMsg = 'No se pudo identificar tu sesión. Por favor, inicia sesión nuevamente.';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        
        // Redirigir a login después de 2 segundos
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        setLoading(false);
        return;
      }

      // Preparar headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Agregar JWT si está disponible (el backend puede usarlo para inferir persona-mira)
      const jwt = obtenerJWT();
      if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
      }

      // Llamar al endpoint de activación
      const response = await fetch('/api/licencias-estudiantes/activar', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: {
            codigo: codigoLimpio,
            persona_mira_id: personaMiraId, // Siempre enviar por compatibilidad
          },
        }),
      });

      const responseData = await response.json();

      // ===== MANEJO DE ERRORES =====

      // 404: Código inválido (no existe la licencia)
      if (response.status === 404) {
        const errorMsg = 'Código inválido. Verifica que hayas ingresado el código correctamente.';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        setLoading(false);
        return;
      }

      // 400: Licencia ya utilizada o libro inactivo
      if (response.status === 400) {
        const errorMessage = responseData.error?.message || 'Error al activar el libro';
        
        let errorMsg = '';
        if (errorMessage.includes('ya fue utilizada')) {
          errorMsg = 'Esta licencia ya fue utilizada. Cada código solo puede ser usado una vez.';
        } else if (errorMessage.includes('no está disponible')) {
          errorMsg = 'El libro no está disponible para activación en este momento.';
        } else {
          errorMsg = errorMessage;
        }

        setError(errorMsg);
        if (onError) onError(errorMsg);
        setLoading(false);
        return;
      }

      // 401: Sesión expirada
      if (response.status === 401) {
        const errorMsg = 'Tu sesión ha expirado. Redirigiendo al login...';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        
        setTimeout(() => {
          router.push('/login');
        }, 2000);
        setLoading(false);
        return;
      }

      // 500: Error interno
      if (response.status === 500) {
        const errorMsg = responseData.error?.message || 'Error interno del servidor. Por favor, intenta más tarde.';
        setError(errorMsg);
        if (onError) onError(errorMsg);
        setLoading(false);
        return;
      }

      // Cualquier otro error
      if (!response.ok) {
        const errorMsg = responseData.error?.message || `Error ${response.status}`;
        setError(errorMsg);
        if (onError) onError(errorMsg);
        setLoading(false);
        return;
      }

      // ===== ÉXITO =====
      const libro = responseData.data;
      setSuccess(true);
      setLibroActivado(libro);
      setCodigo(''); // Limpiar input

      // Llamar callback si existe
      if (onLibroActivado) {
        onLibroActivado(libro.libro);
      }

      // CRÍTICO: Refrescar la página para que el libro aparezca inmediatamente
      // Esto actualiza la lista de libros activados sin recargar manualmente
      router.refresh();

      // Opcional: Si usas estado global, actualizar aquí
      // Ejemplo: updateLibrosActivos(libro);

    } catch (err: any) {
      // Manejar errores de red
      let errorMsg = '';
      
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMsg = 'Error de conexión. Verifica tu conexión a internet.';
      } else {
        errorMsg = err.message || 'Error desconocido al activar el libro';
      }

      setError(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="activar-libro-container">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="codigo-activacion" className="block text-sm font-medium text-gray-700 mb-2">
            Código de Activación
          </label>
          <input
            type="text"
            id="codigo-activacion"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.toUpperCase());
              setError(null);
              setSuccess(false);
            }}
            placeholder="Ingresa el código de activación"
            disabled={loading}
            required
            autoComplete="off"
          />
          <small className="mt-1 block text-sm text-gray-500">
            Ingresa el código único que viene con tu libro
          </small>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Mensaje de éxito */}
        {success && libroActivado && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm font-medium text-green-800 mb-2">
              ¡Libro activado exitosamente!
            </p>
            {libroActivado.libro && (
              <div className="text-sm text-green-700">
                <p><strong>Libro:</strong> {libroActivado.libro.nombre_libro}</p>
                {libroActivado.libro.autor_relacion && (
                  <p><strong>Autor:</strong> {libroActivado.libro.autor_relacion.nombre_completo_autor}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Botón de envío */}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={loading || !codigo.trim()}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Activando...
            </span>
          ) : (
            'Activar Libro'
          )}
        </button>
      </form>
    </div>
  );
}

/**
 * Hook personalizado para usar la activación de libros
 * Útil si prefieres manejar el estado fuera del componente
 */
export function useActivarLibro() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

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

      // Obtener JWT si está disponible
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (typeof window !== 'undefined') {
        const jwt = localStorage.getItem('jwt') || sessionStorage.getItem('jwt');
        if (jwt) {
          headers['Authorization'] = `Bearer ${jwt}`;
        }
      }

      const response = await fetch('/api/licencias-estudiantes/activar', {
        method: 'POST',
        headers,
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
      
      // CRÍTICO: Refrescar para actualizar la lista
      router.refresh();

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
