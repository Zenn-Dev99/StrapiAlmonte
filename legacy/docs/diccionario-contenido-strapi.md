# Diccionario de contenido Strapi

Este documento resume los content-types y componentes disponibles, con ejemplos de valores y restricciones clave.

## Content Types

### Colegio (`api::colegio.colegio`)
- Tipo: Collection Type
- Tabla: colegios
- Draft & Publish: Sí
- Singular API: colegio
- Plural API: colegios

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| rbd | integer | Sí | Sí |  | 123 |
| colegio_nombre | string | Sí |  |  | Nombre de Ejemplo |
| estado_nombre | component (lista · Verificación Nombre) |  |  | Componente: Verificación Nombre · Repetible | Completar Verificación Nombre |
| rbd_digito_verificador | string |  |  |  | Texto de ejemplo |
| dependencia | enumeration |  |  | Valores: Corporación de Administración Delegada, Municipal, Particular Subvencionado, Particular Pagado, Servicio Local de Educación | Corporación de Administración Delegada |
| ruralidad | enumeration |  |  | Valores: Urbano, Rural | Urbano |
| estado_estab | enumeration |  |  | Valores: Funcionando, En receso, Cerrado, Autorizado sin matrícula | Funcionando |
| region | relation (manyToOne → Ubicación. Region) |  |  | Target: Ubicación. Region · Relación manyToOne · inversedBy: colegios | Relacionar Ubicación. Region |
| provincia | relation (manyToOne → Ubicación. Provincia) |  |  | Target: Ubicación. Provincia · Relación manyToOne · inversedBy: colegios | Relacionar Ubicación. Provincia |
| zona | relation (manyToOne → Ubicación. Zona) |  |  | Target: Ubicación. Zona · Relación manyToOne · inversedBy: colegios | Relacionar Ubicación. Zona |
| comuna | relation (manyToOne → Ubicación. Comuna) |  |  | Target: Ubicación. Comuna · Relación manyToOne · inversedBy: colegios | Relacionar Ubicación. Comuna |
| cartera_asignaciones | relation (oneToMany → Intranet · Cartera Asignación) |  |  | Target: Intranet · Cartera Asignación · Relación oneToMany · mappedBy: colegio | Relacionar varios Intranet · Cartera Asignación |
| telefonos | component (lista · Teléfono) |  |  | Componente: Teléfono · Repetible | Completar Teléfono |
| emails | component (lista · Email) |  |  | Componente: Email · Repetible | Completar Email |
| direcciones | component (lista · Dirección) |  |  | Componente: Dirección · Repetible | Completar Dirección |
| Website | component (lista · Website) |  |  | Componente: Website · Repetible | Completar Website |
| logo | component (Logo o Avatar) |  |  | Componente: Logo o Avatar | Completar Logo o Avatar |
| sostenedor | relation (manyToOne → Colegio · Sostenedor) |  |  | Target: Colegio · Sostenedor · Relación manyToOne · inversedBy: colegios | Relacionar Colegio · Sostenedor |
| listas_utiles | relation (oneToMany → Listas · Colegio) |  |  | Target: Listas · Colegio · Relación oneToMany · mappedBy: colegio | Relacionar varios Listas · Colegio |

### Colegio · Asignatura (`api::asignatura.asignatura`)
- Tipo: Collection Type
- Tabla: asignaturas
- Draft & Publish: No
- Singular API: asignatura
- Plural API: asignaturas

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre | string | Sí | Sí |  | Nombre de Ejemplo |
| slug | uid |  |  |  | slug-unica |
| cod_subsector | integer | Sí | Sí |  | 123 |
| area_subsector | string |  |  |  | Texto de ejemplo |
| area_general | string |  |  |  | Texto de ejemplo |
| nota | text |  |  |  | Descripción larga de ejemplo. |
| hola | dynamiczone (shared.seo, shared.media, inventory.libreria, inventory.editorial) |  |  | Componentes permitidos: shared.seo, shared.media, inventory.libreria, inventory.editorial | Seleccionar bloques válidos |

### Colegio · Campañas (`api::colegio-campana.colegio-campana`)
- Tipo: Collection Type
- Tabla: colegio_campanas
- Draft & Publish: Sí
- Singular API: colegio-campana
- Plural API: colegio-campanas
- Descripción: Contenido de landing pages de campañas por colegio

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| periodo | string | Sí |  |  | Texto de ejemplo |
| title | string | Sí |  |  | Texto de ejemplo |
| slug | uid | Sí |  |  | slug-unica |
| tagline | text |  |  |  | Descripción larga de ejemplo. |
| updatedAt_manual | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| notes | component (lista · Note) |  |  | Componente: Note · Repetible | Completar Note |
| colegio | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne | Relacionar Colegio |
| ejecutivo | relation (manyToOne → Persona) |  |  | Target: Persona · Relación manyToOne | Relacionar Persona |
| hero | component (Hero) |  |  | Componente: Hero | Completar Hero |
| highlights | component (lista · Highlight) |  |  | Componente: Highlight · Repetible | Completar Highlight |
| modules | component (lista · Module) |  |  | Componente: Module · Repetible | Completar Module |
| timeline | component (lista · Timeline step) |  |  | Componente: Timeline step · Repetible | Completar Timeline step |
| resources | component (lista · Resource) |  |  | Componente: Resource · Repetible | Completar Resource |
| support | component (Support) |  |  | Componente: Support | Completar Support |

### Colegio · Curso (`api::curso.curso`)
- Tipo: Collection Type
- Tabla: cursos
- Draft & Publish: No
- Singular API: curso
- Plural API: cursos

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| colegio | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne | Relacionar Colegio |
| nivel_ref | relation (manyToOne → Colegio · Nivel) |  |  | Target: Colegio · Nivel · Relación manyToOne | Relacionar Colegio · Nivel |
| titulo | string |  |  |  | Texto de ejemplo |
| letra | string |  |  |  | Texto de ejemplo |
| anio | integer |  |  |  | 123 |
| curso_letra_anio | string |  |  |  | Texto de ejemplo |
| matricula | integer |  |  |  | 123 |
| nota | text |  |  |  | Descripción larga de ejemplo. |

### Colegio · Curso Asignatura (`api::curso-asignatura.curso-asignatura`)
- Tipo: Collection Type
- Tabla: curso_asignaturas
- Draft & Publish: No
- Singular API: curso-asignatura
- Plural API: curso-asignaturas
- Descripción: Oferta de una asignatura en un curso y año, con matrícula

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| curso | relation (manyToOne → Colegio · Curso) |  |  | Target: Colegio · Curso · Relación manyToOne | Relacionar Colegio · Curso |
| asignatura | relation (manyToOne → Colegio · Asignatura) |  |  | Target: Colegio · Asignatura · Relación manyToOne | Relacionar Colegio · Asignatura |
| anio | integer |  |  |  | 123 |
| letra | string |  |  |  | Texto de ejemplo |
| curso_letra_anio | string |  |  |  | Texto de ejemplo |
| grupo | string |  |  |  | Texto de ejemplo |
| matricula | integer |  |  |  | 123 |
| nota | text |  |  |  | Descripción larga de ejemplo. |
| uniq_key | string |  | Sí |  | Texto de ejemplo |

### Colegio · Event (`api::colegio-event.colegio-event`)
- Tipo: Collection Type
- Tabla: colegio_events
- Draft & Publish: No
- Singular API: colegio-event
- Plural API: colegio-events
- Descripción: Bitácora de acciones y cambios en un colegio

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| colegio | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne | Relacionar Colegio |
| action | enumeration | Sí |  | Valores: create, edit, verify, approve, reject, note · Default: edit | create |
| field | string |  |  |  | Texto de ejemplo |
| value | text |  |  |  | Descripción larga de ejemplo. |
| actor_email | email |  |  |  | contacto@ejemplo.cl |
| actor_name | string |  |  |  | Texto de ejemplo |
| meta | json |  |  |  | { "clave": "valor" } |

### Colegio · Nivel (`api::nivel.nivel`)
- Tipo: Collection Type
- Tabla: niveles
- Draft & Publish: No
- Singular API: nivel
- Plural API: niveles
- Descripción: Catálogo de niveles educativos

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre | string | Sí |  |  | Nombre de Ejemplo |
| clave | string | Sí | Sí |  | Texto de ejemplo |
| orden | integer |  |  |  | 123 |
| ensenanza | enumeration |  |  | Valores: Parvularia, Básica, Media | Parvularia |
| ciclo | string |  |  |  | Texto de ejemplo |

### Colegio · Profesores (`api::persona-trayectoria.persona-trayectoria`)
- Tipo: Collection Type
- Tabla: persona_trayectorias
- Draft & Publish: Sí
- Singular API: persona-trayectoria
- Plural API: persona-trayectorias
- Descripción: Historial de cargos por colegio/curso/asignatura

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| persona | relation (manyToOne → Persona) |  |  | Target: Persona · Relación manyToOne | Relacionar Persona |
| colegio | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne | Relacionar Colegio |
| curso | relation (manyToOne → Colegio · Curso) |  |  | Target: Colegio · Curso · Relación manyToOne | Relacionar Colegio · Curso |
| asignatura | relation (manyToOne → Colegio · Asignatura) |  |  | Target: Colegio · Asignatura · Relación manyToOne | Relacionar Colegio · Asignatura |
| curso_asignatura | relation (manyToOne → Colegio · Curso Asignatura) |  |  | Target: Colegio · Curso Asignatura · Relación manyToOne | Relacionar Colegio · Curso Asignatura |
| cargo | string |  |  |  | Texto de ejemplo |
| anio | integer |  |  |  | 123 |
| fecha_inicio | date |  |  |  | 2024-03-15 |
| fecha_fin | date |  |  |  | 2024-03-15 |
| notas | text |  |  |  | Descripción larga de ejemplo. |
| org_display_name | string |  |  |  | Texto de ejemplo |
| role_key | string |  |  |  | Texto de ejemplo |
| department | string |  |  |  | Texto de ejemplo |
| is_current | boolean |  |  | Default: false | false |

