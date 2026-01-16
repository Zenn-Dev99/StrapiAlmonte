# 🔧 Solución para update-core.php que no carga en staging.moraleja.cl

## 📋 Análisis del Problema

La página `/wp-admin/update-core.php` no carga en el entorno de staging. Este es un problema común en WordPress que puede tener varias causas.

## 🔍 Diagnóstico

**Ejecuta el script de diagnóstico primero:**
```bash
node scripts/diagnostico-update-core.mjs
```

Este script verificará:
- ✅ Conectividad básica con WordPress
- ✅ API REST de WordPress
- ✅ Conexión con api.wordpress.org (CRÍTICO)
- ✅ Acceso a update-core.php
- ✅ WooCommerce API (contexto)

## 🎯 Soluciones Propuestas (en orden de probabilidad)

### SOLUCIÓN 1: Problema de Conectividad con api.wordpress.org ⚠️ MÁS PROBABLE

**Problema:** El servidor no puede conectarse a `api.wordpress.org` para verificar actualizaciones.

**Síntomas:**
- La página update-core.php carga pero queda en blanco
- La página carga indefinidamente
- Timeout al intentar acceder

**Soluciones:**

#### A. Verificar Firewall del Servidor
```bash
# Desde el servidor, probar conectividad:
curl -I https://api.wordpress.org/core/version-check/1.7/
```

Si falla, el firewall está bloqueando la conexión.

**Acciones:**
1. Contactar al proveedor de hosting (si es hosting compartido)
2. Si tienes acceso al servidor, verificar reglas de firewall:
   ```bash
   # En Linux con iptables
   sudo iptables -L -n | grep wordpress
   
   # Permitir salida a api.wordpress.org
   sudo iptables -A OUTPUT -d api.wordpress.org -j ACCEPT
   ```

#### B. Verificar Configuración de Proxy
Si el servidor usa proxy, verificar que esté configurado correctamente en `wp-config.php`:

```php
// Si necesitas configurar proxy para WordPress
define('WP_PROXY_HOST', 'proxy.example.com');
define('WP_PROXY_PORT', '8080');
define('WP_PROXY_USERNAME', 'usuario');
define('WP_PROXY_PASSWORD', 'contraseña');
```

#### C. Verificar DNS del Servidor
```bash
# Desde el servidor
nslookup api.wordpress.org
dig api.wordpress.org
```

Si no resuelve, hay un problema de DNS.

**Solución temporal:** Agregar a `/etc/hosts` (si tienes acceso):
```
104.17.96.217 api.wordpress.org
```

---

### SOLUCIÓN 2: Plugin de Seguridad Bloqueando el Acceso

**Problema:** Plugins como Wordfence, iThemes Security, o Sucuri pueden bloquear update-core.php.

**Síntomas:**
- Error 403 al acceder
- Redirección inesperada
- Mensaje de "acceso prohibido"

**Solución:**

1. **Desactivar temporalmente plugins de seguridad:**
   - Ve a `/wp-admin/plugins.php`
   - Desactiva Wordfence, iThemes Security, Sucuri, etc.
   - Intenta acceder a update-core.php
   - Si funciona, reactiva los plugins uno por uno

2. **Configurar excepciones en el plugin:**
   - En Wordfence: Firewall → Allowlist → Agregar `/wp-admin/update-core.php`
   - En iThemes Security: Settings → Banned Users → Excepciones

---

### SOLUCIÓN 3: Error PHP Fatal (Página en Blanco)

**Problema:** Un error PHP está causando que la página no se renderice.

**Síntomas:**
- Página completamente en blanco
- Error 500 en algunos casos

**Solución:**

1. **Habilitar debug en wp-config.php:**
   ```php
   define('WP_DEBUG', true);
   define('WP_DEBUG_LOG', true);
   define('WP_DEBUG_DISPLAY', false);
   @ini_set('display_errors', 0);
   ```

2. **Revisar logs:**
   - `wp-content/debug.log`
   - Logs de PHP del servidor
   - Logs de Apache/Nginx

3. **Buscar errores comunes:**
   - Memoria insuficiente: Aumentar `memory_limit` en `php.ini`
   - Timeout: Aumentar `max_execution_time`
   - Función deshabilitada: Verificar `disable_functions` en `php.ini`

---

### SOLUCIÓN 4: Permisos de Archivos Incorrectos

