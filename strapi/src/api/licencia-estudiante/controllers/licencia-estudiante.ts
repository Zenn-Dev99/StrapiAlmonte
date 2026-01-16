import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::licencia-estudiante.licencia-estudiante' as any, ({ strapi }) => ({
  /**
   * Activa una licencia única para un estudiante basándose en un código de activación.
   * 
   * SISTEMA DE LICENCIAS ÚNICAS (1:1):
   * - Cada código solo puede ser usado una vez
   * - El código se "quema" al asignarse a un estudiante
   * - No hay códigos compartidos en libros
   */
  async activar(ctx: any) {
    try {
      strapi.log.info('[licencia-estudiante.activar] ═══════════════════════════════════════════════════════');
      strapi.log.info('[licencia-estudiante.activar] Iniciando activación de licencia');

      // ===== PASO 1: INPUT =====
      const body = ctx.request.body?.data || ctx.request.body;
      const { codigo, persona_mira_id } = body || {};

      // Validar input
      if (!codigo) {
        return ctx.badRequest('El código de activación es requerido');
      }

      if (!persona_mira_id) {
        return ctx.unauthorized('No se pudo identificar al estudiante. Inicia sesión nuevamente.');
      }

      const codigoLimpio = codigo.trim().toUpperCase();
      const personaMiraId = typeof persona_mira_id === 'number' ? persona_mira_id : parseInt(persona_mira_id, 10);

      if (isNaN(personaMiraId)) {
        return ctx.unauthorized('ID de estudiante inválido');
      }

      strapi.log.info(`[licencia-estudiante.activar] Código: ${codigoLimpio}, Estudiante ID: ${personaMiraId}`);

      // ===== PASO 2: BÚSQUEDA =====
      // Buscar licencia con populate para ver si ya tiene dueño y obtener datos del libro
      const licencias = await strapi.entityService.findMany('api::licencia-estudiante.licencia-estudiante' as any, {
        filters: {
          codigo_activacion: codigoLimpio,
        },
        populate: {
          estudiante: {
            fields: ['id'],
          },
          libro_mira: {
            populate: {
              libro: {
                fields: ['id', 'nombre_libro', 'isbn_libro', 'subtitulo_libro'],
                populate: {
                  portada_libro: true,
                },
              },
            },
          },
        },
        limit: 1,
      });

      // ===== PASO 3: VALIDACIONES DE SEGURIDAD (El "Cerrojo") =====
      if (!licencias || licencias.length === 0) {
        strapi.log.warn(`[licencia-estudiante.activar] ❌ Código no encontrado: ${codigoLimpio}`);
        return ctx.notFound('El código ingresado no existe.');
      }

      const licencia = licencias[0];

      // CRÍTICO: Validar que la licencia esté activa (activa: true) para poder activarla
      if (licencia.activa === false) {
        strapi.log.warn(`[licencia-estudiante.activar] ❌ Licencia desactivada (activa: false), no se puede activar: ${licencia.id}`);
        return ctx.badRequest('Esta licencia no está disponible para activación.');
      }

      // Verificar si la licencia YA tiene un estudiante asignado (no es null)
      const tieneEstudiante = licencia.estudiante !== null && licencia.estudiante !== undefined;
      
      if (tieneEstudiante) {
        const estudianteId = typeof licencia.estudiante === 'object' ? licencia.estudiante?.id : licencia.estudiante;
        strapi.log.warn(`[licencia-estudiante.activar] ❌ Licencia ya tiene estudiante asignado: ${estudianteId}`);
        return ctx.badRequest('Este código ya fue utilizado por otro alumno.');
      }

      // Verificar que la licencia tenga libro_mira asociado
      if (!licencia.libro_mira) {
        strapi.log.error(`[licencia-estudiante.activar] ❌ Licencia no tiene libro_mira asociado: ${licencia.id}`);
        return ctx.internalServerError('Error en la configuración de la licencia');
      }

      // Verificar que el libro_mira esté activo
      if (licencia.libro_mira.activo === false) {
        strapi.log.warn(`[licencia-estudiante.activar] ❌ Libro MIRA inactivo: ${licencia.libro_mira.id}`);
        return ctx.badRequest('El libro no está disponible para activación');
      }

      // ===== PASO 4: ACCIÓN (La "Activación") =====
      strapi.log.info(`[licencia-estudiante.activar] Activando licencia ${licencia.id} para estudiante ${personaMiraId}`);

      // CRÍTICO: Usar entityService.update para relación estudiante y publishedAt
      // entityService maneja correctamente el sistema de documentos de Strapi 5
      const updatedLicencia = await strapi.entityService.update('api::licencia-estudiante.licencia-estudiante' as any, licencia.id, {
        data: {
          estudiante: personaMiraId, // Actualizar relación con entityService para Admin Panel
          publishedAt: new Date().toISOString(), // CRÍTICO: Publicar para evitar estado "Modified"
          // NOTA: NO especificamos codigo_activacion, libro_mira, etc. - estos se mantienen intactos
        },
      });
      
      if (!updatedLicencia) {
        strapi.log.error(`[licencia-estudiante.activar] ❌ Falló la actualización de la licencia con entityService: ${licencia.id}`);
        return ctx.internalServerError('Error al actualizar la licencia');
      }
      
      // CRÍTICO: Actualizar campos Date y boolean con db.query (solo campos escalares)
      // db.query.update SOLO actualiza los campos especificados, NO borra otros campos
      // Esto es seguro porque solo actualizamos campos escalares simples, no relaciones
      await strapi.db.query('api::licencia-estudiante.licencia-estudiante').update({
        where: { id: licencia.id },
        data: {
          fecha_activacion: new Date(),
          activa: false, // CRÍTICO: Desactivar para que nadie más pueda usarla
          // NOTA: Solo actualizamos estos 2 campos escalares, NO tocamos codigo_activacion, libro_mira, estudiante, etc.
        },
      });
      
      strapi.log.info(`[licencia-estudiante.activar] Licencia actualizada - estudiante: ${updatedLicencia.estudiante?.id || personaMiraId}, activa: false, publishedAt: ${updatedLicencia.publishedAt?.toISOString()}`);
      
      // CRÍTICO: Verificar que los datos importantes no se borraron usando entityService
      // entityService maneja correctamente las relaciones y no requiere nombres de columnas de BD
      try {
        const licenciaVerificada = await strapi.entityService.findOne('api::licencia-estudiante.licencia-estudiante' as any, licencia.id, {
          fields: ['id', 'codigo_activacion', 'activa', 'fecha_activacion'],
          populate: {
            estudiante: {
              fields: ['id'],
            },
            libro_mira: {
              fields: ['id'],
            },
          },
          publicationState: 'live',
        });
        
        if (licenciaVerificada) {
          strapi.log.info(`[licencia-estudiante.activar] Verificación - estudiante: ${licenciaVerificada.estudiante?.id || 'N/A'}, activa: ${licenciaVerificada.activa}, codigo: ${licenciaVerificada.codigo_activacion}, libro_mira: ${licenciaVerificada.libro_mira?.id || 'N/A'}`);
          
          // Verificar que campos críticos no se borraron
          if (!licenciaVerificada.codigo_activacion) {
            strapi.log.error(`[licencia-estudiante.activar] ⚠️ CRÍTICO: codigo_activacion se borró!`);
          }
          if (!licenciaVerificada.libro_mira) {
            strapi.log.error(`[licencia-estudiante.activar] ⚠️ CRÍTICO: libro_mira se borró!`);
          }
          if (!licenciaVerificada.estudiante) {
            strapi.log.error(`[licencia-estudiante.activar] ⚠️ CRÍTICO: estudiante no se guardó!`);
          }
        }
      } catch (verifError: any) {
        strapi.log.warn(`[licencia-estudiante.activar] Error en verificación (no crítico): ${verifError.message}`);
        // No es crítico, la activación ya se completó
      }
      
      strapi.log.info(`[licencia-estudiante.activar] Licencia actualizada - estudiante: ${personaMiraId}, activa: false, publishedAt: ${new Date().toISOString()}`);

      strapi.log.info(`[licencia-estudiante.activar] ✅ Licencia activada exitosamente - ID: ${licencia.id}`);

      // ===== PASO 5: RETORNO =====
      // CRÍTICO: entityService.findOne puede devolver null después de db.query.update
      // Usar los datos de libro_mira que ya tenemos de la búsqueda inicial
      // Si necesitamos datos más completos, intentar con entityService primero, luego fallback
      let libroMiraParaRetornar = licencia.libro_mira;
      
      // Intentar obtener datos más completos con entityService (puede fallar después de db.query)
      try {
        const licenciaActualizada = await strapi.entityService.findOne('api::licencia-estudiante.licencia-estudiante' as any, licencia.id, {
          populate: {
            libro_mira: {
              populate: {
                libro: {
                  fields: ['id', 'nombre_libro', 'isbn_libro', 'subtitulo_libro'],
                  populate: {
                    portada_libro: true,
                    autor_relacion: {
                      fields: ['nombre_completo_autor'],
                    },
                  },
                },
              },
            },
          },
          publicationState: 'live', // Asegurar que busque el publicado
        });
        
        if (licenciaActualizada && licenciaActualizada.libro_mira) {
          libroMiraParaRetornar = licenciaActualizada.libro_mira;
          strapi.log.info(`[licencia-estudiante.activar] Datos completos obtenidos con entityService`);
        } else {
          strapi.log.warn(`[licencia-estudiante.activar] entityService.findOne devolvió null, usando datos de búsqueda inicial`);
        }
      } catch (entityError: any) {
        strapi.log.warn(`[licencia-estudiante.activar] Error al obtener licencia actualizada con entityService: ${entityError.message}`);
        strapi.log.warn(`[licencia-estudiante.activar] Usando datos de libro_mira de la búsqueda inicial`);
      }

      // Verificar que tenemos libro_mira para retornar
      if (!libroMiraParaRetornar) {
        strapi.log.error(`[licencia-estudiante.activar] ❌ CRÍTICO: No se pudo obtener libro_mira para retornar`);
        return ctx.internalServerError('Error al obtener datos del libro activado');
      }

      // Retornar el objeto libro_mira completo para que el Frontend pueda mostrar "¡Libro Activado!" y la foto
      return ctx.send({
        data: libroMiraParaRetornar,
        message: 'Licencia activada exitosamente',
      });

    } catch (error: any) {
      strapi.log.error('[licencia-estudiante.activar] ❌ Error al activar licencia:', error);
      strapi.log.error('[licencia-estudiante.activar] Stack:', error.stack);
      
      return ctx.internalServerError({
        error: {
          message: 'Error interno al procesar la activación de la licencia',
          status: 500,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
      });
    }
  },
}));