### Colegio · Sostenedor (`api::colegio-sostenedor.colegio-sostenedor`)
- Tipo: Collection Type
- Tabla: colegio_sostenedores
- Draft & Publish: Sí
- Singular API: colegio-sostenedor
- Plural API: colegio-sostenedores
- Descripción: Registro de sostenedores de colegios

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| rut_sostenedor | biginteger | Sí | Sí |  | 123 |
| dv_rut | string | Sí |  |  | Texto de ejemplo |
| rut_completo | string | Sí | Sí |  | Texto de ejemplo |
| razon_social | string | Sí |  |  | Texto de ejemplo |
| nombre_fantasia | string |  |  |  | Nombre de Ejemplo |
| giro | string |  |  |  | Texto de ejemplo |
| tipo_sostenedor | enumeration |  |  | Valores: Municipalidad, Corporación Municipal, Servicio Local de Educación, SLEP, Particular, Corporación, Fundación, Otro | Municipalidad |
| direccion | component (Dirección) |  |  | Componente: Dirección | Completar Dirección |
| contacto | relation (oneToOne → Persona) |  |  | Target: Persona · Relación oneToOne | Relacionar Persona |
| telefonos | component (lista · Teléfono) |  |  | Componente: Teléfono · Repetible | Completar Teléfono |
| emails | component (lista · Email) |  |  | Componente: Email · Repetible | Completar Email |
| colegios | relation (oneToMany → Colegio) |  |  | Target: Colegio · Relación oneToMany · mappedBy: sostenedor | Relacionar varios Colegio |

### Datos Facturación (`api::datos-facturacion.datos-facturacion`)
- Tipo: Collection Type
- Tabla: datos_facturacions
- Draft & Publish: Sí
- Singular API: datos-facturacion
- Plural API: datos-facturacions

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| rut | string |  | Sí |  | Texto de ejemplo |
| nombre_facturacion | string |  |  |  | Nombre de Ejemplo |
| direccion | component (Dirección) |  |  | Componente: Dirección | Completar Dirección |
| giro | string |  |  |  | Texto de ejemplo |
| tipo_empresa | enumeration |  |  | Valores: Empresa, Colegio, Librería, Editorial, Otro | Empresa |
| rbd | integer |  |  |  | 123 |
| nombre_colegio | string |  |  |  | Nombre de Ejemplo |
| comuna_colegio | string |  |  |  | Texto de ejemplo |
| dependencia | string |  |  |  | Texto de ejemplo |
| colegio | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne | Relacionar Colegio |

### Destacados Home (`api::home-product-highlight.home-product-highlight`)
- Tipo: Collection Type
- Tabla: home_product_highlights
- Draft & Publish: Sí
- Singular API: home-product-highlight
- Plural API: home-product-highlights
- Descripción: Tarjetas destacadas para la portada de la intranet

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string | Sí |  |  | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| description | text |  |  |  | Descripción larga de ejemplo. |
| badge | string |  |  |  | Texto de ejemplo |
| cta_url | string |  |  |  | Texto de ejemplo |
| libro | relation (manyToOne → Product · Libro · Edición) |  |  | Target: Product · Libro · Edición · Relación manyToOne | Relacionar Product · Libro · Edición |

### Documentos · Cotización (`api::cotizaciones.cotizacion`)
- Tipo: Collection Type
- Tabla: cotizaciones
- Draft & Publish: Sí
- Singular API: cotizacion
- Plural API: cotizaciones
- Descripción: Cotizaciones comerciales generadas en intranet

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| numero | uid | Sí |  |  | slug-unica |
| anio | integer | Sí |  |  | 123 |
| fecha | date |  |  |  | 2024-03-15 |
| fecha_vencimiento | date |  |  |  | 2024-03-15 |
| estado | enumeration |  |  | Valores: borrador, enviada, aceptada, rechazada · Default: borrador | borrador |
| subtotal | decimal |  |  |  | 123.45 |
| total | decimal |  |  |  | 123.45 |
| descuento_total | decimal |  |  |  | 123.45 |
| condiciones | richtext |  |  |  | Contenido enriquecido |
| observaciones | richtext |  |  |  | Contenido enriquecido |
| beneficios | component (lista · Beneficio) |  |  | Componente: Beneficio · Repetible | Completar Beneficio |
| metadata | json |  |  |  | { "clave": "valor" } |
| cliente | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne | Relacionar Colegio |
| contacto | relation (manyToOne → Persona) |  |  | Target: Persona · Relación manyToOne | Relacionar Persona |
| ejecutiva | relation (manyToOne → plugin::users-permissions.user) |  |  | Target: plugin::users-permissions.user · Relación manyToOne | Relacionar plugin::users-permissions.user |
| lista_descuento | relation (manyToOne → Documentos · Lista de descuento) |  |  | Target: Documentos · Lista de descuento · Relación manyToOne | Relacionar Documentos · Lista de descuento |
| items | component (lista · Item) |  |  | Componente: Item · Repetible | Completar Item |
| pdf_url | media (simple) |  |  | Un solo archivo · Tipos permitidos: files | Archivo multimedia (imagen/pdf) |

### Documentos · Lista de descuento (`api::lista-descuento.lista-descuento`)
- Tipo: Collection Type
- Tabla: lista_descuentos
- Draft & Publish: Sí
- Singular API: lista-descuento
- Plural API: lista-descuentos
- Descripción: Listas de descuento aplicables a cotizaciones

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre | string | Sí |  |  | Nombre de Ejemplo |
| descripcion | text |  |  |  | Descripción larga de ejemplo. |
| vigencia_inicio | date |  |  |  | 2024-03-15 |
| vigencia_fin | date |  |  |  | 2024-03-15 |
| descuento_base | decimal |  |  |  | 123.45 |
| items | component (lista · Regla de descuento) |  |  | Componente: Regla de descuento · Repetible | Completar Regla de descuento |
| ejecutivas_autorizadas | relation (manyToMany → plugin::users-permissions.user) |  |  | Target: plugin::users-permissions.user · Relación manyToMany | Relacionar varios plugin::users-permissions.user |

### Email · Log (`api::email-log.email-log`)
- Tipo: Collection Type
- Tabla: email_logs
- Draft & Publish: No
- Singular API: email-log
- Plural API: email-logs
- Descripción: Historial de envíos de correos automatizados

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| template | relation (manyToOne → Email · Template) |  |  | Target: Email · Template · Relación manyToOne · inversedBy: logs | Relacionar Email · Template |
| template_key | string | Sí |  |  | Texto de ejemplo |
| status | enumeration |  |  | Valores: pending, sent, failed · Default: pending | pending |
| subject | string |  |  |  | Asunto de ejemplo |
| from_address | string |  |  |  | Texto de ejemplo |
| to | json | Sí |  |  | { "clave": "valor" } |
| to_primary | string |  |  |  | Texto de ejemplo |
| cc | json |  |  |  | { "clave": "valor" } |
| bcc | json |  |  |  | { "clave": "valor" } |
| reply_to | string |  |  |  | Texto de ejemplo |
| payload | json |  |  |  | { "clave": "valor" } |
| attachments | json |  |  |  | { "clave": "valor" } |
| response | json |  |  |  | { "clave": "valor" } |
| campaign_id | string |  |  |  | Texto de ejemplo |
| error_message | text |  |  |  | Descripción larga de ejemplo. |
| sent_at | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| triggered_by | relation (manyToOne → plugin::users-permissions.user) |  |  | Target: plugin::users-permissions.user · Relación manyToOne | Relacionar plugin::users-permissions.user |

### Email · Template (`api::email-template.email-template`)
- Tipo: Collection Type
- Tabla: email_templates
- Draft & Publish: No
- Singular API: email-template
- Plural API: email-templates
- Descripción: Plantillas parametrizables para los envíos automáticos

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| key | uid | Sí |  |  | slug-unica |
| name | string | Sí |  |  | Texto de ejemplo |
| subject | string | Sí |  |  | Asunto de ejemplo |
| preheader | string |  |  |  | Texto de ejemplo |
| from_name | string |  |  |  | Texto de ejemplo |
| from_email | email |  |  |  | contacto@ejemplo.cl |
| reply_to | email |  |  |  | contacto@ejemplo.cl |
| cc | json |  |  |  | { "clave": "valor" } |
| bcc | json |  |  |  | { "clave": "valor" } |
| etapa | enumeration |  |  | Valores: Inicio, Curso, Cierre, Fin | Inicio |
| Ciclo | string |  |  |  | Texto de ejemplo |
| fecha_sugerida | date |  |  |  | 2024-03-15 |
| segmentos_asignaturas | json |  |  |  | { "clave": "valor" } |
| segmentos_niveles | json |  |  |  | { "clave": "valor" } |
| body_text | text |  |  |  | Descripción larga de ejemplo. |
| body_html | richtext |  |  |  | Contenido enriquecido |
| notes | text |  |  |  | Descripción larga de ejemplo. |
| estado | enumeration |  |  | Valores: Borrador, En revisión, Aprobado, Archivado · Default: Borrador | Borrador |
| aprobado_por | relation (manyToOne → plugin::users-permissions.user) |  |  | Target: plugin::users-permissions.user · Relación manyToOne | Relacionar plugin::users-permissions.user |
| aprobado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| autores | relation (manyToMany → plugin::users-permissions.user) |  |  | Target: plugin::users-permissions.user · Relación manyToMany | Relacionar varios plugin::users-permissions.user |
| meta | json |  |  |  | { "clave": "valor" } |
| logs | relation (oneToMany → Email · Log) |  |  | Target: Email · Log · Relación oneToMany · mappedBy: template | Relacionar varios Email · Log |

