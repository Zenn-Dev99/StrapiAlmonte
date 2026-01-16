# 🔍 Diagnóstico: Diferencias entre Canales Moraleja y Escolar

## ❌ PROBLEMA REPORTADO

Los productos creados desde la Intranet:
- ✅ **Se cargan correctamente en WooCommerce Escolar**
- ❌ **NO se cargan en WooCommerce Moraleja**

---

## 📊 ESTRUCTURA DE CANALES EN STRAPI

### Content Type: Canal

```json
{
  "name": "Nombre del canal",  // Ejemplo: "Moraleja", "Escolar"
  "key": "clave-unica"         // Ejemplo: "moraleja", "escolar"
}
```

### Mapeo de Canales a Plataformas WooCommerce

```javascript
// En libro.services.ts línea 125-126:
if (canalKey === 'moraleja' || canalKey === 'escolar') {
  const platform = canalKey === 'moraleja' ? 'woo_moraleja' : 'woo_escolar';
  // ... sincronizar ...
}
```

**Mapeo:**
- `canal.key = "moraleja"` → Sincroniza a `woo_moraleja`
- `canal.key = "escolar"` → Sincroniza a `woo_escolar`

---

## 🔍 POSIBLES CAUSAS DEL PROBLEMA

### 1. **Canal "moraleja" no existe o está mal configurado**

**Verificar en Strapi Admin:**
1. Ve a **Content Manager → Canal**
2. Verifica que existen estos registros:
   - **Canal 1:** `name: "Moraleja"`, `key: "moraleja"` (publicado)
   - **Canal 2:** `name: "Escolar"`, `key: "escolar"` (publicado)

**Posibles errores:**
- ❌ El canal se llama "Moraleja" pero el `key` es "woo_moraleja" (incorrecto)
- ❌ El canal no está publicado (draftAndPublish: true)
- ❌ El `key` tiene mayúsculas ("Moraleja" en lugar de "moraleja")

**Solución:**
```sql
-- Los canales deben tener EXACTAMENTE estos keys:
Canal Moraleja: key = "moraleja" (minúsculas, sin prefijo)
Canal Escolar:  key = "escolar"  (minúsculas, sin prefijo)
```

---

### 2. **Variables de entorno de WooCommerce Moraleja mal configuradas**

**Verificar en Railway:**

Variables requeridas para Moraleja:
```bash
WOO_MORALEJA_URL=https://staging.moraleja.cl
WOO_MORALEJA_CONSUMER_KEY=ck_xxxxxxxxxxxx
WOO_MORALEJA_CONSUMER_SECRET=cs_xxxxxxxxxxxx
```

Variables requeridas para Escolar:
```bash
WOO_ESCOLAR_URL=https://escolar.moraleja.cl
WOO_ESCOLAR_CONSUMER_KEY=ck_xxxxxxxxxxxx
WOO_ESCOLAR_CONSUMER_SECRET=cs_xxxxxxxxxxxx
```

**Posibles errores:**
- ❌ Falta alguna variable de entorno
- ❌ Las credenciales son incorrectas
- ❌ La URL es incorrecta o tiene trailing slash

**Cómo verificar:**

Ejecuta el script de diagnóstico:
```bash
node strapi/scripts/diagnostico-moraleja.mjs
```

O revisa los logs cuando intentas sincronizar:
```
❌ [woo-sync] Error: Configuración de WooCommerce no encontrada para woo_moraleja
```

---

### 3. **El libro NO tiene el canal "moraleja" asignado**

**Verificar en Strapi Admin:**
1. Abre el libro que quieres sincronizar
2. Ve a la sección **"Canales"**
3. Verifica que están seleccionados AMBOS:
   - ✅ Moraleja
   - ✅ Escolar

**Logs esperados al sincronizar:**

✅ **CORRECTO:**
```
[libro] Libro X tiene 2 canal(es): moraleja, escolar
🚀 Sincronizando a woo_moraleja...
🚀 Sincronizando a woo_escolar...
```

❌ **INCORRECTO (problema actual):**
```
[libro] Libro X tiene 1 canal(es): escolar
🚀 Sincronizando a woo_escolar...
⚠️  No se sincroniza a woo_moraleja (canal no asignado)
```

---

### 4. **El estado de publicación no es "Publicado"**

**Verificar:**
1. Abre el libro en Strapi Admin
2. Verifica que el campo **"Estado Publicación"** = `"Publicado"`

**Logs esperados:**

❌ **INCORRECTO:**
```
❌ [LIBRO - SYNC FALLIDO] ❌
MOTIVO: Estado de publicación no es "Publicado" (actual: "Borrador")
```

---

### 5. **Error en las credenciales de WooCommerce Moraleja**

**Síntoma:** El libro se intenta sincronizar pero falla con error 401 o 403.

**Logs esperados:**
```
❌ [woo-sync] Error sincronizando a woo_moraleja: 
   Error 401: Unauthorized
   o
   Error 403: Forbidden
```

**Solución:**
1. Ve a WooCommerce Moraleja → WooCommerce → Settings → Advanced → REST API
2. Genera nuevas credenciales con permisos **Read/Write**
3. Actualiza las variables de entorno en Railway

