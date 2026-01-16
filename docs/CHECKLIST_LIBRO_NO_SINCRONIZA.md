# 🔍 Checklist: Libro creado en Strapi NO se sincroniza a WooCommerce

## ❌ SÍNTOMA

Creaste un libro manualmente en Strapi Admin pero:
- ❌ NO aparece en WooCommerce Moraleja
- ❌ NO aparece en WooCommerce Escolar

---

## 📋 CHECKLIST DE VERIFICACIÓN

### ✅ 1. El libro tiene CANALES asignados

**Verificar en Strapi Admin:**
1. Abre el libro en Content Manager → Libro
2. Busca la sección **"Canales"** (scroll hacia abajo)
3. Verifica que al menos UNO esté seleccionado:
   - [ ] Moraleja
   - [ ] Escolar

**Si NO tiene canales:**
- ❌ **Esto es el problema principal**
- El libro NO se sincronizará a ninguna plataforma
- **Solución:** Selecciona al menos un canal y guarda

---

### ✅ 2. El estado de publicación es "Publicado"

**Verificar en Strapi Admin:**
1. Abre el libro
2. En la esquina superior derecha, verifica el campo **"Estado Publicación"**
3. Debe ser exactamente: `"Publicado"` (no "Borrador", "En Revisión", etc.)

**Si NO está publicado:**
- ❌ El lifecycle no sincronizará hasta que esté publicado
- **Solución:** Cambia el estado a "Publicado" y guarda

---

### ✅ 3. El libro está publicado (Draft & Publish)

**Verificar en Strapi Admin:**
1. En la esquina superior derecha, busca el botón de estado
2. Debe decir **"Published"** (no "Draft")
3. Si dice "Draft", haz clic en **"Publish"**

**Nota:** Strapi tiene dos conceptos de publicación:
- **Draft & Publish:** Estado del documento (borrador vs publicado)
- **Estado Publicación:** Campo custom del libro

**Ambos deben estar en "Publicado"**

---

### ✅ 4. El libro tiene al menos un precio activo

**Verificar en Strapi Admin:**
1. Abre el libro
2. Busca la sección **"Precios"**
3. Verifica que hay al menos UN precio con:
   - [ ] `precio_venta > 0`
   - [ ] `activo = true`
   - [ ] `fecha_inicio` es pasada o presente

**Si NO tiene precio:**
- ⚠️ El producto se creará pero con precio $0
- **Recomendación:** Agrega un precio antes de sincronizar

---

### ✅ 5. El libro tiene al menos una categoría

**Verificar en Strapi Admin:**
1. Abre el libro
2. Busca la sección **"Categorías Producto"**
3. Verifica que al menos UNA categoría esté seleccionada

**Si NO tiene categoría:**
- ⚠️ El producto se creará pero sin categoría en WooCommerce
- **Recomendación:** Asigna una categoría

---

### ✅ 6. Los logs de Railway muestran el intento de sincronización

**Verificar en Railway:**
1. Ve a Railway → Strapi → Logs
2. Filtra por el nombre del libro o su ID
3. Busca estas líneas:

**Logs esperados si TODO está bien:**
```
[libro] 🔍 afterUpdate ejecutado
[libro] Libro ID: X
[libro] Estado Publicación: Publicado
[libro] Iniciando sincronización para libro X
[libro] Libro X tiene 2 canal(es): moraleja, escolar
🚀 Sincronizando a woo_moraleja...
✅ [woo-sync] Producto creado en woo_moraleja: 12345
🚀 Sincronizando a woo_escolar...
✅ [woo-sync] Producto creado en woo_escolar: 67890
```

**Logs si NO tiene canales:**
```
[libro] Libro X tiene 0 canal(es): 
❌ [LIBRO - SYNC FALLIDO] ❌
MOTIVO: NO tiene canales asignados
```

**Logs si NO está publicado:**
```
[libro] Estado Publicación: Borrador
⏭️  No se sincroniza: estado no es "Publicado"
```

---

## 🔧 SOLUCIÓN PASO A PASO

### PASO 1: Verificar y corregir en Strapi Admin

1. **Abre el libro** en Content Manager → Libro
2. **Asigna AMBOS canales:**
   - ✅ Moraleja
   - ✅ Escolar
3. **Establece el estado:**
   - Campo "Estado Publicación" = `"Publicado"`
4. **Publica el documento:**
   - Botón superior derecho → "Publish"
5. **Guarda los cambios:**
   - Botón "Save"

### PASO 2: Esperar la sincronización automática

Cuando guardas el libro, el lifecycle `afterUpdate` se ejecuta automáticamente y sincroniza a WooCommerce.

**Tiempo esperado:** 5-15 segundos

### PASO 3: Verificar en los logs

1. Ve a Railway → Logs
2. Deberías ver inmediatamente:
   ```
   [libro] 🔍 afterUpdate ejecutado
   [libro] Iniciando sincronización...
   ```