### Home · Hero (`api::home-hero.home-hero`)
- Tipo: Single Type
- Tabla: home_hero
- Draft & Publish: Sí
- Singular API: home-hero
- Plural API: home-heroes
- Descripción: Configuración de campañas y hero principal de la portada

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string | Sí |  | maxLength: 120 | Texto de ejemplo |
| subtitle | richtext | Sí |  |  | Contenido enriquecido |
| highlight | string |  |  | maxLength: 80 | Texto de ejemplo |
| campaign_tag | string |  |  | maxLength: 80 | Texto de ejemplo |
| primary_cta | component (ctaLink) | Sí |  | Componente: ctaLink | Completar ctaLink |
| secondary_cta | component (ctaLink) |  |  | Componente: ctaLink | Completar ctaLink |
| stats | component (lista · heroStat) | Sí |  | Componente: heroStat · Repetible · max: 4 · min: 1 | Completar heroStat |
| media | media (simple) |  |  | Un solo archivo · Tipos permitidos: images | Archivo multimedia (imagen/pdf) |
| video_url | string |  |  | maxLength: 2048 | Texto de ejemplo |
| background_style | enumeration | Sí |  | Valores: gradient, image, video · Default: gradient | gradient |
| active_from | datetime | Sí |  |  | 2024-03-15T10:30:00.000Z |
| active_until | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| is_default | boolean |  |  | Default: false | false |
| seo | component (Seo) |  |  | Componente: Seo | Completar Seo |
| structured_data | json |  |  |  | { "clave": "valor" } |

### Intranet · Cartera Asignación (`api::cartera-asignacion.cartera-asignacion`)
- Tipo: Collection Type
- Tabla: cartera_asignaciones
- Draft & Publish: Sí
- Singular API: cartera-asignacion
- Plural API: cartera-asignaciones
- Descripción: Asignación de colegio a ejecutivo comercial en un periodo

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| periodo | relation (manyToOne → Intranet · Cartera Periodo) |  |  | Target: Intranet · Cartera Periodo · Relación manyToOne · inversedBy: asignaciones | Relacionar Intranet · Cartera Periodo |
| colegio | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne · inversedBy: cartera_asignaciones | Relacionar Colegio |
| ejecutivo | relation (manyToOne → Persona) |  |  | Target: Persona · Relación manyToOne · inversedBy: cartera_asignaciones | Relacionar Persona |
| estado | enumeration |  |  | Valores: activa, en_revision, cerrada · Default: activa | activa |
| fecha_inicio | date |  |  |  | 2024-03-15 |
| fecha_fin | date |  |  |  | 2024-03-15 |
| is_current | boolean |  |  | Default: true | true |
| prioridad | enumeration |  |  | Valores: alta, media, baja | alta |
| rol | enumeration |  |  | Valores: comercial, soporte1, soporte2 | comercial |
| orden | integer |  |  |  | 123 |
| meta_ingresos | decimal |  |  |  | 123.45 |
| notas | text |  |  |  | Descripción larga de ejemplo. |

### Intranet · Cartera Periodo (`api::cartera-periodo.cartera-periodo`)
- Tipo: Collection Type
- Tabla: cartera_periodos
- Draft & Publish: Sí
- Singular API: cartera-periodo
- Plural API: cartera-periodos
- Descripción: Periodo o ciclo para la asignación comercial

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre | string | Sí |  |  | Nombre de Ejemplo |
| slug | uid |  |  |  | slug-unica |
| fecha_inicio | date |  |  |  | 2024-03-15 |
| fecha_fin | date |  |  |  | 2024-03-15 |
| estado | enumeration |  |  | Valores: borrador, vigente, cerrado · Default: borrador | borrador |
| notas | text |  |  |  | Descripción larga de ejemplo. |
| asignaciones | relation (oneToMany → Intranet · Cartera Asignación) |  |  | Target: Intranet · Cartera Asignación · Relación oneToMany · mappedBy: periodo | Relacionar varios Intranet · Cartera Asignación |

### Intranet · Colaboradores (`api::colaborador.colaborador`)
- Tipo: Collection Type
- Tabla: colaboradores
- Draft & Publish: Sí
- Singular API: colaborador
- Plural API: colaboradores
- Descripción: Usuarios internos que operan roles en la intranet

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| persona | relation (oneToOne → Persona) |  |  | Target: Persona · Relación oneToOne | Relacionar Persona |
| empresa | relation (manyToOne → Intranet · Empresa) |  |  | Target: Intranet · Empresa · Relación manyToOne · inversedBy: colaboradores | Relacionar Intranet · Empresa |
| email_login | email | Sí | Sí |  | contacto@ejemplo.cl |
| auth_provider | enumeration |  |  | Valores: google, strapi, otro · Default: google | google |
| rol_principal | enumeration |  |  | Valores: comercial, soporte, comprobaciones, otro | comercial |
| rol_operativo | enumeration |  |  | Valores: support_verify, support_approve, support_super, sales_exec, sales_manager · Default: support_verify | support_verify |
| perfiles_operativos | json |  |  | Default: [] | { "clave": "valor" } |
| metadata | json |  |  | Default: {} | { "clave": "valor" } |
| activo | boolean |  |  | Default: true | true |
| notas | text |  |  |  | Descripción larga de ejemplo. |
| identificadores_externos | json |  |  |  | { "clave": "valor" } |

### Intranet · Empresa (`api::empresa.empresa`)
- Tipo: Collection Type
- Tabla: empresas
- Draft & Publish: No
- Singular API: empresa
- Plural API: empresas

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre | string | Sí |  |  | Nombre de Ejemplo |
| nombre_corto | string |  |  |  | Nombre de Ejemplo |
| website | string |  |  |  | Texto de ejemplo |
| logo_principal | component (Media) |  |  | Componente: Media | Completar Media |
| logo_secundario | component (Media) |  |  | Componente: Media | Completar Media |
| favicon | component (Media) |  |  | Componente: Media | Completar Media |
| colaboradores | relation (oneToMany → Intranet · Colaboradores) |  |  | Target: Intranet · Colaboradores · Relación oneToMany · mappedBy: empresa | Relacionar varios Intranet · Colaboradores |
| colores | json |  |  | Default: {} | { "clave": "valor" } |
| slug | uid | Sí |  |  | slug-unica |

### Listas · Colegio (`api::colegio-list.colegio-list`)
- Tipo: Collection Type
- Tabla: colegio_lists
- Draft & Publish: No
- Singular API: colegio-list
- Plural API: colegio-lists
- Descripción: Cabecera de listas de útiles por colegio y año

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| slug | uid | Sí | Sí |  | slug-unica |
| anio | integer | Sí |  | min: 2000 | 123 |
| colegio | relation (manyToOne → Colegio) | Sí |  | Target: Colegio · Relación manyToOne · inversedBy: listas_utiles | Relacionar Colegio |
| descripcion_interna | text |  |  |  | Descripción larga de ejemplo. |
| estado_global | enumeration | Sí |  | Valores: sin_versiones, en_proceso, publicado · Default: sin_versiones | sin_versiones |
| version_actual | relation (oneToOne → Listas · Versión) |  |  | Target: Listas · Versión · Relación oneToOne | Relacionar Listas · Versión |
| versiones | relation (oneToMany → Listas · Versión) |  |  | Target: Listas · Versión · Relación oneToMany · mappedBy: colegio_list | Relacionar varios Listas · Versión |

### Listas · Documento (`api::colegio-list-document.colegio-list-document`)
- Tipo: Collection Type
- Tabla: colegio_list_documents
- Draft & Publish: No
- Singular API: colegio-list-document
- Plural API: colegio-list-documents
- Descripción: Documentos fuente (PDF) utilizados para indexar listas de útiles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre_archivo | string | Sí |  |  | Nombre de Ejemplo |
| archivo_pdf | media (simple) |  |  | Un solo archivo · Tipos permitidos: files | Archivo multimedia (imagen/pdf) |
| curso_detectado | string |  |  |  | Texto de ejemplo |
| curso_normalizado | string |  |  |  | Texto de ejemplo |
| pagina_inicio | integer |  |  | min: 1 | 123 |
| pagina_fin | integer |  |  | min: 1 | 123 |
| pdf_hash | string |  |  | maxLength: 191 | Texto de ejemplo |
| estado_procesamiento | enumeration | Sí |  | Valores: pendiente, procesando, completado, error · Default: pendiente | pendiente |
| procesamiento_log | json |  |  |  | { "clave": "valor" } |
| orden | integer |  |  |  | 123 |
| version | relation (manyToOne → Listas · Versión) | Sí |  | Target: Listas · Versión · Relación manyToOne · inversedBy: documentos | Relacionar Listas · Versión |
| items | relation (oneToMany → Listas · Item) |  |  | Target: Listas · Item · Relación oneToMany · mappedBy: documento | Relacionar varios Listas · Item |
| notas | relation (oneToMany → Listas · Nota) |  |  | Target: Listas · Nota · Relación oneToMany · mappedBy: documento | Relacionar varios Listas · Nota |

