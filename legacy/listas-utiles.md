Listas de utiles - modelo Strapi (intranet.moraleja.cl)

Resumen de colecciones
- colegio-list (api/colegio-list)
- colegio-list-version (api/colegio-list-version)
- colegio-list-document (api/colegio-list-document)
- colegio-list-item (api/colegio-list-item)
- colegio-list-note (api/colegio-list-note)
- colegio-list-item-audit (api/colegio-list-item-audit)

Componentes compartidos
- listas-utiles.bounding-box
  - page: integer (pagina dentro del PDF, base 1)
  - x: decimal (coordenada horizontal normalizada 0-1)
  - y: decimal (coordenada vertical normalizada 0-1)
  - width: decimal (ancho relativo 0-1)
  - height: decimal (alto relativo 0-1)
- listas-utiles.quality-flag
  - code: enumeration [isbn_invalido, editorial_incongruente, nombre_inexacto, instruccion_confusa, faltan_productos, otros]
  - label: string
  - severity: enumeration [info, warning, error]
  - resolved: boolean default false
  - resolved_by: relation to admin::user (opcional)
  - resolved_at: datetime
- listas-utiles.change-diff
  - scope: enumeration [curso, item, nota]
  - diff_type: enumeration [agregado, eliminado, modificado]
  - reference: string (ej. nombre del curso o item)
  - previous_value: json
  - new_value: json
  - impact: enumeration [bajo, medio, alto]

Coleccion: colegio-list (api/colegio-list)
- slug: UID string requerido (patron {colegio}-{anio}; unico)
- anio: integer requerido
- colegio: relation many-to-one a colegios (obligatorio)
- descripcion_interna: text
- estado_global: enumeration [sin_versiones, en_proceso, publicado] (lectura, se actualiza con hook)
- version_actual: relation one-to-one con colegio-list-version (opcional)
- versiones: relation one-to-many con colegio-list-version
- createdBy/updatedBy: gestionados por Strapi

Reglas
- slug unico; anio + colegio deben ser unicos (crear indice compuesto)
- estado_global se deriva del estado de version_actual (hook afterUpdate)

Coleccion: colegio-list-version (api/colegio-list-version)
- version_number: integer requerido (autoincremental por lista)
- etiqueta: string (ej. "Version 2025 v2")
- estado: enumeration [draft, in_review, ready_for_publish, published, archived] requerido
- url_fuente: string (URL)
- fecha_publicacion_fuente: date
- fecha_actualizacion_fuente: date
- mensaje_apoderados: richtext
- estimated_value: decimal (precision 12,2; suma cantidades x precio producto)
- match_score: decimal (0-100, porcentaje de items con match perfecto)
- error_rate: decimal (0-100, porcentaje de items con problemas abiertos)
- quality_flags: repeatable component listas-utiles.quality-flag
- change_summary: repeatable component listas-utiles.change-diff
- comparison_base: relation many-to-one a colegio-list-version (version anterior del mismo curso)
- hash_fuentes: string (hash combinado de PDFs)
- indexado_por: relation to admin::user (roles Indexar/Aprobar)
- indexado_en: datetime
- verificado_por: relation to admin::user
- verificado_en: datetime
- aprobado_por: relation to admin::user
- aprobado_en: datetime
- comentario_aprobador: text
- colegio_list: relation many-to-one a colegio-list (requerido)
- documentos: relation one-to-many con colegio-list-document
- items: relation one-to-many con colegio-list-item
- notas: relation one-to-many con colegio-list-note
- publishedAt: datetime (gestiona Strapi; usar al pasar a estado published)

Reglas
- version_number se genera por servicio (consultar max y sumar 1)
- estado transiciona solo via servicios (draft->in_review->ready_for_publish->published; permitir back a in_review)
- quality_flags marcadas como error deben resolverse antes de publicar (validacion en servicio)

Coleccion: colegio-list-document (api/colegio-list-document)
- nombre_archivo: string requerido
- archivo_pdf: media single (tipo file, provider S3/local segun despliegue)
- curso_detectado: string
- curso_normalizado: string (ej. "3-basico-a")
- pagina_inicio: integer
- pagina_fin: integer
- pdf_hash: string (md5/sha256)
- estado_procesamiento: enumeration [pendiente, procesando, completado, error] default pendiente
- procesamiento_log: json (mensajes y advertencias del parser)
- orden: integer (permite ordenar documentos dentro de la version)
- version: relation many-to-one con colegio-list-version (requerido)