### PASO 4: Verificar en WooCommerce

Después de 15-30 segundos:
1. Ve a WooCommerce Moraleja → Productos
2. Busca el producto por nombre o ISBN
3. Repite en WooCommerce Escolar

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### Error 1: "NO tiene canales asignados"

**Causa:** El libro no tiene canales seleccionados

**Solución:**
1. Abre el libro
2. En "Canales", selecciona Moraleja y/o Escolar
3. Guarda

---

### Error 2: "Estado no es 'Publicado'"

**Causa:** El campo "Estado Publicación" no está en "Publicado"

**Solución:**
1. Abre el libro
2. Campo "Estado Publicación" → Selecciona "Publicado"
3. Guarda

---

### Error 3: No aparecen logs de sincronización

**Causa:** El lifecycle no se está ejecutando

**Posibles razones:**
- El libro no se guardó correctamente
- Hay un error en el código del lifecycle

**Solución:**
1. Haz un cambio mínimo en el libro (ej: agrega un espacio al subtítulo)
2. Guarda nuevamente
3. Revisa los logs inmediatamente

---

### Error 4: "Configuración de WooCommerce no encontrada"

**Causa:** Faltan variables de entorno

**Solución:**
1. Ve a Railway → Variables
2. Verifica que existan:
   - `WOO_MORALEJA_URL`
   - `WOO_MORALEJA_CONSUMER_KEY`
   - `WOO_MORALEJA_CONSUMER_SECRET`
   - `WOO_ESCOLAR_URL`
   - `WOO_ESCOLAR_CONSUMER_KEY`
   - `WOO_ESCOLAR_CONSUMER_SECRET`
3. Si faltan, agrégalas
4. Reinicia Strapi

---

### Error 5: Error 401/403 en WooCommerce

**Causa:** Credenciales API inválidas o sin permisos

**Solución:**
1. Ve a WooCommerce → Settings → Advanced → REST API
2. Genera nuevas credenciales con permisos **Read/Write**
3. Actualiza las variables de entorno en Railway
4. Reinicia Strapi

---

## 📸 INFORMACIÓN REQUERIDA PARA AYUDAR

Si después de verificar todo lo anterior el libro sigue sin sincronizarse, necesito:

### 1. Screenshot del libro en Strapi Admin

Captura de pantalla mostrando:
- Campo "Estado Publicación"
- Sección "Canales" (con los canales seleccionados)
- Botón de estado (Published/Draft)

### 2. Datos del libro

```
ID del libro: ______
Nombre del libro: ______
ISBN: ______
Estado Publicación: ______
Canales asignados: ______
```

### 3. Logs de Railway

Copia las líneas de los logs que aparecen cuando guardas el libro.

Busca especialmente:
- Líneas que contengan `[libro]`
- Líneas que contengan `syncToWooCommerce`
- Cualquier línea con `ERROR` o `❌`

### 4. Verificación de canales

Ejecuta en la consola del navegador (F12) en Strapi Admin:

```javascript
fetch('https://strapi.moraleja.cl/api/canales')
  .then(r => r.json())
  .then(data => console.log('Canales:', data.data));
```

Comparte el resultado.

---

## 🎯 DIAGNÓSTICO RÁPIDO

Responde estas preguntas:

1. **¿El libro tiene canales asignados?**
   - [ ] Sí, tiene Moraleja
   - [ ] Sí, tiene Escolar
   - [ ] Sí, tiene ambos
   - [ ] No, no tiene ninguno ← **ESTE ES EL PROBLEMA**

2. **¿El campo "Estado Publicación" dice "Publicado"?**
   - [ ] Sí
   - [ ] No ← **ESTE ES EL PROBLEMA**

3. **¿El botón superior derecho dice "Published"?**
   - [ ] Sí
   - [ ] No, dice "Draft" ← **ESTE ES EL PROBLEMA**

4. **¿Aparecen logs en Railway cuando guardas el libro?**
   - [ ] Sí, aparecen logs con `[libro]`
   - [ ] No, no aparece nada ← **HAY UN PROBLEMA CON EL LIFECYCLE**

Con estas respuestas puedo identificar exactamente qué está fallando.

---

## ✅ RESUMEN

**Las causas más comunes son:**

1. ❌ **NO tiene canales asignados** (90% de los casos)
2. ❌ **Estado Publicación no es "Publicado"** (5% de los casos)
3. ❌ **El documento está en Draft** (3% de los casos)
4. ❌ **Variables de entorno faltantes** (1% de los casos)
5. ❌ **Credenciales API inválidas** (1% de los casos)

**Para resolver:**
1. Asigna AMBOS canales (Moraleja y Escolar)
2. Establece Estado Publicación = "Publicado"
3. Publica el documento (botón "Publish")
4. Guarda
5. Espera 15-30 segundos
6. Verifica en WooCommerce

Si sigues estos pasos, el libro se sincronizará automáticamente. 🎉