### Listas · Item (`api::colegio-list-item.colegio-list-item`)
- Tipo: Collection Type
- Tabla: colegio_list_items
- Draft & Publish: No
- Singular API: colegio-list-item
- Plural API: colegio-list-items
- Descripción: Ítems individuales presentes en versiones de listas de útiles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre_detectado | string | Sí |  |  | Nombre de Ejemplo |
| nombre_normalizado | string |  |  |  | Nombre de Ejemplo |
| cantidad | decimal |  |  |  | 123.45 |
| unidad | enumeration |  |  | Valores: unidad, paquete, caja, litro, kilo, cuaderno, libro, otro | unidad |
| instrucciones | text |  |  |  | Descripción larga de ejemplo. |
| asignatura | string |  |  |  | Texto de ejemplo |
| categoria_texto | string |  |  |  | Texto de ejemplo |
| omit_purchase | boolean |  |  | Default: false | false |
| prioridad_revision | enumeration |  |  | Valores: normal, alta · Default: normal | normal |
| validacion_estado | enumeration | Sí |  | Valores: pendiente, en_revision, aprobado, rechazado · Default: pendiente | pendiente |
| validation_errors | json |  |  |  | { "clave": "valor" } |
| bounding_boxes | component (lista · Bounding Box) |  |  | Componente: Bounding Box · Repetible | Completar Bounding Box |
| precio_unitario_referencia | decimal |  |  |  | 123.45 |
| producto | relation (manyToOne → Product · Material · Ficha) |  |  | Target: Product · Material · Ficha · Relación manyToOne | Relacionar Product · Material · Ficha |
| producto_creado_en_revision | boolean |  |  | Default: false | false |
| documento | relation (manyToOne → Listas · Documento) | Sí |  | Target: Listas · Documento · Relación manyToOne · inversedBy: items | Relacionar Listas · Documento |
| version | relation (manyToOne → Listas · Versión) | Sí |  | Target: Listas · Versión · Relación manyToOne · inversedBy: items | Relacionar Listas · Versión |
| orden | integer |  |  |  | 123 |
| detectado_por | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| verificado_por | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| aprobado_por | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| detectado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| verificado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| aprobado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| audits | relation (oneToMany → Listas · Item Audit) |  |  | Target: Listas · Item Audit · Relación oneToMany · mappedBy: item | Relacionar varios Listas · Item Audit |

### Listas · Item Audit (`api::colegio-list-item-audit.colegio-list-item-audit`)
- Tipo: Collection Type
- Tabla: colegio_list_item_audits
- Draft & Publish: No
- Singular API: colegio-list-item-audit
- Plural API: colegio-list-item-audits
- Descripción: Historial de acciones realizadas sobre ítems de listas de útiles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| item | relation (manyToOne → Listas · Item) | Sí |  | Target: Listas · Item · Relación manyToOne · inversedBy: audits | Relacionar Listas · Item |
| accion | enumeration | Sí |  | Valores: match, update, revert, marcar_no_comprar, comentario | match |
| descripcion | text |  |  |  | Descripción larga de ejemplo. |
| datos_previos | json |  |  |  | { "clave": "valor" } |
| datos_nuevos | json |  |  |  | { "clave": "valor" } |
| realizado_por | relation (manyToOne → admin::user) | Sí |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| realizado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| estado_version | enumeration |  |  | Valores: draft, in_review, ready_for_publish, published | draft |

### Listas · Nota (`api::colegio-list-note.colegio-list-note`)
- Tipo: Collection Type
- Tabla: colegio_list_notes
- Draft & Publish: No
- Singular API: colegio-list-note
- Plural API: colegio-list-notes
- Descripción: Notas y anotaciones encontradas en listas de útiles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| tipo | enumeration | Sí |  | Valores: encabezado, pie, general, instruccion | encabezado |
| contenido | text | Sí |  |  | Descripción larga de ejemplo. |
| pagina | integer |  |  | min: 1 | 123 |
| bounding_box | component (Bounding Box) |  |  | Componente: Bounding Box | Completar Bounding Box |
| version | relation (manyToOne → Listas · Versión) | Sí |  | Target: Listas · Versión · Relación manyToOne · inversedBy: notas | Relacionar Listas · Versión |
| documento | relation (manyToOne → Listas · Documento) |  |  | Target: Listas · Documento · Relación manyToOne · inversedBy: notas | Relacionar Listas · Documento |
| orden | integer |  |  |  | 123 |

### Listas · Versión (`api::colegio-list-version.colegio-list-version`)
- Tipo: Collection Type
- Tabla: colegio_list_versions
- Draft & Publish: Sí
- Singular API: colegio-list-version
- Plural API: colegio-list-versions
- Descripción: Versiones de listas de útiles procesadas por colegio y año

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| version_number | integer | Sí |  | min: 1 | 123 |
| etiqueta | string |  |  | maxLength: 120 | Texto de ejemplo |
| estado | enumeration | Sí |  | Valores: draft, in_review, ready_for_publish, published, archived · Default: draft | draft |
| url_fuente | string |  |  |  | Texto de ejemplo |
| fecha_publicacion_fuente | date |  |  |  | 2024-03-15 |
| fecha_actualizacion_fuente | date |  |  |  | 2024-03-15 |
| mensaje_apoderados | richtext |  |  |  | Contenido enriquecido |
| estimated_value | decimal |  |  | min: 0 | 123.45 |
| match_score | decimal |  |  | max: 100 · min: 0 | 123.45 |
| error_rate | decimal |  |  | max: 100 · min: 0 | 123.45 |
| quality_flags | component (lista · Quality Flag) |  |  | Componente: Quality Flag · Repetible | Completar Quality Flag |
| change_summary | component (lista · Change Diff) |  |  | Componente: Change Diff · Repetible | Completar Change Diff |
| comparison_base | relation (manyToOne → Listas · Versión) |  |  | Target: Listas · Versión · Relación manyToOne · inversedBy: derivatives | Relacionar Listas · Versión |
| derivatives | relation (oneToMany → Listas · Versión) |  |  | Target: Listas · Versión · Relación oneToMany · mappedBy: comparison_base · Privado | Relacionar varios Listas · Versión |
| hash_fuentes | string |  |  | maxLength: 191 | Texto de ejemplo |
| indexado_por | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| indexado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| verificado_por | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| verificado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| aprobado_por | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| aprobado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| comentario_aprobador | text |  |  |  | Descripción larga de ejemplo. |
| colegio_list | relation (manyToOne → Listas · Colegio) | Sí |  | Target: Listas · Colegio · Relación manyToOne · inversedBy: versiones | Relacionar Listas · Colegio |
| documentos | relation (oneToMany → Listas · Documento) |  |  | Target: Listas · Documento · Relación oneToMany · mappedBy: version | Relacionar varios Listas · Documento |
| items | relation (oneToMany → Listas · Item) |  |  | Target: Listas · Item · Relación oneToMany · mappedBy: version | Relacionar varios Listas · Item |
| notas | relation (oneToMany → Listas · Nota) |  |  | Target: Listas · Nota · Relación oneToMany · mappedBy: version | Relacionar varios Listas · Nota |

### Media Asset (`api::media-asset.media-asset`)
- Tipo: Collection Type
- Tabla: media_assets
- Draft & Publish: No
- Singular API: media-asset
- Plural API: media-assets
- Descripción: Repositorio centralizado de archivos multimedia

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string | Sí |  | maxLength: 200 | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| description | richtext |  |  |  | Contenido enriquecido |
| file | media (simple) | Sí |  | Un solo archivo · Tipos permitidos: images, videos, files, audios | Archivo multimedia (imagen/pdf) |
| thumbnail | media (simple) |  |  | Un solo archivo · Tipos permitidos: images | Archivo multimedia (imagen/pdf) |
| assetType | enumeration |  |  | Valores: image, video, audio, document, other · Default: other | image |
| mimeType | string |  |  |  | Texto de ejemplo |
| fileSizeBytes | integer |  |  |  | 123 |
| width | integer |  |  |  | 123 |
| height | integer |  |  |  | 123 |
| durationSeconds | integer |  |  |  | 123 |
| uploadedAt | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| uploadedBy | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| status | enumeration | Sí |  | Valores: active, hidden · Default: active | active |
| tags | relation (manyToMany → Media Tag) |  |  | Target: Media Tag · Relación manyToMany · inversedBy: assets | Relacionar varios Media Tag |
| categories | relation (manyToMany → Media Category) |  |  | Target: Media Category · Relación manyToMany · inversedBy: assets | Relacionar varios Media Category |
| usageNotes | text |  |  |  | Descripción larga de ejemplo. |
| externalUrl | string |  |  |  | Texto de ejemplo |
| source | enumeration |  |  | Valores: interno, proveedor, fotografo, campana, otro | interno |
| publicUrl | string |  |  |  | Texto de ejemplo |
| colorPalette | json |  |  |  | { "clave": "valor" } |
| metadata | json |  |  |  | { "clave": "valor" } |

