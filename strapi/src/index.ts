import { ensureContentManagerMainFields } from './utils/bootstrap-maintenance';
import bcrypt from 'bcryptjs';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    // Las APIs se registran automáticamente por Strapi
    // No necesitamos verificar aquí ya que pueden no estar completamente cargadas
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[Strapi] 🚀 Bootstrap iniciado');
    console.log('═══════════════════════════════════════════════════════');
    
    // Verificar y corregir schema de up_users si faltan columnas críticas
    try {
      const db = strapi.db;
      const connection = db.connection;
      
      // Verificar si existe la columna email en up_users
      const emailColumnExists = await connection.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'up_users' 
          AND column_name = 'email'
        ) as exists;
      `);
      
      if (!emailColumnExists.rows?.[0]?.exists) {
        strapi.log.warn('[bootstrap] ⚠️ Columna email no existe en up_users, agregándola...');
        await connection.raw(`
          ALTER TABLE "up_users" 
          ADD COLUMN IF NOT EXISTS "email" varchar(255);
        `);
        strapi.log.info('[bootstrap] ✅ Columna email agregada a up_users');
      }
      
      // Verificar si existe la columna confirmed en up_users (necesaria para email confirmation)
      const confirmedColumnExists = await connection.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'up_users' 
          AND column_name = 'confirmed'
        ) as exists;
      `);
      
      if (!confirmedColumnExists.rows?.[0]?.exists) {
        strapi.log.warn('[bootstrap] ⚠️ Columna confirmed no existe en up_users, agregándola...');
        await connection.raw(`
          ALTER TABLE "up_users" 
          ADD COLUMN IF NOT EXISTS "confirmed" boolean DEFAULT false;
        `);
        strapi.log.info('[bootstrap] ✅ Columna confirmed agregada a up_users');
      }
      
      // Verificar si existe la columna blocked en up_users
      const blockedColumnExists = await connection.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'up_users' 
          AND column_name = 'blocked'
        ) as exists;
      `);
      
      if (!blockedColumnExists.rows?.[0]?.exists) {
        strapi.log.warn('[bootstrap] ⚠️ Columna blocked no existe en up_users, agregándola...');
        await connection.raw(`
          ALTER TABLE "up_users" 
          ADD COLUMN IF NOT EXISTS "blocked" boolean DEFAULT false;
        `);
        strapi.log.info('[bootstrap] ✅ Columna blocked agregada a up_users');
      }
    } catch (error: any) {
      strapi.log.warn(`[bootstrap] ⚠️ No se pudo verificar/corregir schema de up_users: ${error.message}`);
      // No fallar el bootstrap si hay error, solo loguear
    }
    
    // Configurar mainFields para que los comboboxes muestren los campos correctos
    await ensureContentManagerMainFields(strapi);
    
    // Verificación opcional de rutas (solo para debug, no crítico)
    // Comentado para evitar advertencias innecesarias
    // Las APIs y rutas se cargan automáticamente por Strapi
    
    // Interceptar entityService.count para plugin::users-permissions.role
    // Esto es más seguro que interceptar db.query directamente
    try {
      const originalEntityServiceCount = strapi.entityService.count;
      
      strapi.entityService.count = async function(uid: string, options: any = {}) {
        // Solo interceptar para plugin::users-permissions.role
        if (uid === 'plugin::users-permissions.role' && options?.filters) {
          const cleanFilters = (filters: any): any => {
            if (!filters || typeof filters !== 'object') {
              return filters;
            }
            
            // Si hay un filtro con 'id' que es un objeto con 'id' anidado, corregirlo
            if (filters.id && typeof filters.id === 'object' && filters.id.id !== undefined) {
              strapi.log.warn('[role-query-fix] Limpiando filters.id anidado:', JSON.stringify(filters.id));
              const idValue = filters.id.id || filters.id.$eq || filters.id.$in;
              if (idValue !== undefined) {
                return {
                  ...filters,
                  id: idValue,
                };
              }
            }
            
            // Recursivamente limpiar filtros anidados
            const cleaned: any = {};
            for (const [key, value] of Object.entries(filters)) {
              if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                cleaned[key] = cleanFilters(value);
              } else {
                cleaned[key] = value;
              }
            }
            return cleaned;
          };
          
          const originalFilters = JSON.stringify(options.filters);
          options.filters = cleanFilters(options.filters);
          
          if (originalFilters !== JSON.stringify(options.filters)) {
            strapi.log.warn('[role-query-fix] Filters limpiados:', JSON.stringify(options.filters, null, 2));
          }
          
          try {
            return await originalEntityServiceCount.call(this, uid, options);
          } catch (error: any) {
            if (error.message && error.message.includes('Undefined attribute level operator id')) {
              strapi.log.warn('[role-query-fix] Error persistente, intentando sin filters');
              const optionsWithoutFilters = { ...options };
              delete optionsWithoutFilters.filters;
              return await originalEntityServiceCount.call(this, uid, optionsWithoutFilters);
            }
            throw error;
          }
        }
        
        // Para todos los demás casos, usar el método original
        return await originalEntityServiceCount.call(this, uid, options);
      };
      
      strapi.log.info('[role-query-fix] Interceptor de entityService.count() configurado para plugin::users-permissions.role');
    } catch (error: any) {
      strapi.log.warn('[role-query-fix] Error configurando interceptor:', error.message);
    }
    
    // Asignar permisos públicos para persona-mira y libro-mira
    try {
      // 1. Buscar el rol Public (una sola vez para ambos)
      const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
      });

      if (!publicRole) {
        strapi.log.warn('[bootstrap] No se encontró el rol Public. Saltando asignación de permisos.');
      } else {
        // 2. Configurar permisos para persona-mira (login, find, findOne)
        strapi.log.info('[bootstrap] Configurando permisos para persona-mira...');
        const personaMiraActions = [
          'api::persona-mira.persona-mira.login',
          'api::persona-mira.persona-mira.find',
          'api::persona-mira.persona-mira.findOne',
        ];
        
        for (const action of personaMiraActions) {
          const existingPermission = await strapi.query('plugin::users-permissions.permission').findOne({
            where: {
              action: action,
              role: publicRole.id,
            },
          });

          if (existingPermission) {
            strapi.log.info(`[bootstrap] ✅ Permiso ${action} ya está asignado al rol Public.`);
          } else {
            await strapi.query('plugin::users-permissions.permission').create({
              data: {
                action: action,
                role: publicRole.id,
              },
            });
            strapi.log.info(`[bootstrap] ✅ Permiso ${action} asignado exitosamente al rol Public.`);
          }
        }
        
        // 3. Configurar permisos para libro-mira.findOne
        strapi.log.info('[bootstrap] Configurando permisos públicos para libro-mira...');
        const libroMiraAction = 'api::libro-mira.libro-mira.findOne';
        
        const existingLibroMiraPermission = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: libroMiraAction,
            role: publicRole.id,
          },
        });

        if (existingLibroMiraPermission) {
          strapi.log.info(`[bootstrap] ✅ Permiso ${libroMiraAction} ya está asignado al rol Public.`);
        } else {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: libroMiraAction,
              role: publicRole.id,
            },
          });
          strapi.log.info(`[bootstrap] ✅ Permiso ${libroMiraAction} creado y asignado al rol Public.`);
        }

        // 4. Configurar permisos para omr-evaluacion.create
        strapi.log.info('[bootstrap] Configurando permisos públicos para omr-evaluacion...');
        const omrEvaluacionAction = 'api::omr-evaluacion.omr-evaluacion.create';
        
        const existingOmrPermission = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: omrEvaluacionAction,
            role: publicRole.id,
          },
        });

        if (existingOmrPermission) {
          strapi.log.info(`[bootstrap] ✅ Permiso ${omrEvaluacionAction} ya está asignado al rol Public.`);
        } else {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: omrEvaluacionAction,
              role: publicRole.id,
            },
          });
          strapi.log.info(`[bootstrap] ✅ Permiso ${omrEvaluacionAction} creado y asignado al rol Public.`);
        }

        // 5. 🔓 PERMISOS PÚBLICOS PARA CREAR EVALUACIONES Y SUBIR IMÁGENES (SIN AUTENTICACIÓN)
        strapi.log.info('[bootstrap] 🔓 Configurando permisos PÚBLICOS para crear evaluaciones y subir imágenes...');
        const permisosPublicosCriticos = [
          'api::evaluacion.evaluacion.create',
          'api::evaluacion.evaluacion.find',
          'api::evaluacion.evaluacion.findOne',
          'plugin::upload.content-api.upload',
          'plugin::upload.controllers.content-api.upload',
        ];

        for (const accion of permisosPublicosCriticos) {
          try {
            const permisoExistente = await strapi.query('plugin::users-permissions.permission').findOne({
              where: {
                action: accion,
                role: publicRole.id,
              },
            });

            if (permisoExistente) {
              if (!permisoExistente.enabled) {
                await strapi.query('plugin::users-permissions.permission').update({
                  where: { id: permisoExistente.id },
                  data: { enabled: true },
                });
                strapi.log.info(`[bootstrap] ✅ Permiso PÚBLICO ${accion} habilitado (estaba deshabilitado)`);
              } else {
                strapi.log.info(`[bootstrap] ✅ Permiso PÚBLICO ${accion} ya existe y está habilitado`);
              }
            } else {
              await strapi.query('plugin::users-permissions.permission').create({
                data: {
                  action: accion,
                  role: publicRole.id,
                  enabled: true,
                },
              });
              strapi.log.info(`[bootstrap] ✅ Permiso PÚBLICO ${accion} CREADO y asignado al rol Public`);
            }
          } catch (permisoError: any) {
            strapi.log.error(`[bootstrap] ❌ Error al procesar permiso público ${accion}: ${permisoError.message}`);
          }
        }
      }
    } catch (error: any) {
      strapi.log.error('[bootstrap] ❌ Error al configurar permisos públicos:', error.message);
      // No lanzamos el error para que Strapi pueda iniciar aunque falle esto
    }

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
        // IMPORTANTE: Los estudiantes (persona-mira) también pueden crear evaluaciones por ahora
        const permisosCriticos = [
          // Evaluaciones (estudiantes pueden crear por ahora)
          'api::evaluacion.evaluacion.create',
          'api::evaluacion.evaluacion.find',
          'api::evaluacion.evaluacion.findOne',
          // Libros MIRA
          'api::libro-mira.libro-mira.find',
          'api::libro-mira.libro-mira.findOne',
          // Upload de imágenes (CRÍTICO para subir hoja maestra)
          // Habilitar AMBAS variantes por seguridad (Strapi v5 puede usar cualquiera)
          'plugin::upload.content-api.upload',
          'plugin::upload.controllers.content-api.upload',
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
      // No lanzamos el error para que Strapi pueda iniciar aunque falle esto
    }
    
    // 🔐 CONFIGURAR CONFIRMACIÓN DE EMAIL PROGRAMÁTICAMENTE
    // Esto es necesario porque el Admin Panel está roto y no podemos activarlo manualmente
    try {
      strapi.log.info('[bootstrap] 🔐 Configurando confirmación de email programáticamente...');
      
      const pluginStore = strapi.store({
        type: 'plugin',
        name: 'users-permissions',
      });

      const prevSettings = await pluginStore.get({ key: 'advanced' }) || {};

      // Obtener URL del frontend desde variables de entorno o usar default
      const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
      const confirmationUrl = `${frontendUrl}/connect/email-confirmation`;

      // Forzar configuración
      await pluginStore.set({
        key: 'advanced',
        value: {
          ...prevSettings,
          email_confirmation: true, // Activar confirmación
          email_confirmation_redirection: confirmationUrl, // URL de destino
        },
      });
      
      // CRÍTICO: Configurar también el template de email de confirmación
      // El template debe incluir el token {{TOKEN}} que Strapi reemplazará automáticamente
      const emailTemplates = await pluginStore.get({ key: 'email' }) || {};
      
      await pluginStore.set({
        key: 'email',
        value: {
          ...emailTemplates,
          email_confirmation: {
            display: 'Email.template.email_confirmation',
            icon: 'envelope',
            options: {
              from: {
                name: 'MIRA.APP',
                email: process.env.SENDGRID_DEFAULT_FROM || 'no-reply@mira.app',
              },
              response_email: process.env.SENDGRID_DEFAULT_REPLY_TO || 'soporte@mira.app',
              object: 'Confirma tu cuenta en MIRA.APP',
              message: `<p>¡Gracias por registrarte en MIRA.APP!</p>