---

## 🛠️ SCRIPT DE DIAGNÓSTICO

Crea un archivo para probar la sincronización:

```javascript
// strapi/scripts/test-sync-canales.mjs

import dotenv from 'dotenv';
dotenv.config();

async function testSyncCanales() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO: Canales Moraleja vs Escolar');
  console.log('═══════════════════════════════════════════════════════');
  
  // 1. Verificar variables de entorno
  console.log('\n1️⃣ Variables de Entorno:');
  console.log('   Moraleja:');
  console.log('   - WOO_MORALEJA_URL:', process.env.WOO_MORALEJA_URL ? '✅' : '❌ FALTA');
  console.log('   - WOO_MORALEJA_CONSUMER_KEY:', process.env.WOO_MORALEJA_CONSUMER_KEY ? '✅' : '❌ FALTA');
  console.log('   - WOO_MORALEJA_CONSUMER_SECRET:', process.env.WOO_MORALEJA_CONSUMER_SECRET ? '✅' : '❌ FALTA');
  
  console.log('   Escolar:');
  console.log('   - WOO_ESCOLAR_URL:', process.env.WOO_ESCOLAR_URL ? '✅' : '❌ FALTA');
  console.log('   - WOO_ESCOLAR_CONSUMER_KEY:', process.env.WOO_ESCOLAR_CONSUMER_KEY ? '✅' : '❌ FALTA');
  console.log('   - WOO_ESCOLAR_CONSUMER_SECRET:', process.env.WOO_ESCOLAR_CONSUMER_SECRET ? '✅' : '❌ FALTA');
  
  // 2. Probar conexión a WooCommerce Moraleja
  console.log('\n2️⃣ Probando conexión a WooCommerce Moraleja:');
  try {
    const url = `${process.env.WOO_MORALEJA_URL}/wp-json/wc/v3/system_status`;
    const auth = Buffer.from(
      `${process.env.WOO_MORALEJA_CONSUMER_KEY}:${process.env.WOO_MORALEJA_CONSUMER_SECRET}`
    ).toString('base64');
    
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` }
    });
    
    if (response.ok) {
      console.log('   ✅ Conexión exitosa a WooCommerce Moraleja');
    } else {
      console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Error de conexión:', error.message);
  }
  
  // 3. Probar conexión a WooCommerce Escolar
  console.log('\n3️⃣ Probando conexión a WooCommerce Escolar:');
  try {
    const url = `${process.env.WOO_ESCOLAR_URL}/wp-json/wc/v3/system_status`;
    const auth = Buffer.from(
      `${process.env.WOO_ESCOLAR_CONSUMER_KEY}:${process.env.WOO_ESCOLAR_CONSUMER_SECRET}`
    ).toString('base64');
    
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` }
    });
    
    if (response.ok) {
      console.log('   ✅ Conexión exitosa a WooCommerce Escolar');
    } else {
      console.log(`   ❌ Error ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.log('   ❌ Error de conexión:', error.message);
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
}

testSyncCanales();
```

**Ejecutar:**
```bash
cd strapi
node scripts/test-sync-canales.mjs
```

---

## 📋 CHECKLIST DE VERIFICACIÓN

### En Strapi Admin:

- [ ] Verificar que existen los canales:
  - [ ] Canal "Moraleja" con `key: "moraleja"` (publicado)
  - [ ] Canal "Escolar" con `key: "escolar"` (publicado)

- [ ] Verificar el libro:
  - [ ] Tiene AMBOS canales asignados (Moraleja y Escolar)
  - [ ] Estado de publicación = "Publicado"
  - [ ] Tiene precio activo
  - [ ] Tiene al menos una categoría

### En Railway:

- [ ] Variables de entorno configuradas:
  - [ ] WOO_MORALEJA_URL
  - [ ] WOO_MORALEJA_CONSUMER_KEY
  - [ ] WOO_MORALEJA_CONSUMER_SECRET
  - [ ] WOO_ESCOLAR_URL
  - [ ] WOO_ESCOLAR_CONSUMER_KEY
  - [ ] WOO_ESCOLAR_CONSUMER_SECRET

### En WooCommerce Moraleja:

- [ ] Las credenciales API tienen permisos **Read/Write**
- [ ] El sitio está accesible (no en modo mantenimiento)
- [ ] La URL es correcta (https://staging.moraleja.cl)

---

## 🎯 PASOS DE DIAGNÓSTICO

### PASO 1: Verificar Canales en Strapi

```sql
-- Query directa a la base de datos (si tienes acceso):
SELECT id, name, key, published_at 
FROM canales;

