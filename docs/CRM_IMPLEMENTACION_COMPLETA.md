# 🎯 CRM - Plan de Implementación Completo

**Enfoque:** Usar content types existentes (`colegio` y `persona`) sin crear nuevos  
**Integración:** Módulo dentro de la intranet existente

---

## 🏗️ Arquitectura del CRM

### Visión General

```
Intranet (frontend-ubold)
├── CRM (NUEVO MÓDULO)
│   ├── Colegios
│   ├── Personas
│   ├── Cartera (Asignaciones)
│   └── Actividades (Timeline)
│
Strapi (Backend)
├── colegio (existente)
├── persona (existente)
├── cartera-asignacion (existente)
└── colegio-event (existente - bitácora)
```

---

## 📊 Modelo de Datos (Todo Existe)

### 1. Colegio (`api::colegio.colegio`)

**Campos clave existentes:**
- `rbd` (integer, único)
- `colegio_nombre` (string)
- `estado`, `estado_nombre` (enum)
- `dependencia`, `ruralidad`, `estado_estab` (enum)
- `region`, `provincia`, `zona` (string)
- `comuna` (relation → comuna)
- `emails` (component repeatable)
- `telefonos` (component repeatable)
- `direcciones` (component repeatable)
- `cartera_asignaciones` (relation → cartera-asignacion)
- `persona_trayectorias` (relation → persona-trayectoria)

**✅ No necesita cambios** - Ya tiene todo lo necesario

### 2. Persona (`api::persona.persona`)

**Campos clave existentes:**
- `rut` (string, único)
- `nombres`, `primer_apellido`, `segundo_apellido`
- `nombre_completo` (string)
- `emails` (component repeatable)
- `telefonos` (component repeatable)
- `cartera_asignaciones` (relation → cartera-asignacion)
- `trayectorias` (relation → persona-trayectoria)
- `activo` (boolean)
- `origen` (enum: "mineduc", "csv", "manual", "crm", "web", "otro")
- `nivel_confianza` (enum: "baja", "media", "alta")
- `notas` (text)

**✅ No necesita cambios** - Ya tiene todo lo necesario

### 3. Cartera Asignación (`api::cartera-asignacion.cartera-asignacion`)

**Campos clave existentes:**
- `colegio` (relation → colegio)
- `ejecutivo` (relation → persona)
- `periodo` (relation → cartera-periodo)
- `rol` (enum: "comercial", "soporte1", "soporte2")
- `estado` (enum: "activa", "en_revision", "cerrada")
- `prioridad` (enum: "alta", "media", "baja")
- `fecha_inicio`, `fecha_fin` (date)
- `is_current` (boolean)
- `notas` (text)

**✅ No necesita cambios** - Ya tiene todo lo necesario

### 4. Colegio Event (`api::colegio-event.colegio-event`)

**Campos clave existentes:**
- `colegio` (relation → colegio)
- `action` (enum: "create", "edit", "verify", "approve", "reject", "note")
- `field` (string)
- `value` (text)
- `actor_email`, `actor_name` (string, email)
- `meta` (json)

**✅ No necesita cambios** - Ya tiene todo lo necesario

---

## 🔄 Flujos de Trabajo del CRM

### Flujo 1: Ver Colegio en CRM

```
1. Usuario va a /crm/colegios
2. Ve listado con filtros
3. Hace clic en un colegio → /crm/colegios/[id]
4. Página muestra:
   ├── Información General
   │   ├── Datos básicos (RBD, nombre, estado)
   │   ├── Ubicación (región, comuna, dirección)
   │   └── Contacto (emails, teléfonos)
   │
   ├── Asignaciones (pestaña)
   │   ├── Ejecutivo Comercial (desde cartera-asignacion con rol="comercial")
   │   ├── Soporte 1 (rol="soporte1")
   │   └── Soporte 2 (rol="soporte2")
   │
   ├── Profesores (pestaña)
   │   └── Lista de personas relacionadas (desde persona-trayectoria)
   │
   ├── Actividades (pestaña)
   │   └── Timeline de eventos (desde colegio-event)
   │
   └── Notas (pestaña)
       └── Campo notas del colegio + historial
```

### Flujo 2: Ver Persona en CRM

