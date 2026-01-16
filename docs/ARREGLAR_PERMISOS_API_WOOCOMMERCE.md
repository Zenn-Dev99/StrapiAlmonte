# 🔧 Arreglar Permisos API WooCommerce para Subir Imágenes

## ❌ ERROR

```
WooCommerce API error: 400
"woocommerce_product_image_upload_error"
"Imagen no válida: Lo siento, no tienes permisos para subir este tipo de archivo."
```

**CAUSA:** Las credenciales API de WooCommerce no tienen permisos para subir archivos/media.

---

## ✅ SOLUCIÓN: Regenerar Credenciales con Permisos Correctos

### PASO 1: En WooCommerce Moraleja

1. **Accede al admin de WordPress:**
   - URL: https://staging.moraleja.cl/wp-admin
   
2. **Ve a WooCommerce → Settings:**
   - Menú lateral: **WooCommerce** → **Settings**
   
3. **Pestaña Advanced:**
   - Haz clic en la pestaña **Advanced**
   
4. **REST API:**
   - Haz clic en **REST API**
   
5. **Revisa las credenciales existentes:**
   - Busca las credenciales actuales (probablemente se llamen "Strapi" o similar)
   - Verifica el campo **Permissions**
   - Si dice "Read" o algo diferente a "Read/Write", ese es el problema
   
6. **Elimina las credenciales viejas:**
   - Haz clic en **Revoke** o elimina las credenciales antiguas
   
7. **Crea nuevas credenciales:**
   - Haz clic en **Add key**
   - **Description:** "Strapi Integration"
   - **User:** Selecciona un usuario administrador
   - **Permissions:** **Read/Write** ← ⚠️ MUY IMPORTANTE
   - Haz clic en **Generate API key**
   
8. **Copia las credenciales:**
   - **Consumer key:** `ck_xxxxxxxxxxxxxxxxxxxx`
   - **Consumer secret:** `cs_xxxxxxxxxxxxxxxxxxxx`
   - ⚠️ **COPIA AHORA**, no podrás verlas después

---

### PASO 2: Actualizar Variables de Entorno en Railway

1. **Ve a Railway:**
   - https://railway.app
   
2. **Selecciona tu proyecto Strapi**
   
3. **Ve a Variables:**
   - Pestaña **Variables**
   
4. **Actualiza las credenciales:**
   ```
   WOO_MORALEJA_CONSUMER_KEY=ck_nuevo_valor_aqui
   WOO_MORALEJA_CONSUMER_SECRET=cs_nuevo_valor_aqui
   ```
   
5. **Guarda los cambios**

---

### PASO 3: Reiniciar Strapi

1. **En Railway, ve a tu servicio Strapi**

2. **Pestaña Settings:**
   - Scroll hasta abajo
   
3. **Restart:**
   - Haz clic en **Restart**
   
4. **Espera 2-3 minutos** a que Strapi reinicie

---

### PASO 4: Probar

1. **Crea un producto de prueba desde la Intranet**

2. **Verifica en los logs de Railway:**
   ```
   [libro] Iniciando sincronización...
   🚀 Sincronizando a woo_moraleja...
   ✅ [woo-sync] Producto creado en woo_moraleja: 12345
   ```
   
3. **Verifica en WooCommerce Moraleja:**
   - Ve a Productos
   - El producto debe aparecer **con su imagen**

---

## 🔄 **REPETIR PARA WOOCOMMERCE ESCOLAR**

Si también tienes problemas con Escolar, repite el proceso:

1. **En WooCommerce Escolar:**
   - URL: https://escolar.moraleja.cl/wp-admin
   - WooCommerce → Settings → Advanced → REST API
   - Crear nuevas credenciales con **Read/Write**

2. **En Railway:**
   ```
   WOO_ESCOLAR_CONSUMER_KEY=ck_nuevo_valor
   WOO_ESCOLAR_CONSUMER_SECRET=cs_nuevo_valor
   ```

3. **Reiniciar Strapi**

---

## ⚠️ **VERIFICAR PERMISOS DE WORDPRESS**

Si después de regenerar las credenciales sigue el error, verifica:

### 1. Permisos de Usuario

El usuario asociado a las credenciales API debe ser **Administrador**.

1. En WordPress: **Users → All Users**
2. Encuentra el usuario de las credenciales API
3. Verifica que **Role** = **Administrator**

---

### 2. Permisos de Archivos en el Servidor

Si el error persiste, puede ser un problema de permisos del servidor.

**Contacta al hosting** y pide que verifiquen:
- Permisos de la carpeta `wp-content/uploads` (debe ser 755 o 775)
- El usuario web (www-data, apache, nginx) debe poder escribir en esa carpeta

---

### 3. Tipos de Archivo Permitidos

En WordPress: **Settings → Media**

Verifica que los tipos de imagen estén permitidos:
- JPG/JPEG
- PNG
- GIF
- WebP

Si hay un plugin de seguridad, puede estar bloqueando la subida.

---

## 🛠️ **SOLUCIÓN TEMPORAL: Crear Sin Imagen**

Si necesitas que los productos se creen YA mientras se arregla:

### Opción A: No enviar portada desde Intranet

```javascript
// NO incluir portada_libro en el payload
const payload = {
  data: {
    isbn_libro: "...",
    nombre_libro: "...",
    // NO incluir: portada_libro: ...
  }
};
```

### Opción B: Modificar el código de sincronización

En `strapi/src/api/woo-sync/services/woo-sync.ts`, busca donde se procesa la imagen y agrégale un try/catch:

```typescript
// Procesar imagen
if (libro.portada_libro) {
  try {
    // Código actual de procesamiento de imagen
    wooProduct.images = [...];
  } catch (error) {
    strapi.log.warn('[woo-sync] No se pudo procesar imagen, continuando sin ella:', error);
    // No incluir imagen, pero crear el producto
  }
}
```

**Ventaja:** Los productos se crean sin fallar
**Desventaja:** No tendrán imagen hasta que se arreglen los permisos

---

## 📋 CHECKLIST

- [ ] Regenerar credenciales API en WooCommerce con **Read/Write**
- [ ] Actualizar `WOO_MORALEJA_CONSUMER_KEY` en Railway
- [ ] Actualizar `WOO_MORALEJA_CONSUMER_SECRET` en Railway
- [ ] Reiniciar Strapi en Railway
- [ ] Probar creando un producto con imagen
- [ ] Verificar en logs que NO hay error de imagen
- [ ] Verificar en WooCommerce que el producto tiene imagen
- [ ] Repetir para WooCommerce Escolar si es necesario

---

## 🎯 RESUMEN

**Problema:** Credenciales API sin permisos para subir imágenes

**Solución:**
1. Regenerar credenciales con **Read/Write** en WooCommerce
2. Actualizar variables de entorno en Railway
3. Reiniciar Strapi
4. Probar

**Resultado:** Los productos se crearán **con sus imágenes** en WooCommerce. 🎉

