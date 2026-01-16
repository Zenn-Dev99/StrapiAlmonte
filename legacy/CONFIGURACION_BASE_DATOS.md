# 🗄️ Guía de Configuración de Base de Datos

## 📋 Índice
1. [SQLite](#sqlite)
2. [PostgreSQL](#postgresql)
3. [MySQL](#mysql)
4. [Diagnóstico de Problemas](#diagnóstico-de-problemas)
5. [Variables de Entorno](#variables-de-entorno)

---

## SQLite

### Configuración Básica
SQLite es la opción más simple y no requiere configuración adicional. Perfecto para desarrollo.

### Variables de Entorno
```env
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
```

### Ventajas
- ✅ No requiere servidor de base de datos
- ✅ Fácil de configurar
- ✅ Perfecto para desarrollo y pruebas

### Desventajas
- ❌ No recomendado para producción
- ❌ Rendimiento limitado con muchas conexiones concurrentes

---

## PostgreSQL

### Configuración Básica

#### Opción 1: Usando DATABASE_URL (Recomendado)
```env
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_db
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

#### Opción 2: Usando Parámetros Individuales
```env
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=tu_password
DATABASE_SCHEMA=public
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

### Configuración SSL

#### Para servicios cloud (Railway, Render, Heroku, etc.)
```env
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

#### Para servidores con certificados personalizados
```env
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_SSL_CA=/ruta/al/certificado/ca.crt
DATABASE_SSL_KEY=/ruta/al/certificado/client.key
DATABASE_SSL_CERT=/ruta/al/certificado/client.crt
```

### Configuración de Pool de Conexiones
```env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_ACQUIRE_TIMEOUT=30000
DATABASE_POOL_CREATE_TIMEOUT=30000
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_POOL_REAP_INTERVAL=1000
```

### Timeout de Conexión
```env
DATABASE_CONNECTION_TIMEOUT=60000
```

---

## MySQL

### Configuración Básica
```env
DATABASE_CLIENT=mysql
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=strapi
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=tu_password
DATABASE_SSL=false
```

### Configuración SSL
```env
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_SSL_CA=/ruta/al/certificado/ca.crt
DATABASE_SSL_KEY=/ruta/al/certificado/client.key
DATABASE_SSL_CERT=/ruta/al/certificado/client.crt
```

### Configuración de Pool de Conexiones
```env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_POOL_ACQUIRE_TIMEOUT=30000
DATABASE_POOL_CREATE_TIMEOUT=30000
DATABASE_POOL_IDLE_TIMEOUT=30000
DATABASE_POOL_REAP_INTERVAL=1000
```

---

## Diagnóstico de Problemas

### Probar la Conexión
Ejecuta el script de diagnóstico:
```bash
npm run test:db
```

Este script:
- ✅ Verifica variables de entorno
- ✅ Prueba la conexión a la base de datos
- ✅ Muestra información de diagnóstico
- ✅ Sugiere soluciones a problemas comunes

### Problemas Comunes

#### 1. Error: "SSL connection is required"
**Solución:**
```env
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

#### 2. Error: "password authentication failed"
**Solución:**
- Verifica que `DATABASE_PASSWORD` sea correcta
- Si usas `DATABASE_URL`, verifica que la contraseña en la URL sea correcta
- Asegúrate de que el usuario tenga permisos en la base de datos

#### 3. Error: "ECONNREFUSED"
**Solución:**
- Verifica que el servidor de base de datos esté corriendo
- Verifica que `DATABASE_HOST` y `DATABASE_PORT` sean correctos
- Verifica que el firewall permita la conexión

#### 4. Error: "database does not exist"
**Solución:**
- Crea la base de datos antes de conectar
- Verifica que `DATABASE_NAME` sea correcto

#### 5. Error: "timeout"
**Solución:**
- Aumenta `DATABASE_CONNECTION_TIMEOUT`
- Verifica la conectividad de red
- Verifica que el servidor de base de datos no esté sobrecargado

#### 6. PostgreSQL: "DATABASE_URL" vs Parámetros Individuales
**Solución:**
- Si usas `DATABASE_URL`, no necesitas los parámetros individuales
- Si usas parámetros individuales, no necesitas `DATABASE_URL`
- La configuración mejorada prioriza `DATABASE_URL` si está presente

---

## Variables de Entorno

### Variables Comunes
| Variable | Descripción | Default | Requerido |
|----------|-------------|---------|-----------|
| `DATABASE_CLIENT` | Cliente de BD (sqlite, postgres, mysql) | `sqlite` | No |
| `DATABASE_CONNECTION_TIMEOUT` | Timeout de conexión (ms) | `60000` | No |

### Variables SQLite
| Variable | Descripción | Default | Requerido |
|----------|-------------|---------|-----------|
| `DATABASE_FILENAME` | Ruta al archivo de BD | `.tmp/data.db` | No |

### Variables PostgreSQL
| Variable | Descripción | Default | Requerido |
|----------|-------------|---------|-----------|
| `DATABASE_URL` | URL de conexión completa | - | No* |
| `DATABASE_HOST` | Host del servidor | `localhost` | No* |
| `DATABASE_PORT` | Puerto del servidor | `5432` | No* |
| `DATABASE_NAME` | Nombre de la base de datos | `strapi` | No* |
| `DATABASE_USERNAME` | Usuario | `strapi` | No* |
| `DATABASE_PASSWORD` | Contraseña | - | No* |
| `DATABASE_SCHEMA` | Schema de PostgreSQL | `public` | No |
| `DATABASE_SSL` | Habilitar SSL | `false` | No |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Rechazar certificados no autorizados | `true` | No |
| `DATABASE_SSL_CA` | Certificado CA | - | No |
| `DATABASE_SSL_KEY` | Clave privada | - | No |
| `DATABASE_SSL_CERT` | Certificado | - | No |

*Requerido si no se usa `DATABASE_URL`

### Variables MySQL
| Variable | Descripción | Default | Requerido |
|----------|-------------|---------|-----------|
| `DATABASE_HOST` | Host del servidor | `localhost` | No |
| `DATABASE_PORT` | Puerto del servidor | `3306` | No |
| `DATABASE_NAME` | Nombre de la base de datos | `strapi` | No |
| `DATABASE_USERNAME` | Usuario | `strapi` | No |
| `DATABASE_PASSWORD` | Contraseña | - | No |
| `DATABASE_SSL` | Habilitar SSL | `false` | No |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Rechazar certificados no autorizados | `true` | No |

### Variables de Pool (Opcionales)
| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_POOL_MIN` | Mínimo de conexiones en el pool | `2` |
| `DATABASE_POOL_MAX` | Máximo de conexiones en el pool | `10` |
| `DATABASE_POOL_ACQUIRE_TIMEOUT` | Timeout para adquirir conexión (ms) | `30000` |
| `DATABASE_POOL_CREATE_TIMEOUT` | Timeout para crear conexión (ms) | `30000` |
| `DATABASE_POOL_IDLE_TIMEOUT` | Timeout para conexiones idle (ms) | `30000` |
| `DATABASE_POOL_REAP_INTERVAL` | Intervalo para limpiar conexiones (ms) | `1000` |

---

## Ejemplos de Configuración

### Desarrollo Local (SQLite)
```env
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
```

### Desarrollo Local (PostgreSQL)
```env
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=strapi_dev
DATABASE_USERNAME=strapi
DATABASE_PASSWORD=strapi
DATABASE_SSL=false
```

### Producción (PostgreSQL en Railway)
```env
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://usuario:password@host.railway.app:5432/railway
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

### Producción (PostgreSQL en Render)
```env
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://usuario:password@dpg-xxx.oregon-postgres.render.com:5432/strapi
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

---

## 🧪 Probar la Configuración

1. Configura las variables de entorno en tu archivo `.env`
2. Ejecuta el script de diagnóstico:
   ```bash
   npm run test:db
   ```
3. Si hay errores, revisa la sección de [Diagnóstico de Problemas](#diagnóstico-de-problemas)
4. Una vez que la conexión funcione, inicia Strapi:
   ```bash
   npm run develop
   ```

---

## 📚 Recursos Adicionales

- [Documentación de Strapi - Database](https://docs.strapi.io/dev-docs/configurations/database)
- [Documentación de Knex.js](https://knexjs.org/guide/) (usado por Strapi)
- [Documentación de PostgreSQL](https://www.postgresql.org/docs/)
- [Documentación de MySQL](https://dev.mysql.com/doc/)

---

**Última actualización**: Noviembre 2024
**Rama**: test/cursor-database-fix

