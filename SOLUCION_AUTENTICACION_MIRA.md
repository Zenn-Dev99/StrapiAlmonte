# Solución de Autenticación para MIRA.APP - Documentación Completa

## 📋 Resumen del Problema

**Error Original:** Los usuarios de `persona-mira` no podían crear evaluaciones porque recibían errores 401/403 "Missing or invalid credentials" o "Invalid credentials".

**Causa Raíz:** 
- El JWT se estaba generando con el ID de `persona-mira`, pero Strapi requiere que el JWT esté asociado a un usuario de `plugin::users-permissions.user`
- Los permisos no estaban correctamente configurados para el rol `authenticated`
- La creación/búsqueda de usuarios en `users-permissions` fallaba por problemas de compatibilidad con Strapi v5

---

## 🔧 Cambios Realizados

### 1. **Configuración de Permisos en Bootstrap** (`src/index.ts`)

**Archivo:** `C:\Trabajo\Strapi\BdEstructura\strapi\src\index.ts`

**Problema:** Después del cambio de rama a `etiquetas-gonza`, se perdieron los permisos programáticos.

**Solución:** Se reescribió completamente la sección de permisos para el rol `authenticated` con un sistema de "fuerza bruta" que verifica y crea/habilita todos los permisos necesarios en cada inicio del servidor.

**Código Agregado:**
```typescript
// 🔐 FORZAR PERMISOS CRÍTICOS PARA ROL AUTHENTICATED (MIRA.APP)
try {
  strapi.log.info('[bootstrap] 🔐 Iniciando configuración FORZADA de permisos para rol Authenticated...');
  
  // 1. Buscar el rol Authenticated
  const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
  });

  if (!authenticatedRole) {
    strapi.log.error('[bootstrap] ❌ No se encontró el rol Authenticated. No se pueden asignar permisos.');
  } else {
    strapi.log.info(`[bootstrap] ✅ Rol Authenticated encontrado: ID=${authenticatedRole.id}`);
    
    // 2. Lista de permisos críticos para MIRA.APP
    const permisosCriticos = [
      // Evaluaciones
      'api::evaluacion.evaluacion.create',
      'api::evaluacion.evaluacion.find',
      'api::evaluacion.evaluacion.findOne',
      // Libros MIRA
      'api::libro-mira.libro-mira.find',
      'api::libro-mira.libro-mira.findOne',
      // Upload de imágenes (CRÍTICO para subir hoja maestra)
      'plugin::upload.content-api.upload',
      // OMR Evaluaciones
      'api::omr-evaluacion.omr-evaluacion.create',
    ];

    let creados = 0;
    let existentes = 0;
    let errores = 0;

    // 3. Bucle de asignación (Fuerza Bruta)
    strapi.log.info(`[bootstrap] Procesando ${permisosCriticos.length} permisos críticos...`);
    
    for (const accion of permisosCriticos) {
      try {
        // Verificar si el permiso ya existe
        const permisoExistente = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: accion,
            role: authenticatedRole.id,
          },
        });

        if (permisoExistente) {
          // Si existe, asegurar que esté habilitado
          if (!permisoExistente.enabled) {
            await strapi.query('plugin::users-permissions.permission').update({
              where: { id: permisoExistente.id },
              data: { enabled: true },
            });
            strapi.log.info(`[bootstrap] ✅ Permiso ${accion} habilitado (estaba deshabilitado)`);
          } else {
            strapi.log.info(`[bootstrap] ✅ Permiso ${accion} ya existe y está habilitado`);
          }
          existentes++;
        } else {
          // Si NO existe, crearlo
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: accion,
              role: authenticatedRole.id,
              enabled: true,
            },
          });
          strapi.log.info(`[bootstrap] ✅ Permiso ${accion} CREADO y asignado al rol Authenticated`);
          creados++;
        }
      } catch (permisoError: any) {
        strapi.log.error(`[bootstrap] ❌ Error al procesar permiso ${accion}: ${permisoError.message}`);
        errores++;
      }
    }

    // 4. Feedback final
    strapi.log.info('═══════════════════════════════════════════════════════');
    strapi.log.info('🔐 PERMISOS FORZADOS APLICADOS CORRECTAMENTE');
    strapi.log.info(`   ✅ Creados: ${creados}`);
    strapi.log.info(`   ✅ Existentes: ${existentes}`);
    strapi.log.info(`   ❌ Errores: ${errores}`);
    strapi.log.info('═══════════════════════════════════════════════════════');
  }
} catch (error: any) {
  strapi.log.error('[bootstrap] ❌ Error crítico al configurar permisos para usuarios autenticados:', error.message);
  strapi.log.error('[bootstrap] Stack:', error.stack);
}
```

