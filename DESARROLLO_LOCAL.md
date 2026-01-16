# 🚀 Guía para Desarrollo Local de Strapi

Esta guía te ayudará a levantar un entorno de desarrollo local **sin tocar producción**.

## ✅ Configuración Inicial

### 1. Archivo `.env` creado

Ya se creó el archivo `strapi/.env` con la configuración para desarrollo local:
- ✅ Usa **SQLite** (base de datos local, no toca producción)
- ✅ Puerto **1337** (localhost)
- ✅ Secretos generados automáticamente
- ✅ Content-Type Builder habilitado para desarrollo

### 2. Dependencias instaladas

Las dependencias de Node.js ya están instaladas.

## 🏃 Cómo Levantar el Servidor

### Opción 1: Modo Desarrollo (Recomendado)
```bash
cd strapi
npm run dev
```

### Opción 2: Modo Desarrollo con más memoria
```bash
cd strapi
npm run develop
```

### Opción 3: Modo Producción (solo para probar build)
```bash
cd strapi
npm run build
npm start
```

## 📍 Acceso al Admin

Una vez que el servidor esté corriendo:
- **URL del Admin**: http://localhost:1337/admin
- **API**: http://localhost:1337/api

La primera vez que accedas, Strapi te pedirá crear un usuario administrador.

## 🔒 Seguridad - No Tocar Producción

### ✅ Lo que está configurado para NO tocar producción:

1. **Base de datos SQLite local** (`strapi/.tmp/data.db`)
   - Se crea automáticamente
   - Solo existe en tu máquina
   - No se conecta a la base de datos de producción

2. **Archivos locales** (`strapi/public/uploads/`)
   - Los uploads se guardan localmente
   - No se suben a S3/R2 de producción

3. **Puerto local** (1337)
   - Solo accesible desde tu máquina
   - No interfiere con producción

### ⚠️ Importante:

- **NUNCA** cambies `DATABASE_CLIENT` a `postgres` en el `.env` local
- **NUNCA** uses las credenciales de producción en tu `.env` local
- El archivo `.env` está en `.gitignore` - no se sube a Git

## 🛠️ Comandos Útiles

### Desarrollo
```bash
# Levantar servidor en modo desarrollo
npm run dev

# Ver logs en tiempo real
npm run dev
```

### Base de Datos
```bash
# La base de datos SQLite se crea automáticamente
# Está en: strapi/.tmp/data.db
# Para resetear: elimina el archivo .tmp/data.db
```

### Scripts Disponibles
```bash
# Ver todos los scripts disponibles
npm run

# Ejecutar tests
npm test

# Verificar conexión a base de datos
npm run test:db
```

## 📝 Estructura de Archivos

```
bdEstructura/
├── strapi/
│   ├── .env              # ⚠️ Configuración local (NO se sube a Git)
│   ├── .tmp/
│   │   └── data.db       # Base de datos SQLite local
│   ├── public/
│   │   └── uploads/      # Archivos subidos localmente
│   └── src/              # Código fuente
└── ...
```

## 🔄 Sincronizar Datos (Opcional)

Si necesitas datos de producción para probar localmente:

### Opción 1: Usar Strapi Transfer (Recomendado)
```bash
# Desde producción a local (solo entidades, sin assets)
npx strapi transfer --from https://strapi.moraleja.cl \
  --from-token=<TOKEN> --from-secret=<SECRET> \
  --to http://localhost:1337 \
  --to-token=<TOKEN_LOCAL> --to-secret=<SECRET_LOCAL>
```

### Opción 2: Importar desde backup
```bash
npm run import:backup
```

## 🐛 Solución de Problemas

### Error: "Port 1337 already in use"
```bash
# Cambia el puerto en strapi/.env
PORT=1338
```

### Error: "Database connection failed"
- Verifica que `DATABASE_CLIENT=sqlite` en `strapi/.env`
- Elimina `strapi/.tmp/data.db` y reinicia

### Error: "APP_KEYS missing"
- Verifica que el archivo `strapi/.env` existe
- Regenera las claves si es necesario

### Limpiar todo y empezar de nuevo
```bash
# Eliminar base de datos
Remove-Item -Recurse -Force strapi/.tmp

# Eliminar node_modules (opcional)
Remove-Item -Recurse -Force strapi/node_modules

# Reinstalar
npm install

# Reiniciar
npm run dev
```

## 📚 Recursos

- [Documentación de Strapi](https://docs.strapi.io)
- [Configuración de Railway](./strapi/DEPLOYMENT_RAILWAY.md)
- [Estructura del Proyecto](./README.md)

## ✅ Checklist Antes de Empezar

- [x] Archivo `.env` creado en `strapi/`
- [x] Dependencias instaladas (`npm install`)
- [x] Base de datos configurada como SQLite
- [x] Puerto 1337 disponible
- [ ] Servidor corriendo (`npm run dev`)
- [ ] Acceso a http://localhost:1337/admin

---

**¡Listo para desarrollar sin tocar producción! 🎉**


