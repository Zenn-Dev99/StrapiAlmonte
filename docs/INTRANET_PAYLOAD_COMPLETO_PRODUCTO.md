# 🔧 Intranet: Payload Completo para Crear Productos que se Sincronicen a WooCommerce

## ❌ PROBLEMA ACTUAL

Los productos creados desde la Intranet:
- ✅ SÍ llegan a Strapi (se crean correctamente)
- ❌ NO se sincronizan a WooCommerce Moraleja
- ❌ NO se sincronizan a WooCommerce Escolar

**CAUSA:** El payload enviado desde la Intranet le faltan campos críticos para que se active la sincronización automática.

---

## 🔍 CAMPOS REQUERIDOS PARA SINCRONIZACIÓN

Para que un libro se sincronice automáticamente a WooCommerce, DEBE tener:

1. ✅ **Canales asignados** (`canales: [1, 2]`)
2. ✅ **Estado de publicación = "Publicado"** (`estado_publicacion: "Publicado"`)
3. ✅ **Documento publicado** (no draft)

**Si falta CUALQUIERA de estos, NO se sincronizará.**

---

## ❌ PAYLOAD INCORRECTO (Situación Actual)

```json
{
  "data": {
    "isbn_libro": "9789563134278",
    "nombre_libro": "Libro de Prueba",
    "precio": 45990,
    "stock_quantity": 10
    // ❌ FALTAN: canales, estado_publicacion
  }
}
```

**Resultado:**
- ✅ Se crea en Strapi
- ❌ NO tiene canales → NO sincroniza
- ❌ NO tiene estado "Publicado" → NO sincroniza

---

## ✅ PAYLOAD CORRECTO (Solución)

```json
{
  "data": {
    // ══════════════════════════════════════════════════
    // CAMPOS BÁSICOS
    // ══════════════════════════════════════════════════
    "isbn_libro": "9789563134278",
    "nombre_libro": "Libro de Prueba",
    "subtitulo_libro": "Subtítulo opcional",
    "descripcion": "Descripción del libro",
    
    // ══════════════════════════════════════════════════
    // PRECIO Y STOCK
    // ══════════════════════════════════════════════════
    "precio": 45990,
    "stock_quantity": 10,
    "manage_stock": true,
    "stock_status": "instock",
    
    // ══════════════════════════════════════════════════
    // ⚠️ CRÍTICO: ESTADO DE PUBLICACIÓN
    // ══════════════════════════════════════════════════
    "estado_publicacion": "Publicado",  // ⚠️ OBLIGATORIO para sincronizar
    
    // ══════════════════════════════════════════════════
    // ⚠️ CRÍTICO: CANALES (WooCommerce)
    // ══════════════════════════════════════════════════
    "canales": [1, 2],  // ⚠️ OBLIGATORIO: [1=Moraleja, 2=Escolar]
    
    // ══════════════════════════════════════════════════
    // RELACIONES (OPCIONAL pero recomendado)
    // ══════════════════════════════════════════════════
    "autor_relacion": 5,              // ID del autor
    "editorial": 3,                    // ID de la editorial
    "sello": 7,                        // ID del sello
    "categorias_producto": [12, 15],   // IDs de categorías
    
    // ══════════════════════════════════════════════════
    // OTROS CAMPOS OPCIONALES
    // ══════════════════════════════════════════════════
    "numero_edicion": 1,
    "agno_edicion": 2024,
    "idioma": "Español",
    "tipo_libro": "Plan Lector",
    "estado_edicion": "Vigente"
  }
}
```

---

## 🚀 CÓDIGO COMPLETO PARA LA INTRANET

