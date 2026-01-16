# 🔧 Intranet: Cómo Crear Productos en AMBOS Canales (Moraleja y Escolar)

## ❌ PROBLEMA ACTUAL

Los productos creados desde la Intranet:
- ✅ Se cargan en **WooCommerce Escolar**
- ❌ NO se cargan en **WooCommerce Moraleja**

**CAUSA:** El payload enviado desde la Intranet solo incluye el canal "Escolar", no incluye "Moraleja".

---

## 📊 CÓMO FUNCIONA LA ASIGNACIÓN DE CANALES

### Estructura en Strapi

En Strapi, el campo `canales` de un libro es una relación **manyToMany**:

```typescript
// schema.json línea 104-108
"canales": {
  "type": "relation",
  "relation": "manyToMany",
  "target": "api::canal.canal"
}
```

Esto significa que un libro puede tener **múltiples canales** asignados.

### Canales Disponibles en Strapi

| ID | name | key | Plataforma WooCommerce |
|----|------|-----|------------------------|
| 1 | Moraleja | `moraleja` | WooCommerce Moraleja |
| 2 | Escolar | `escolar` | WooCommerce Escolar |

**Regla de sincronización:**
- Si el libro tiene el canal `moraleja` → Se sincroniza a WooCommerce Moraleja
- Si el libro tiene el canal `escolar` → Se sincroniza a WooCommerce Escolar
- Si tiene **ambos** → Se sincroniza a **ambas plataformas**

---

## ❌ PAYLOAD INCORRECTO (Situación Actual)

```json
{
  "data": {
    "isbn_libro": "9789563134278",
    "nombre_libro": "Libro de Prueba",
    "precio": 45990,
    "stock_quantity": 10,
    "estado_publicacion": "Publicado",
    "canales": [2]  // ❌ Solo canal Escolar (ID 2)
  }
}
```

**Resultado:**
- ✅ Se sincroniza a WooCommerce Escolar
- ❌ NO se sincroniza a WooCommerce Moraleja

---

## ✅ PAYLOAD CORRECTO (Solución)

```json
{
  "data": {
    "isbn_libro": "9789563134278",
    "nombre_libro": "Libro de Prueba",
    "precio": 45990,
    "stock_quantity": 10,
    "estado_publicacion": "Publicado",
    "canales": [1, 2]  // ✅ Ambos canales: Moraleja (1) y Escolar (2)
  }
}
```

**Resultado:**
- ✅ Se sincroniza a WooCommerce Moraleja
- ✅ Se sincroniza a WooCommerce Escolar

---

## 🛠️ SOLUCIÓN: Obtener IDs de Canales Dinámicamente

En lugar de hardcodear los IDs (1 y 2), es mejor obtenerlos dinámicamente desde Strapi:

### PASO 1: Obtener IDs de Canales al Iniciar

```javascript
// Al inicializar la aplicación o antes de crear productos
async function obtenerCanalesDisponibles() {
  const response = await fetch('https://strapi.moraleja.cl/api/canales', {
    headers: { 'Content-Type': 'application/json' }
  });
  
  const result = await response.json();
  const canales = result.data;
  
  // Mapear canales por key
  const canalesPorKey = {};
  canales.forEach(canal => {
    canalesPorKey[canal.key] = canal.id;
  });
  
  console.log('Canales disponibles:', canalesPorKey);
  // Ejemplo: { moraleja: 1, escolar: 2 }
  
  return canalesPorKey;
}

// Guardar en una variable global o estado
const CANALES = await obtenerCanalesDisponibles();
```

### PASO 2: Usar los IDs al Crear Productos