```
1. Usuario va a /crm/personas
2. Ve listado con filtros
3. Hace clic en una persona → /crm/personas/[id]
4. Página muestra:
   ├── Información General
   │   ├── Datos personales (RUT, nombres, apellidos)
   │   ├── Contacto (emails, teléfonos)
   │   ├── Estado (activo, origen, nivel_confianza)
   │   └── Imagen (si tiene)
   │
   ├── Colegios (pestaña)
   │   └── Colegios donde trabaja (desde persona-trayectoria)
   │
   ├── Asignaciones (pestaña)
   │   └── Colegios asignados como ejecutivo (desde cartera-asignacion)
   │
   ├── Actividades (pestaña)
   │   └── Timeline de interacciones
   │
   └── Notas (pestaña)
       └── Campo notas de la persona + historial
```

### Flujo 3: Asignar Ejecutivo a Colegio

```
1. Desde /crm/colegios/[id] → pestaña "Asignaciones"
2. Botón "Asignar ejecutivo"
3. Modal se abre:
   ├── Seleccionar persona (ejecutivo)
   ├── Seleccionar rol (comercial, soporte1, soporte2)
   ├── Seleccionar período
   ├── Prioridad (alta, media, baja)
   ├── Fecha inicio
   ├── Fecha fin (opcional)
   └── Notas (opcional)
4. Al guardar:
   ├── Crear/actualizar registro en cartera-asignacion
   ├── Marcar otras asignaciones como is_current=false (si es necesario)
   └── Crear evento en colegio-event (action="edit", field="asignacion")
```

### Flujo 4: Agregar Nota/Actividad

```
1. Desde cualquier ficha (colegio o persona)
2. Botón "Agregar nota" o "Agregar actividad"
3. Modal se abre:
   ├── Tipo de acción (nota, llamada, email, reunión)
   ├── Descripción
   └── Fecha (default: ahora)
4. Al guardar:
   ├── Crear registro en colegio-event (action="note")
   └── Actualizar campo notas si es necesario
```

### Flujo 5: Vincular Profesor a Colegio

```
1. Desde /crm/personas/[id] → pestaña "Colegios"
2. Botón "Vincular a colegio"
3. Modal se abre:
   ├── Seleccionar colegio
   ├── Cargo (string)
   ├── Curso (relation)
   ├── Asignatura (relation)
   ├── Año (integer)
   ├── Fecha inicio
   ├── Fecha fin (opcional)
   └── Notas (opcional)
4. Al guardar:
   ├── Crear/actualizar registro en persona-trayectoria
   └── Crear evento en colegio-event (action="edit")
```

---

## 🎨 Estructura de Páginas en Intranet

### Rutas del CRM

```
/crm
├── /crm/colegios
│   ├── GET    → Listado con filtros
│   ├── /crm/colegios/[id]
│   │   ├── GET    → Ficha detalle
│   │   ├── PUT    → Editar colegio
│   │   └── POST   → Agregar nota/evento
│   └── /crm/colegios/nuevo
│       └── POST   → Crear nuevo colegio
│
├── /crm/personas
│   ├── GET    → Listado con filtros
│   ├── /crm/personas/[id]
│   │   ├── GET    → Ficha detalle
│   │   ├── PUT    → Editar persona
│   │   └── POST   → Agregar nota/evento
│   └── /crm/personas/nuevo
│       └── POST   → Crear nueva persona
│
├── /crm/cartera
│   ├── GET    → Listado de asignaciones
│   ├── /crm/cartera/[id]
│   │   ├── GET    → Detalle asignación
│   │   └── PUT    → Editar asignación
│   └── /crm/cartera/nueva
│       └── POST   → Crear nueva asignación
│
└── /crm/actividades
    └── GET    → Timeline unificado de actividades
```

---

## 🔌 APIs Necesarias (Strapi)

### 1. Colegios

#### GET /api/crm/colegios
Listado con filtros y paginación

**Query params:**
```
?page=1
&pageSize=25
&filters[rbd][$eq]=12345
&filters[colegio_nombre][$contains]=ejemplo
&filters[region][$eq]=Metropolitana
&filters[estado][$eq]=Aprobado
&filters[cartera_asignaciones][ejecutivo][id][$eq]=123
&populate[cartera_asignaciones][filters][is_current][$eq]=true
&populate[cartera_asignaciones][populate][ejecutivo]=true
&populate[comuna]=true
&sort[0]=colegio_nombre:asc
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "rbd": 12345,
      "colegio_nombre": "Colegio Ejemplo",
      "estado": "Aprobado",
      "region": "Metropolitana",
      "comuna": {...},
      "cartera_asignaciones": [
        {
          "id": 1,
          "rol": "comercial",
          "ejecutivo": {
            "id": 10,
            "nombre_completo": "Juan Pérez",
            "emails": [...],
            "telefonos": [...]
          },
          "is_current": true
        }
      ]
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 10,
      "total": 250
    }
  }
}
```

