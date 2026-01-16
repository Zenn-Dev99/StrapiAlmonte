# Promoción · Plantillas de correo

## Cambios clave
- El campo `key` se autogenera a partir del `name` al crear una plantilla recién guardada y pasa a “solo lectura” cuando ya existe en Strapi; no se debe editar manualmente.
- La validación de guardado ya no dispara el error “La clave ya existe…” al editar plantillas existentes.
- La precarga de plantillas usa `GET` con `publicationState=preview` para incluir borradores.
- El botón **Enviar prueba** solo advierte “guarda antes de enviar” cuando Strapi aún no ha devuelto el registro.

## Cómo probar
1. Ingresar a `/promocion/plantillas_correos/2025/campaignkey`.
2. Modificar un campo (por ejemplo, “Contenido del correo” o `name`) y guardar para crear/actualizar en Strapi.
3. Pulsar **Enviar prueba** (correo por defecto `andres@moraleja.cl`, seleccionable).
4. Repetir si es necesario: no deben aparecer errores `404` al guardar ni avisos de “la plantilla no existe”.

## Documentación para Strapi
- **Content Type**: `api::email-template.email-template` (sin draft/publish).
- **Campos relevantes**: `key` (uid, requerido), `name`, `subject`, `preheader`, `from_name`, `from_email`, `reply_to`, `cc`, `bcc`, `etapa`, `estado`, `fecha_sugerida`, `segmentos_asignaturas`, `segmentos_niveles`, `body_html`, `body_text`, `meta`.
- **Relaciones**: `autores` y `aprobado_por` → `plugin::users-permissions.user`; `logs` → `api::email-log.email-log`.
- **Consumo**:
  - Listado: `/promocion/plantillas_correos` (tarjetas “Borrador/Archivado”).
  - Formulario: `/promocion/plantillas_correos/[grupo?]/[key]`.
  - Guardado: `PUT /api/promocion/email/templates/[key]` (upsert por `key`, maneja `404/400/409`).
  - Pruebas: `POST /api/promocion/email/test`.
  - Campañas reales leen la plantilla y registran envíos en `email_logs`.
- Si Strapi responde `400`, revisar el payload de error para identificar el campo rechazado (validaciones, hooks, permisos, etc.).
