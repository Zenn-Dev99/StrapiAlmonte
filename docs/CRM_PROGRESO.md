# 📊 CRM - Progreso de Implementación

**Fecha inicio:** 29-12-2025  
**Estado:** En desarrollo

---

## ✅ Completado

### 1. Estructura Base

- ✅ Rutas creadas:
  - `/crm/colegios` - Listado de colegios
  - `/crm/colegios/[id]` - Ficha detalle de colegio
  - `/crm/personas` - Listado de personas
  - `/crm/personas/[id]` - Ficha detalle de persona

- ✅ API Routes (Next.js):
  - `GET /api/crm/colegios` - Listado con paginación
  - `GET /api/crm/colegios/[id]` - Detalle completo
  - `GET /api/crm/personas` - Listado con paginación
  - `GET /api/crm/personas/[id]` - Detalle completo

- ✅ Componentes básicos:
  - `ColegiosList` - Tabla simple con datos básicos
  - `ColegioDetail` - Ficha con pestañas (estructura base)
  - `PersonasList` - Tabla simple con datos básicos
  - `PersonaDetail` - Ficha con pestañas (estructura base)

---

## 🚧 En Progreso

### 2. Fichas Detalle (Estructura base creada, falta contenido)

- ⚠️ Pestaña "Información General" - ✅ Completa
- ⚠️ Pestaña "Asignaciones" - Estructura creada, falta implementar
- ⚠️ Pestaña "Profesores" - Estructura creada, falta implementar
- ⚠️ Pestaña "Actividades" - Estructura creada, falta implementar
- ⚠️ Pestaña "Notas" - Estructura creada, falta implementar

---

## 📋 Pendiente

### 3. Funcionalidades Faltantes

#### 3.1 Listados Mejorados
- [ ] Filtros avanzados (región, comuna, estado, etc.)
- [ ] Búsqueda por nombre/RBD/RUT
- [ ] Paginación funcional
- [ ] Ordenamiento de columnas
- [ ] Exportación a CSV/Excel

#### 3.2 Asignaciones
- [ ] Formulario crear/editar asignación ejecutivo-colegio
- [ ] Listado de asignaciones activas
- [ ] Visualización de ejecutivo asignado en ficha de colegio
- [ ] Cambio de ejecutivo

#### 3.3 Profesores (Persona-Trayectoria)
- [ ] Listado de profesores en ficha de colegio
- [ ] Formulario vincular profesor a colegio
- [ ] Visualización de trayectorias en ficha de persona

#### 3.4 Actividades (Timeline)
- [ ] Timeline de eventos (colegio-event)
- [ ] Formulario agregar nueva actividad/nota
- [ ] Filtros por tipo de acción
- [ ] Visualización de eventos en tiempo real

#### 3.5 Notas
- [ ] Editor de notas
- [ ] Historial de cambios
- [ ] Agregar notas desde cualquier pestaña

#### 3.6 Otras Funcionalidades
- [ ] Crear nuevo colegio (página `/crm/colegios/nuevo`)
- [ ] Crear nueva persona (página `/crm/personas/nuevo`)
- [ ] Editar colegio/persona
- [ ] Búsqueda global (en header)
- [ ] Widgets en dashboard principal

---

## 🔌 APIs Pendientes en Strapi

Aunque las APIs básicas están implementadas en Next.js (proxies a Strapi), podrían crearse endpoints personalizados en Strapi para:

- [ ] `GET /api/crm/colegios/:id/completo` - Endpoint optimizado con populate específico
- [ ] `POST /api/crm/colegios/:id/evento` - Crear evento en bitácora
- [ ] `GET /api/crm/cartera` - Listado de asignaciones
- [ ] `POST /api/crm/cartera` - Crear asignación
- [ ] `GET /api/crm/actividades` - Timeline unificado
- [ ] `GET /api/crm/buscar?q=termino` - Búsqueda global

---

## 📁 Archivos Creados

### Frontend (Next.js)

```
frontend-ubold/src/app/(admin)/(apps)/crm/
├── colegios/
│   ├── page.tsx                           ✅
│   ├── components/
│   │   └── ColegiosList.tsx               ✅
│   └── [id]/
│       ├── page.tsx                       ✅
│       └── components/
│           └── ColegioDetail.tsx          ✅ (estructura base)
├── personas/
│   ├── page.tsx                           ✅
│   ├── components/
│   │   └── PersonasList.tsx               ✅
│   └── [id]/
│       ├── page.tsx                       ✅
│       └── components/
│           └── PersonaDetail.tsx          ✅ (estructura base)
└── api/crm/
    ├── colegios/
    │   ├── route.ts                       ✅
    │   └── [id]/route.ts                  ✅
    └── personas/
        ├── route.ts                       ✅
        └── [id]/route.ts                  ✅
```

---

## 🎯 Próximos Pasos Recomendados

### Prioridad Alta

1. **Implementar pestaña Asignaciones en ColegioDetail**
   - Listar asignaciones activas
   - Mostrar ejecutivo comercial y soportes
   - Botón "Asignar ejecutivo"

2. **Crear formulario de asignación**
   - Modal con selector de persona
   - Campos: rol, período, prioridad, fechas
   - Guardar en `cartera-asignacion`

3. **Implementar filtros en listados**
   - Filtros básicos: región, estado
   - Búsqueda por nombre/RBD

### Prioridad Media

4. **Implementar pestaña Profesores**
   - Listar persona-trayectorias relacionadas
   - Tabla con datos relevantes

5. **Implementar pestaña Actividades**
   - Timeline de colegio-event
   - Formulario agregar actividad

6. **Crear/Editar colegios y personas**
   - Páginas de formulario
   - Validación

### Prioridad Baja

7. **Mejoras de UI/UX**
   - Tablas más avanzadas (TanStack Table)
   - Mejor diseño de fichas
   - Animaciones

8. **Widgets en dashboard**
   - Resumen de colegios
   - Asignaciones pendientes

---

## ⚙️ Configuración Necesaria

### Variables de Entorno

Asegúrate de tener estas variables en `.env.local`:

```env
STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=tu_token_aqui
```

### Permisos en Strapi

Verificar que las APIs de `colegio` y `persona` tengan permisos públicos o que el token tenga acceso.

---

## 📝 Notas Técnicas

- **Stack**: Next.js 14 (App Router), React Bootstrap, TypeScript
- **Patrón**: Server Components para páginas, Client Components para interactividad
- **API**: Proxy routes en Next.js que llaman a Strapi
- **Autenticación**: Usar misma política que el resto de la intranet

---

**Última actualización:** 29-12-2025