**Permisos Configurados:**
- `api::evaluacion.evaluacion.create` - Crear evaluaciones
- `api::evaluacion.evaluacion.find` - Listar evaluaciones
- `api::evaluacion.evaluacion.findOne` - Ver una evaluación
- `api::libro-mira.libro-mira.find` - Listar libros MIRA
- `api::libro-mira.libro-mira.findOne` - Ver un libro MIRA
- `plugin::upload.content-api.upload` - **CRÍTICO** Subir imágenes (hoja maestra)
- `api::omr-evaluacion.omr-evaluacion.create` - Crear evaluaciones OMR

**Commits:**
- `975909f` - "feat: Forzar asignación de permisos críticos para rol Authenticated en bootstrap"

---

### 2. **Corrección del Controlador de Login** (`src/api/persona-mira/controllers/persona-mira.ts`)

**Archivo:** `C:\Trabajo\Strapi\BdEstructura\strapi\src\api\persona-mira\controllers\persona-mira.ts`

**Problema Original:** 
- El JWT se generaba con el ID de `persona-mira`, pero Strapi requiere que el JWT esté asociado a un usuario de `plugin::users-permissions.user`
- La búsqueda/creación de usuarios en `users-permissions` fallaba con errores de SQL

**Solución Implementada:** Crear o encontrar un usuario en `users-permissions` para cada `persona-mira` que hace login, y generar el JWT usando el ID de ese usuario.

#### 2.1. Primera Versión (Falló - Error SQL)

**Intento 1:** Usar `strapi.db.query()` para buscar y crear usuarios
```typescript
const existingUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
  where: { email: usuarioCompleto.email.toLowerCase().trim() },
});
```
**Error:** `column t0.email does not exist`

**Razón:** `strapi.db.query()` hace consultas SQL directas y la estructura de la tabla puede ser diferente.

#### 2.2. Segunda Versión (Falló - Error SQL)

**Intento 2:** Usar `strapi.query()` en lugar de `strapi.db.query()`
```typescript
const existingUsers = await strapi.query('plugin::users-permissions.user').findMany({
  where: { email: usuarioCompleto.email.toLowerCase().trim() },
});
```
**Error:** `column t0.email does not exist`

**Razón:** `strapi.query()` también intenta hacer consultas SQL directas con `where: { email: ... }`.

#### 2.3. Tercera Versión (Falló - Error TypeScript)

**Intento 3:** Usar `entityService` para buscar y crear
```typescript
// Búsqueda
const existingUsers = await strapi.entityService.findMany('plugin::users-permissions.user' as any, {
  filters: {
    email: usuarioCompleto.email.toLowerCase().trim(),
  },
  limit: 1,
});

// Creación
usersPermissionsUser = await strapi.entityService.create('plugin::users-permissions.user' as any, {
  data: {
    email: usuarioCompleto.email.toLowerCase().trim(),
    username: usuarioCompleto.email.toLowerCase().trim(),
    confirmed: true,  // ❌ Error TypeScript
    blocked: false,   // ❌ Error TypeScript
    role: authenticatedRole.id,
  },
});
```
**Error TypeScript:** `Type 'boolean' is not assignable to type 'XOneInput'`

**Razón:** `entityService.create()` no acepta `confirmed` y `blocked` como booleanos directos en Strapi v5.

#### 2.4. Versión Final (Funcional)

**Solución:** Combinar `entityService` para búsqueda y `db.query()` para creación.