```javascript
async function crearProducto(datosProducto) {
  // Construir payload con AMBOS canales
  const payload = {
    data: {
      isbn_libro: datosProducto.isbn,
      nombre_libro: datosProducto.nombre,
      precio: datosProducto.precio,
      stock_quantity: datosProducto.stock,
      estado_publicacion: "Publicado",
      
      // ✅ CRÍTICO: Incluir AMBOS canales
      canales: [
        CANALES.moraleja,  // ID del canal Moraleja (ej: 1)
        CANALES.escolar    // ID del canal Escolar (ej: 2)
      ],
      
      // Otros campos según sea necesario
      autor_relacion: datosProducto.autorId,
      editorial: datosProducto.editorialId,
      categorias_producto: datosProducto.categoriasIds || []
    }
  };
  
  console.log('═══════════════════════════════════════════════════════');
  console.log('📤 Creando producto con AMBOS canales:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('═══════════════════════════════════════════════════════');
  
  const response = await fetch('https://strapi.moraleja.cl/api/libros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error ${response.status}: ${error}`);
  }
  
  const result = await response.json();
  console.log('✅ Producto creado exitosamente');
  console.log('   ID:', result.data.id);
  console.log('   Canales asignados:', result.data.canales?.length || 0);
  
  return result.data;
}
```

---

## 🔍 VERIFICAR QUE FUNCIONA

### En los Logs de Railway (Strapi):

Cuando creas un producto, deberías ver:

```
[libro] Libro X tiene 2 canal(es): moraleja, escolar
🚀 Sincronizando a woo_moraleja...
✅ [woo-sync] Producto creado en woo_moraleja: 12345
🚀 Sincronizando a woo_escolar...
✅ [woo-sync] Producto creado en woo_escolar: 67890
```

### En Strapi Admin:

1. Ve a Content Manager → Libro
2. Abre el producto recién creado
3. En la sección "Canales" deberías ver AMBOS seleccionados:
   - ✅ Moraleja
   - ✅ Escolar

### En WooCommerce:

1. Ve a WooCommerce Moraleja → Productos
2. El producto debe aparecer ahí
3. Ve a WooCommerce Escolar → Productos
4. El producto debe aparecer ahí también

---

## 🚨 CASOS ESPECIALES

### Caso 1: Productos Solo para Escolar

Si un producto debe ir **SOLO a Escolar** (ej: materiales escolares específicos):

```javascript
canales: [CANALES.escolar]  // Solo canal Escolar
```

### Caso 2: Productos Solo para Moraleja

Si un producto debe ir **SOLO a Moraleja** (ej: libros exclusivos):

```javascript
canales: [CANALES.moraleja]  // Solo canal Moraleja
```

### Caso 3: Productos en Ambos (Mayoría de casos)

```javascript
canales: [CANALES.moraleja, CANALES.escolar]  // Ambos canales
```

---

## 📝 EJEMPLO COMPLETO DE IMPLEMENTACIÓN

```javascript
// ═══════════════════════════════════════════════════════
// 1. CONFIGURACIÓN INICIAL
// ═══════════════════════════════════════════════════════

const STRAPI_URL = 'https://strapi.moraleja.cl';
let CANALES = null;

// Obtener canales al iniciar la aplicación
async function inicializarCanales() {
  try {
    const response = await fetch(`${STRAPI_URL}/api/canales`);
    if (!response.ok) {
      throw new Error(`Error al obtener canales: ${response.status}`);
    }
    
    const result = await response.json();
    const canalesPorKey = {};
    
    result.data.forEach(canal => {
      canalesPorKey[canal.key] = canal.id;
    });
    
    CANALES = canalesPorKey;
    console.log('✅ Canales inicializados:', CANALES);
    
    // Validar que existen ambos canales
    if (!CANALES.moraleja || !CANALES.escolar) {
      console.error('⚠️ ADVERTENCIA: No se encontraron todos los canales necesarios');
      console.error('   Canales encontrados:', Object.keys(CANALES));
    }
    
    return CANALES;
  } catch (error) {
    console.error('❌ Error al inicializar canales:', error);
    throw error;
  }
}

// Llamar al iniciar la app
inicializarCanales();

// ═══════════════════════════════════════════════════════
// 2. FUNCIÓN PARA CREAR PRODUCTOS
// ═══════════════════════════════════════════════════════