### Media Category (`api::media-category.media-category`)
- Tipo: Collection Type
- Tabla: media_categories
- Draft & Publish: No
- Singular API: media-category
- Plural API: media-categories

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| name | string | Sí | Sí | maxLength: 160 | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| description | text |  |  |  | Descripción larga de ejemplo. |
| parent | relation (manyToOne → Media Category) |  |  | Target: Media Category · Relación manyToOne · inversedBy: children | Relacionar Media Category |
| children | relation (oneToMany → Media Category) |  |  | Target: Media Category · Relación oneToMany · mappedBy: parent | Relacionar varios Media Category |
| assets | relation (manyToMany → Media Asset) |  |  | Target: Media Asset · Relación manyToMany · mappedBy: categories | Relacionar varios Media Asset |

### Media Tag (`api::media-tag.media-tag`)
- Tipo: Collection Type
- Tabla: media_tags
- Draft & Publish: No
- Singular API: media-tag
- Plural API: media-tags

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| name | string | Sí | Sí | maxLength: 120 | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| description | text |  |  |  | Descripción larga de ejemplo. |
| assets | relation (manyToMany → Media Asset) |  |  | Target: Media Asset · Relación manyToMany · mappedBy: tags | Relacionar varios Media Asset |

### News · Article (`api::news-article.news-article`)
- Tipo: Collection Type
- Tabla: news_articles
- Draft & Publish: Sí
- Singular API: news-article
- Plural API: news-articles
- Descripción: Noticias y artículos del blog

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string | Sí |  | maxLength: 160 | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| excerpt | text |  |  |  | Descripción larga de ejemplo. |
| body | richtext |  |  |  | Contenido enriquecido |
| hero_image | media (simple) |  |  | Un solo archivo | Archivo multimedia (imagen/pdf) |
| gallery | media (multi) |  |  | Puede tener varios archivos | Archivo multimedia (imagen/pdf) |
| category | relation (manyToOne → News · Category) | Sí |  | Target: News · Category · Relación manyToOne · inversedBy: articles | Relacionar News · Category |
| tags | relation (manyToMany → News · Tag) |  |  | Target: News · Tag · Relación manyToMany · inversedBy: articles | Relacionar varios News · Tag |
| author | relation (manyToOne → News · Author) | Sí |  | Target: News · Author · Relación manyToOne · inversedBy: articles | Relacionar News · Author |
| read_time | integer |  |  |  | 123 |
| is_featured | boolean |  |  | Default: false | false |
| pin_until | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| related_articles | relation (manyToMany → News · Article) |  |  | Target: News · Article · Relación manyToMany · inversedBy: related_by | Relacionar varios News · Article |
| related_by | relation (manyToMany → News · Article) |  |  | Target: News · Article · Relación manyToMany · mappedBy: related_articles | Relacionar varios News · Article |
| cta | component (ctaBlock) |  |  | Componente: ctaBlock | Completar ctaBlock |
| seo | component (seoMeta) |  |  | Componente: seoMeta | Completar seoMeta |
| canonical_url | string |  |  |  | Texto de ejemplo |
| newsletter_sent | boolean |  |  | Default: false | false |

### News · Author (`api::news-author.news-author`)
- Tipo: Collection Type
- Tabla: news_authors
- Draft & Publish: No
- Singular API: news-author
- Plural API: news-authors

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| name | string | Sí |  |  | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| bio | text |  |  |  | Descripción larga de ejemplo. |
| avatar | media (simple) |  |  | Un solo archivo | Archivo multimedia (imagen/pdf) |
| position | string |  |  |  | Texto de ejemplo |
| team | string |  |  |  | Texto de ejemplo |
| social_links | component (lista · socialLink) |  |  | Componente: socialLink · Repetible | Completar socialLink |
| email | email |  |  |  | contacto@ejemplo.cl |
| is_active | boolean |  |  | Default: true | true |
| articles | relation (oneToMany → News · Article) |  |  | Target: News · Article · Relación oneToMany · mappedBy: author | Relacionar varios News · Article |

### News · Category (`api::news-category.news-category`)
- Tipo: Collection Type
- Tabla: news_categories
- Draft & Publish: No
- Singular API: news-category
- Plural API: news-categories

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| name | string | Sí |  |  | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| description | text |  |  |  | Descripción larga de ejemplo. |
| color | string |  |  |  | Texto de ejemplo |
| icon | media (simple) |  |  | Un solo archivo | Archivo multimedia (imagen/pdf) |
| is_public | boolean |  |  | Default: true | true |
| articles | relation (oneToMany → News · Article) |  |  | Target: News · Article · Relación oneToMany · mappedBy: category | Relacionar varios News · Article |

### News · Tag (`api::news-tag.news-tag`)
- Tipo: Collection Type
- Tabla: news_tags
- Draft & Publish: No
- Singular API: news-tag
- Plural API: news-tags

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| name | string | Sí |  |  | Texto de ejemplo |
| slug | uid | Sí | Sí |  | slug-unica |
| description | text |  |  |  | Descripción larga de ejemplo. |
| articles | relation (manyToMany → News · Article) |  |  | Target: News · Article · Relación manyToMany · mappedBy: tags | Relacionar varios News · Article |

### Persona (`api::persona.persona`)
- Tipo: Collection Type
- Tabla: personas
- Draft & Publish: Sí
- Singular API: persona
- Plural API: personas
- Descripción: Contacto académico y general

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| rut | string |  | Sí |  | Texto de ejemplo |
| nombres | string |  |  |  | Nombre de Ejemplo |
| primer_apellido | string |  |  |  | Texto de ejemplo |
| segundo_apellido | string |  |  |  | Texto de ejemplo |
| nombre_apellidos | string |  |  |  | Nombre de Ejemplo |
| iniciales | string |  |  |  | Texto de ejemplo |
| nombre_completo | string |  |  |  | Nombre de Ejemplo |
| status_nombres | enumeration |  |  | Valores: Por Verificar, Verificado, Aprobado, Eliminado, Rechazado | Por Verificar |
| nivel_confianza | enumeration |  |  | Valores: baja, media, alta · Default: baja | baja |
| origen | enumeration |  |  | Valores: mineduc, csv, manual, crm, web, otro · Default: manual | mineduc |
| activo | boolean |  |  | Default: true | true |
| notas | text |  |  |  | Descripción larga de ejemplo. |
| tags | relation (manyToMany → Persona. Persona Tag) |  |  | Target: Persona. Persona Tag · Relación manyToMany | Relacionar varios Persona. Persona Tag |
| genero | enumeration |  |  | Valores: Mujer, Hombre | Mujer |
| cumpleagno | date |  |  |  | 2024-03-15 |
| cartera_asignaciones | relation (oneToMany → Intranet · Cartera Asignación) |  |  | Target: Intranet · Cartera Asignación · Relación oneToMany · mappedBy: ejecutivo | Relacionar varios Intranet · Cartera Asignación |
| identificadores_externos | json |  |  |  | { "clave": "valor" } |
| emails | component (lista · Email) |  |  | Componente: Email · Repetible | Completar Email |
| telefonos | component (lista · Teléfono) |  |  | Componente: Teléfono · Repetible | Completar Teléfono |
| imagen | component (Logo o Avatar) |  |  | Componente: Logo o Avatar | Completar Logo o Avatar |
| portal_account | component (account) |  |  | Componente: account | Completar account |
| portal_roles | component (lista · accessRole) |  |  | Componente: accessRole · Repetible | Completar accessRole |
| portal_preferences | component (preferences) |  |  | Componente: preferences | Completar preferences |
| portal_snapshot | json |  |  |  | { "clave": "valor" } |
| portal_last_synced_at | datetime |  |  |  | 2024-03-15T10:30:00.000Z |

### Persona. Persona Tag (`api::persona-tag.persona-tag`)
- Tipo: Collection Type
- Tabla: persona_tags
- Draft & Publish: No
- Singular API: persona-tag
- Plural API: persona-tags

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| name | string | Sí | Sí |  | Texto de ejemplo |
| description | text |  |  |  | Descripción larga de ejemplo. |

### Product · Libro · Autor (`api::autor.autor`)
- Tipo: Collection Type
- Tabla: autores
- Draft & Publish: Sí
- Singular API: autor
- Plural API: autores
- Descripción: Autores registrados

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| id_autor | string |  | Sí |  | Texto de ejemplo |
| nombre_completo_autor | string | Sí |  |  | Nombre de Ejemplo |
| obras | relation (manyToMany → Product · Libro · Obra) |  |  | Target: Product · Libro · Obra · Relación manyToMany · mappedBy: autores | Relacionar varios Product · Libro · Obra |
| libros | relation (oneToMany → Product · Libro · Edición) |  |  | Target: Product · Libro · Edición · Relación oneToMany · mappedBy: autor_relacion | Relacionar varios Product · Libro · Edición |

### Product · Libro · Colección (`api::coleccion.coleccion`)
- Tipo: Collection Type
- Tabla: colecciones
- Draft & Publish: Sí
- Singular API: coleccion
- Plural API: colecciones
- Descripción: Colecciones asociadas a una editorial y sello

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| id_coleccion | string | Sí | Sí |  | Texto de ejemplo |
| nombre_coleccion | string | Sí |  |  | Nombre de Ejemplo |
| editorial | relation (manyToOne → Product · Libro · Editorial) | Sí |  | Target: Product · Libro · Editorial · Relación manyToOne · inversedBy: colecciones | Relacionar Product · Libro · Editorial |
| sello | relation (manyToOne → Product · Libro · Sello) |  |  | Target: Product · Libro · Sello · Relación manyToOne · inversedBy: colecciones | Relacionar Product · Libro · Sello |
| libros | relation (oneToMany → Product · Libro · Edición) |  |  | Target: Product · Libro · Edición · Relación oneToMany · mappedBy: coleccion | Relacionar varios Product · Libro · Edición |

