# 🎯 Cómo Funciona el CRM

## 📋 Resumen Ejecutivo

El CRM (Customer Relationship Management) es un módulo integrado en la intranet que permite gestionar relaciones comerciales con colegios y personas. Utiliza content-types existentes de Strapi y añade una capa de visualización y gestión en el frontend.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (Next.js / Intranet)              │
│                                                          │
│  /crm/colegios    → Listado y fichas de colegios       │
│  /crm/personas    → Listado y fichas de personas       │
│  /api/crm/*       → Proxy routes a Strapi              │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP REST API
                     │
┌────────────────────▼────────────────────────────────────┐
│              BACKEND (Strapi)                           │
│                                                          │
│  Content Types:                                         │
│  ├── colegio          (existente)                       │
│  ├── persona          (existente)                       │
│  ├── cartera-asignacion (existente)                     │
│  ├── colegio-event    (existente - bitácora)            │
│  ├── lead             (nuevo - CRM)                     │
│  ├── oportunidad      (nuevo - CRM)                     │
│  ├── deal             (nuevo - CRM)                     │
│  ├── cotizacioncrm    (nuevo - CRM)                     │
│  ├── propuesta        (nuevo - CRM)                     │
│  └── actividad        (nuevo - CRM)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujos Principales

### 1. Ver Listado de Colegios

```
Usuario → /crm/colegios
         ↓
    [ColegiosList.tsx]
         ↓
    GET /api/crm/colegios
         ↓
    Next.js Proxy Route
         ↓
    GET /api/colegios (Strapi)
         ↓
    [Populate: comuna, cartera_asignaciones, ejecutivo]
         ↓
    Mostrar tabla con:
    - RBD, Nombre, Estado, Región, Comuna
    - Botón "Ver" → /crm/colegios/[id]
```

**Ejemplo de llamada API:**
```javascript
GET /api/crm/colegios?page=1&pageSize=25

// Internamente hace:
GET http://localhost:1337/api/colegios?
  pagination[page]=1&
  pagination[pageSize]=25&
  populate[0]=comuna&
  populate[1]=cartera_asignaciones.ejecutivo&
  sort[0]=colegio_nombre:asc
```

---

### 2. Ver Ficha de Colegio

```
Usuario → /crm/colegios/123
         ↓
    [ColegioDetail.tsx]
         ↓
    GET /api/crm/colegios/123
         ↓
    Next.js Proxy Route
         ↓
    GET /api/colegios/123 (Strapi)
         ↓
    [Populate completo:
      - comuna
      - cartera_asignaciones (con ejecutivo, periodo)
      - persona_trayectorias (con persona, curso, asignatura)
      - telefonos, emails, direcciones]
         ↓
    Mostrar pestañas:
    ├── Información General ✅
    ├── Asignaciones 🚧
    ├── Profesores 🚧
    ├── Actividades 🚧
    └── Notas 🚧
```

**Estructura de la ficha:**

```typescript
// Datos que se muestran:
{
  id: 123,
  rbd: 12345,
  colegio_nombre: "Colegio Ejemplo",
  estado: "Aprobado",
  region: "Metropolitana",
  comuna: {
    id: 1,
    nombre: "Santiago"
  },
  cartera_asignaciones: [
    {
      id: 1,
      rol: "comercial",
      ejecutivo: {
        id: 10,
        nombre_completo: "Juan Pérez",
        emails: [...],
        telefonos: [...]
      },
      is_current: true
    }
  ],
  persona_trayectorias: [
    {
      id: 1,
      persona: { nombre_completo: "Profesor X" },
      curso: { nombre: "1ro Básico" },
      asignatura: { nombre: "Matemáticas" }
    }
  ]
}
```

---

### 3. Gestión de Asignaciones

**Asignar Ejecutivo a un Colegio:**

```
Usuario → /crm/colegios/123 → Pestaña "Asignaciones"
         ↓
    Click "Asignar ejecutivo"
         ↓
    Modal [AsignacionForm]
         ↓
    Seleccionar:
    - Persona (ejecutivo)
    - Rol (comercial, soporte1, soporte2)
    - Período
    - Prioridad (alta, media, baja)
    - Fechas (inicio, fin)
         ↓
    POST /api/cartera-asignaciones (Strapi)
         ↓
    Crear registro en cartera-asignacion:
    {
      colegio: 123,
      ejecutivo: 10,
      rol: "comercial",
      periodo: 5,
      prioridad: "alta",
      fecha_inicio: "2025-01-01",
      fecha_fin: "2025-12-31",
      is_current: true
    }
         ↓
    Actualizar is_current=false en otras asignaciones
         ↓
    Crear evento en colegio-event
```

**Content Type: `cartera-asignacion`**
```json
{
  "colegio": "relation → colegio",
  "ejecutivo": "relation → persona",
  "periodo": "relation → cartera-periodo",
  "rol": "enum: comercial | soporte1 | soporte2",
  "estado": "enum: activa | en_revision | cerrada",
  "prioridad": "enum: alta | media | baja",
  "fecha_inicio": "date",
  "fecha_fin": "date",
  "is_current": "boolean",
  "notas": "text"
}
```

---

### 4. Gestión de Actividades (Timeline)

**Agregar una Actividad:**

```
Usuario → /crm/colegios/123 → Pestaña "Actividades"
         ↓
    Click "Agregar actividad"
         ↓
    Modal [ActivityForm]
         ↓
    Seleccionar:
    - Tipo (llamada, email, reunión, nota, etc.)
    - Título
    - Descripción
    - Fecha
    - Estado (completada, pendiente, etc.)
         ↓
    POST /api/actividades (Strapi)
         ↓
    Crear registro en actividad:
    {
      tipo: "llamada",
      titulo: "Llamada de seguimiento",
      descripcion: "Cliente interesado en productos",
      fecha: "2025-01-07T10:00:00Z",
      estado: "completada",
      relacionado_con_colegio: 123,
      creado_por: colaborador_id
    }
         ↓
    O alternativamente, crear en colegio-event:
    {
      colegio: 123,
      action: "note",
      field: "actividad",
      value: "Llamada de seguimiento",
      actor_email: "usuario@moraleja.cl",
      actor_name: "Juan Pérez"
    }
```

---

### 5. Content Types del CRM

#### Lead (Contactos Potenciales)
```typescript
{
  nombre: "string (requerido)",
  email: "email",
  telefono: "string",
  empresa: "string",
  monto_estimado: "decimal",
  etiqueta: "enum: baja | media | alta",
  estado: "enum: in-progress | proposal-sent | follow-up | ...",
  fuente: "string",
  fecha_creacion: "date",
  asignado_a: "relation → colaborador",
  relacionado_con_persona: "relation → persona",
  relacionado_con_colegio: "relation → colegio"
}
```

#### Oportunidad (Oportunidades de Venta)
```typescript
{
  nombre: "string (requerido)",
  descripcion: "text",
  monto: "decimal",
  moneda: "enum: USD | CLP | EUR",
  etapa: "enum: Qualification | Proposal Sent | Negotiation | Won | Lost",
  estado: "enum: open | in-progress | closed",
  prioridad: "enum: low | medium | high",
  fecha_cierre: "date",
  contacto: "relation → persona",
  propietario: "relation → colaborador",
  producto: "relation → libro"
}
```

#### Deal (Negocios)
```typescript
{
  nombre: "string (requerido)",
  empresa: "string (requerido)",
  monto: "decimal",
  etapa: "enum: calificacion | propuesta-enviada | negociacion | ganado | perdido",
  probabilidad: "integer (0-100)",
  fecha_cierre: "date",
  relacionado_con_contacto: "relation → persona",
  relacionado_con_oportunidad: "relation → oportunidad",
  relacionado_con_colegio: "relation → colegio",
  asignado_a: "relation → colaborador"
}
```

#### Cotizacioncrm (Cotizaciones)
```typescript
{
  proyecto: "string (requerido)",
  cliente: "string",
  valor: "decimal",
  fecha_creacion: "datetime",
  fecha_cierre_esperada: "datetime",
  estado: "enum: en_revision | aprobada | pendiente | rechazada | enviada",
  notas: "text",
  contacto_relacionado: "relation → persona",
  oportunidad_relacionada: "relation → oportunidad",
  colegio_relacionado: "relation → colegio",
  cotizado_por_colaborador: "relation → colaborador"
}
```

#### Propuesta (Propuestas Comerciales)
```typescript
{
  asunto: "string (requerido)",
  enviado_a: "string",
  valor: "decimal",
  fecha_creacion: "datetime (auto-asignado)",
  fecha_vencimiento: "datetime",
  estado: "enum: aprobada | pendiente | rechazada | enviada | en_revision",
  notas: "text",
  relacionado_con_contacto: "relation → persona",
  relacionado_con_oportunidad: "relation → oportunidad",
  relacionado_con_colegio: "relation → colegio",
  creado_por: "relation → colaborador"
}
```

#### Actividad (Actividades CRM)
```typescript
{
  tipo: "enum: llamada | email | reunion | nota | cambio_estado | tarea | recordatorio | otro",
  titulo: "string (requerido)",
  descripcion: "text",
  fecha: "datetime (requerido)",
  estado: "enum: completada | pendiente | cancelada | en_progreso",
  notas: "text",
  relacionado_con_contacto: "relation → persona",
  relacionado_con_lead: "relation → lead",
  relacionado_con_oportunidad: "relation → oportunidad",
  relacionado_con_colegio: "relation → colegio",
  creado_por: "relation → colaborador"
}
```

---

## 🔗 Relaciones entre Content Types

```
┌─────────────┐
│   Colegio   │
└──────┬──────┘
       │
       ├──→ cartera_asignaciones → Persona (ejecutivo)
       ├──→ persona_trayectorias → Persona (profesores)
       ├──→ colegio-event (bitácora)
       │
       └──→ Lead, Oportunidad, Deal, Cotizacioncrm, Propuesta, Actividad

┌─────────────┐
│   Persona   │
└──────┬──────┘
       │
       ├──→ cartera_asignaciones (como ejecutivo)
       ├──→ trayectorias (vinculada a colegios)
       │
       └──→ Lead, Oportunidad, Deal, Cotizacioncrm, Propuesta, Actividad

┌─────────────┐
│ Colaborador │
└──────┬──────┘
       │
       └──→ Lead (asignado_a)
            Oportunidad (propietario)
            Deal (asignado_a)
            Cotizacioncrm (cotizado_por_colaborador)
            Propuesta (creado_por)
            Actividad (creado_por)
```

---

## 📍 Rutas del CRM

### Frontend (Next.js)

```
/crm/colegios
├── GET  → Listado de colegios
├── /crm/colegios/[id]
│   └── GET  → Ficha detalle de colegio
└── /crm/colegios/nuevo
    └── POST → Crear nuevo colegio (pendiente)

/crm/personas
├── GET  → Listado de personas
├── /crm/personas/[id]
│   └── GET  → Ficha detalle de persona
└── /crm/personas/nuevo
    └── POST → Crear nueva persona (pendiente)

/crm/cartera (pendiente)
└── GET  → Listado de asignaciones

/crm/actividades (pendiente)
└── GET  → Timeline unificado
```

### API Proxy Routes (Next.js)

```
/api/crm/colegios
├── GET  → Proxy a /api/colegios (Strapi)
└── /api/crm/colegios/[id]
    └── GET  → Proxy a /api/colegios/[id] (Strapi)

/api/crm/personas
├── GET  → Proxy a /api/personas (Strapi)
└── /api/crm/personas/[id]
    └── GET  → Proxy a /api/personas/[id] (Strapi)
```

### Strapi APIs

```
/api/colegios
├── GET      → Listado (con filtros, paginación, populate)
├── GET /:id → Detalle completo
├── POST     → Crear colegio
└── PUT /:id → Actualizar colegio

/api/personas
├── GET      → Listado
├── GET /:id → Detalle
├── POST     → Crear persona
└── PUT /:id → Actualizar persona

/api/cartera-asignaciones
├── GET      → Listado de asignaciones
├── POST     → Crear asignación
└── PUT /:id → Actualizar asignación

/api/actividades
├── GET      → Listado de actividades
└── POST     → Crear actividad

/api/leads
/api/oportunidades
/api/deals
/api/cotizacionescrm
/api/propuestas
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Obtener colegios con ejecutivo asignado

```javascript
// Frontend (Next.js)
const response = await fetch('/api/crm/colegios?populate[0]=cartera_asignaciones.ejecutivo')
const { data } = await response.json()

// Filtra solo asignaciones activas
data.forEach(colegio => {
  const asignacionActiva = colegio.cartera_asignaciones?.find(a => a.is_current)
  if (asignacionActiva) {
    console.log(`${colegio.colegio_nombre} → ${asignacionActiva.ejecutivo.nombre_completo}`)
  }
})
```

### Ejemplo 2: Crear una asignación

```javascript
// Frontend
const response = await fetch('http://localhost:1337/api/cartera-asignaciones', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    data: {
      colegio: 123,
      ejecutivo: 10,
      periodo: 5,
      rol: 'comercial',
      prioridad: 'alta',
      fecha_inicio: '2025-01-01',
      fecha_fin: '2025-12-31',
      is_current: true
    }
  })
})
```

### Ejemplo 3: Agregar actividad a un colegio

```javascript
// Frontend
const response = await fetch('http://localhost:1337/api/actividades', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    data: {
      tipo: 'llamada',
      titulo: 'Llamada de seguimiento',
      descripcion: 'Cliente interesado en nuevos productos',
      fecha: new Date().toISOString(),
      estado: 'completada',
      relacionado_con_colegio: 123,
      creado_por: colaboradorId
    }
  })
})
```

---

## ✅ Estado Actual

### Completado ✅
- [x] Estructura base del CRM
- [x] Rutas `/crm/colegios` y `/crm/personas`
- [x] Componentes de listado (ColegiosList, PersonasList)
- [x] Componentes de ficha (ColegioDetail, PersonaDetail)
- [x] Pestaña "Información General" en fichas
- [x] API proxy routes en Next.js
- [x] Content types del CRM (Lead, Oportunidad, Deal, Cotizacioncrm, Propuesta, Actividad)

### En Progreso 🚧
- [ ] Pestaña "Asignaciones" en ColegioDetail
- [ ] Pestaña "Profesores" en ColegioDetail
- [ ] Pestaña "Actividades" en ColegioDetail
- [ ] Pestaña "Notas" en ColegioDetail

### Pendiente 📋
- [ ] Formulario crear/editar asignación
- [ ] Timeline de actividades
- [ ] Filtros avanzados en listados
- [ ] Búsqueda global
- [ ] Crear/editar colegios y personas desde CRM
- [ ] Widgets en dashboard
- [ ] Exportación a CSV/Excel

---

## 🎯 Casos de Uso Comunes

### 1. Ver qué colegios tiene asignados un ejecutivo

```javascript
// Query Strapi
GET /api/cartera-asignaciones?
  filters[ejecutivo][id][$eq]=123&
  filters[is_current][$eq]=true&
  populate[colegio]=true

// Resultado
{
  data: [
    {
      id: 1,
      colegio: { id: 456, colegio_nombre: "Colegio A" },
      rol: "comercial",
      is_current: true
    },
    {
      id: 2,
      colegio: { id: 789, colegio_nombre: "Colegio B" },
      rol: "comercial",
      is_current: true
    }
  ]
}
```

### 2. Ver actividades de un colegio

```javascript
GET /api/actividades?
  filters[relacionado_con_colegio][id][$eq]=123&
  sort[0]=fecha:desc&
  pagination[limit]=50
```

### 3. Ver profesores de un colegio

```javascript
GET /api/colegios/123?
  populate[persona_trayectorias][populate][persona]=true&
  populate[persona_trayectorias][populate][curso]=true&
  populate[persona_trayectorias][populate][asignatura]=true
```

---

## 🔐 Permisos y Autenticación

- Todas las rutas del CRM requieren autenticación
- Se usa el mismo sistema de autenticación de la intranet
- Los permisos se verifican en las API proxy routes usando el token de Strapi
- Variables de entorno necesarias:
  ```env
  STRAPI_URL=http://localhost:1337
  STRAPI_API_TOKEN=tu_token_aqui
  ```

---

**Última actualización:** 7 de enero de 2026