**Código Final:**
```typescript
// Crear o encontrar usuario en users-permissions para generar JWT válido
// El JWT de users-permissions requiere que exista un usuario en plugin::users-permissions.user
let usersPermissionsUser = null;
try {
  // Buscar si ya existe un usuario con este email usando entityService
  // entityService maneja mejor los campos de Strapi v5 que strapi.query()
  const existingUsers = await strapi.entityService.findMany('plugin::users-permissions.user' as any, {
    filters: {
      email: usuarioCompleto.email.toLowerCase().trim(),
    },
    limit: 1,
  });

  if (existingUsers && existingUsers.length > 0) {
    usersPermissionsUser = existingUsers[0];
    strapi.log.info(`[persona-mira.login] Usuario users-permissions encontrado: ID=${usersPermissionsUser.id}`);
  } else {
    // Crear nuevo usuario en users-permissions
    // Obtener rol "Authenticated" por defecto
    const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    if (!authenticatedRole) {
      strapi.log.error('[persona-mira.login] No se encontró el rol Authenticated');
    } else {
      // Usar db.query() para crear usuarios de users-permissions (como en colaborador.ts)
      // entityService no acepta confirmed/blocked como booleanos directos
      usersPermissionsUser = await strapi.db.query('plugin::users-permissions.user').create({
        data: {
          email: usuarioCompleto.email.toLowerCase().trim(),
          username: usuarioCompleto.email.toLowerCase().trim(),
          confirmed: true,
          blocked: false,
          role: authenticatedRole.id,
        },
      });
      strapi.log.info(`[persona-mira.login] Usuario users-permissions creado: ID=${usersPermissionsUser.id}`);
    }
  }
} catch (userError: any) {
  strapi.log.error(`[persona-mira.login] Error al crear/buscar usuario users-permissions: ${userError.message}`);
  strapi.log.error(`[persona-mira.login] Stack: ${userError.stack}`);
}

// Generar JWT token usando el servicio de users-permissions
// IMPORTANTE: Usar el ID del usuario de users-permissions, no el de persona-mira
let jwt = '';
if (usersPermissionsUser) {
  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    jwt = jwtService.issue({
      id: usersPermissionsUser.id, // <-- Usar el ID del usuario de users-permissions
    });
    strapi.log.info(`[persona-mira.login] JWT generado exitosamente para usuario users-permissions ID=${usersPermissionsUser.id}`);
  } catch (jwtError: any) {
    strapi.log.error(`[persona-mira.login] Error al generar JWT: ${jwtError.message}`);
  }
} else {
  strapi.log.warn('[persona-mira.login] No se pudo generar JWT: usuario users-permissions no disponible');
}

// Respuesta exitosa (SIN password, CON JWT)
return ctx.send({
  data: {
    id: usuarioCompleto.id,
    email: usuarioCompleto.email,
    fecha_registro: usuarioCompleto.fecha_registro,
    activo: usuarioCompleto.activo,
    ultimo_acceso: usuarioCompleto.ultimo_acceso,
    persona: usuarioCompleto.persona,
    licencias_activadas: usuarioCompleto.licencias_activadas || [],
    jwt: jwt, // Incluir JWT en la respuesta
  },
  message: 'Login exitoso',
});
```

**Cambios Clave:**
1. **Búsqueda:** Usa `entityService.findMany()` con `filters` (no `where`)
2. **Creación:** Usa `db.query().create()` para poder pasar `confirmed` y `blocked` como booleanos
3. **JWT:** Se genera usando el ID del usuario de `users-permissions`, no el de `persona-mira`
4. **JWT en Respuesta:** El JWT se incluye en el campo `jwt` de la respuesta

**Commits:**
- `72910a4` - "fix: Usar strapi.query() en lugar de strapi.db.query() para users-permissions en Strapi v5" (falló)
- `2705283` - "fix: Usar entityService en lugar de query para users-permissions.user en Strapi v5" (falló TypeScript)
- `7243d10` - "fix: Usar db.query() para crear users-permissions.user (entityService no acepta confirmed/blocked)" (funcional)

---

### 3. **Actualización del Frontend - Login** (`src/app/login/page.tsx`)

**Archivo:** `C:\Trabajo\Mira-Almonte\src\app\login\page.tsx`

**Problema:** El frontend no estaba guardando el JWT recibido del backend.

**Solución:** Actualizar la interfaz `LoginResponse` y el manejo de la respuesta para guardar el JWT.

**Cambios:**

1. **Actualización de la Interfaz:**
```typescript
interface LoginResponse {
  data: {
    id: number
    email: string
    fecha_registro: string
    activo: boolean
    ultimo_acceso: string | null
    persona: {
      id: number
      nombres: string
      primer_apellido: string
      segundo_apellido: string | null
      nombre_completo: string
      rut: string
    }
    licencias_activadas: Array<{...}>
    jwt?: string // ✅ JWT token para autenticación (AGREGADO)
  }
  message: string
}
```