### Product · Libro · Edición (`api::libro.libro`)
- Tipo: Collection Type
- Tabla: libros
- Draft & Publish: Sí
- Singular API: libro
- Plural API: libros
- Descripción: Libros con los campos mínimos para catalogar

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| isbn_libro | string | Sí | Sí |  | Texto de ejemplo |
| nombre_libro | string | Sí |  |  | Nombre de Ejemplo |
| subtitulo_libro | string |  |  |  | Texto de ejemplo |
| nombre_completo_autor | string |  |  |  | Nombre de Ejemplo |
| portada_libro | media (simple) |  |  | Un solo archivo | Archivo multimedia (imagen/pdf) |
| obra | relation (manyToOne → Product · Libro · Obra) |  |  | Target: Product · Libro · Obra · Relación manyToOne · inversedBy: ediciones | Relacionar Product · Libro · Obra |
| autor_relacion | relation (manyToOne → Product · Libro · Autor) |  |  | Target: Product · Libro · Autor · Relación manyToOne · inversedBy: libros | Relacionar Product · Libro · Autor |
| editorial | relation (manyToOne → Product · Libro · Editorial) |  |  | Target: Product · Libro · Editorial · Relación manyToOne · inversedBy: libros | Relacionar Product · Libro · Editorial |
| sello | relation (manyToOne → Product · Libro · Sello) |  |  | Target: Product · Libro · Sello · Relación manyToOne · inversedBy: libros | Relacionar Product · Libro · Sello |
| coleccion | relation (manyToOne → Product · Libro · Colección) |  |  | Target: Product · Libro · Colección · Relación manyToOne · inversedBy: libros | Relacionar Product · Libro · Colección |
| ofertas | relation (oneToMany → Product · Oferta · Canal) |  |  | Target: Product · Oferta · Canal · Relación oneToMany · mappedBy: libro | Relacionar varios Product · Oferta · Canal |

### Product · Libro · Editorial (`api::editorial.editorial`)
- Tipo: Collection Type
- Tabla: editoriales
- Draft & Publish: Sí
- Singular API: editorial
- Plural API: editoriales
- Descripción: Catálogo de editoriales disponibles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| id_editorial | string | Sí | Sí |  | Texto de ejemplo |
| nombre_editorial | string | Sí |  |  | Nombre de Ejemplo |
| sellos | relation (oneToMany → Product · Libro · Sello) |  |  | Target: Product · Libro · Sello · Relación oneToMany · mappedBy: editorial | Relacionar varios Product · Libro · Sello |
| colecciones | relation (oneToMany → Product · Libro · Colección) |  |  | Target: Product · Libro · Colección · Relación oneToMany · mappedBy: editorial | Relacionar varios Product · Libro · Colección |
| libros | relation (oneToMany → Product · Libro · Edición) |  |  | Target: Product · Libro · Edición · Relación oneToMany · mappedBy: editorial | Relacionar varios Product · Libro · Edición |

### Product · Libro · Obra (`api::obra.obra`)
- Tipo: Collection Type
- Tabla: obras
- Draft & Publish: Sí
- Singular API: obra
- Plural API: obras
- Descripción: Contenido abstracto independiente de la edición

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| codigo_obra | string | Sí | Sí |  | Texto de ejemplo |
| nombre_obra | string | Sí |  |  | Nombre de Ejemplo |
| descripcion | text |  |  |  | Descripción larga de ejemplo. |
| autores | relation (manyToMany → Product · Libro · Autor) |  |  | Target: Product · Libro · Autor · Relación manyToMany · inversedBy: obras | Relacionar varios Product · Libro · Autor |
| etiquetas | json |  |  |  | { "clave": "valor" } |
| ediciones | relation (oneToMany → Product · Libro · Edición) |  |  | Target: Product · Libro · Edición · Relación oneToMany · mappedBy: obra | Relacionar varios Product · Libro · Edición |
| materiales | relation (oneToMany → Product · Material · Ficha) |  |  | Target: Product · Material · Ficha · Relación oneToMany · mappedBy: obra | Relacionar varios Product · Material · Ficha |

### Product · Libro · Sello (`api::sello.sello`)
- Tipo: Collection Type
- Tabla: sellos
- Draft & Publish: Sí
- Singular API: sello
- Plural API: sellos
- Descripción: Sellos editoriales asociados a una editorial

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| id_sello | string | Sí | Sí |  | Texto de ejemplo |
| nombre_sello | string | Sí |  |  | Nombre de Ejemplo |
| editorial | relation (manyToOne → Product · Libro · Editorial) | Sí |  | Target: Product · Libro · Editorial · Relación manyToOne · inversedBy: sellos | Relacionar Product · Libro · Editorial |
| colecciones | relation (oneToMany → Product · Libro · Colección) |  |  | Target: Product · Libro · Colección · Relación oneToMany · mappedBy: sello | Relacionar varios Product · Libro · Colección |
| libros | relation (oneToMany → Product · Libro · Edición) |  |  | Target: Product · Libro · Edición · Relación oneToMany · mappedBy: sello | Relacionar varios Product · Libro · Edición |

### Product · Material · Ficha (`api::material.material`)
- Tipo: Collection Type
- Tabla: materials
- Draft & Publish: Sí
- Singular API: material
- Plural API: materials
- Descripción: Material o insumo básico

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| nombre | string | Sí |  |  | Nombre de Ejemplo |
| ean | string | Sí | Sí |  | Texto de ejemplo |
| categoria | string |  |  |  | Texto de ejemplo |
| subcategoria | string |  |  |  | Texto de ejemplo |
| marca | string |  |  |  | Texto de ejemplo |
| obra | relation (manyToOne → Product · Libro · Obra) |  |  | Target: Product · Libro · Obra · Relación manyToOne · inversedBy: materiales | Relacionar Product · Libro · Obra |

### Product · Oferta · Canal (`api::oferta-producto.oferta-producto`)
- Tipo: Collection Type
- Tabla: oferta_productos
- Draft & Publish: Sí
- Singular API: oferta-producto
- Plural API: oferta-productos
- Descripción: Registro de precios y stock observados para un producto

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| ean | string | Sí |  |  | Texto de ejemplo |
| tipo_producto | enumeration | Sí |  | Valores: libro, material, otro · Default: libro | libro |
| vendedor | string |  |  |  | Texto de ejemplo |
| canal | string |  |  |  | Texto de ejemplo |
| precio | decimal | Sí |  | min: 0 | 123.45 |
| moneda | string |  |  | Default: CLP | Texto de ejemplo |
| stock | integer |  |  | Default: 0 · min: 0 | 123 |
| ubicacion | string |  |  |  | Texto de ejemplo |
| condicion | enumeration |  |  | Valores: nuevo, usado, reacondicionado · Default: nuevo | nuevo |
| notas | text |  |  |  | Descripción larga de ejemplo. |
| libro | relation (manyToOne → Product · Libro · Edición) |  |  | Target: Product · Libro · Edición · Relación manyToOne · inversedBy: ofertas | Relacionar Product · Libro · Edición |

### Ubicación. Comuna (`api::comuna.comuna`)
- Tipo: Collection Type
- Tabla: comunas
- Draft & Publish: Sí
- Singular API: comuna
- Plural API: comunas

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| comuna_nombre | string | Sí |  |  | Nombre de Ejemplo |
| provincia | relation (manyToOne → Ubicación. Provincia) |  |  | Target: Ubicación. Provincia · Relación manyToOne · inversedBy: comunas | Relacionar Ubicación. Provincia |
| comuna_id | integer |  | Sí |  | 123 |
| colegios | relation (oneToMany → Colegio) |  |  | Target: Colegio · Relación oneToMany · mappedBy: comuna | Relacionar varios Colegio |

### Ubicación. Provincia (`api::provincia.provincia`)
- Tipo: Collection Type
- Tabla: provincias
- Draft & Publish: Sí
- Singular API: provincia
- Plural API: provincias

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| provincia_nombre | string |  | Sí |  | Nombre de Ejemplo |
| region | relation (manyToOne → Ubicación. Region) |  |  | Target: Ubicación. Region · Relación manyToOne · inversedBy: provincias | Relacionar Ubicación. Region |
| zona | relation (manyToOne → Ubicación. Zona) |  |  | Target: Ubicación. Zona · Relación manyToOne · inversedBy: provincias | Relacionar Ubicación. Zona |
| comunas | relation (oneToMany → Ubicación. Comuna) |  |  | Target: Ubicación. Comuna · Relación oneToMany · mappedBy: provincia | Relacionar varios Ubicación. Comuna |
| provincia_id | integer |  | Sí |  | 123 |
| colegios | relation (oneToMany → Colegio) |  |  | Target: Colegio · Relación oneToMany · mappedBy: provincia | Relacionar varios Colegio |

### Ubicación. Region (`api::region.region`)
- Tipo: Collection Type
- Tabla: regions
- Draft & Publish: Sí
- Singular API: region
- Plural API: regions

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| region_nombre | string | Sí | Sí |  | Nombre de Ejemplo |
| region_numero | string | Sí | Sí |  | Texto de ejemplo |
| region_id | integer | Sí | Sí |  | 123 |
| provincias | relation (oneToMany → Ubicación. Provincia) |  |  | Target: Ubicación. Provincia · Relación oneToMany · mappedBy: region | Relacionar varios Ubicación. Provincia |
| colegios | relation (oneToMany → Colegio) |  |  | Target: Colegio · Relación oneToMany · mappedBy: region | Relacionar varios Colegio |