async function crearProductoEnStrapi(datosProducto) {
  // Validar que los canales estén inicializados
  if (!CANALES) {
    console.error('❌ ERROR: Canales no inicializados');
    alert('Error: Sistema no está listo. Recarga la página.');
    return;
  }
  
  // Validar datos requeridos
  if (!datosProducto.isbn || !datosProducto.nombre) {
    alert('Error: ISBN y nombre son requeridos');
    return;
  }
  
  // Construir payload
  const payload = {
    data: {
      // Campos básicos
      isbn_libro: datosProducto.isbn,
      nombre_libro: datosProducto.nombre,
      subtitulo_libro: datosProducto.subtitulo || null,
      descripcion: datosProducto.descripcion || null,
      
      // Precio y stock
      precio: datosProducto.precio || 0,
      stock_quantity: datosProducto.stock || 0,
      
      // Estado de publicación
      estado_publicacion: "Publicado",
      
      // ⚠️ CRÍTICO: Asignar AMBOS canales por defecto
      canales: [
        CANALES.moraleja,
        CANALES.escolar
      ],
      
      // Relaciones (opcional)
      autor_relacion: datosProducto.autorId || null,
      editorial: datosProducto.editorialId || null,
      sello: datosProducto.selloId || null,
      
      // Categorías y marcas
      categorias_producto: datosProducto.categoriasIds || [],
      marcas: datosProducto.marcasIds || [],
      etiquetas: datosProducto.etiquetasIds || []
    }
  };
  
  // Logging para debugging
  console.log('═══════════════════════════════════════════════════════');
  console.log('📤 Creando producto en Strapi');
  console.log('═══════════════════════════════════════════════════════');
  console.log('ISBN:', payload.data.isbn_libro);
  console.log('Nombre:', payload.data.nombre_libro);
  console.log('Precio:', payload.data.precio);
  console.log('Stock:', payload.data.stock_quantity);
  console.log('Canales:', payload.data.canales);
  console.log('   - Moraleja ID:', CANALES.moraleja);
  console.log('   - Escolar ID:', CANALES.escolar);
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    const response = await fetch(`${STRAPI_URL}/api/libros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ PRODUCTO CREADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════');
    console.log('ID:', result.data.id);
    console.log('ISBN:', result.data.isbn_libro);
    console.log('Nombre:', result.data.nombre_libro);
    console.log('Canales asignados:', result.data.canales?.length || 0);
    console.log('═══════════════════════════════════════════════════════');
    
    // Mostrar mensaje de éxito
    alert(`✅ Producto creado exitosamente\n\nSe sincronizará a:\n- WooCommerce Moraleja\n- WooCommerce Escolar`);
    
    return result.data;
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════');
    console.error('❌ ERROR AL CREAR PRODUCTO');
    console.error('═══════════════════════════════════════════════════════');
    console.error('Error:', error.message);
    console.error('═══════════════════════════════════════════════════════');
    
    alert(`Error al crear producto: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════
// 3. EJEMPLO DE USO
// ═══════════════════════════════════════════════════════

// Ejemplo: Crear un producto desde un formulario
async function handleSubmitFormulario(event) {
  event.preventDefault();
  
  const datosProducto = {
    isbn: document.getElementById('isbn').value,
    nombre: document.getElementById('nombre').value,
    precio: parseFloat(document.getElementById('precio').value),
    stock: parseInt(document.getElementById('stock').value),
    autorId: document.getElementById('autor').value || null,
    editorialId: document.getElementById('editorial').value || null
  };
  
  await crearProductoEnStrapi(datosProducto);
}
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Implementar función `inicializarCanales()` al iniciar la app
- [ ] Guardar los IDs de canales en variable global/estado
- [ ] Modificar la función de crear productos para incluir `canales: [moralejaId, escolarId]`
- [ ] Agregar logs de debugging para verificar que los IDs son correctos
- [ ] Probar creando un producto y verificar en Strapi Admin que tiene ambos canales
- [ ] Verificar en logs de Railway que sincroniza a ambas plataformas
- [ ] Verificar en WooCommerce Moraleja que el producto aparece
- [ ] Verificar en WooCommerce Escolar que el producto aparece

---

## 🎯 RESUMEN

**Cambio principal:** En lugar de enviar:
```javascript
canales: [2]  // ❌ Solo Escolar
```

Enviar:
```javascript
canales: [1, 2]  // ✅ Moraleja y Escolar
```

O mejor aún, obtener los IDs dinámicamente:
```javascript
canales: [CANALES.moraleja, CANALES.escolar]  // ✅ Ambos canales
```

**Beneficios:**
- ✅ Los productos se sincronizan a AMBAS plataformas
- ✅ No dependes de IDs hardcodeados
- ✅ Si se agregan más canales en el futuro, es fácil adaptarlo

---

**Una vez implementado esto, todos los productos creados desde la Intranet se sincronizarán automáticamente a Moraleja y Escolar.** 🎉