```javascript
// ═══════════════════════════════════════════════════════════════
// PASO 1: Obtener IDs de Canales (ejecutar al iniciar la app)
// ═══════════════════════════════════════════════════════════════

let CANALES = null;

async function inicializarCanales() {
  try {
    const response = await fetch('https://strapi.moraleja.cl/api/canales');
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
    // Ejemplo: { moraleja: 1, escolar: 2 }
    
    return CANALES;
  } catch (error) {
    console.error('❌ Error al inicializar canales:', error);
    throw error;
  }
}

// Llamar al iniciar la aplicación
await inicializarCanales();

// ═══════════════════════════════════════════════════════════════
// PASO 2: Función para Crear Producto que SE SINCRONICE
// ═══════════════════════════════════════════════════════════════

async function crearProductoQueSeSync(datosProducto) {
  // Validar que los canales estén inicializados
  if (!CANALES) {
    throw new Error('Canales no inicializados. Llama a inicializarCanales() primero.');
  }
  
  // Validar datos mínimos
  if (!datosProducto.isbn || !datosProducto.nombre) {
    throw new Error('ISBN y nombre son requeridos');
  }
  
  // Construir payload COMPLETO
  const payload = {
    data: {
      // ════════════════════════════════════════════════
      // CAMPOS BÁSICOS
      // ════════════════════════════════════════════════
      isbn_libro: datosProducto.isbn,
      nombre_libro: datosProducto.nombre,
      subtitulo_libro: datosProducto.subtitulo || null,
      descripcion: datosProducto.descripcion || null,
      
      // ════════════════════════════════════════════════
      // PRECIO Y STOCK
      // ════════════════════════════════════════════════
      precio: datosProducto.precio || 0,
      stock_quantity: datosProducto.stock || 0,
      manage_stock: true,
      stock_status: (datosProducto.stock || 0) > 0 ? 'instock' : 'outofstock',
      
      // ════════════════════════════════════════════════
      // ⚠️ CRÍTICO: ESTADO DE PUBLICACIÓN
      // ════════════════════════════════════════════════
      estado_publicacion: "Publicado",  // ⚠️ SIEMPRE "Publicado" para sincronizar
      
      // ════════════════════════════════════════════════
      // ⚠️ CRÍTICO: CANALES
      // ════════════════════════════════════════════════
      canales: [
        CANALES.moraleja,  // Sincroniza a WooCommerce Moraleja
        CANALES.escolar    // Sincroniza a WooCommerce Escolar
      ],
      
      // ════════════════════════════════════════════════
      // RELACIONES (si vienen en datosProducto)
      // ════════════════════════════════════════════════
      autor_relacion: datosProducto.autorId || null,
      editorial: datosProducto.editorialId || null,
      sello: datosProducto.selloId || null,
      coleccion: datosProducto.coleccionId || null,
      
      // ════════════════════════════════════════════════
      // CATEGORÍAS, MARCAS, ETIQUETAS
      // ════════════════════════════════════════════════
      categorias_producto: datosProducto.categoriasIds || [],
      marcas: datosProducto.marcasIds || [],
      etiquetas: datosProducto.etiquetasIds || [],
      
      // ════════════════════════════════════════════════
      // OTROS CAMPOS
      // ════════════════════════════════════════════════
      numero_edicion: datosProducto.numeroEdicion || null,
      agno_edicion: datosProducto.agnoEdicion || new Date().getFullYear(),
      idioma: datosProducto.idioma || "Español",
      tipo_libro: datosProducto.tipoLibro || null,
      estado_edicion: datosProducto.estadoEdicion || "Vigente"
    }
  };
  
  // ════════════════════════════════════════════════════════════
  // LOGGING PARA DEBUGGING
  // ════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('📤 Creando producto que SE SINCRONIZARÁ a WooCommerce');
  console.log('═══════════════════════════════════════════════════════');
  console.log('ISBN:', payload.data.isbn_libro);
  console.log('Nombre:', payload.data.nombre_libro);
  console.log('Precio:', payload.data.precio);
  console.log('Stock:', payload.data.stock_quantity);
  console.log('⚠️  Estado Publicación:', payload.data.estado_publicacion);
  console.log('⚠️  Canales:', payload.data.canales);
  console.log('   → Moraleja ID:', CANALES.moraleja);
  console.log('   → Escolar ID:', CANALES.escolar);
  console.log('═══════════════════════════════════════════════════════');
  
  // Validar campos críticos antes de enviar
  if (payload.data.estado_publicacion !== "Publicado") {
    console.warn('⚠️  ADVERTENCIA: estado_publicacion NO es "Publicado"');
    console.warn('   El producto NO se sincronizará automáticamente');
  }
  
  if (!payload.data.canales || payload.data.canales.length === 0) {
    console.error('❌ ERROR: NO hay canales asignados');
    console.error('   El producto NO se sincronizará a ningún WooCommerce');
    throw new Error('Debe asignar al menos un canal para sincronizar');
  }
  
  // ════════════════════════════════════════════════════════════
  // ENVIAR A STRAPI
  // ════════════════════════════════════════════════════════════
  try {
    const response = await fetch('https://strapi.moraleja.cl/api/libros', {
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
    console.log('✅ PRODUCTO CREADO EN STRAPI');
    console.log('═══════════════════════════════════════════════════════');
    console.log('ID:', result.data.id);
    console.log('ISBN:', result.data.isbn_libro);
    console.log('Nombre:', result.data.nombre_libro);
    console.log('Estado:', result.data.estado_publicacion);
    console.log('Canales:', result.data.canales?.length || 0);
    console.log('═══════════════════════════════════════════════════════');
    console.log('⏳ Esperando sincronización a WooCommerce...');
    console.log('   (15-30 segundos)');
    console.log('═══════════════════════════════════════════════════════');
    
    // Mostrar alerta de éxito
    alert(`✅ Producto creado exitosamente en Strapi\n\n` +
          `Se sincronizará automáticamente a:\n` +
          `- WooCommerce Moraleja\n` +
          `- WooCommerce Escolar\n\n` +
          `Espera 15-30 segundos y verifica en WooCommerce.`);
    
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

// ═══════════════════════════════════════════════════════════════
// PASO 3: Ejemplo de Uso
// ═══════════════════════════════════════════════════════════════

// Ejemplo: Crear un producto desde un formulario
async function handleSubmitFormulario(event) {
  event.preventDefault();
  
  const datosProducto = {
    isbn: document.getElementById('isbn').value,
    nombre: document.getElementById('nombre').value,
    subtitulo: document.getElementById('subtitulo').value,
    precio: parseFloat(document.getElementById('precio').value) || 0,
    stock: parseInt(document.getElementById('stock').value) || 0,
    autorId: parseInt(document.getElementById('autor').value) || null,
    editorialId: parseInt(document.getElementById('editorial').value) || null,
    categoriasIds: obtenerCategoriasSeleccionadas() // Función que retorna array de IDs
  };
  
  try {
    const productoCreado = await crearProductoQueSeSync(datosProducto);
    console.log('Producto creado:', productoCreado);
    
    // Opcional: Mostrar confirmación o redirigir
    // window.location.href = '/productos';
  } catch (error) {
    console.error('Error:', error);
  }
}
```

