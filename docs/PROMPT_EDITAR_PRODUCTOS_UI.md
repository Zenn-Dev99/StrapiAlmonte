# 🎨 PROMPT PARA CURSOR: Implementar Interfaz de Edición de Productos

## 📋 OBJETIVO

Crear una interfaz de **editar producto** similar a la de "agregar producto", con **precarga automática de datos** y actualización a través de la API de Strapi.

---

## 🎯 REQUERIMIENTOS FUNCIONALES

### 1. **Precarga de Datos**
- Al abrir la página de edición con un ID de producto, cargar automáticamente todos los datos del producto desde Strapi
- Llenar todos los campos del formulario con los valores actuales
- Mostrar indicador de carga mientras se obtienen los datos
- Manejar errores si el producto no existe

### 2. **Interfaz de Usuario**
- Usar la **misma estructura y componentes** que la página de "Agregar Producto"
- Mantener el mismo diseño visual y UX
- Todos los campos deben ser editables
- Botón "Guardar Cambios" en lugar de "Crear Producto"
- Botón "Cancelar" que regrese a la lista de productos

### 3. **Actualización de Datos**
- Al hacer clic en "Guardar Cambios", enviar PUT request a Strapi
- Solo enviar los campos que hayan cambiado (optimización)
- Mostrar mensaje de éxito o error
- Redirigir a la lista de productos después de guardar exitosamente

### 4. **Validaciones**
- Mantener las mismas validaciones que en "Agregar Producto"
- Validar campos requeridos antes de enviar
- Mostrar errores de validación de forma clara

---

## 📂 ESTRUCTURA DE ARCHIVOS SUGERIDA

```
src/
├── pages/
│   ├── productos/
│   │   ├── agregar.jsx          # Ya existe
│   │   ├── editar/[id].jsx      # CREAR ESTA
│   │   └── index.jsx            # Lista de productos
├── components/
│   ├── productos/
│   │   ├── FormularioProducto.jsx   # Componente reutilizable (CREAR)
│   │   ├── CamposBasicos.jsx        # Campos básicos del producto
│   │   ├── CamposWooCommerce.jsx    # Campos específicos de WooCommerce
│   │   └── SelectorCanales.jsx      # Selector de canales (moraleja/escolar)
├── hooks/
│   ├── useProducto.js           # Hook para obtener producto (CREAR)
│   └── useActualizarProducto.js # Hook para actualizar (CREAR)
└── services/
    └── productoService.js       # Servicios API (actualizar si existe)
```

---

## 💻 CÓDIGO DE IMPLEMENTACIÓN

### 1. **Hook para Obtener Producto**

**Archivo:** `src/hooks/useProducto.js`

```javascript
import { useState, useEffect } from 'react';

/**
 * Hook para obtener un producto desde Strapi
 * @param {string|number} productoId - ID del producto a obtener
 * @returns {Object} { producto, loading, error }
 */
export function useProducto(productoId) {
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productoId) {
      setLoading(false);
      return;
    }

    const fetchProducto = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener producto completo con todas las relaciones
        const response = await fetch(
          `https://strapi.moraleja.cl/api/libros/${productoId}?populate=*`
        );

        if (!response.ok) {
          throw new Error(`Error ${response.status}: No se pudo obtener el producto`);
        }

        const data = await response.json();
        
        if (!data.data) {
          throw new Error('Producto no encontrado');
        }

        // Normalizar datos para el formulario
        const productoNormalizado = {
          id: data.data.id,
          isbn_libro: data.data.attributes.isbn_libro || '',
          nombre_libro: data.data.attributes.nombre_libro || '',
          descripcion: data.data.attributes.descripcion || '',
          precio: data.data.attributes.precio || '',
          precio_oferta: data.data.attributes.precio_oferta || '',
          stock: data.data.attributes.stock || 0,
          estado_publicacion: data.data.attributes.estado_publicacion || 'Pendiente',
          
          // Canales (normalizar a array de IDs)
          canales: data.data.attributes.canales?.data?.map(c => c.id) || [],
          
          // Datos específicos de WooCommerce (si existen)
          peso: data.data.attributes.peso || '',
          ancho: data.data.attributes.ancho || '',
          alto: data.data.attributes.alto || '',
          largo: data.data.attributes.largo || '',
          clase_envio: data.data.attributes.clase_envio || '',
          
          // rawWooData si existe
          rawWooData: data.data.attributes.rawWooData || null,
          
          // Preservar externalIds (importante para actualización)
          externalIds: data.data.attributes.externalIds || {},
          
          // Otros campos que necesites
          autor: data.data.attributes.autor || '',
          editorial: data.data.attributes.editorial || '',
          año_publicacion: data.data.attributes.año_publicacion || '',
        };

        setProducto(productoNormalizado);
      } catch (err) {
        console.error('Error al obtener producto:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducto();
  }, [productoId]);

  return { producto, loading, error };
}
```

---

### 2. **Hook para Actualizar Producto**

**Archivo:** `src/hooks/useActualizarProducto.js`

```javascript
import { useState } from 'react';