<p>Por favor, confirma tu cuenta haciendo clic en el siguiente enlace:</p>
<p><a href="<%= URL %>?confirmation=<%= TOKEN %>">Confirmar mi cuenta</a></p>
<p>O copia y pega este enlace en tu navegador:</p>
<p><%= URL %>?confirmation=<%= TOKEN %></p>
<p>Si no creaste esta cuenta, puedes ignorar este correo.</p>
<p>Este enlace expirará en 24 horas.</p>`,
            },
          },
        },
      });
      
      strapi.log.info('✅ [Bootstrap] Confirmación de email activada forzosamente por código.');
      strapi.log.info(`   - URL de redirección: ${confirmationUrl}`);
      strapi.log.info(`   - Template de email configurado`);
    } catch (error: any) {
      strapi.log.error('❌ [Bootstrap] Error al configurar email confirmation:', error.message);
      strapi.log.error('❌ [Bootstrap] Stack:', error.stack);
      // No lanzamos el error para que Strapi pueda iniciar aunque falle esto
    }
    
    // Crear usuario de prueba para MIRA.APP si no existe
    try {
      strapi.log.info('[bootstrap] Verificando usuario de prueba para MIRA.APP...');
      
      const testEmail = 'prueba@mira.app';
      const testRut = '12345678-9';
      
      // 1. Buscar si ya existe el persona-mira de prueba
      const existingPersonaMira = await strapi.entityService.findMany('api::persona-mira.persona-mira' as any, {
        filters: { email: testEmail },
        limit: 1,
      });
      
      if (existingPersonaMira && existingPersonaMira.length > 0) {
        strapi.log.info(`[bootstrap] ✅ Usuario de prueba ${testEmail} ya existe.`);
      } else {
        strapi.log.info(`[bootstrap] Creando usuario de prueba ${testEmail}...`);
        
        // 2. Buscar o crear la persona base
        let persona = await strapi.entityService.findMany('api::persona.persona', {
          filters: { rut: testRut },
          limit: 1,
        });
        
        if (!persona || persona.length === 0) {
          // Crear persona de prueba
          persona = [await strapi.entityService.create('api::persona.persona', {
            data: {
              rut: testRut,
              nombres: 'Usuario',
              primer_apellido: 'Prueba',
              segundo_apellido: 'MIRA',
              nombre_completo: 'Usuario Prueba MIRA',
              genero: 'otro',
              origen: 'bootstrap',
              activo: true,
              publishedAt: new Date(),
            },
          })];
          strapi.log.info(`[bootstrap] ✅ Persona de prueba creada con RUT ${testRut}`);
        } else {
          strapi.log.info(`[bootstrap] ✅ Persona de prueba ya existe con RUT ${testRut}`);
        }
        
        // 3. Crear persona-mira con email y password
        // IMPORTANTE: Hashear la contraseña manualmente porque db.query no ejecuta lifecycles
        const passwordHash = bcrypt.hashSync('123456', 10);
        
        const personaMiraCreada = await strapi.db.query('api::persona-mira.persona-mira').create({
          data: {
            persona: persona[0].id,
            email: testEmail,
            password: passwordHash, // Hasheado manualmente
            activo: true,
            fecha_registro: new Date(),
            publishedAt: new Date(),
          },
        });
        
        strapi.log.info(`[bootstrap] Persona-mira creada con ID: ${personaMiraCreada.id}, email: ${testEmail}`);
        
        strapi.log.info(`[bootstrap] ✅ Usuario de prueba ${testEmail} creado exitosamente con password: 123456`);
        
        // Crear libro-mira de prueba y asignar licencia
        try {
          strapi.log.info('[bootstrap] Creando libro-mira de prueba para MIRA.APP...');
          
          // 1. Buscar o crear un libro base
          const testISBN = '978-956-000-000-0';
          let libroBase = await strapi.entityService.findMany('api::libro.libro', {
            filters: { isbn_libro: testISBN },
            limit: 1,
          });
          
          if (!libroBase || libroBase.length === 0) {
            libroBase = [await strapi.entityService.create('api::libro.libro', {
              data: {
                isbn_libro: testISBN,
                nombre_libro: 'Libro de Prueba MIRA',
                subtitulo_libro: 'Para testing de la aplicación',
                activo: true,
                publishedAt: new Date(),
              },
            })];
            strapi.log.info(`[bootstrap] ✅ Libro base creado: ${libroBase[0].id}`);
          } else {
            strapi.log.info(`[bootstrap] ✅ Libro base ya existe: ${libroBase[0].id}`);
          }
          
          // 2. Buscar o crear libro-mira
          // CRÍTICO: Ya no usamos codigo_activacion_base, buscamos por relación libro
          let libroMira = await strapi.entityService.findMany('api::libro-mira.libro-mira', {
            filters: { libro: libroBase[0].id },
            limit: 1,
          });
          
          if (!libroMira || libroMira.length === 0) {
            libroMira = [await strapi.entityService.create('api::libro-mira.libro-mira', {
              data: {
                libro: libroBase[0].id,
                activo: true,
                google_drive_folder_id: '1ABC123DEF456GHI789JKL', // ID de prueba
                url_qr_redireccion: 'https://mira.app/qr/test',
                publishedAt: new Date(),
              },
            })];
            strapi.log.info(`[bootstrap] ✅ Libro-mira creado: ID=${libroMira[0].id}, documentId=${libroMira[0].documentId}`);
          } else {
            // Asegurar que esté publicado
            if (!libroMira[0].publishedAt) {
              await strapi.entityService.update('api::libro-mira.libro-mira', libroMira[0].id, {
                data: { publishedAt: new Date() },
              });
              strapi.log.info(`[bootstrap] ✅ Libro-mira publicado: ID=${libroMira[0].id}`);
            } else {
              strapi.log.info(`[bootstrap] ✅ Libro-mira ya existe y está publicado: ID=${libroMira[0].id}, documentId=${libroMira[0].documentId}`);
            }
          }
          
          // 3. Verificar si el usuario ya tiene una licencia para este libro
          const personaMiraId = personaMiraCreada.id;
          const licenciaExistente = await strapi.entityService.findMany('api::licencia-estudiante.licencia-estudiante', {
            filters: {
              estudiante: personaMiraId,
              libro_mira: libroMira[0].id,
              activa: true,
            },
            limit: 1,
          });
          
          if (!licenciaExistente || licenciaExistente.length === 0) {
            // Crear licencia de prueba con código único
            // CRÍTICO: Ya no usamos codigo_activacion_base del libro, generamos código único directamente
            const codigoUnico = `TEST-MIRA-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const licenciaCreada = await strapi.entityService.create('api::licencia-estudiante.licencia-estudiante', {
              data: {
                estudiante: personaMiraId,
                libro_mira: libroMira[0].id,
                codigo_activacion: codigoUnico,
                fecha_activacion: new Date(),
                activa: true,
                google_drive_folder_id: libroMira[0].google_drive_folder_id,
                publishedAt: new Date(),
              },
            });
            strapi.log.info(`[bootstrap] ✅ Licencia de prueba creada para usuario ${testEmail}`);
            strapi.log.info(`[bootstrap]   - Código de activación: ${codigoUnico}`);
          } else {
            strapi.log.info(`[bootstrap] ✅ Usuario ${testEmail} ya tiene licencia para este libro`);
            strapi.log.info(`[bootstrap]   - Código de activación existente: ${licenciaExistente[0].codigo_activacion || 'N/A'}`);
          }
          
          strapi.log.info(`[bootstrap] ✅ Libro-mira de prueba configurado correctamente`);
          strapi.log.info(`[bootstrap]   - Libro-mira ID: ${libroMira[0].id}, documentId: ${libroMira[0].documentId}`);
        } catch (error: any) {
          strapi.log.error('[bootstrap] ❌ Error al crear libro-mira de prueba:', error.message);
          strapi.log.error('[bootstrap] Stack:', error.stack);
          // No lanzamos el error para que Strapi pueda iniciar aunque falle esto
        }
      }
    } catch (error: any) {
      strapi.log.error('[bootstrap] ❌ Error al crear usuario de prueba:', error.message);
      strapi.log.error('[bootstrap] Stack:', error.stack);
      // No lanzamos el error para que Strapi pueda iniciar aunque falle esto
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Strapi iniciado correctamente');
    console.log('═══════════════════════════════════════════════════════');
  },
};
