# Portal de Cuenta Moraleja · Sesión de usuario

Objetivo: Definir la experiencia completa cuando un usuario inicia sesión en `moraleja.cl` y accede a su perfil. Aplica a responsables de colegios, docentes, apoderados y estudiantes con licencias digitales.

---

## 1. Perfiles y necesidades principales

| Perfil | Acceso | Información clave |
|--------|--------|-------------------|
| **Administrador de colegio** | Gestión de pedidos y licencias de toda la institución | Historial de compras, envíos, facturas, licencias activas por curso, documentos contractuales, soporte prioritario |
| **Docente/tutor** | Acceso a materiales y seguimiento de cursos asignados | Licencias personales, recursos descargables, planificación, alumnos asignados, capacitaciones |
| **Apoderado** | Compras personales, seguimiento de pedidos y facturación | Pedidos, estado de entrega, boletas/facturas, licencias del estudiante, notificaciones |
| **Estudiante** | Licencias digitales y materiales complementarios | Acceso a textos digitales, Mira (cuando corresponda), recordatorios de tareas, documentación |

---

## 2. Flujo de autenticación

1. **Ingreso** desde cualquier CTA de “Iniciar sesión”.  
2. **SSO centralizado** (Auth0 / Keycloak / propio) con: email corporativo, Google Workspace o credenciales Moraleja.  
3. **Autorización por rol**: tras login, la API de usuarios devuelve rol(es) y contexto (colegio asociado, cursos, pedidos).  
4. **Selección de perfil** (si aplica): un usuario puede tener rol colegio + docente; se presenta selector inicial.  
5. **Redirección** al dashboard (`/cuenta`), personalizando widgets según rol.

---

## 3. Estructura del dashboard (landing de la sesión)

```
┌───────────────────────────────────────────────────────────────┐
│ Header sesión: logo, saludo, rol activo, botón cambiar perfil │
├───────────────────────────────────────────────────────────────┤
│ Columna principal (2/3)        │ Columna lateral (1/3)        │
│ • Tarjeta Resumen general      │ • Ticket rápido / Soporte    │
│ • Pedidos recientes            │ • Próximas capacitaciones    │
│ • Licencias activas (overview) │ • Documentos destacados      │
│ • Actividad reciente           │ • Notificaciones/alerts      │
└───────────────────────────────────────────────────────────────┘
```

### 3.1 Tarjeta “Resumen”
- Nombre del usuario + rol + colegio.  
- Indicadores principales según rol:
  - Colegio: pedidos abiertos, licencias por vencer, capacitaciones pendientes.
  - Docente: cursos asignados, licencias activas personales, próximos workshops.
  - Apoderado: pedidos en tránsito, hijo asociado.
  - Estudiante: licencias vigentes, nuevas actividades (si aplica).

### 3.2 Pedidos recientes
- Lista de los últimos 3-5 pedidos con estado (`Procesando`, `Enviado`, `Entregado`, `Incidencia`).  
- CTA “Ver todos los pedidos” (`/cuenta/pedidos`).  
- Cada pedido muestra: número, fecha, monto, tracking, descarga de documento tributario.

### 3.3 Licencias activas
- Tarjetas por producto (PAES, Plan Lector, Faro Lector, Mira).  
- Datos: cantidad asignada/asignar, fecha de expiración, CTA “Gestionar licencias”.  
- Para docentes/estudiantes: botón “Entrar al recurso”.

### 3.4 Actividad reciente
- Timeline de acciones: pedidos actualizados, licencias activadas, nuevos documentos publicados, tickets respondidos.

### 3.5 Soporte rápido (lateral)
- Botón “Crear ticket” → formulario `/cuenta/soporte`.  
- Estado de tickets abiertos (últimos 3).  
- Enlaces a artículos recomendados (`help-articles`) según rol.

### 3.6 Documentos destacados
- Contratos, convenios, planificaciones descargables (expuestos via Strapi).  
- Mostrar último publicado + CTA “Ver biblioteca”.

### 3.7 Calendario/capacitaciones
- Próximos workshops, webinars o visitas programadas (API intranet).  
- CTA “Ver agenda” o “Agendar capacitación”.

### 3.8 Notificaciones
- Alertas importantes: facturas vencidas, licencias por expirar, actualizaciones de productos.

---

## 4. Secciones detalladas

### 4.1 Pedidos (`/cuenta/pedidos`)
- Filtro por estado, rango de fechas, tipo (editorial / librería).  
- Tabla con columnas: número, fecha, monto, estado, tracking, documento (descargas PDF).  
- Acceso rápido a soporte por pedido (“Reportar incidencia”).

### 4.2 Detalle de pedido (`/cuenta/pedidos/[id]`)
- Estado visual (timeline: recibido → en preparación → despachado → entregado).  
- Artículos incluidos (sku, título, cantidad).  
- Direcciones asociadas (envío/facturación) editable según permisos.  
- Observaciones del equipo logística.  
- Factura/boleta descargable (link a SII o PDF).