---

## 📊 VERIFICAR QUE FUNCIONA

### 1️⃣ En la Consola del Navegador (F12)

Deberías ver:

```
✅ Canales inicializados: { moraleja: 1, escolar: 2 }
═══════════════════════════════════════════════════════
📤 Creando producto que SE SINCRONIZARÁ a WooCommerce
═══════════════════════════════════════════════════════
⚠️  Estado Publicación: Publicado
⚠️  Canales: [1, 2]
   → Moraleja ID: 1
   → Escolar ID: 2
═══════════════════════════════════════════════════════
✅ PRODUCTO CREADO EN STRAPI
⏳ Esperando sincronización a WooCommerce...
```

### 2️⃣ En Strapi Admin

1. Ve a Content Manager → Libro
2. Abre el producto recién creado
3. Verifica:
   - ✅ Estado Publicación = "Publicado"
   - ✅ Canales = Moraleja ✓, Escolar ✓
   - ✅ Estado (arriba a la derecha) = "Published"

### 3️⃣ En los Logs de Railway

Filtra por el ISBN o nombre del libro y busca:

```
[libro] 🔍 afterCreate ejecutado
[libro] Libro ID: X
[libro] Estado Publicación: Publicado
[libro] Iniciando sincronización para libro X
[libro] Libro X tiene 2 canal(es): moraleja, escolar
🚀 Sincronizando a woo_moraleja...
✅ [woo-sync] Producto creado en woo_moraleja: 12345
🚀 Sincronizando a woo_escolar...
✅ [woo-sync] Producto creado en woo_escolar: 67890
```

### 4️⃣ En WooCommerce (después de 15-30 segundos)

1. Ve a WooCommerce Moraleja → Productos
2. Busca el producto por nombre o SKU (ISBN)
3. ✅ Debe aparecer
4. Repite en WooCommerce Escolar
5. ✅ Debe aparecer también

---

## 🚨 SI TODAVÍA NO SINCRONIZA

### Verifica en Strapi Admin:

1. **Abre el producto creado**
2. **Verifica estos campos:**
   - [ ] "Estado Publicación" = "Publicado" (no "Borrador")
   - [ ] "Canales" tiene Moraleja y Escolar seleccionados
   - [ ] Botón arriba a la derecha dice "Published" (no "Draft")

3. **Si algo está mal:**
   - Corrige los valores
   - Guarda
   - Espera 15 segundos
   - Verifica en WooCommerce

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Implementar `inicializarCanales()` al iniciar la app
- [ ] Modificar función de crear productos para usar `crearProductoQueSeSync()`
- [ ] Agregar `estado_publicacion: "Publicado"` en el payload
- [ ] Agregar `canales: [CANALES.moraleja, CANALES.escolar]` en el payload
- [ ] Agregar logs de debugging
- [ ] Probar creando un producto
- [ ] Verificar en Strapi Admin que tiene estado y canales correctos
- [ ] Verificar en logs de Railway la sincronización
- [ ] Verificar en ambos WooCommerce que el producto aparece

---

## 🎯 RESUMEN

**El problema:** El payload desde la Intranet NO incluye:
- ❌ `estado_publicacion: "Publicado"`
- ❌ `canales: [1, 2]`

**La solución:** Agregar SIEMPRE estos campos al crear productos:

```javascript
{
  data: {
    // ... otros campos ...
    estado_publicacion: "Publicado",  // ⚠️ OBLIGATORIO
    canales: [CANALES.moraleja, CANALES.escolar]  // ⚠️ OBLIGATORIO
  }
}
```

**Resultado:** El producto se creará EN Strapi Y se sincronizará automáticamente a AMBOS WooCommerce. 🎉

