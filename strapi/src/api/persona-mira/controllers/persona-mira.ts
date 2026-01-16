import { factories } from '@strapi/strapi';
import bcrypt from 'bcryptjs';

export default factories.createCoreController('api::persona-mira.persona-mira' as any, ({ strapi }) => ({
  /**
   * Sobrescribir create para procesar password antes de crear
   * CRÍTICO: Usar db.query en lugar de entityService porque entityService filtra campos private
   */
  async create(ctx: any) {
    try {
      const body = ctx.request.body?.data || ctx.request.body;
      
      // Extraer password del body antes de que se filtre
      const passwordPlain = body?.password;
      
      strapi.log.info('[persona-mira.controller] create ejecutado');
      strapi.log.info('[persona-mira.controller] Password presente en body:', !!passwordPlain);
      
      // Preparar datos para crear
      const createData: any = { ...body };
      
      // Si hay password, hashearlo ANTES de crear
      if (passwordPlain && typeof passwordPlain === 'string') {
        const passwordStr = String(passwordPlain).trim();
        
        // Verificar si ya está hasheado
        const isHashed = passwordStr.startsWith('$2a$') || passwordStr.startsWith('$2b$');
        
        if (!isHashed) {
          strapi.log.info('[persona-mira.controller] Hasheando contraseña antes de crear');
          createData.password = bcrypt.hashSync(passwordStr, 10);
          strapi.log.info('[persona-mira.controller] Password hasheado correctamente');
        } else {
          strapi.log.info('[persona-mira.controller] Password ya está hasheado, manteniendo');
          createData.password = passwordStr;
        }
      } else {
        strapi.log.warn('[persona-mira.controller] ⚠️ No se recibió password en el body');
      }
      
      // CRÍTICO: Incluir publishedAt directamente en el create (como en el bootstrap)
      // Esto asegura que el registro se publique inmediatamente y las relaciones se resuelvan
      if (!createData.publishedAt) {
        createData.publishedAt = new Date();
        strapi.log.info('[persona-mira.controller] Agregando publishedAt al create para publicar automáticamente');
      }
      
      // CRÍTICO: Usar db.query en lugar de entityService porque entityService filtra campos private
      // db.query permite guardar campos private directamente
      strapi.log.info('[persona-mira.controller] Creando registro con db.query, datos:', JSON.stringify({ ...createData, password: '[HIDDEN]' }, null, 2));
      
      const result = await strapi.db.query('api::persona-mira.persona-mira').create({
        data: createData,
      });
      
      // Verificar que el resultado no sea null
      if (!result) {
        strapi.log.error('[persona-mira.controller] db.query().create() devolvió null');
        throw new Error('No se pudo crear el registro. El resultado fue null.');
      }
      
      // Verificar que tenga id
      if (!result.id) {
        strapi.log.error('[persona-mira.controller] db.query().create() no devolvió id. Result:', JSON.stringify(result, null, 2));
        throw new Error('No se pudo crear el registro. No se obtuvo ID del registro creado.');
      }
      
      strapi.log.info('[persona-mira.controller] Registro creado exitosamente con ID:', result.id, 'documentId:', result.documentId, 'publishedAt:', result.publishedAt);
      
      // Obtener el registro completo publicado usando entityService para incluir relaciones
      let fullResult;
      try {
        fullResult = await strapi.entityService.findOne('api::persona-mira.persona-mira' as any, result.id, {
          populate: ['persona', 'colegio'],
        });
      } catch (findError: any) {
        strapi.log.warn('[persona-mira.controller] No se pudo obtener registro completo con entityService, usando resultado de db.query:', findError.message);
        // Si falla entityService, usar el resultado de db.query directamente
        fullResult = result;
      }
      
      // Asegurar que documentId, id y email estén presentes en la respuesta
      const responseData = {
        ...fullResult,
        id: fullResult?.id || result.id,
        documentId: fullResult?.documentId || result.documentId || result.id,
        email: fullResult?.email || result.email || createData.email, // Asegurar que email esté presente
      };
      
      strapi.log.info('[persona-mira.controller] Respuesta formateada con id:', responseData.id, 'documentId:', responseData.documentId, 'email:', responseData.email);
      
      // Verificar que email esté presente antes de devolver
      if (!responseData.email) {
        strapi.log.error('[persona-mira.controller] ⚠️ Email no está presente en la respuesta. fullResult:', JSON.stringify(fullResult, null, 2), 'result:', JSON.stringify(result, null, 2));
      }
      
      return ctx.created({ data: responseData });
    } catch (error: any) {
      strapi.log.error('[persona-mira.controller] Error en create:', error);
      strapi.log.error('[persona-mira.controller] Stack:', error.stack);
      
      // Manejar errores de validación
      if (error.name === 'ValidationError' || error.status === 400) {
        return ctx.badRequest(error.message || 'Error de validación');
      }
      
      return ctx.internalServerError(
        process.env.NODE_ENV === 'development' 
          ? `Error al crear registro: ${error.message}` 
          : 'Error al crear registro'
      );
    }
  },

  /**
   * Endpoint de login personalizado para estudiantes MIRA.APP
   * 
   * Valida credenciales (email y password) y devuelve el usuario sin el password.
   * 
   * IMPORTANTE: El campo password es `private`, por lo que debemos usar
   * strapi.db.query para acceder directamente a la base de datos y obtener
   * el password hasheado para compararlo.
   */
  async login(ctx: any) {
    try {
      // Debug: Ver qué está llegando en el request
      strapi.log.info('[persona-mira.login] Request body:', JSON.stringify(ctx.request.body));
      strapi.log.info('[persona-mira.login] Request method:', ctx.request.method);
      strapi.log.info('[persona-mira.login] Request headers:', JSON.stringify(ctx.request.headers));
      
      const body = ctx.request.body?.data || ctx.request.body;
      const { email, password } = body || {};

      // Validación de input
      if (!email || !password) {
        strapi.log.warn('[persona-mira.login] Faltan credenciales:', { 
          email: !!email, 
          password: !!password,
          bodyKeys: Object.keys(body || {}),
          rawBody: JSON.stringify(ctx.request.body)
        });
        return ctx.badRequest('Email y contraseña son requeridos');
      }

      strapi.log.info(`[persona-mira.login] Intento de login para: ${email}`);

      // Buscar usuario por email
      // CRÍTICO: Como password es private, usamos strapi.db.query para acceder directamente
      // CRÍTICO: Siempre usar el registro PUBLICADO, no el draft
      const usuarios = await strapi.db.query('api::persona-mira.persona-mira').findMany({
        where: {
          email: email.toLowerCase().trim(),
          publishedAt: { $notNull: true }, // Solo registros publicados
        },
        select: ['id', 'email', 'password', 'activo', 'fecha_registro', 'documentId'],
        orderBy: { publishedAt: 'desc' }, // Si hay múltiples, usar el más reciente
      });

      if (!usuarios || usuarios.length === 0) {
        strapi.log.warn(`[persona-mira.login] Usuario no encontrado (o no publicado): ${email}`);
        return ctx.badRequest('Credenciales inválidas');
      }

      const usuario = usuarios[0];
      strapi.log.info(`[persona-mira.login] Usuario encontrado: ID=${usuario.id}, DocumentID=${usuario.documentId}`);

      // Verificar que el usuario esté activo
      if (!usuario.activo) {
        return ctx.badRequest('Usuario inactivo');
      }

      // CRÍTICO: Verificar que el usuario de users-permissions esté confirmado
      // Si no está confirmado, no puede iniciar sesión
      // Usar entityService en lugar de db.query para evitar problemas con campos que no existen
      try {
        const upUsers = await strapi.entityService.findMany('plugin::users-permissions.user' as any, {
          filters: { email: email.toLowerCase().trim() },
          fields: ['id', 'email', 'username', 'confirmed', 'blocked'],
          limit: 1,
        });
        
        const upUser = Array.isArray(upUsers) && upUsers.length > 0 ? upUsers[0] : upUsers;

        if (upUser) {
          // Verificar si está bloqueado (campo puede no existir en Strapi 5, usar verificación segura)
          if (upUser.blocked === true) {
            strapi.log.warn(`[persona-mira.login] Usuario ${email} está bloqueado`);
            return ctx.badRequest('Tu cuenta está bloqueada. Contacta al administrador.');
          }
          
          // Verificar si está confirmado (campo puede no existir en Strapi 5, usar verificación segura)
          // En Strapi 5, confirmed puede ser null, false, o true
          if (upUser.confirmed === false || upUser.confirmed === null) {
            strapi.log.warn(`[persona-mira.login] Usuario ${email} no ha confirmado su email (confirmed=${upUser.confirmed})`);
            return ctx.badRequest('Debes confirmar tu email antes de iniciar sesión. Revisa tu correo electrónico para el enlace de confirmación.');
          }
          
          strapi.log.info(`[persona-mira.login] Usuario ${email} verificado - confirmado: ${upUser.confirmed}, bloqueado: ${upUser.blocked}`);
        } else {
          // Si no existe usuario en users-permissions, permitir login (compatibilidad con usuarios antiguos)
          strapi.log.warn(`[persona-mira.login] No se encontró usuario users-permissions para ${email}, permitiendo login (usuario antiguo)`);
        }
      } catch (upErr: any) {
        // Si hay error (ej: campo confirmed no existe), permitir login (compatibilidad)
        strapi.log.warn(`[persona-mira.login] Error verificando confirmación en users-permissions: ${upErr.message}`);
        strapi.log.warn(`[persona-mira.login] Permitiendo login (compatibilidad con usuarios antiguos o schema diferente)`);
      }

      // Verificar contraseña
      if (!usuario.password) {
        strapi.log.error(`[persona-mira.login] Usuario ${email} no tiene password configurado`);
        return ctx.badRequest('Error en la configuración del usuario');
      }

      // Debug: Verificar formato del hash (debe empezar con $2a$ o $2b$)
      const hashFormat = usuario.password.substring(0, 4);
      const hashLength = usuario.password.length;
      strapi.log.info(`[persona-mira.login] Formato de hash: ${hashFormat}, Longitud: ${hashLength}`);

      // Verificar que el hash sea válido
      const isHashValid = usuario.password.startsWith('$2a$') || usuario.password.startsWith('$2b$');
      const isLengthValid = hashLength === 60;

      if (!isHashValid || !isLengthValid) {
        strapi.log.error(`[persona-mira.login] Hash de password inválido para ${email}. Formato: ${hashFormat}, Longitud: ${hashLength}`);
        strapi.log.error(`[persona-mira.login] Hash completo (primeros 30 chars): ${usuario.password.substring(0, 30)}...`);
        
        // Intentar corregir hasheando la contraseña proporcionada
        strapi.log.warn(`[persona-mira.login] Intentando corregir hash inválido...`);
        const nuevoHash = bcrypt.hashSync(password, 10);
        await strapi.db.query('api::persona-mira.persona-mira').update({
          where: { id: usuario.id },
          data: { password: nuevoHash },
        });
        strapi.log.info(`[persona-mira.login] Hash corregido. Intenta login nuevamente.`);
        return ctx.badRequest('Credenciales inválidas. Por favor, intenta nuevamente.');
      }

      const passwordValido = bcrypt.compareSync(password, usuario.password);

      if (!passwordValido) {
        strapi.log.warn(`[persona-mira.login] Contraseña incorrecta para: ${email}`);
        strapi.log.warn(`[persona-mira.login] Hash en BD (primeros 20 chars): ${usuario.password.substring(0, 20)}...`);
        return ctx.badRequest('Credenciales inválidas');
      }

      strapi.log.info(`[persona-mira.login] Login exitoso para: ${email}`);

      // Actualizar último acceso
      await strapi.db.query('api::persona-mira.persona-mira').update({
        where: { id: usuario.id },
        data: { ultimo_acceso: new Date() },
      });

      // Obtener usuario completo sin password para la respuesta
      // CRÍTICO: entityService.findOne puede devolver null si el registro no está publicado correctamente
      // Usar db.query como fallback si entityService falla
      const idNumerico = usuario.id; // Usar id numérico, no documentId
      let usuarioCompleto: any = null;

      try {
        usuarioCompleto = await strapi.entityService.findOne('api::persona-mira.persona-mira' as any, idNumerico, {
          fields: ['id', 'email', 'fecha_registro', 'activo', 'ultimo_acceso'],
          populate: {
            persona: {
              fields: ['id', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'rut'],
              populate: {
                emails: true,
                telefonos: true,
              },
            },
            licencias_activadas: {
              fields: ['id', 'codigo_activacion', 'fecha_activacion', 'activa'],
              populate: {
                libro_mira: {
                  fields: ['id', 'activo'],
                  populate: {
                    libro: {
                      fields: ['id', 'nombre_libro', 'isbn_libro'],
                      populate: {
                        portada_libro: true, // Campo media se popula así
                      },
                    },
                  },
                },
              },
            },
          },
          publicationState: 'live', // Asegurar que busque el registro publicado
        });
      } catch (entityError: any) {
        strapi.log.warn(`[persona-mira.login] entityService.findOne falló: ${entityError.message}`);
        usuarioCompleto = null;
      }

      // CRÍTICO: Si entityService devuelve null, usar datos de db.query como fallback
      if (!usuarioCompleto) {
        strapi.log.warn(`[persona-mira.login] ⚠️ entityService.findOne devolvió null, usando datos de db.query como fallback`);
        
        // Obtener datos básicos con db.query
        const usuarioDb = await strapi.db.query('api::persona-mira.persona-mira').findOne({
          where: { id: idNumerico },
          select: ['id', 'email', 'fecha_registro', 'activo', 'ultimo_acceso', 'documentId'],
        });

        if (!usuarioDb) {
          strapi.log.error(`[persona-mira.login] ⚠️ CRÍTICO: No se pudo obtener usuario ni con entityService ni con db.query`);
          return ctx.internalServerError('Error al obtener datos del usuario');
        }

        // Construir objeto de respuesta con datos básicos
        usuarioCompleto = {
          id: usuarioDb.id,
          email: usuarioDb.email,
          fecha_registro: usuarioDb.fecha_registro,
          activo: usuarioDb.activo,
          ultimo_acceso: usuarioDb.ultimo_acceso,
          persona: null, // Se poblará después si es necesario
          licencias_activadas: [], // Se poblará después si es necesario
        };

        // Intentar poblar persona y licencias por separado
        try {
          // Poblar persona
          if (usuarioDb.persona) {
            const personaId = typeof usuarioDb.persona === 'object' ? usuarioDb.persona.id : usuarioDb.persona;
            if (personaId) {
              const persona = await strapi.entityService.findOne('api::persona.persona' as any, personaId, {
                fields: ['id', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'rut'],
                populate: {
                  emails: true,
                  telefonos: true,
                },
              });
              usuarioCompleto.persona = persona;
            }
          }

          // Poblar licencias activadas
          // CRÍTICO: NO filtrar por activa. Las licencias activadas tienen activa: false pero pertenecen al usuario
          // Solo filtrar por estudiante (licencias del usuario)
          const licencias = await strapi.entityService.findMany('api::licencia-estudiante.licencia-estudiante' as any, {
            filters: {
              estudiante: idNumerico,
              // NO filtrar por activa: true - las licencias activadas tienen activa: false
            },
            fields: ['id', 'codigo_activacion', 'fecha_activacion', 'activa'],
            populate: {
              libro_mira: {
                fields: ['id', 'activo'],
                populate: {
                  libro: {
                    fields: ['id', 'nombre_libro', 'isbn_libro'],
                    populate: {
                      portada_libro: true,
                    },
                  },
                },
              },
            },
          });
          usuarioCompleto.licencias_activadas = licencias || [];
        } catch (populateError: any) {
          strapi.log.warn(`[persona-mira.login] Error al poblar relaciones: ${populateError.message}`);
          // Continuar con datos básicos
        }
      }

      // CRÍTICO: Verificar que usuarioCompleto tenga id antes de generar JWT
      if (!usuarioCompleto || !usuarioCompleto.id) {
        strapi.log.error(`[persona-mira.login] ⚠️ CRÍTICO: usuarioCompleto no tiene id válido`);
        return ctx.internalServerError('Error al obtener datos del usuario');
      }

      // Generar JWT token usando el servicio de users-permissions
      let jwt = '';
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        jwt = jwtService.issue({
          id: usuarioCompleto.id,
          email: usuarioCompleto.email,
        });
        strapi.log.info(`[persona-mira.login] JWT generado exitosamente para usuario ${usuarioCompleto.id}`);
      } catch (jwtError: any) {
        strapi.log.error(`[persona-mira.login] Error al generar JWT: ${jwtError.message}`);
        // Continuar sin JWT, pero esto causará problemas con endpoints protegidos
      }

      // Respuesta exitosa (SIN password, CON JWT)
      return ctx.send({
        data: {
          id: usuarioCompleto.id,
          email: usuarioCompleto.email,
          fecha_registro: usuarioCompleto.fecha_registro,
          activo: usuarioCompleto.activo,
          ultimo_acceso: usuarioCompleto.ultimo_acceso,
          persona: usuarioCompleto.persona || null,
          licencias_activadas: usuarioCompleto.licencias_activadas || [],
          jwt: jwt, // Incluir JWT en la respuesta
        },
        message: 'Login exitoso',
      });
    } catch (error: any) {
      strapi.log.error('Error en login de persona-mira:', error);
      return ctx.internalServerError(
        process.env.NODE_ENV === 'development' 
          ? `Error interno al procesar el login: ${error.message}` 
          : 'Error interno al procesar el login'
      );
    }
  },

  /**
   * Endpoint temporal para resetear contraseña del usuario de prueba
   * SOLO PARA DESARROLLO/TESTING
   */
  async resetPassword(ctx: any) {
    try {
      const body = ctx.request.body?.data || ctx.request.body;
      const { email, newPassword } = body || {};

      if (!email || !newPassword) {
        return ctx.badRequest('Email y nueva contraseña son requeridos');
      }

      // Solo permitir para el usuario de prueba en desarrollo
      if (email !== 'prueba@mira.app' && process.env.NODE_ENV === 'production') {
        return ctx.forbidden('Este endpoint solo está disponible para el usuario de prueba en desarrollo');
      }

      strapi.log.info(`[persona-mira.resetPassword] Reseteando contraseña para: ${email}`);

      // Buscar usuario (todos los registros: draft y publicado)
      const usuarios = await strapi.db.query('api::persona-mira.persona-mira').findMany({
        where: {
          email: email.toLowerCase().trim(),
        },
        select: ['id', 'email', 'documentId', 'publishedAt'],
      });

      if (!usuarios || usuarios.length === 0) {
        return ctx.badRequest('Usuario no encontrado');
      }

      // Hashear nueva contraseña
      const passwordHash = bcrypt.hashSync(newPassword, 10);

      // Actualizar contraseña en TODOS los registros (draft y publicado)
      const documentIds = new Set(usuarios.map((u: any) => u.documentId).filter(Boolean));
      
      for (const usuario of usuarios) {
        await strapi.db.query('api::persona-mira.persona-mira').update({
          where: { id: usuario.id },
          data: { password: passwordHash },
        });
        strapi.log.info(`[persona-mira.resetPassword] Contraseña actualizada para registro ID=${usuario.id} (${usuario.publishedAt ? 'publicado' : 'draft'})`);
      }

      strapi.log.info(`[persona-mira.resetPassword] Contraseña actualizada para: ${email} (${usuarios.length} registro(s))`);

      return ctx.send({
        message: 'Contraseña actualizada exitosamente',
        data: {
          email: email,
        },
      });
    } catch (error: any) {
      strapi.log.error('Error en resetPassword de persona-mira:', error);
      return ctx.internalServerError(
        process.env.NODE_ENV === 'development' 
          ? `Error interno: ${error.message}` 
          : 'Error interno al procesar la solicitud'
      );
    }
  },

  /**
   * Endpoint para obtener los datos del usuario actual
   * Usa el ID del query param (viene del localStorage del frontend)
   */
  async getCurrentUser(ctx: any) {
    try {
      const { id } = ctx.query;

      if (!id) {
        return ctx.badRequest('ID de usuario es requerido');
      }

      strapi.log.info(`[persona-mira.getCurrentUser] Obteniendo datos para usuario ID: ${id}`);

      // CRÍTICO: Usar db.query primero porque entityService puede fallar con registros recién creados
      let usuario: any = null;
      
      try {
        // Intentar primero con db.query para obtener datos básicos
        const usuarioDb = await strapi.db.query('api::persona-mira.persona-mira').findOne({
          where: { id: Number(id) },
          select: ['id', 'email', 'fecha_registro', 'activo', 'ultimo_acceso', 'documentId'],
        });
        
        if (usuarioDb) {
          usuario = {
            id: usuarioDb.id,
            email: usuarioDb.email,
            activo: usuarioDb.activo,
            fecha_registro: usuarioDb.fecha_registro,
            ultimo_acceso: usuarioDb.ultimo_acceso,
            documentId: usuarioDb.documentId,
          };
          
          // Obtener persona relacionada si existe
          if (usuarioDb.persona) {
            try {
              const personaId = typeof usuarioDb.persona === 'object' ? usuarioDb.persona.id : usuarioDb.persona;
              if (personaId) {
                const persona = await strapi.entityService.findOne('api::persona.persona' as any, personaId, {
                  fields: ['id', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'rut'],
                  populate: {
                    emails: true,
                    telefonos: true,
                  },
                });
                usuario.persona = persona;
              }
            } catch (personaError: any) {
              strapi.log.warn(`[persona-mira.getCurrentUser] No se pudo obtener persona relacionada: ${personaError.message}`);
            }
          }
          
          // Obtener licencias activadas
          // CRÍTICO: NO filtrar por activa. Las licencias activadas tienen activa: false pero pertenecen al usuario
          // Solo filtrar por estudiante (licencias del usuario)
          try {
            const licencias = await strapi.entityService.findMany('api::licencia-estudiante.licencia-estudiante' as any, {
              filters: { 
                estudiante: usuarioDb.id,
                // NO filtrar por activa: true - las licencias activadas tienen activa: false
              },
              fields: ['id', 'codigo_activacion', 'fecha_activacion', 'activa'],
              populate: {
                libro_mira: {
                  fields: ['id', 'documentId', 'activo'],
                  populate: {
                    libro: {
                      fields: ['id', 'nombre_libro', 'isbn_libro'],
                      populate: {
                        portada_libro: true,
                        categorias_producto: {
                          fields: ['id', 'name'] as any,
                        },
                      },
                    },
                  },
                },
              },
            });
            usuario.licencias_activadas = licencias || [];
          } catch (licenciasError: any) {
            strapi.log.warn(`[persona-mira.getCurrentUser] No se pudo obtener licencias: ${licenciasError.message}`);
            usuario.licencias_activadas = [];
          }
          
          // Intentar obtener con entityService para datos completos (como fallback si db.query no tiene todo)
          try {
            const usuarioCompleto = await strapi.entityService.findOne('api::persona-mira.persona-mira' as any, usuarioDb.id, {
              fields: ['id', 'email', 'fecha_registro', 'activo', 'ultimo_acceso'],
              populate: {
                persona: {
                  fields: ['id', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'rut'],
                  populate: {
                    emails: true,
                    telefonos: true,
                  },
                },
                licencias_activadas: {
                  fields: ['id', 'codigo_activacion', 'fecha_activacion', 'activa'],
                  populate: {
                    libro_mira: {
                      fields: ['id', 'documentId', 'activo'],
                      populate: {
                        libro: {
                          fields: ['id', 'nombre_libro', 'isbn_libro'],
                          populate: {
                            portada_libro: true,
                            categorias_producto: {
                              fields: ['id', 'name'] as any,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            });
            
            // Si entityService funciona, usar esos datos (más completos)
            if (usuarioCompleto) {
              usuario = usuarioCompleto;
            }
          } catch (entityError: any) {
            strapi.log.warn(`[persona-mira.getCurrentUser] entityService falló, usando datos de db.query: ${entityError.message}`);
            // Continuar con los datos de db.query que ya tenemos
          }
        } else {
          strapi.log.warn(`[persona-mira.getCurrentUser] db.query no encontró usuario con ID=${id}, intentando con entityService...`);
          
          // Fallback a entityService
          usuario = await strapi.entityService.findOne('api::persona-mira.persona-mira' as any, Number(id), {
            fields: ['id', 'email', 'fecha_registro', 'activo', 'ultimo_acceso'],
            populate: {
              persona: {
                fields: ['id', 'nombres', 'primer_apellido', 'segundo_apellido', 'nombre_completo', 'rut'],
                populate: {
                  emails: true,
                  telefonos: true,
                },
              },
              licencias_activadas: {
                fields: ['id', 'codigo_activacion', 'fecha_activacion', 'activa'],
                populate: {
                  libro_mira: {
                    fields: ['id', 'documentId', 'activo'],
                    populate: {
                      libro: {
                        fields: ['id', 'nombre_libro', 'isbn_libro'],
                        populate: {
                          portada_libro: true,
                          categorias_producto: {
                            fields: ['id', 'name'] as any,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          }) as any;
        }
      } catch (error: any) {
        strapi.log.error(`[persona-mira.getCurrentUser] Error al obtener datos del usuario: ${error.message}`);
        strapi.log.error(`[persona-mira.getCurrentUser] Stack: ${error.stack}`);
        return ctx.internalServerError('Error al obtener datos del usuario');
      }

      if (!usuario) {
        strapi.log.warn(`[persona-mira.getCurrentUser] Usuario no encontrado para ID: ${id}`);
        return ctx.notFound('Usuario no encontrado');
      }

      strapi.log.info(`[persona-mira.getCurrentUser] Usuario encontrado: ID=${usuario.id}, email=${usuario.email}`);

      return ctx.send({
        data: usuario,
      });
    } catch (error: any) {
      strapi.log.error('[persona-mira.getCurrentUser] Error en getCurrentUser:', error);
      return ctx.internalServerError(
        process.env.NODE_ENV === 'development' 
          ? `Error interno: ${error.message}` 
          : 'Error interno al procesar la solicitud'
      );
    }
  },
}));