### 4.3 Licencias (`/cuenta/licencias`)
- Módulo por producto:
  - Total licencias contratadas.
  - Licencias activas / pendientes.
  - Expiración y renovaciones.  
- CTA “Descargar listado” (CSV) y “Asignar licencias” (vista con cursos/usuarios).  
- Para docentes/estudiantes: lista de accesos directos (ej. `Entrar a PAES digital`).

### 4.4 Biblioteca / Documentos (`/cuenta/documentos`)
- Repositorio filtrable por tipo (contratos, planificaciones, manuales, recibos).  
- Agrupar por ciclo (básica, media) y producto.  
- Búsqueda textual (integración Algolia).

### 4.5 Datos del colegio (`/cuenta/colegio`)
- Información institucional: RBD, dirección, responsable comercial, plan contratado.  
- Contactos clave (asesor editorial, ejecutivo comercial).  
- Historial de capacitaciones pasadas y futuras.

### 4.6 Perfil usuario (`/cuenta/perfil`)
- Datos personales: nombre, correo, teléfono (editable según rol).  
- Preferencias: idioma, notificaciones por email, canales preferidos.  
- Conexiones: vínculos a Google Workspace, intranet, etc.  
- Cambios de contraseña cuando no se usa SSO.

### 4.7 Soporte (`/cuenta/soporte`)
- Formularios personalizados:
  - Incidencia logística
  - Consultas editoriales
  - Cambio de licencias
  - Asistencia técnica  
- Listado de tickets abiertos/cerrados con estado y fecha de próxima actualización.  
- Integración backend: Zendesk/Freshdesk propio o Strapi + workflow-service.

---

## 5. Datos & APIs necesarias

| Módulo | Fuente de datos | Notas |
|--------|-----------------|-------|
| Pedidos, direcciones, facturas | WooCommerce/Kista + ERP | Endpoint para historial y tracking, con cache |
| Licencias | Servicio `commerce-service` + Strapi (metadatos) | Lógica de asignación y expiración |
| Documentos | Strapi (`help-documents`, `contracts`) | Control de permisos por rol/colegio |
| Noticias / Help center | Strapi (`news`, `help-articles`) | Reutiliza endpoints existentes |
| Capacitaciones | Intranet Moraleja (API `events`) | Pueden sincronizar con Google Calendar |
| Tickets soporte | Helpdesk (Zendesk / Strapi) | Necesario webhook para actualizaciones estado |
| Notificaciones | Event bus (BullMQ / RabbitMQ) + Strapi | Persiste alertas importantes |
| Perfil usuario | Auth service (Auth0/Keycloak) + Strapi | Traer roles, metadata colegio |

---

## 6. Experiencia móvil

- Dashboard responsive con tarjetas apiladas.  
- Menú inferior fijo (Pedidos, Licencias, Documentos, Soporte, Perfil).  
- Buscador global accesible en la parte superior.

---

## 7. Seguridad y permisos

- Autenticación JWT/SSO con refresh token.
- Autorización granular:
  - Colegio admin puede ver todo del colegio.
  - Docente solo cursos y licencias asignadas.
  - Apoderado solo pedidos propios y licencias de su(s) estudiante(s).
  - Estudiante acceso restringido a licencias propias y materiales.
- Auditoría: log de cambios en datos sensibles (direcciones, asignaciones).
- Opción de 2FA para admins/colegios.

---

## 8. Métricas y analítica

- Uso del portal (usuarios activos, módulos más visitados).  
- Tiempos de respuesta de pedidos (desde compra a entrega).  
- Feedback NPS integrado (tiny prompt en dashboard).  
- Tracking de licencias expiradas/renovadas.  
- Integración con Mixpanel/GA4 + Data Warehouse.

---

## 9. Roadmap sugerido

1. **MVP (Q1)**  
   - Dashboard + pedidos + licencias + soporte básico.  
   - Integración WooCommerce + Strapi (lectura).  
   - Autenticación unificada.

2. **Q2**  
   - Biblioteca de documentos, capacitaciones, notificaciones.  
   - Gestión de licencias (asignación desde portal).  
   - Feedback/helpful votes sobre artículos.

3. **Q3**  
   - Automations (renovaciones, recordatorios).  
   - Integración con Mira (cuando esté disponible).  
   - Panel analítico para colegios (resumen de uso).

4. **Q4**  
   - Configuración avanzada de permisos por usuarios.  
   - Single invoice / pagos en línea (si se habilita).  
   - App móvil o PWA dedicada (si se valida).

---

Con esta estructura, el portal de cuenta se convierte en un hub centralizado donde cada stakeholder de Moraleja gestiona su relación con la editorial: pedidos, licencias, recursos, soporte y comunicación en un solo lugar.