### Ubicación. Zona (`api::zona.zona`)
- Tipo: Collection Type
- Tabla: zonas
- Draft & Publish: Sí
- Singular API: zona
- Plural API: zonas

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| zona_nombre | string | Sí |  |  | Nombre de Ejemplo |
| provincias | relation (oneToMany → Ubicación. Provincia) |  |  | Target: Ubicación. Provincia · Relación oneToMany · mappedBy: zona | Relacionar varios Ubicación. Provincia |
| zona_id | integer |  | Sí |  | 123 |
| colegios | relation (oneToMany → Colegio) |  |  | Target: Colegio · Relación oneToMany · mappedBy: zona | Relacionar varios Colegio |

### User · Mailbox (`api::user-mailbox.user-mailbox`)
- Tipo: Collection Type
- Tabla: user_mailboxes
- Draft & Publish: No
- Singular API: user-mailbox
- Plural API: user-mailboxes
- Descripción: Credenciales SMTP asociadas a usuarios o cuentas compartidas

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| email | email | Sí | Sí |  | contacto@ejemplo.cl |
| smtp_host | string | Sí |  |  | Texto de ejemplo |
| smtp_port | integer | Sí |  |  | 123 |
| secure | boolean |  |  | Default: true | true |
| username | string | Sí |  |  | Texto de ejemplo |
| password | password | Sí |  | Privado | ******** |
| from_name | string |  |  |  | Texto de ejemplo |
| reply_to | email |  |  |  | contacto@ejemplo.cl |
| meta | json |  |  |  | { "clave": "valor" } |

## Componentes

### accessRole (`portal.access-role`)
- Descripción: Contexto de acceso al portal por rol

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| role | enumeration | Sí |  | Valores: colegio_admin, docente, apoderado, estudiante, staff | colegio_admin |
| is_primary | boolean |  |  | Default: false | false |
| colegio | relation (manyToOne → Colegio) |  |  | Target: Colegio · Relación manyToOne | Relacionar Colegio |
| cursos | relation (manyToMany → Colegio · Curso) |  |  | Target: Colegio · Curso · Relación manyToMany | Relacionar varios Colegio · Curso |
| dependientes | relation (manyToMany → Persona) |  |  | Target: Persona · Relación manyToMany | Relacionar varios Persona |
| default_dashboard | enumeration |  |  | Valores: general, pedidos, licencias, documentos, soporte | general |
| scopes | json |  |  |  | { "clave": "valor" } |
| valid_until | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| notes | text |  |  |  | Descripción larga de ejemplo. |

### account (`portal.account`)
- Descripción: Estado de cuenta del portal Moraleja

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| status | enumeration |  |  | Valores: pending_invite, active, suspended, revoked · Default: pending_invite | pending_invite |
| sso_provider | enumeration |  |  | Valores: auth0, keycloak, google, microsoft, internal, otro · Default: auth0 | auth0 |
| username | string |  |  |  | Texto de ejemplo |
| primary_email | email |  |  |  | contacto@ejemplo.cl |
| portal_id | string |  |  |  | Texto de ejemplo |
| last_login_at | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| onboarded_at | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| mfa_enabled | boolean |  |  | Default: false | false |
| accepted_terms_at | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| notes | text |  |  |  | Descripción larga de ejemplo. |

### Beneficio (`cotizaciones.beneficio`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| titulo | string | Sí |  |  | Texto de ejemplo |
| descripcion | text |  |  |  | Descripción larga de ejemplo. |

### Bounding Box (`listas-utiles.bounding-box`)
- Descripción: Ubicación normalizada del elemento dentro de un PDF de lista de útiles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| page | integer | Sí |  | min: 1 | 123 |
| x | decimal |  |  | max: 1 · min: 0 | 123.45 |
| y | decimal |  |  | max: 1 · min: 0 | 123.45 |
| width | decimal |  |  | max: 1 · min: 0 | 123.45 |
| height | decimal |  |  | max: 1 · min: 0 | 123.45 |

### Change Diff (`listas-utiles.change-diff`)
- Descripción: Resumen de cambios entre versiones de listas de útiles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| scope | enumeration | Sí |  | Valores: curso, item, nota | curso |
| diff_type | enumeration | Sí |  | Valores: agregado, eliminado, modificado | agregado |
| reference | string |  |  | maxLength: 255 | Texto de ejemplo |
| previous_value | json |  |  |  | { "clave": "valor" } |
| new_value | json |  |  |  | { "clave": "valor" } |
| impact | enumeration |  |  | Valores: bajo, medio, alto | bajo |

### ctaBlock (`news.cta-block`)
- Descripción: Call to action block for news articles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| label | string |  |  |  | Texto de ejemplo |
| subtitle | text |  |  |  | Descripción larga de ejemplo. |
| button_text | string |  |  |  | Texto de ejemplo |
| button_url | string |  |  |  | Texto de ejemplo |
| style | enumeration |  |  | Valores: primary, secondary, outline · Default: primary | primary |

### ctaLink (`home.cta-link`)
- Descripción: CTA principal/secundaria para el home hero

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| label | string | Sí |  | maxLength: 80 | Texto de ejemplo |
| href | string | Sí |  |  | Texto de ejemplo |
| is_primary | boolean |  |  | Default: true | true |
| aria_label | string |  |  | maxLength: 160 | Texto de ejemplo |
| external | boolean |  |  | Default: false | false |

### Dirección (`contacto.direccion`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| direccion_principal_envio_facturacion | enumeration |  |  | Valores: Principal, Envío, Facturación | Principal |
| region | relation (oneToOne → Ubicación. Region) |  |  | Target: Ubicación. Region · Relación oneToOne | Relacionar Ubicación. Region |
| comuna | relation (oneToOne → Ubicación. Comuna) |  |  | Target: Ubicación. Comuna · Relación oneToOne | Relacionar Ubicación. Comuna |
| nombre_calle | string |  |  |  | Nombre de Ejemplo |
| numero_calle | string |  |  |  | Texto de ejemplo |
| complemento_direccion | string |  |  |  | Texto de ejemplo |
| tipo_direccion | enumeration |  |  | Valores: Comercial, Particular, Otro | Comercial |
| verificada_por | string |  |  |  | Texto de ejemplo |
| fecha_verificacion | date |  |  |  | 2024-03-15 |
| estado_verificacion | enumeration |  |  | Valores: Por Verificar, Verificado, Aprobado | Por Verificar |

### Editorial Inventory (`inventory.editorial`)
- Descripción: Stock buckets for Editorial store

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| operador_logistico | integer |  |  | Default: 0 | 123 |
| comodato_libreria | integer |  |  | Default: 0 | 123 |

### Email (`contacto.email`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| email | email | Sí |  |  | contacto@ejemplo.cl |
| tipo | enumeration |  |  | Valores: Personal, Laboral, Institucional | Personal |
| estado | enumeration |  |  | Valores: Por Verificar, Verificado, Aprobado | Por Verificar |
| principal | boolean |  |  |  | true |
| vigente_desde | date |  |  |  | 2024-03-15 |
| vigente_hasta | date |  |  |  | 2024-03-15 |
| eliminado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| nota | text |  |  |  | Descripción larga de ejemplo. |
| fuente | string |  |  |  | Texto de ejemplo |
| verificado_por | string |  |  |  | Texto de ejemplo |
| fecha_verificacion | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| confidence_score | decimal |  |  |  | 123.45 |

### Hero (`campanias.hero`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| eyebrow | string |  |  |  | Texto de ejemplo |
| title | string |  |  |  | Texto de ejemplo |
| subtitle | richtext |  |  |  | Contenido enriquecido |
| primaryCtaLabel | string |  |  |  | Texto de ejemplo |
| primaryCtaHref | string |  |  |  | Texto de ejemplo |
| secondaryCtaLabel | string |  |  |  | Texto de ejemplo |
| secondaryCtaHref | string |  |  |  | Texto de ejemplo |
| stats | component (lista · Hero stat) |  |  | Componente: Hero stat · Repetible | Completar Hero stat |

### Hero stat (`campanias.hero-stat`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| label | string |  |  |  | Texto de ejemplo |
| value | string |  |  |  | Texto de ejemplo |

### heroStat (`home.hero-stat`)
- Descripción: Indicadores destacados para el home hero

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| value | string | Sí |  | maxLength: 40 | Texto de ejemplo |
| label | string | Sí |  | maxLength: 120 | Texto de ejemplo |
| order | integer |  |  |  | 123 |

### Highlight (`campanias.highlight`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string |  |  |  | Texto de ejemplo |
| description | text |  |  |  | Descripción larga de ejemplo. |
| icon | enumeration |  |  | Valores: curriculum, analytics, support, custom | curriculum |

### Item (`cotizaciones.item`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| producto | string | Sí |  |  | Texto de ejemplo |
| descripcion | text |  |  |  | Descripción larga de ejemplo. |
| categoria | string |  |  |  | Texto de ejemplo |
| cantidad | decimal |  |  | Default: 1 | 123.45 |
| precio_unitario | decimal |  |  |  | 123.45 |
| descuento | decimal |  |  |  | 123.45 |
| subtotal | decimal |  |  |  | 123.45 |

### Libreria Inventory (`inventory.libreria`)
- Descripción: Stock buckets for Libreria Escolar store

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| tienda | integer |  |  | Default: 0 | 123 |
| bodega | integer |  |  | Default: 0 | 123 |
| operador_logistico | integer |  |  | Default: 0 | 123 |