Coleccion: colegio-list-item (api/colegio-list-item)
- nombre_detectado: string requerido (texto crudo del PDF)
- nombre_normalizado: string (texto despues de limpieza)
- cantidad: decimal (precision 10,2)
- unidad: enumeration [unidad, paquete, caja, litro, kilo, cuaderno, libro, otro]
- instrucciones: text
- asignatura: string
- categoria_texto: string
- omit_purchase: boolean default false (indica "no comprar")
- prioridad_revision: enumeration [normal, alta]
- validacion_estado: enumeration [pendiente, en_revision, aprobado, rechazado] default pendiente
- validation_errors: json (array con {code, message, severity, resolved})
- bounding_boxes: repeatable component listas-utiles.bounding-box
- precio_unitario_referencia: decimal (precio tomado del producto en el momento de revision)
- producto: relation many-to-one a api::material.material (requerido antes de publicar)
- producto_creado_en_revision: boolean default false
- documento: relation many-to-one a colegio-list-document (requerido)
- version: relation many-to-one a colegio-list-version (requerido)
- orden: integer
- detectado_por: relation to admin::user (Indexar) opcional
- verificado_por: relation to admin::user (Verificar) opcional
- aprobado_por: relation to admin::user (Aprobar) opcional
- detectado_en: datetime (auto por servicio)
- verificado_en: datetime
- aprobado_en: datetime

Reglas
- producto obligatorio cuando validacion_estado = aprobado
- omit_purchase no exime de vincular producto (se usa para check informativo)
- validation_errors se vacia o marca resuelto cuando verificador corrige

Coleccion: colegio-list-note (api/colegio-list-note)
- tipo: enumeration [encabezado, pie, general, instruccion]
- contenido: text requerido
- pagina: integer
- bounding_box: component listas-utiles.bounding-box
- version: relation many-to-one a colegio-list-version (requerido)
- documento: relation many-to-one a colegio-list-document (opcional)
- orden: integer

Coleccion: colegio-list-item-audit (api/colegio-list-item-audit)
- item: relation many-to-one a colegio-list-item (requerido)
- accion: enumeration [match, update, revert, marcar_no_comprar, comentario]
- descripcion: text
- datos_previos: json
- datos_nuevos: json
- realizado_por: relation to admin::user (requerido)
- realizado_en: datetime (auto default now)
- estado_version: enumeration [draft, in_review, ready_for_publish, published] (estado de la version cuando ocurrio)

Integraciones y reglas adicionales
- Usar existing content type colegios (api/colegios) como referencia principal.
- Relacion producto apunta al content type existente (ajustar slug real en strapi export).
- Configurar indices compuestos:
  - colegio-list: unique (colegio, anio)
  - colegio-list-version: unique (colegio_list, version_number)
  - colegio-list-item: unique opcional (version, documento, orden) para preservar orden estable.
- Definir lifecycle hooks en colegio-list-version para:
  - calcular version_number
  - recalcular estimated_value, match_score y error_rate tras cambios en items
  - bloquear publicacion si hay validation_errors no resueltos o items sin producto
- Definir servicio que compare version actual con comparison_base y actualice change_summary (counts y lista de diffs significativos).
- Worker de parsing (Bull + pdf.js) debe actualizar estado_procesamiento y poblar items/notas con bounding_boxes.
- Worker de matching debe proponer productos y llenar validation_errors cuando no hay coincidencia o hay inconsistencias (ej. ISBN invalido).

Roles (Admin)
- Rol Indexar
  - Permisos: crear/actualizar colegio-list, subir documentos, ejecutar parser, editar campos hasta estado draft.
- Rol Verificar
  - Permisos: editar items/notas en estado in_review, crear productos faltantes via endpoint dedicado, resolver validation_errors.
- Rol Aprobar
  - Permisos: cambiar estado a ready_for_publish/published, editar mensaje_apoderados, devolver version a in_review, gestionar quality_flags.

Endpoints recomendados (REST)
- POST /colegio-list/ingest: valida colegio y anio, crea lista si no existe, adjunta PDFs (solo Indexar/Aprobar)
- POST /colegio-list-version/:id/process: lanza parsing (Indexar)
- POST /colegio-list-version/:id/submit-review: cambia estado draft->in_review (Indexar)
- POST /colegio-list-version/:id/complete-verification: in_review->ready_for_publish (Verificar)
- POST /colegio-list-version/:id/publish: ready_for_publish->published (Aprobar)
- GET /colegio-list/:id/history: devuelve versiones, metrics y diffs
- GET /colegios/:id/listas?anio=AAAA: consulta para vista Colegios en intranet

Metricas y reportes
- estimated_value: recalcular al modificar producto o cantidad
- match_score = (items aprobados con producto valido / total items) * 100
- error_rate = (items con validation_errors abiertos / total items revisados) * 100
- Registrar historico de metricas por version para alimentar graficos
- change_summary debe incluir conteos (items_agregados, items_eliminados, items_modificados, notas_cambiadas) con referencias detalladas

Consideraciones de comparacion
- Guardar referencia comparison_base al crear nueva version (ultima publicada del mismo curso si existe)
- Worker de diffs compara nombre_normalizado, producto, cantidad, instrucciones, flags omit_purchase
- Cuando dif > umbral, crear quality_flag severity warning/error segun impacto

Publicacion hacia intranet.moraleja.cl
- Todos los endpoints deben exigir autenticacion con token existente entre intranet y Strapi
- Filtrar data segun rol del usuario autenticado (Indexar/Verificar/Aprobar)
- Exponer solo versiones published para consumidores externos (por ejemplo tienda) via permisos publicos