-- Debería mostrar:
-- id | name      | key       | published_at
-- 1  | Moraleja  | moraleja  | 2024-12-28 ...
-- 2  | Escolar   | escolar   | 2024-12-28 ...
```

O en Strapi Admin:
1. Content Manager → Canal
2. Verifica que ambos canales existen y están publicados

---

### PASO 2: Verificar Variables de Entorno

En Railway:
1. Ve a tu proyecto Strapi
2. Pestaña **Variables**
3. Busca las 6 variables de WooCommerce
4. Verifica que todas tienen valores

---

### PASO 3: Probar Sincronización Manual

1. En Strapi Admin, abre un libro
2. Asigna AMBOS canales (Moraleja y Escolar)
3. Establece estado = "Publicado"
4. Guarda
5. Ve a **Railway → Logs**
6. Busca los mensajes de sincronización

**Logs esperados (CORRECTO):**
```
[libro] Libro X tiene 2 canal(es): moraleja, escolar
🚀 Sincronizando a woo_moraleja...
✅ [woo-sync] Producto creado en woo_moraleja: 12345
🚀 Sincronizando a woo_escolar...
✅ [woo-sync] Producto creado en woo_escolar: 67890
```

**Logs si hay error en Moraleja:**
```
[libro] Libro X tiene 2 canal(es): moraleja, escolar
🚀 Sincronizando a woo_moraleja...
❌ [libro] Error sincronizando a woo_moraleja: [MENSAJE DE ERROR]
🚀 Sincronizando a woo_escolar...
✅ [woo-sync] Producto creado en woo_escolar: 67890
```

---

### PASO 4: Revisar Logs Detallados

Busca en los logs de Railway estas líneas clave:

```bash
# Buscar inicios de sincronización:
grep "syncToWooCommerce" logs.txt

# Buscar errores específicos:
grep "Error sincronizando a woo_moraleja" logs.txt

# Buscar configuración de canales:
grep "canal(es):" logs.txt
```

---

## 🔧 SOLUCIONES SEGÚN EL ERROR

### Error: "Canal no asignado"

**Síntoma:** El libro solo sincroniza a Escolar

**Solución:**
1. Abre el libro en Strapi Admin
2. En la sección "Canales", selecciona AMBOS:
   - ✅ Moraleja
   - ✅ Escolar
3. Guarda y publica

---

### Error: "Configuración no encontrada"

**Síntoma:** 
```
Error: Configuración de WooCommerce no encontrada para woo_moraleja
```

**Solución:**
1. Ve a Railway → Variables
2. Verifica que existen:
   - WOO_MORALEJA_URL
   - WOO_MORALEJA_CONSUMER_KEY
   - WOO_MORALEJA_CONSUMER_SECRET
3. Si faltan, agrégalas
4. Reinicia el servicio de Strapi

---

### Error: "401 Unauthorized" o "403 Forbidden"

**Síntoma:**
```
❌ Error 401: Unauthorized
```

**Solución:**
1. Ve a WooCommerce Moraleja → WooCommerce → Settings → Advanced → REST API
2. Elimina las credenciales actuales
3. Crea nuevas credenciales con permisos **Read/Write**
4. Actualiza las variables de entorno en Railway:
   - WOO_MORALEJA_CONSUMER_KEY
   - WOO_MORALEJA_CONSUMER_SECRET
5. Reinicia Strapi

---

### Error: "Canal key incorrecto"

**Síntoma:** El canal existe pero no se mapea correctamente

**Verificar:**
```
Canal debe tener:
name: "Moraleja" (puede tener mayúsculas)
key: "moraleja"  (DEBE ser minúsculas, sin prefijo "woo_")
```

**NO debe ser:**
```
❌ key: "woo_moraleja"  (con prefijo)
❌ key: "Moraleja"      (con mayúsculas)
❌ key: "mora leja"     (con espacios)
```

**Solución:**
1. Ve a Content Manager → Canal
2. Edita el canal "Moraleja"
3. Verifica que `key` = "moraleja" (minúsculas, sin prefijo)
4. Si está mal, crea un nuevo canal con el key correcto
5. Elimina el canal antiguo

---

## 📤 INFORMACIÓN REQUERIDA PARA AYUDAR

Para diagnosticar el problema, necesito que compartas:

1. **Screenshot de Strapi Admin:**
   - Content Manager → Canal (lista de todos los canales)
   - Un libro que intentes sincronizar (sección "Canales")

2. **Variables de entorno (censuradas):**
   ```
   WOO_MORALEJA_URL = https://...
   WOO_MORALEJA_CONSUMER_KEY = ck_xxxxx (primeros 5 caracteres)
   WOO_ESCOLAR_URL = https://...
   ```

3. **Logs de Railway:**
   - Filtra por "libro" y "sync"
   - Copia las líneas desde que intentas sincronizar hasta el error

4. **Resultado del script de diagnóstico:**
   - Ejecuta `node strapi/scripts/test-sync-canales.mjs`
   - Comparte la salida completa

---

## 🎯 RESUMEN

**El problema más común es:**
1. ❌ El canal "Moraleja" NO está asignado al libro
2. ❌ El `key` del canal es incorrecto (tiene mayúsculas o prefijo "woo_")
3. ❌ Faltan variables de entorno de WooCommerce Moraleja

**Para confirmar:**
1. Ejecuta el script de diagnóstico
2. Verifica los canales en Strapi Admin
3. Comparte los logs de Railway

Con esa información podré identificar exactamente qué está fallando.