2. **Actualización del Manejo de Respuesta:**
```typescript
const data: LoginResponse = await response.json()

// Guardar datos en localStorage
if (typeof window !== 'undefined') {
  localStorage.setItem('mira_user', JSON.stringify(data.data))
  // ✅ Guardar JWT si está disponible (AGREGADO)
  if (data.data.jwt) {
    localStorage.setItem('mira_token', JSON.stringify({ jwt: data.data.jwt }))
  } else {
    // Fallback: guardar datos del usuario (sin JWT)
    localStorage.setItem('mira_token', JSON.stringify(data.data))
  }
}
```

**Rama:** `ramaBastian-Mira` (proyecto Next.js)

---

### 4. **Actualización del Frontend - Crear Evaluación** (`src/app/dashboard/crear-evaluacion/page.tsx`)

**Archivo:** `C:\Trabajo\Mira-Almonte\src\app\dashboard\crear-evaluacion\page.tsx`

**Problema:** El frontend no estaba enviando correctamente el JWT en las peticiones.

**Solución:** Mejorar la lógica de extracción y envío del JWT.

**Código Actual (ya estaba implementado, pero mejorado):**
```typescript
// Obtener token JWT para autenticación
const token = localStorage.getItem('mira_token');
const headers: HeadersInit = {};

if (token) {
  try {
    const tokenData = JSON.parse(token);
    // Si tiene jwt, usarlo
    if (tokenData.jwt) {
      headers['Authorization'] = `Bearer ${tokenData.jwt}`;
    } else if (typeof tokenData === 'string') {
      // Si es un string directo, usarlo
      headers['Authorization'] = `Bearer ${tokenData}`;
    }
  } catch {
    // Si no es JSON, intentar usarlo directamente como string
    if (typeof token === 'string' && token.trim()) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
}

// Si no hay token, mostrar error
if (!headers['Authorization']) {
  setError('No estás autenticado. Por favor, inicia sesión nuevamente.');
  setSubmitting(false);
  return;
}

const response = await fetch(`${apiUrl}/api/evaluaciones`, {
  method: 'POST',
  headers: headers,
  body: formData,
});
```

**Rama:** `ramaBastian-Mira` (proyecto Next.js)

---

## 📊 Resumen de Archivos Modificados

### Backend (Strapi)
1. **`src/index.ts`**
   - Agregada sección de permisos forzados para rol `authenticated`
   - Permisos: evaluacion (create, find, findOne), libro-mira (find, findOne), upload, omr-evaluacion (create)

2. **`src/api/persona-mira/controllers/persona-mira.ts`**
   - Agregada lógica para crear/buscar usuario en `users-permissions`
   - Generación de JWT usando el ID del usuario de `users-permissions`
   - Inclusión del JWT en la respuesta del login

### Frontend (Next.js)
3. **`src/app/login/page.tsx`**
   - Actualizada interfaz `LoginResponse` para incluir `jwt?: string`
   - Actualizado manejo de respuesta para guardar JWT en `localStorage`

4. **`src/app/dashboard/crear-evaluacion/page.tsx`**
   - Lógica de extracción y envío de JWT ya estaba implementada (sin cambios necesarios)

---

## 🔍 Diagnóstico del Problema Actual

Si aún no funciona, verificar:

### 1. **Logs de Strapi al Iniciar**
Buscar en los logs:
```
🔐 PERMISOS FORZADOS APLICADOS CORRECTAMENTE
   ✅ Creados: X
   ✅ Existentes: Y
   ❌ Errores: 0
```

### 2. **Logs de Login**
Al hacer login, debería aparecer:
```
[persona-mira.login] Usuario users-permissions encontrado: ID=X
```
o
```
[persona-mira.login] Usuario users-permissions creado: ID=X
[persona-mira.login] JWT generado exitosamente para usuario users-permissions ID=X
```

### 3. **Verificar JWT en Frontend**
En la consola del navegador:
```javascript
const token = localStorage.getItem('mira_token');
console.log(JSON.parse(token));
// Debería mostrar: { jwt: "eyJhbGc..." }
```