#### GET /api/crm/colegios/:id/completo
Ficha completa con todas las relaciones

**Populate:**
- comuna
- cartera_asignaciones (con ejecutivo completo)
- persona_trayectorias (con persona completa)
- colegio-events (últimos 50)

#### PUT /api/crm/colegios/:id
Actualizar colegio

#### POST /api/crm/colegios/:id/evento
Crear evento en bitácora

**Body:**
```json
{
  "action": "note",
  "field": "contacto",
  "value": "Llamada realizada, no contesta",
  "actor_email": "admin@moraleja.cl",
  "actor_name": "Admin Usuario",
  "meta": {}
}
```

### 2. Personas

#### GET /api/crm/personas
Listado con filtros

**Query params similares a colegios**

#### GET /api/crm/personas/:id/completo
Ficha completa con relaciones

**Populate:**
- trayectorias (con colegio, curso, asignatura)
- cartera_asignaciones (con colegio)
- emails, telefonos

#### PUT /api/crm/personas/:id
Actualizar persona

#### POST /api/crm/personas/:id/evento
Crear evento (si se implementa persona-event)

### 3. Cartera

#### GET /api/crm/cartera
Listado de asignaciones

**Query params:**
```
?filters[is_current][$eq]=true
&filters[ejecutivo][id][$eq]=123
&filters[colegio][id][$eq]=456
&populate[colegio]=true
&populate[ejecutivo]=true
&populate[periodo]=true
```

#### POST /api/crm/cartera
Crear nueva asignación

**Body:**
```json
{
  "colegio": 456,
  "ejecutivo": 123,
  "periodo": 10,
  "rol": "comercial",
  "prioridad": "alta",
  "fecha_inicio": "2025-01-01",
  "fecha_fin": "2025-12-31",
  "notas": "Nueva asignación"
}
```

#### PUT /api/crm/cartera/:id
Actualizar asignación

### 4. Actividades (Timeline)

#### GET /api/crm/actividades
Timeline unificado

**Query params:**
```
?filters[colegio][id][$eq]=123
&filters[action][$eq]=note
&sort[0]=createdAt:desc
&pagination[limit]=50
```

---

## 🎨 Componentes de UI

### 1. Listado de Colegios (`ColegiosList.tsx`)

**Características:**
- Tabla con columnas: RBD, Nombre, Región, Comuna, Estado, Ejecutivo, Última actividad
- Filtros: región, comuna, dependencia, estado, ejecutivo, búsqueda
- Paginación
- Acciones: ver, editar, asignar ejecutivo

### 2. Ficha de Colegio (`ColegioDetail.tsx`)

**Estructura:**
```
┌─────────────────────────────────────┐
│ Header: Nombre, RBD, Estado badge   │
├─────────────────────────────────────┤
│ [Pestañas]                          │
│ Info | Asignaciones | Profesores |  │
│      | Actividades | Notas          │
├─────────────────────────────────────┤
│                                     │
│ Contenido de la pestaña activa      │
│                                     │
└─────────────────────────────────────┘
```

**Pestaña Info:**
- Formulario con datos básicos
- Componente de contacto (emails, teléfonos)
- Direcciones

**Pestaña Asignaciones:**
- Cards para cada rol (comercial, soporte1, soporte2)
- Botón "Asignar" si no hay
- Botón "Cambiar" si hay asignación activa

**Pestaña Profesores:**
- Tabla con persona-trayectorias
- Columnas: Nombre, Cargo, Curso, Asignatura, Año
- Botón "Vincular profesor"

**Pestaña Actividades:**
- Timeline vertical
- Filtros por tipo de acción
- Formulario para agregar nueva actividad

### 3. Listado de Personas (`PersonasList.tsx`)

Similar a colegios pero con columnas: RUT, Nombre, Email, Teléfono, Colegios, Estado