### Logo o Avatar (`contacto.logo-o-avatar`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| imagen | media (multi) |  |  | Puede tener varios archivos · Tipos permitidos: images, files, videos, audios | Archivo multimedia (imagen/pdf) |
| tipo | enumeration |  |  | Valores: Logo, Foto Perfíl, Otro | Logo |
| formato | enumeration |  |  | Valores: Png, Jpg, WebP, SVG, Gif, Otro | Png |
| estado | enumeration |  |  | Valores: Por Verificar, Verificado, Aprobado | Por Verificar |
| vigente_desde | date |  |  |  | 2024-03-15 |
| vigente_hasta | date |  |  |  | 2024-03-15 |
| eliminado_en | date |  |  |  | 2024-03-15 |
| nota | string |  |  |  | Texto de ejemplo |
| fuente | string |  |  |  | Texto de ejemplo |
| verificado_por | string |  |  |  | Texto de ejemplo |
| fecha_verificacion | date |  |  |  | 2024-03-15 |
| confiance_score | integer |  |  |  | 123 |
| aprobado_por | string |  |  |  | Texto de ejemplo |
| fecha_aprobacion | date |  |  |  | 2024-03-15 |

### Media (`shared.media`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| file | media (simple) |  |  | Un solo archivo · Tipos permitidos: images, files, videos | Archivo multimedia (imagen/pdf) |

### Module (`campanias.module`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| name | string |  |  |  | Texto de ejemplo |
| audience | string |  |  |  | Texto de ejemplo |
| summary | richtext |  |  |  | Contenido enriquecido |
| outcomes | component (lista · Module outcome) |  |  | Componente: Module outcome · Repetible | Completar Module outcome |
| duration | string |  |  |  | Texto de ejemplo |
| ctaLabel | string |  |  |  | Texto de ejemplo |
| ctaHref | string |  |  |  | Texto de ejemplo |

### Module outcome (`campanias.module-outcome`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| value | string |  |  |  | Texto de ejemplo |

### Note (`campanias.note`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| value | text |  |  |  | Descripción larga de ejemplo. |

### preferences (`portal.preferences`)
- Descripción: Preferencias de uso del portal

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| language | enumeration |  |  | Valores: es, en · Default: es | es |
| timezone | string |  |  |  | Texto de ejemplo |
| notifications_email | boolean |  |  | Default: true | true |
| notifications_push | boolean |  |  | Default: false | false |
| notifications_whatsapp | boolean |  |  | Default: false | false |
| marketing_opt_in | boolean |  |  | Default: false | false |
| default_dashboard | enumeration |  |  | Valores: general, pedidos, licencias, documentos, soporte · Default: general | general |
| shortcuts | component (lista · shortcut) |  |  | Componente: shortcut · Repetible | Completar shortcut |
| hidden_widgets | json |  |  |  | { "clave": "valor" } |

### Quality Flag (`listas-utiles.quality-flag`)
- Descripción: Flags de control de calidad asociados a listas de útiles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| code | enumeration | Sí |  | Valores: isbn_invalido, editorial_incongruente, nombre_inexacto, instruccion_confusa, faltan_productos, otros | isbn_invalido |
| label | string |  |  | maxLength: 160 | Texto de ejemplo |
| severity | enumeration | Sí |  | Valores: info, warning, error · Default: info | info |
| resolved | boolean |  |  | Default: false | false |
| resolved_by | relation (manyToOne → admin::user) |  |  | Target: admin::user · Relación manyToOne | Relacionar admin::user |
| resolved_at | datetime |  |  |  | 2024-03-15T10:30:00.000Z |

### Quote (`shared.quote`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string |  |  |  | Texto de ejemplo |
| body | text |  |  |  | Descripción larga de ejemplo. |

### Regla de descuento (`lista-descuento.regla`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| categoria | string | Sí |  |  | Texto de ejemplo |
| descuento_especial | decimal |  |  |  | 123.45 |

### Resource (`campanias.resource`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| label | string |  |  |  | Texto de ejemplo |
| description | text |  |  |  | Descripción larga de ejemplo. |
| href | string |  |  |  | Texto de ejemplo |
| format | enumeration |  |  | Valores: pdf, video, link, contact | pdf |

### Rich text (`shared.rich-text`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| body | richtext |  |  |  | Contenido enriquecido |

### Seo (`shared.seo`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| metaTitle | string | Sí |  |  | Texto de ejemplo |
| metaDescription | text | Sí |  |  | Descripción larga de ejemplo. |
| shareImage | media (simple) |  |  | Un solo archivo · Tipos permitidos: images | Archivo multimedia (imagen/pdf) |

### seoMeta (`news.seo-meta`)
- Descripción: Meta tags and structured data for news articles

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| metaTitle | string |  |  |  | Texto de ejemplo |
| metaDescription | text |  |  |  | Descripción larga de ejemplo. |
| metaImage | media (simple) |  |  | Un solo archivo | Archivo multimedia (imagen/pdf) |
| metaRobots | enumeration |  |  | Valores: index_follow, index_nofollow, noindex_follow, noindex_nofollow · Default: index_follow | index_follow |
| structuredData | json |  |  |  | { "clave": "valor" } |
| canonicalURL | string |  |  |  | Texto de ejemplo |
| ogTitle | string |  |  |  | Texto de ejemplo |
| ogDescription | text |  |  |  | Descripción larga de ejemplo. |

### shortcut (`portal.shortcut`)
- Descripción: Accesos directos personalizados

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| label | string | Sí |  |  | Texto de ejemplo |
| description | text |  |  |  | Descripción larga de ejemplo. |
| target_url | string |  |  |  | Texto de ejemplo |
| icon | string |  |  |  | Texto de ejemplo |
| order | integer |  |  | Default: 0 | 123 |

### Slider (`shared.slider`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| files | media (multi) |  |  | Puede tener varios archivos · Tipos permitidos: images | Archivo multimedia (imagen/pdf) |

### socialLink (`news.social-link`)
- Descripción: Social platform link

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| platform | enumeration |  |  | Valores: website, linkedin, twitter, instagram, facebook, youtube | website |
| url | string |  |  |  | Texto de ejemplo |

### Support (`campanias.support`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string |  |  |  | Texto de ejemplo |
| description | text |  |  |  | Descripción larga de ejemplo. |
| contactEmail | email |  |  |  | contacto@ejemplo.cl |
| contactPhone | string |  |  |  | Texto de ejemplo |
| contactWhatsapp | string |  |  |  | Texto de ejemplo |
| officeHours | string |  |  |  | Texto de ejemplo |

### Teléfono (`contacto.telefono`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| telefono_raw | string |  |  |  | Texto de ejemplo |
| telefono_norm | string |  |  |  | Texto de ejemplo |
| tipo | string |  |  |  | Texto de ejemplo |
| estado | enumeration |  |  | Valores: Por Verificar, Verificado, Aprobado | Por Verificar |
| principal | boolean |  |  |  | true |
| vigente_desde | date |  |  |  | 2024-03-15 |
| vigente_hasta | date |  |  |  | 2024-03-15 |
| eliminado_en | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| nota | text |  |  |  | Descripción larga de ejemplo. |
| fuente | string |  |  |  | Texto de ejemplo |
| verificado_por | string |  |  |  | Texto de ejemplo |
| fecha_verificacion | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| confidence_score | decimal |  |  |  | 123.45 |

### Timeline step (`campanias.timeline-step`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| title | string |  |  |  | Texto de ejemplo |
| description | text |  |  |  | Descripción larga de ejemplo. |
| detail | text |  |  |  | Descripción larga de ejemplo. |

### Verificación Nombre (`contacto.nombre`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| estado | enumeration |  |  | Valores: Por Verificar, Verificado, Aprobado, Rechazado, Otro | Por Verificar |
| nota | string |  |  |  | Texto de ejemplo |
| fuente | string |  |  |  | Texto de ejemplo |
| verificado_por | string |  |  |  | Texto de ejemplo |
| aprobado_por | string |  |  |  | Texto de ejemplo |
| fecha_aprobacion | date |  |  |  | 2024-03-15 |
| fecha_verificacion | date |  |  |  | 2024-03-15 |
| confiance_score | integer |  |  |  | 123 |

### Website (`contacto.website`)

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| website | string |  |  |  | Texto de ejemplo |
| estado | enumeration |  |  | Valores: Por Verificar, Verificado, Aprobado | Por Verificar |
| vigente_desde | date |  |  |  | 2024-03-15 |
| vigente_hasta | date |  |  |  | 2024-03-15 |
| eliminado_en | date |  |  |  | 2024-03-15 |
| nota | string |  |  |  | Texto de ejemplo |
| fuente | string |  |  |  | Texto de ejemplo |
| confiance_score | integer |  |  |  | 123 |
| verificado_por | string |  |  |  | Texto de ejemplo |
| fecha_verificacion | date |  |  |  | 2024-03-15 |
| aprobado_por | string |  |  |  | Texto de ejemplo |
| fecha_aprobacion | date |  |  |  | 2024-03-15 |

### Woo Mapping (`integration.woo-map`)
- Descripción: WooCommerce IDs and sync metadata per store

| Campo | Tipo | Obligatorio | Único | Detalles | Ejemplo |
| --- | --- | --- | --- | --- | --- |
| storeKey | enumeration | Sí |  | Valores: editorial, libreria | editorial |
| wooProductId | integer |  |  |  | 123 |
| wooVariantIds | json |  |  |  | { "clave": "valor" } |
| lastSyncedAt | datetime |  |  |  | 2024-03-15T10:30:00.000Z |
| contentHash | string |  |  |  | Texto de ejemplo |