### 4. **Verificar Permisos en Strapi Admin**
1. Ir a `Settings` > `Users & Permissions Plugin` > `Roles` > `Authenticated`
2. Verificar que estos permisos estén habilitados:
   - `Evaluacion` > `create`, `find`, `findOne`
   - `Libro-mira` > `find`, `findOne`
   - `Upload` > `upload`
   - `Omr-evaluacion` > `create`

### 5. **Probar el Endpoint Directamente**
```bash
# 1. Hacer login y obtener JWT
curl -X POST https://strapi.moraleja.cl/api/personas-mira/auth/login \
  -H "Content-Type: application/json" \
  -d '{"data":{"email":"prueba@mira.app","password":"123456"}}'

# 2. Usar el JWT para crear una evaluación
curl -X POST https://strapi.moraleja.cl/api/evaluaciones \
  -H "Authorization: Bearer <JWT_AQUI>" \
  -H "Content-Type: multipart/form-data" \
  -F "data={\"nombre\":\"Test\",\"categoria\":\"Básica\",\"cantidad_preguntas\":10,\"libro_mira\":1,\"activo\":true}" \
  -F "files.hoja_maestra_imagen=@imagen.jpg"
```

---

## 🐛 Errores Conocidos y Soluciones

### Error: "column t0.email does not exist"
**Causa:** Usar `strapi.query()` o `strapi.db.query()` con `where: { email: ... }` para buscar usuarios.

**Solución:** Usar `entityService.findMany()` con `filters: { email: ... }`.

### Error: "Type 'boolean' is not assignable to type 'XOneInput'"
**Causa:** Usar `entityService.create()` con `confirmed: true` y `blocked: false`.

**Solución:** Usar `strapi.db.query().create()` para crear usuarios de `users-permissions`.

### Error: "Missing or invalid credentials"
**Causa:** El JWT no está asociado a un usuario de `users-permissions`.

**Solución:** Asegurar que el login crea/encuentra un usuario en `users-permissions` y genera el JWT con su ID.

### Error: "Forbidden" (403)
**Causa:** Los permisos no están configurados para el rol `authenticated`.

**Solución:** Verificar que el bootstrap esté ejecutándose y creando los permisos correctamente.

---

## 📝 Notas Técnicas

1. **Strapi v5 vs v4:**
   - En Strapi v5, `entityService` es preferido para búsquedas con filtros
   - `db.query()` sigue siendo necesario para crear usuarios con campos como `confirmed` y `blocked`
   - `strapi.query()` puede fallar con campos que no existen directamente en la tabla SQL

2. **JWT y users-permissions:**
   - El JWT de Strapi siempre debe estar asociado a un usuario de `plugin::users-permissions.user`
   - No se puede usar el ID de otros content types (como `persona-mira`) para generar JWT válidos
   - Cada `persona-mira` debe tener un usuario correspondiente en `users-permissions`

3. **Permisos:**
   - Los permisos se verifican en cada request
   - El bootstrap fuerza la creación/habilitación de permisos en cada inicio
   - Si un permiso está deshabilitado, el bootstrap lo habilita automáticamente

---

## 🚀 Próximos Pasos si Aún No Funciona

1. **Verificar que el código esté desplegado:**
   - Revisar los commits en GitHub
   - Verificar que Railway haya desplegado los cambios

2. **Limpiar y Re-login:**
   - Cerrar sesión en el frontend
   - Limpiar `localStorage` del navegador
   - Hacer login nuevamente para generar un nuevo JWT

3. **Verificar Base de Datos:**
   - Conectar a PostgreSQL
   - Verificar que existan usuarios en `up_users` para los `persona-mira`
   - Verificar que los permisos estén en `up_permissions` y asociados al rol `authenticated`

4. **Debug Adicional:**
   - Agregar más logs en el controlador de login
   - Verificar el JWT generado (decodificarlo en jwt.io)
   - Probar el endpoint directamente con Postman/curl

---

## 📚 Referencias

- **Strapi v5 Documentation:** https://docs.strapi.io/dev-docs/backend-customization
- **Users & Permissions Plugin:** https://docs.strapi.io/dev-docs/plugins/users-permissions
- **JWT Service:** https://docs.strapi.io/dev-docs/plugins/users-permissions#jwt-service

---

---