/**
 * Hook para actualizar un producto en Strapi
 * @returns {Object} { actualizarProducto, loading, error, success }
 */
export function useActualizarProducto() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  /**
   * Actualiza un producto
   * @param {number|string} productoId - ID del producto
   * @param {Object} datos - Datos a actualizar
   * @returns {Promise<Object>} Producto actualizado
   */
  const actualizarProducto = async (productoId, datos) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      console.log('Actualizando producto:', productoId);
      console.log('Datos a enviar:', datos);

      // ✅ MÉTODO SIMPLIFICADO: Solo envía los campos que cambien
      // Strapi preserva externalIds automáticamente
      const payload = {
        data: {
          ...datos
          // ✅ NO necesitas incluir externalIds (se preservan automáticamente)
        }
      };

      const response = await fetch(
        `https://strapi.moraleja.cl/api/libros/${productoId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || `Error ${response.status}: No se pudo actualizar el producto`
        );
      }

      const resultado = await response.json();
      
      console.log('✅ Producto actualizado exitosamente:', resultado);
      setSuccess(true);
      
      return resultado;
    } catch (err) {
      console.error('❌ Error al actualizar producto:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    actualizarProducto,
    loading,
    error,
    success,
  };
}
```

---

### 3. **Componente Reutilizable de Formulario**

**Archivo:** `src/components/productos/FormularioProducto.jsx`

```javascript
import React, { useState, useEffect } from 'react';

/**
 * Componente de formulario reutilizable para crear/editar productos
 * @param {Object} props
 * @param {Object} props.valoresIniciales - Valores iniciales del formulario (opcional)
 * @param {Function} props.onSubmit - Función a ejecutar al enviar el formulario
 * @param {boolean} props.loading - Estado de carga
 * @param {string} props.textoBoton - Texto del botón de submit
 * @param {Function} props.onCancelar - Función al cancelar (opcional)
 */
export function FormularioProducto({
  valoresIniciales = {},
  onSubmit,
  loading = false,
  textoBoton = 'Guardar',
  onCancelar,
}) {
  // Estado del formulario
  const [formData, setFormData] = useState({
    isbn_libro: '',
    nombre_libro: '',
    descripcion: '',
    precio: '',
    precio_oferta: '',
    stock: 0,
    estado_publicacion: 'Publicado',
    canales: [],
    peso: '',
    ancho: '',
    alto: '',
    largo: '',
    clase_envio: '',
    ...valoresIniciales, // Sobrescribir con valores iniciales si existen
  });

  const [errores, setErrores] = useState({});

  // Actualizar formData cuando cambien los valores iniciales
  useEffect(() => {
    if (valoresIniciales && Object.keys(valoresIniciales).length > 0) {
      setFormData(prev => ({
        ...prev,
        ...valoresIniciales,
      }));
    }
  }, [valoresIniciales]);

  // Manejar cambios en inputs
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Limpiar error del campo cuando el usuario empieza a escribir
    if (errores[name]) {
      setErrores(prev => {
        const nuevosErrores = { ...prev };
        delete nuevosErrores[name];
        return nuevosErrores;
      });
    }
  };

  // Manejar cambios en selector de canales
  const handleCanalesChange = (canalId) => {
    setFormData(prev => {
      const canalesActuales = prev.canales || [];
      const yaExiste = canalesActuales.includes(canalId);
      
      return {
        ...prev,
        canales: yaExiste
          ? canalesActuales.filter(id => id !== canalId)
          : [...canalesActuales, canalId],
      };
    });
  };

  // Validar formulario
  const validarFormulario = () => {
    const nuevosErrores = {};

    if (!formData.nombre_libro || formData.nombre_libro.trim() === '') {
      nuevosErrores.nombre_libro = 'El nombre del producto es requerido';
    }

    if (!formData.precio || parseFloat(formData.precio) <= 0) {
      nuevosErrores.precio = 'El precio debe ser mayor a 0';
    }

    if (formData.canales.length === 0) {
      nuevosErrores.canales = 'Debes seleccionar al menos un canal';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // Manejar submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) {
      console.log('Errores de validación:', errores);
      return;
    }

    // Construir payload con rawWooData
    const payload = {
      nombre_libro: formData.nombre_libro,
      isbn_libro: formData.isbn_libro,
      descripcion: formData.descripcion,
      precio: parseFloat(formData.precio),
      estado_publicacion: formData.estado_publicacion,
      canales: formData.canales,
      stock: parseInt(formData.stock) || 0,
      
      // rawWooData para sincronización completa
      rawWooData: {
        name: formData.nombre_libro,
        description: formData.descripcion || '',
        short_description: formData.descripcion?.substring(0, 150) || '',
        regular_price: formData.precio.toString(),
        sale_price: formData.precio_oferta || '',
        weight: formData.peso || '',
        dimensions: {
          length: formData.largo || '',
          width: formData.ancho || '',
          height: formData.alto || '',
        },
        shipping_class: formData.clase_envio || '',
        manage_stock: true,
        stock_quantity: parseInt(formData.stock) || 0,
        stock_status: parseInt(formData.stock) > 0 ? 'instock' : 'outofstock',
        // ⚠️ IMPORTANTE: Campos específicos de WooCommerce van AQUÍ
        backorders: 'no',              // ✅ Aquí, NO en data
        backorders_allowed: false,     // ✅ Aquí, NO en data
      },
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="formulario-producto">
      {/* SECCIÓN: INFORMACIÓN BÁSICA */}
      <div className="seccion-formulario">
        <h3>Información Básica</h3>
        
        {/* ISBN */}
        <div className="campo-formulario">
          <label htmlFor="isbn_libro">
            ISBN *
          </label>
          <input
            type="text"
            id="isbn_libro"
            name="isbn_libro"
            value={formData.isbn_libro}
            onChange={handleChange}
            placeholder="Ej: 9788491820123"
            disabled={!!valoresIniciales.isbn_libro} // ISBN no editable
            className={errores.isbn_libro ? 'error' : ''}
          />
          {errores.isbn_libro && (
            <span className="mensaje-error">{errores.isbn_libro}</span>
          )}
        </div>

        {/* Nombre del Producto */}
        <div className="campo-formulario">
          <label htmlFor="nombre_libro">
            Nombre del Producto *
          </label>
          <input
            type="text"
            id="nombre_libro"
            name="nombre_libro"
            value={formData.nombre_libro}
            onChange={handleChange}
            placeholder="Ej: Cálculo I - 10ª Edición"
            className={errores.nombre_libro ? 'error' : ''}
          />
          {errores.nombre_libro && (
            <span className="mensaje-error">{errores.nombre_libro}</span>
          )}
        </div>

        {/* Descripción */}
        <div className="campo-formulario">
          <label htmlFor="descripcion">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="Descripción del producto"
            rows={5}
            className={errores.descripcion ? 'error' : ''}
          />
          {errores.descripcion && (
            <span className="mensaje-error">{errores.descripcion}</span>
          )}
        </div>
      </div>

      {/* SECCIÓN: PRECIO Y STOCK */}
      <div className="seccion-formulario">
        <h3>Precio y Stock</h3>
        
        <div className="fila-dos-columnas">
          {/* Precio */}
          <div className="campo-formulario">
            <label htmlFor="precio">
              Precio Regular *
            </label>
            <input
              type="number"
              id="precio"
              name="precio"
              value={formData.precio}
              onChange={handleChange}
              placeholder="15990"
              min="0"
              step="1"
              className={errores.precio ? 'error' : ''}
            />
            {errores.precio && (
              <span className="mensaje-error">{errores.precio}</span>
            )}
          </div>

          {/* Precio Oferta */}
          <div className="campo-formulario">
            <label htmlFor="precio_oferta">
              Precio Oferta
            </label>
            <input
              type="number"
              id="precio_oferta"
              name="precio_oferta"
              value={formData.precio_oferta}
              onChange={handleChange}
              placeholder="12990 (opcional)"
              min="0"
              step="1"
            />
          </div>
        </div>

        {/* Stock */}
        <div className="campo-formulario">
          <label htmlFor="stock">
            Stock
          </label>
          <input
            type="number"
            id="stock"
            name="stock"
            value={formData.stock}
            onChange={handleChange}
            placeholder="100"
            min="0"
          />
        </div>
      </div>

      {/* SECCIÓN: DIMENSIONES Y ENVÍO */}
      <div className="seccion-formulario">
        <h3>Dimensiones y Envío</h3>
        
        <div className="fila-cuatro-columnas">
          <div className="campo-formulario">
            <label htmlFor="peso">Peso (kg)</label>
            <input
              type="text"
              id="peso"
              name="peso"
              value={formData.peso}
              onChange={handleChange}
              placeholder="0.5"
            />
          </div>

          <div className="campo-formulario">
            <label htmlFor="largo">Largo (cm)</label>
            <input
              type="text"
              id="largo"
              name="largo"
              value={formData.largo}
              onChange={handleChange}
              placeholder="21"
            />
          </div>

          <div className="campo-formulario">
            <label htmlFor="ancho">Ancho (cm)</label>
            <input
              type="text"
              id="ancho"
              name="ancho"
              value={formData.ancho}
              onChange={handleChange}
              placeholder="15"
            />
          </div>

          <div className="campo-formulario">
            <label htmlFor="alto">Alto (cm)</label>
            <input
              type="text"
              id="alto"
              name="alto"
              value={formData.alto}
              onChange={handleChange}
              placeholder="2"
            />
          </div>
        </div>

        <div className="campo-formulario">
          <label htmlFor="clase_envio">Clase de Envío</label>
          <select
            id="clase_envio"
            name="clase_envio"
            value={formData.clase_envio}
            onChange={handleChange}
          >
            <option value="">Seleccionar...</option>
            <option value="envio-rapido">Envío Rápido</option>
            <option value="envio-normal">Envío Normal</option>
            <option value="retiro-tienda">Retiro en Tienda</option>
          </select>
        </div>
      </div>

      {/* SECCIÓN: PUBLICACIÓN */}
      <div className="seccion-formulario">
        <h3>Publicación</h3>
        
        {/* Estado de Publicación */}
        <div className="campo-formulario">
          <label htmlFor="estado_publicacion">
            Estado de Publicación *
          </label>
          <select
            id="estado_publicacion"
            name="estado_publicacion"
            value={formData.estado_publicacion}
            onChange={handleChange}
            className={errores.estado_publicacion ? 'error' : ''}
          >
            <option value="Publicado">Publicado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Borrador">Borrador</option>
          </select>
          {errores.estado_publicacion && (
            <span className="mensaje-error">{errores.estado_publicacion}</span>
          )}
        </div>

        {/* Canales */}
        <div className="campo-formulario">
          <label>Canales de Venta *</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.canales.includes(1)}
                onChange={() => handleCanalesChange(1)}
              />
              <span>Moraleja</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.canales.includes(2)}
                onChange={() => handleCanalesChange(2)}
              />
              <span>Escolar</span>
            </label>
          </div>
          {errores.canales && (
            <span className="mensaje-error">{errores.canales}</span>
          )}
        </div>
      </div>

      {/* BOTONES */}
      <div className="botones-formulario">
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="btn btn-secundario"
            disabled={loading}
          >
            Cancelar
          </button>
        )}
        
        <button
          type="submit"
          className="btn btn-primario"
          disabled={loading}
        >
          {loading ? 'Guardando...' : textoBoton}
        </button>
      </div>
    </form>
  );
}
```

---

### 4. **Página de Edición de Producto**

**Archivo:** `src/pages/productos/editar/[id].jsx` (Next.js) o `src/pages/productos/EditarProducto.jsx` (React)

```javascript
import React from 'react';
import { useRouter } from 'next/router'; // Next.js
// O import { useParams, useNavigate } from 'react-router-dom'; // React Router

import { useProducto } from '../../../hooks/useProducto';
import { useActualizarProducto } from '../../../hooks/useActualizarProducto';
import { FormularioProducto } from '../../../components/productos/FormularioProducto';

export default function EditarProducto() {
  // Next.js
  const router = useRouter();
  const { id } = router.query;
  
  // React Router alternativa:
  // const { id } = useParams();
  // const navigate = useNavigate();

  // Hooks personalizados
  const { producto, loading: loadingProducto, error: errorProducto } = useProducto(id);
  const { actualizarProducto, loading: actualizando, error: errorActualizar, success } = useActualizarProducto();

  // Manejar submit del formulario
  const handleSubmit = async (datos) => {
    try {
      await actualizarProducto(id, datos);
      
      // Mostrar mensaje de éxito
      alert('✅ Producto actualizado exitosamente');
      
      // Redirigir a la lista de productos
      router.push('/productos');
      // O con React Router: navigate('/productos');
    } catch (error) {
      alert(`❌ Error al actualizar: ${error.message}`);
    }
  };

  // Manejar cancelar
  const handleCancelar = () => {
    if (confirm('¿Descartar cambios?')) {
      router.push('/productos');
      // O con React Router: navigate('/productos');
    }
  };

  // Estados de carga
  if (loadingProducto) {
    return (
      <div className="container-cargando">
        <div className="spinner"></div>
        <p>Cargando producto...</p>
      </div>
    );
  }

  if (errorProducto) {
    return (
      <div className="container-error">
        <h2>❌ Error</h2>
        <p>{errorProducto}</p>
        <button onClick={() => router.back()}>Volver</button>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="container-error">
        <h2>❌ Producto no encontrado</h2>
        <button onClick={() => router.push('/productos')}>
          Ir a lista de productos
        </button>
      </div>
    );
  }

  return (
    <div className="pagina-editar-producto">
      <div className="header-pagina">
        <h1>Editar Producto</h1>
        <p className="subtitulo">Producto ID: {id}</p>
      </div>

      {errorActualizar && (
        <div className="alerta alerta-error">
          ❌ {errorActualizar}
        </div>
      )}

      <FormularioProducto
        valoresIniciales={producto}
        onSubmit={handleSubmit}
        loading={actualizando}
        textoBoton="Guardar Cambios"
        onCancelar={handleCancelar}
      />
    </div>
  );
}
```

---

### 5. **Estilos CSS Básicos**

**Archivo:** `src/styles/formulario-producto.css`

```css
/* Container principal */
.pagina-editar-producto {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.header-pagina {
  margin-bottom: 2rem;
}

.header-pagina h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.subtitulo {
  color: #666;
  font-size: 0.9rem;
}

/* Formulario */
.formulario-producto {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 2rem;
}

.seccion-formulario {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e0e0e0;
}

.seccion-formulario:last-of-type {
  border-bottom: none;
}

.seccion-formulario h3 {
  font-size: 1.3rem;
  margin-bottom: 1rem;
  color: #444;
}

/* Campos del formulario */
.campo-formulario {
  margin-bottom: 1.5rem;
}

.campo-formulario label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #555;
}

.campo-formulario input[type="text"],
.campo-formulario input[type="number"],
.campo-formulario textarea,
.campo-formulario select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.campo-formulario input:focus,
.campo-formulario textarea:focus,
.campo-formulario select:focus {
  outline: none;
  border-color: #4CAF50;
}

.campo-formulario input.error,
.campo-formulario textarea.error,
.campo-formulario select.error {
  border-color: #f44336;
}

.campo-formulario input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

/* Mensajes de error */
.mensaje-error {
  display: block;
  color: #f44336;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

/* Layouts de columnas */
.fila-dos-columnas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.fila-cuatro-columnas {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 768px) {
  .fila-dos-columnas,
  .fila-cuatro-columnas {
    grid-template-columns: 1fr;
  }
}

/* Checkboxes */
.checkbox-group {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

/* Botones */
.botones-formulario {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primario {
  background-color: #4CAF50;
  color: white;
}

.btn-primario:hover:not(:disabled) {
  background-color: #45a049;
}

.btn-secundario {
  background-color: #f0f0f0;
  color: #333;
}

.btn-secundario:hover:not(:disabled) {
  background-color: #e0e0e0;
}

/* Estados de carga y error */
.container-cargando,
.container-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Alertas */
.alerta {
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.alerta-error {
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ef5350;
}

.alerta-exito {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #66bb6a;
}
```

---

## 🔗 INTEGRACIÓN CON LA LISTA DE PRODUCTOS

**En tu componente de lista de productos, añadir botón de editar:**

```javascript
// En el componente de lista de productos
<button 
  onClick={() => router.push(`/productos/editar/${producto.id}`)}
  className="btn-editar"
>
  ✏️ Editar
</button>
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear hook `useProducto` para obtener datos
- [ ] Crear hook `useActualizarProducto` para actualizar
- [ ] Crear componente reutilizable `FormularioProducto`
- [ ] Crear página de edición `/productos/editar/[id]`
- [ ] Añadir estilos CSS
- [ ] Integrar botón "Editar" en lista de productos
- [ ] Probar precarga de datos
- [ ] Probar actualización exitosa
- [ ] Probar manejo de errores
- [ ] Verificar en Strapi que se actualiza correctamente
- [ ] Verificar en WooCommerce que se sincroniza

---

## 🎯 RESULTADO ESPERADO

1. ✅ Usuario hace clic en "Editar" en un producto
2. ✅ Se abre la página de edición con el formulario
3. ✅ Todos los campos se precargan con los datos actuales
4. ✅ Usuario modifica los campos que desee
5. ✅ Usuario hace clic en "Guardar Cambios"
6. ✅ Se envía PUT request a Strapi con los cambios
7. ✅ Strapi actualiza el producto y sincroniza con WooCommerce
8. ✅ Usuario ve mensaje de éxito
9. ✅ Usuario es redirigido a la lista de productos

---

## 📝 NOTAS IMPORTANTES

1. **externalIds NO es necesario incluirlo** → Strapi lo preserva automáticamente
2. **rawWooData debe incluirse** para sincronización completa con WooCommerce
3. **ISBN no debe ser editable** una vez creado (campo protegido)
4. **Validar campos requeridos** antes de enviar
5. **Mostrar indicadores de carga** para mejor UX

---

## 🚀 EMPEZAR AHORA

**PASO 1:** Copiar hooks (`useProducto.js` y `useActualizarProducto.js`)
**PASO 2:** Copiar componente `FormularioProducto.jsx`
**PASO 3:** Crear página de edición con el código proporcionado
**PASO 4:** Añadir estilos CSS
**PASO 5:** Probar con un producto existente

**¡IMPORTANTE!** Mantén la misma estructura visual y UX que la página de "Agregar Producto" para consistencia.