**Problema:** Los permisos de archivos impiden que WordPress acceda a update-core.php.

**Solución:**

```bash
# Permisos correctos para WordPress
find /ruta/a/wordpress/ -type f -exec chmod 644 {} \;
find /ruta/a/wordpress/ -type d -exec chmod 755 {} \;

# Permisos específicos para wp-admin
chmod 755 /ruta/a/wordpress/wp-admin
chmod 644 /ruta/a/wordpress/wp-admin/update-core.php
```

**Nota:** Si el servidor requiere permisos diferentes (664/775), ajusta según las recomendaciones del hosting.

---

### SOLUCIÓN 5: Reglas en .htaccess Bloqueando el Acceso

**Problema:** Reglas en `.htaccess` pueden estar bloqueando update-core.php.

**Solución:**

1. **Revisar `.htaccess` en la raíz de WordPress:**
   ```bash
   # Buscar reglas que bloqueen wp-admin
   grep -i "wp-admin" .htaccess
   grep -i "update-core" .htaccess
   ```

2. **Revisar `.htaccess` en wp-admin:**
   ```bash
   # Si existe, revisar
   cat wp-admin/.htaccess
   ```

3. **Agregar excepción si es necesario:**
   ```apache
   # Permitir acceso a update-core.php
   <Files "update-core.php">
       Order allow,deny
       Allow from all
   </Files>
   ```

---

### SOLUCIÓN 6: Actualizaciones Deshabilitadas en wp-config.php

**Problema:** Las actualizaciones están deshabilitadas por configuración.

**Solución:**

Revisar `wp-config.php` y eliminar o comentar estas líneas si existen:

```php
// ❌ ELIMINAR O COMENTAR ESTAS LÍNEAS:
// define('AUTOMATIC_UPDATER_DISABLED', true);
// define('WP_AUTO_UPDATE_CORE', false);
// define('DISABLE_WP_CRON', true);
```

---

### SOLUCIÓN 7: Archivos de WordPress Corruptos

**Problema:** Los archivos del core de WordPress están corruptos o modificados.

**Solución:**

1. **Descargar versión limpia de WordPress:**
   - Descargar la misma versión desde wordpress.org
   - Extraer los archivos

2. **Reemplazar archivos del core (SIN tocar wp-content y wp-config.php):**
   ```bash
   # HACER BACKUP PRIMERO
   cp -r wp-admin wp-admin.backup
   
   # Reemplazar solo wp-admin/update-core.php
   cp /ruta/wordpress-nuevo/wp-admin/update-core.php wp-admin/update-core.php
   
   # O reemplazar todo wp-admin (más seguro)
   cp -r /ruta/wordpress-nuevo/wp-admin/* wp-admin/
   ```

---

## 🚀 Plan de Acción Recomendado

### Paso 1: Ejecutar Diagnóstico
```bash
node scripts/diagnostico-update-core.mjs
```

### Paso 2: Según el Resultado

**Si NO puede conectar a api.wordpress.org:**
1. ✅ Verificar firewall (Solución 1A)
2. ✅ Verificar proxy (Solución 1B)
3. ✅ Verificar DNS (Solución 1C)
4. ✅ Contactar hosting si es necesario

**Si Error 403:**
1. ✅ Desactivar plugins de seguridad (Solución 2)
2. ✅ Revisar .htaccess (Solución 5)

**Si Página en Blanco:**
1. ✅ Habilitar WP_DEBUG (Solución 3)
2. ✅ Revisar logs
3. ✅ Verificar memoria PHP

**Si Todo Parece Normal:**
1. ✅ Verificar permisos (Solución 4)
2. ✅ Verificar wp-config.php (Solución 6)
3. ✅ Considerar reemplazar archivos (Solución 7)

---

## 📝 Notas Adicionales

- **Staging vs Producción:** Los entornos de staging suelen tener firewalls más restrictivos
- **Hosting Compartido:** Si es hosting compartido, contacta al soporte técnico
- **Backup:** Siempre hacer backup antes de hacer cambios
- **Tiempo de Espera:** A veces el problema se resuelve solo después de unos minutos (cache, etc.)

---

## 🔗 Referencias

- [WordPress Codex - Configurando Actualizaciones](https://codex.wordpress.org/es:Configurando_actualizaciones_automaticas)
- [WordPress Support - update-core.php Issues](https://wordpress.org/support/topic/update-core-php-not-loading/)