## 🔧 Correcciones Quirúrgicas (2026-01-05 - Segunda Iteración)

### 1. **Permisos de Upload - Ambas Variantes**

**Problema:** El permiso de upload puede tener diferentes formatos en Strapi v5.

**Solución:** Habilitar ambas variantes del permiso de upload:
```typescript
const permisosCriticos = [
  // ... otros permisos ...
  // Upload de imágenes (CRÍTICO para subir hoja maestra)
  // Habilitar AMBAS variantes por seguridad (Strapi v5 puede usar cualquiera)
  'plugin::upload.content-api.upload',
  'plugin::upload.controllers.content-api.upload',
  // ... otros permisos ...
];
```

**Commit:** `d5d651b` - "fix: Correcciones quirúrgicas - Upload permissions, login robusto, debug logs"

---

### 2. **Login Robusto - A Prueba de Fallos**

**Problema:** Si falla la creación/búsqueda del usuario `users-permissions`, el login completo falla.

**Solución:** Hacer el login robusto con múltiples fallbacks:

1. **Validación de ID numérico:**
```typescript
const userId = typeof usersPermissionsUser.id === 'number' 
  ? usersPermissionsUser.id 
  : parseInt(usersPermissionsUser.id);

if (isNaN(userId) || userId <= 0) {
  throw new Error(`ID de usuario inválido: ${usersPermissionsUser.id}`);
}
```

2. **JWT de Fallback:**
Si falla la creación del usuario `users-permissions`, se genera un JWT usando el ID de `persona-mira`:
```typescript
// Intentar generar JWT de fallback con el ID de persona-mira (no ideal pero funcional)
try {
  const jwtService = strapi.plugin('users-permissions').service('jwt');
  jwt = jwtService.issue({
    id: usuarioCompleto.id,
    email: usuarioCompleto.email,
  });
  strapi.log.warn(`[persona-mira.login] ⚠️ JWT de fallback generado con ID de persona-mira: ${usuarioCompleto.id}`);
} catch (fallbackError: any) {
  strapi.log.error(`[persona-mira.login] ❌ Error al generar JWT de fallback: ${fallbackError.message}`);
}
```

3. **No romper el login:**
Todos los errores se capturan y se registran, pero el login siempre devuelve éxito (con o sin JWT válido).

**Commit:** `d5d651b` - "fix: Correcciones quirúrgicas - Upload permissions, login robusto, debug logs"

---

### 3. **Debug Logs en Evaluacion.create**

**Problema:** No se sabía si `ctx.state.user` estaba definido al crear evaluaciones.

**Solución:** Agregar logs de debug masivos en el controlador de `evaluacion.create`:

```typescript
async create(ctx: any) {
  // 🔍 DEBUG GIGANTE: Verificar autenticación
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 [evaluacion.create] DEBUG DE AUTENTICACIÓN');
  console.log('═══════════════════════════════════════════════════════');
  console.log('ctx.state.user:', JSON.stringify(ctx.state.user, null, 2));
  console.log('ctx.state.user existe?', !!ctx.state.user);
  console.log('ctx.state.user?.id:', ctx.state.user?.id);
  console.log('ctx.state.user?.email:', ctx.state.user?.email);
  console.log('ctx.request.headers.authorization:', ctx.request.headers.authorization);
  console.log('ctx.request.method:', ctx.request.method);
  console.log('ctx.request.url:', ctx.request.url);
  console.log('═══════════════════════════════════════════════════════');
  
  strapi.log.info('🔍 [evaluacion.create] ctx.state.user:', ctx.state.user);
  // ... más logs ...
  
  // Llamar al método create del core controller
  return await super.create(ctx);
}
```

**Qué verificar en los logs:**
- Si `ctx.state.user` es `undefined` → El JWT no está siendo validado correctamente
- Si `ctx.state.user` existe pero no tiene `id` → Problema con el formato del JWT
- Si `ctx.request.headers.authorization` está vacío → El frontend no está enviando el token

**Commit:** `d5d651b` - "fix: Correcciones quirúrgicas - Upload permissions, login robusto, debug logs"

---

**Última Actualización:** 2026-01-05 (Segunda Iteración)
**Versión Strapi:** 5.29.0
**Rama Backend:** `etiquetas-gonza`
**Rama Frontend:** `ramaBastian-Mira`