### 4. Ficha de Persona (`PersonaDetail.tsx`)

Similar estructura a colegio pero con pestañas: Info, Colegios, Asignaciones, Actividades, Notas

### 5. Formulario de Asignación (`AsignacionForm.tsx`)

Modal con:
- Selector de persona (ejecutivo)
- Selector de rol
- Selector de período
- Selector de prioridad
- Inputs de fechas
- Textarea de notas

### 6. Timeline de Actividades (`ActivityTimeline.tsx`)

Componente que muestra eventos en formato timeline:
- Icono según tipo de acción
- Fecha y hora
- Actor
- Descripción
- Valor (si aplica)

---

## 🔐 Permisos y Roles

Usar roles existentes de `colaborador`:

- **super_admin**: Acceso completo
- **encargado_adquisiciones**: Lectura completa, edición limitada
- **supervisor**: Ver y editar colegios/personas asignados
- **soporte**: Lectura, agregar notas/eventos

**Implementación:**
- Middleware de autenticación existente
- Verificar rol del colaborador
- Filtrar datos según permisos

---

## 📈 Dashboard CRM (Widget en Dashboard Principal)

### Widgets Sugeridos

1. **Resumen de Colegios**
   - Total colegios
   - Por estado (gráfico de barras)
   - Sin ejecutivo asignado (alerta)

2. **Asignaciones Pendientes**
   - Colegios sin ejecutivo comercial
   - Asignaciones en revisión

3. **Actividades Recientes**
   - Últimas 5 actividades del día
   - Link a ver todas

4. **Personas Nuevas**
   - Personas creadas esta semana
   - Link a listado

---

## 🔍 Búsqueda Global

### Implementación

Búsqueda en header de intranet que busca en:
- Colegios (por RBD, nombre)
- Personas (por RUT, nombre)

**API:**
```
GET /api/crm/buscar?q=termino
```

**Response:**
```json
{
  "colegios": [
    {
      "id": 1,
      "rbd": 12345,
      "colegio_nombre": "Colegio Ejemplo",
      "tipo": "colegio"
    }
  ],
  "personas": [
    {
      "id": 10,
      "rut": "12345678-9",
      "nombre_completo": "Juan Pérez",
      "tipo": "persona"
    }
  ]
}
```

---

## ✅ Plan de Implementación

### Fase 1: Listados y Fichas Básicas (2-3 semanas)

1. ✅ Crear rutas en intranet (`/crm/*`)
2. ✅ Componente listado de colegios
3. ✅ Componente ficha de colegio (pestaña Info)
4. ✅ Componente listado de personas
5. ✅ Componente ficha de persona (pestaña Info)
6. ✅ APIs básicas (listado y detalle)

### Fase 2: Asignaciones (1-2 semanas)

7. ✅ Pestaña Asignaciones en ficha de colegio
8. ✅ Formulario crear/editar asignación
9. ✅ APIs de cartera
10. ✅ Listado de asignaciones

### Fase 3: Relaciones y Actividades (2 semanas)

11. ✅ Pestaña Profesores (persona-trayectoria)
12. ✅ Pestaña Actividades (timeline)
13. ✅ Formulario agregar actividad/nota
14. ✅ APIs de eventos

### Fase 4: Mejoras (1-2 semanas)

15. ✅ Búsqueda global
16. ✅ Widgets en dashboard
17. ✅ Filtros avanzados
18. ✅ Exportación a CSV/Excel

---

## 🎯 Ventajas de esta Arquitectura

1. ✅ **No crea content types nuevos** - Usa lo existente
2. ✅ **Reutiliza datos** - No duplica información
3. ✅ **Mantiene relaciones** - Aprovecha relaciones existentes
4. ✅ **Escalable** - Fácil agregar nuevas funcionalidades
5. ✅ **Consistente** - Misma estructura que el resto de la intranet

---

## 📝 Notas Técnicas

- **Autenticación**: Usar misma política que intranet (`global::is-authenticated`)
- **Paginación**: Usar paginación de Strapi (default: 25 por página)
- **Populate**: Usar populate profundo solo cuando sea necesario (performance)
- **Caché**: Considerar caché para listados si hay muchos registros
- **Validación**: Validar en frontend y backend

---

**Última actualización:** 29-12-2025  
**Próximos pasos:** Aprobar plan y comenzar Fase 1

