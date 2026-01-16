function normalizeRut(rut?: string) {
  if (!rut) return rut;
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (!clean) return undefined;
  return clean; // placeholder, without formatting
}

export default {
  async beforeCreate(event) {
    const data = event.params.data;
    if (data.rut) data.rut = normalizeRut(data.rut);
    if (!data.nombre_completo) {
      const apellidos = [data.primer_apellido, data.segundo_apellido].filter(Boolean).join(' ').trim();
      data.nombre_completo = [data.nombres, apellidos].filter(Boolean).join(' ').trim();
    }
    normalizeTelefonos(data);
  },
  async beforeUpdate(event) {
    const data = event.params.data;
    if (data.rut) data.rut = normalizeRut(data.rut);
    if (data.nombres || data.primer_apellido || data.segundo_apellido) {
      const nombres = data.nombres ?? event?.result?.nombres;
      const primer = data.primer_apellido ?? event?.result?.primer_apellido;
      const segundo = data.segundo_apellido ?? event?.result?.segundo_apellido;
      const apellidos = [primer, segundo].filter(Boolean).join(' ').trim();
      data.nombre_completo = [nombres, apellidos].filter(Boolean).join(' ').trim();
    }
    normalizeTelefonos(data);
  },
  async afterCreate(event) {
    strapi.log.info('[persona.lifecycle] ═══════════════════════════════════════════════════════');
    strapi.log.info('[persona.lifecycle] afterCreate ejecutado');
    
    const resultId = event.result?.id || event.result?.documentId;
    const resultOrigen = (event.result as any)?.origen;
    
    strapi.log.info('[persona.lifecycle] Event result:', {
      id: resultId,
      origen: resultOrigen,
      tieneResult: !!event.result,
      resultKeys: event.result ? Object.keys(event.result) : []
    });
    
    // Crear persona-mira automáticamente si viene de registro web
    strapi.log.info('[persona.lifecycle] Verificando condiciones:', {
      tieneResult: !!event.result,
      origen: resultOrigen,
      origenEsWeb: resultOrigen === 'web'
    });
    
    // CRÍTICO: Verificar que no se haya procesado ya este registro
    // Usar un Set para rastrear IDs procesados en esta sesión
    if (!(strapi as any).__personasProcesadas) {
      (strapi as any).__personasProcesadas = new Set();
    }
    
    if (event.result && resultOrigen === 'web' && resultId) {
      // Verificar si ya se procesó este ID
      if ((strapi as any).__personasProcesadas.has(resultId)) {
        strapi.log.warn(`[persona.lifecycle] ⚠️ Persona ID ${resultId} ya fue procesada, omitiendo creación de persona-mira para evitar duplicados`);
        // Continuar con MailerLite pero no crear persona-mira
        if (event.result) {
          await syncToMailerLite(event.result, event);
        }
        return;
      }
      
      // Marcar como procesado
      (strapi as any).__personasProcesadas.add(resultId);
      strapi.log.info('[persona.lifecycle] ✅ Origen es "web", procediendo a crear persona-mira...');
      try {
        // Obtener email de la persona
        const personaId = resultId;
        strapi.log.info(`[persona.lifecycle] Buscando persona con ID: ${personaId}`);
        
        const personaCompleta = await strapi.entityService.findOne('api::persona.persona', personaId, {
          populate: ['emails'],
        }) as any;
        
        strapi.log.info('[persona.lifecycle] Persona completa obtenida:', {
          tienePersona: !!personaCompleta,
          tieneEmails: !!personaCompleta?.emails,
          emailsCount: personaCompleta?.emails?.length || 0
        });
        
        if (personaCompleta) {
          const emails = (personaCompleta.emails || []) as any[];
          const primaryEmail = emails.find((e: any) => e.principal === true)?.email 
            || emails[0]?.email;
          
          strapi.log.info('[persona.lifecycle] Email principal encontrado:', primaryEmail);
          
          if (primaryEmail) {
            const emailKey = primaryEmail.toLowerCase().trim();
            
            // Buscar datos MIRA guardados temporalmente
            strapi.log.info('[persona.lifecycle] Buscando datos MIRA en Map temporal...');
            strapi.log.info('[persona.lifecycle] Map existe:', !!(strapi as any).__datosMiraTemporales);
            strapi.log.info('[persona.lifecycle] Map size:', (strapi as any).__datosMiraTemporales?.size || 0);
            
            const datosMira = (strapi as any).__datosMiraTemporales?.get(emailKey);
            
            strapi.log.info('[persona.lifecycle] Datos MIRA encontrados:', {
              tieneDatos: !!datosMira,
              tienePassword: !!datosMira?.password,
              emailKey: emailKey
            });
            
            if (datosMira && datosMira.password) {
              // Obtener el ID correcto de la persona (puede ser id o documentId en Strapi v5)
              const personaId = personaCompleta.id || personaCompleta.documentId || resultId;
              const personaRut = personaCompleta.rut;
              
              strapi.log.info(`[persona.lifecycle] ✅ Creando persona-mira automáticamente para persona ID=${personaId}, RUT=${personaRut}, email=${primaryEmail}`);
              
              // Verificar si ya existe persona-mira con este email (tanto publicado como draft)
              const existing = await strapi.db.query('api::persona-mira.persona-mira').findMany({
                where: { email: emailKey },
                limit: 1,
              });
              
              if (!existing || existing.length === 0) {
                // Crear persona-mira con la relación correcta usando el ID de la persona
                // La relación en Strapi se hace con el ID, pero el admin panel muestra el RUT porque es el mainField
                const personaMiraData: any = {
                  persona: personaId, // Relación con persona usando su ID
                  email: emailKey,
                  password: datosMira.password,
                  fecha_registro: new Date(),
                  activo: personaCompleta.activo !== undefined ? personaCompleta.activo : true,
                };
                
                // Agregar campos opcionales del registro
                if (datosMira.colegio) {
                  personaMiraData.colegio = Number(datosMira.colegio);
                }
                if (datosMira.nivel) {
                  personaMiraData.nivel = datosMira.nivel;
                }
                if (datosMira.curso) {
                  personaMiraData.curso = datosMira.curso;
                }
                
                strapi.log.info(`[persona.lifecycle] Datos para crear persona-mira:`, {
                  personaId: personaMiraData.persona,
                  personaRut: personaRut,
                  email: personaMiraData.email,
                  tienePassword: !!personaMiraData.password,
                  colegio: personaMiraData.colegio,
                  nivel: personaMiraData.nivel,
                  curso: personaMiraData.curso,
                  activo: personaMiraData.activo
                });
                
                // CRÍTICO: Usar db.query para crear directamente el registro publicado
                // entityService.create con publishedAt crea draft y published, causando problemas con password
                const personaIdNumerico = typeof personaMiraData.persona === 'number' 
                  ? personaMiraData.persona 
                  : (typeof personaMiraData.persona === 'string' 
                    ? parseInt(personaMiraData.persona, 10) 
                    : personaMiraData.persona);
                
                strapi.log.info(`[persona.lifecycle] Creando persona-mira con db.query (publicado directamente), persona ID: ${personaIdNumerico}`);
                
                // CRÍTICO: Hashear password ANTES de crear con entityService
                // entityService requiere password (campo required), pero no puede guardar campos private correctamente
                // Por eso lo incluimos en el create y luego lo actualizamos con db.query
                const bcrypt = require('bcryptjs');
                let passwordHasheado: string | null = null;
                const passwordStr = String(personaMiraData.password || '');
                
                // Verificar si ya está hasheado
                const isHashed = passwordStr.startsWith('$2a$') || passwordStr.startsWith('$2b$');
                if (!isHashed && passwordStr.length > 0) {
                  strapi.log.info('[persona.lifecycle] Hasheando password antes de crear con entityService');
                  passwordHasheado = bcrypt.hashSync(passwordStr, 10);
                  strapi.log.info('[persona.lifecycle] Password hasheado correctamente, longitud:', passwordHasheado.length);
                } else if (isHashed) {
                  strapi.log.info('[persona.lifecycle] Password ya está hasheado, usando directamente');
                  passwordHasheado = passwordStr;
                } else {
                  strapi.log.error('[persona.lifecycle] ⚠️ CRÍTICO: No se pudo obtener password válido');
                  throw new Error('Password es requerido para crear persona-mira');
                }
                
                // CRÍTICO: Usar entityService.create para que las relaciones aparezcan en Admin Panel
                // entityService integra correctamente con el sistema de documentos de Strapi 5
                // Luego actualizamos el password con db.query porque es un campo private
                
                // Preparar datos para crear persona-mira CON relaciones usando entityService
                // CRÍTICO: password es required en el schema, pero NO debemos pasar passwordHasheado aquí
                // El lifecycle beforeCreate de persona-mira detecta si está hasheado y lo mantiene,
                // pero si entityService lo procesa de nuevo, puede causar doble hash
                // SOLUCIÓN NUCLEAR: Pasar password temporal para pasar validación, luego sobrescribir con db.query
                const datosParaCrear: any = {
                  email: personaMiraData.email,
                  password: `TEMP_PASSWORD_${Date.now()}_IGNORE_ME`, // Password temporal para pasar validación (se sobrescribe inmediatamente)
                  fecha_registro: personaMiraData.fecha_registro || new Date(),
                  activo: personaMiraData.activo !== undefined ? personaMiraData.activo : true,
                  publishedAt: new Date(), // CRÍTICO: Publicar automáticamente (evita estado Draft)
                  locale: 'es', // CRÍTICO: Asignar locale para que aparezca en Content Manager (i18n plugin)
                };
                
                // Agregar campos escalares (no relaciones)
                if (personaMiraData.nivel !== undefined && personaMiraData.nivel !== null) {
                  datosParaCrear.nivel = personaMiraData.nivel;
                }
                if (personaMiraData.curso !== undefined && personaMiraData.curso !== null) {
                  datosParaCrear.curso = personaMiraData.curso;
                }
                
                // CRÍTICO: Usar sintaxis { connect: [id] } para relaciones Many-to-One en Strapi 5
                // Esto asegura que las relaciones aparezcan correctamente en Admin Panel
                if (personaIdNumerico) {
                  datosParaCrear.persona = { connect: [personaIdNumerico] };
                  strapi.log.info(`[persona.lifecycle] Agregando relación persona con connect: ${personaIdNumerico}`);
                }
                
                if (personaMiraData.colegio !== undefined && personaMiraData.colegio !== null) {
                  const colegioIdNumerico = typeof personaMiraData.colegio === 'number' 
                    ? personaMiraData.colegio 
                    : (typeof personaMiraData.colegio === 'string' 
                      ? parseInt(personaMiraData.colegio, 10) 
                      : personaMiraData.colegio);
                  if (colegioIdNumerico) {
                    datosParaCrear.colegio = { connect: [colegioIdNumerico] };
                    strapi.log.info(`[persona.lifecycle] Agregando relación colegio con connect: ${colegioIdNumerico}`);
                  }
                }
                
                strapi.log.info(`[persona.lifecycle] Datos completos para crear:`, {
                  email: datosParaCrear.email,
                  tienePassword: !!datosParaCrear.password,
                  nivel: datosParaCrear.nivel,
                  curso: datosParaCrear.curso,
                  activo: datosParaCrear.activo,
                  persona: datosParaCrear.persona,
                  colegio: datosParaCrear.colegio,
                  publishedAt: datosParaCrear.publishedAt,
                  locale: datosParaCrear.locale
                });
                
                // CRÍTICO: Crear con entityService para que las relaciones se guarden correctamente
                // entityService integra con el sistema de documentos de Strapi 5
                strapi.log.info(`[persona.lifecycle] Creando persona-mira con entityService (para relaciones correctas)...`);
                const personaMiraCreada = await strapi.entityService.create('api::persona-mira.persona-mira' as any, {
                  data: datosParaCrear,
                });
                
                strapi.log.info(`[persona.lifecycle] Persona-mira creada con entityService - ID: ${personaMiraCreada?.id}, documentId: ${personaMiraCreada?.documentId}, publishedAt: ${personaMiraCreada?.publishedAt}`);
                
                // CRÍTICO: SOLUCIÓN NUCLEAR - Sobrescribir password y colegio inmediatamente con db.query
                // db.query NO dispara lifecycles, así que podemos guardar el password hasheado directamente
                // sin riesgo de doble hash
                const datosParaActualizar: any = {
                  password: passwordHasheado, // SIEMPRE sobrescribir con el hash correcto (sin doble hash)
                };
                
                // CRÍTICO: Asegurar relación colegio con db.query (fallback si entityService no la guardó)
                // db.query prefiere ID directo (número) en lugar de { connect: [...] }
                if (personaMiraData.colegio !== undefined && personaMiraData.colegio !== null) {
                  const colegioIdNumerico = typeof personaMiraData.colegio === 'number' 
                    ? personaMiraData.colegio 
                    : (typeof personaMiraData.colegio === 'string' 
                      ? parseInt(personaMiraData.colegio, 10) 
                      : personaMiraData.colegio);
                  
                  if (colegioIdNumerico && !isNaN(colegioIdNumerico)) {
                    datosParaActualizar.colegio = colegioIdNumerico;
                    strapi.log.info(`[persona.lifecycle] Agregando colegio al update: ${colegioIdNumerico}`);
                  }
                }
                
                // SIEMPRE actualizar password y colegio con db.query (garantiza integridad)
                strapi.log.info(`[persona.lifecycle] Sobrescribiendo password y colegio con db.query (sin doble hash)...`);
                await strapi.db.query('api::persona-mira.persona-mira').update({
                  where: { id: personaMiraCreada.id },
                  data: datosParaActualizar,
                });
                strapi.log.info(`[persona.lifecycle] ✅ Password y colegio actualizados correctamente con db.query:`, Object.keys(datosParaActualizar));
                
                // CRÍTICO: Verificar y corregir publishedAt si no se guardó
                if (!personaMiraCreada?.publishedAt) {
                  strapi.log.warn(`[persona.lifecycle] ⚠️ publishedAt no se guardó, actualizando...`);
                  await strapi.db.query('api::persona-mira.persona-mira').update({
                    where: { id: personaMiraCreada.id },
                    data: { publishedAt: new Date() },
                  });
                  strapi.log.info(`[persona.lifecycle] publishedAt actualizado`);
                }
                
                strapi.log.info(`[persona.lifecycle] Persona-mira creada con ID: ${personaMiraCreada?.id}, publishedAt: ${personaMiraCreada?.publishedAt}`);
                
                // Verificar que los campos básicos se guardaron correctamente
                const registroVerificado = await strapi.db.query('api::persona-mira.persona-mira').findOne({
                  where: { id: personaMiraCreada.id },
                  select: ['id', 'email', 'password', 'nivel', 'curso', 'activo', 'fecha_registro', 'publishedAt'],
                });
                
                strapi.log.info(`[persona.lifecycle] Verificación db.query - ID: ${registroVerificado?.id}, email: ${registroVerificado?.email}, nivel: ${registroVerificado?.nivel}, curso: ${registroVerificado?.curso}, activo: ${registroVerificado?.activo}, publishedAt: ${registroVerificado?.publishedAt}`);
                
                if (registroVerificado) {
                  if (registroVerificado.password) {
                    const hashFormat = String(registroVerificado.password).substring(0, 4);
                    const hashLength = String(registroVerificado.password).length;
                    strapi.log.info(`[persona.lifecycle] Password guardado correctamente - Formato: ${hashFormat}, Longitud: ${hashLength}`);
                  } else {
                    strapi.log.error(`[persona.lifecycle] ⚠️ CRÍTICO: Password no se guardó correctamente para ${personaMiraCreada.id}`);
                  }
                  
                  // Verificar y corregir campos faltantes
                  const camposFaltantes: any = {};
                  if (!registroVerificado.email && datosParaCrear.email) {
                    camposFaltantes.email = datosParaCrear.email;
                    strapi.log.warn(`[persona.lifecycle] ⚠️ Email no se guardó, agregando: ${datosParaCrear.email}`);
                  }
                  if (!registroVerificado.nivel && datosParaCrear.nivel) {
                    camposFaltantes.nivel = datosParaCrear.nivel;
                    strapi.log.warn(`[persona.lifecycle] ⚠️ Nivel no se guardó, agregando: ${datosParaCrear.nivel}`);
                  }
                  if (!registroVerificado.curso && datosParaCrear.curso) {
                    camposFaltantes.curso = datosParaCrear.curso;
                    strapi.log.warn(`[persona.lifecycle] ⚠️ Curso no se guardó, agregando: ${datosParaCrear.curso}`);
                  }
                  if (!registroVerificado.publishedAt) {
                    camposFaltantes.publishedAt = new Date();
                    strapi.log.warn(`[persona.lifecycle] ⚠️ publishedAt no se guardó, publicando ahora...`);
                  }
                  
                  // Actualizar campos faltantes si hay alguno
                  if (Object.keys(camposFaltantes).length > 0) {
                    await strapi.db.query('api::persona-mira.persona-mira').update({
                      where: { id: personaMiraCreada.id },
                      data: camposFaltantes,
                    });
                    strapi.log.info(`[persona.lifecycle] Campos faltantes actualizados:`, Object.keys(camposFaltantes));
                  }
                } else {
                  strapi.log.error(`[persona.lifecycle] ⚠️ CRÍTICO: No se pudo verificar el registro creado`);
                }
                
                // Verificación final usando entityService (para obtener relaciones correctamente)
                // CRÍTICO: entityService.findOne requiere el ID numérico, no el documentId
                try {
                  const idNumerico = personaMiraCreada.id; // Usar id numérico, no documentId
                  const registroFinal = await strapi.entityService.findOne('api::persona-mira.persona-mira' as any, idNumerico, {
                    populate: ['persona', 'colegio'],
                    publicationState: 'live', // Asegurar que busque el publicado
                  });
                  
                  if (registroFinal) {
                    strapi.log.info(`[persona.lifecycle] Verificación final - ID: ${registroFinal?.id}, email: ${registroFinal?.email}, nivel: ${registroFinal?.nivel}, curso: ${registroFinal?.curso}, persona: ${registroFinal?.persona ? (typeof registroFinal.persona === 'object' ? registroFinal.persona.id : registroFinal.persona) : 'N/A'}, colegio: ${registroFinal?.colegio ? (typeof registroFinal.colegio === 'object' ? registroFinal.colegio.id : registroFinal.colegio) : 'N/A'}, publicado: ${!!registroFinal?.publishedAt}`);
                  } else {
                    strapi.log.warn(`[persona.lifecycle] ⚠️ No se pudo encontrar registro publicado con ID: ${idNumerico}, pero db.query confirmó que existe`);
                  }
                } catch (verifError: any) {
                  strapi.log.warn(`[persona.lifecycle] ⚠️ Error al verificar registro final: ${verifError.message}`);
                  // No es crítico, los campos ya se guardaron según db.query
                }
                
                strapi.log.info(`[persona.lifecycle] ✅ Persona-mira creada exitosamente para email: ${primaryEmail}`);
                
                // ============================================
                // 🔐 Crear usuario de users-permissions y enviar email de confirmación
                // ============================================
                try {
                  // CRÍTICO: Verificar que el email sea válido antes de crear
                  if (!emailKey || !emailKey.includes('@')) {
                    strapi.log.error(`[persona.lifecycle] ❌ Email inválido para crear usuario users-permissions: ${emailKey}`);
                    throw new Error(`Email inválido: ${emailKey}`);
                  }

                  // Buscar usuario existente usando db.query (email es campo private, no se puede filtrar con entityService)
                  let upUser = null;
                  try {
                    upUser = await strapi.db.query('plugin::users-permissions.user').findOne({
                      where: { email: emailKey },
                    });
                  } catch (findErr: any) {
                    strapi.log.warn(`[persona.lifecycle] No se encontró usuario existente: ${findErr.message}`);
                  }

                  const passwordPlano = datosMira.password || datosMira.passwordPlain || datosMira.password_original;

                  if (!upUser && passwordPlano) {
                    const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
                      where: { type: 'authenticated' },
                    });

                    // CRÍTICO: Crear usuario usando db.query directamente para asegurar que email se guarde
                    // El servicio add() puede no guardar el email correctamente
                    strapi.log.info(`[persona.lifecycle] Creando usuario users-permissions con db.query para email: ${emailKey}`);
                    
                    const nuevoUpUser = await strapi.db.query('plugin::users-permissions.user').create({
                      data: {
                        username: emailKey,
                        email: emailKey, // CRÍTICO: Email debe estar presente
                        password: passwordPlano, // El servicio hasheará automáticamente
                        confirmed: false,
                        blocked: false,
                        role: authenticatedRole?.id,
                      },
                    });

                    if (!nuevoUpUser || !nuevoUpUser.id) {
                      strapi.log.error(`[persona.lifecycle] ❌ No se pudo crear usuario users-permissions`);
                      throw new Error('No se pudo crear usuario users-permissions');
                    }

                    strapi.log.info(`[persona.lifecycle] Usuario users-permissions creado - ID: ${nuevoUpUser.id}`);

                    // CRÍTICO: Obtener el usuario completo usando db.query (email es campo private)
                    // db.query puede acceder directamente a campos private
                    const upUserCompleto = await strapi.db.query('plugin::users-permissions.user').findOne({
                      where: { id: nuevoUpUser.id },
                    });

                    if (!upUserCompleto || !upUserCompleto.email) {
                      strapi.log.error(`[persona.lifecycle] ❌ No se pudo obtener usuario completo con email: ${JSON.stringify(upUserCompleto)}`);
                      throw new Error('Usuario sin email válido');
                    }

                    // CRÍTICO: Enviar email de confirmación con el usuario completo que tiene email
                    await strapi.plugin('users-permissions').service('user').sendConfirmationEmail(upUserCompleto);
                    strapi.log.info(`[persona.lifecycle] ✅ Email de confirmación enviado a: ${upUserCompleto.email}`);
                  } else if (upUser) {
                    // Verificar si está confirmado usando db.query (más confiable para campos private)
                    if (upUser.confirmed !== false && upUser.confirmed !== null) {
                      strapi.log.info(`[persona.lifecycle] Usuario users-permissions ya existe para ${emailKey}, confirmado=${upUser.confirmed}`);
                    } else {
                      // Reenviar confirmación si existe pero no confirmado
                      if (upUser.email) {
                        await strapi.plugin('users-permissions').service('user').sendConfirmationEmail(upUser);
                        strapi.log.info(`[persona.lifecycle] 🔄 Reenviando email de confirmación para ${upUser.email}`);
                      } else {
                        strapi.log.error(`[persona.lifecycle] ❌ Usuario users-permissions sin email: ${JSON.stringify(upUser)}`);
                      }
                    }
                  } else {
                    strapi.log.warn(`[persona.lifecycle] ⚠️ No se pudo crear usuario users-permissions (password faltante).`);
                  }
                } catch (upErr: any) {
                  strapi.log.error(`[persona.lifecycle] ❌ Error al crear/enviar email de confirmación (users-permissions): ${upErr.message}`);
                  strapi.log.error(`[persona.lifecycle] Stack: ${upErr.stack}`);
                  // NO lanzar el error para que la creación de persona-mira no falle
                }

                // Limpiar datos temporales
                (strapi as any).__datosMiraTemporales?.delete(emailKey);
              } else {
                strapi.log.info(`[persona.lifecycle] Ya existe persona-mira con email ${primaryEmail}, no se crea duplicado`);
                (strapi as any).__datosMiraTemporales?.delete(emailKey);
              }
            }
          }
        }
      } catch (error: any) {
        strapi.log.error(`[persona.lifecycle] ❌ ERROR CRÍTICO al crear persona-mira automáticamente: ${error.message}`);
        strapi.log.error(`[persona.lifecycle] Stack: ${error.stack}`);
        strapi.log.error(`[persona.lifecycle] ⚠️ La persona se creó correctamente, pero persona-mira NO se creó. El usuario deberá crearla manualmente.`);
        // NO lanzar el error para que la creación de persona no falle
        // El error ya se logueó, pero no debe romper la transacción
      }
    }
    
    // Sincronizar con MailerLite después de crear
    if (event.result) {
      await syncToMailerLite(event.result, event);
    }
  },
  async afterUpdate(event) {
    // Sincronizar con MailerLite después de actualizar
    if (event.result) {
      await syncToMailerLite(event.result, event);
    }
  },
};

function normalizeTelefonos(data: any) {
  if (!data || !Array.isArray(data.telefonos)) return;
  data.telefonos = data.telefonos.map((tel: any) => {
    const t = { ...(tel || {}) };
    if (!t.telefono_norm) {
      const raw = t.telefono_raw || t.telefono_norm || '';
      const norm = normalizePhoneCL(raw);
      if (norm) t.telefono_norm = norm;
    }
    return t;
  });
}

function normalizePhoneCL(v?: string) {
  if (!v) return v;
  const d = String(v).replace(/\D+/g, '');
  if (!d) return v;
  if (d.startsWith('56')) return `+${d}`;
  if (d.length === 9 && d.startsWith('9')) return `+569${d.slice(1)}`;
  if (d.length === 8) return `+562${d}`;
  return `+56${d}`;
}

/**
 * Sincroniza Persona con MailerLite si está habilitado
 * Asigna grupos según origen de datos y estado de validación
 */
async function syncToMailerLite(persona: any, event: any) {
  try {
    // Verificar si MailerLite está habilitado
    const mailerliteConfig = await strapi.entityService.findMany('api::mailerlite.mailerlite' as any, {
      limit: 1,
    });
    
    if (!mailerliteConfig || (Array.isArray(mailerliteConfig) && mailerliteConfig.length === 0)) {
      return; // No configurado, no hacer nada
    }

    const config = (Array.isArray(mailerliteConfig) ? mailerliteConfig[0] : mailerliteConfig) as any;
    if (!config.enabled) {
      return; // Deshabilitado, no sincronizar
    }

    // Obtener servicio de MailerLite
    const mailerliteService = strapi.service('api::mailerlite.mailerlite');
    if (!mailerliteService) {
      return; // Servicio no disponible
    }

    // Obtener persona completa con emails
    const personaCompleta = await strapi.entityService.findOne('api::persona.persona', persona.id, {
      populate: ['emails'],
    }) as any;

    if (!personaCompleta) {
      return;
    }

    // Verificar que tenga email
    const emails = (personaCompleta.emails || []) as any[];
    const primaryEmail = emails.find((e: any) => e.principal === true)?.email 
      || emails[0]?.email;

    if (!primaryEmail) {
      return; // Sin email, no se puede sincronizar
    }

    // Construir mapeo de grupos desde la configuración
    // Formato esperado en default_groups: objeto con mapeos
    // Ejemplo: { "web_validado": ["123"], "web_no_validado": ["456"], "origen_web": ["789"] }
    const groupMapping = config.group_mapping || {};
    
    // Si hay grupos por defecto (formato antiguo), usarlos como fallback
    const defaultGroups = config.default_groups || [];
    const hasLegacyGroups = Array.isArray(defaultGroups) && defaultGroups.length > 0;

    // Sincronizar con grupos determinados automáticamente o por defecto
    await mailerliteService.syncPersona(personaCompleta, {
      groupMapping: Object.keys(groupMapping).length > 0 ? groupMapping : undefined,
      groups: hasLegacyGroups && Object.keys(groupMapping).length === 0 ? defaultGroups : undefined,
      updateGroups: true, // Actualizar grupos cuando cambia el estado de validación
    });

    strapi.log.info(`✅ Persona ${persona.id} sincronizada con MailerLite (origen: ${personaCompleta.origen || 'manual'})`);
  } catch (error: any) {
    // No fallar la operación principal si MailerLite falla
    strapi.log.warn(`⚠️ Error al sincronizar Persona ${persona.id} con MailerLite:`, error.message);
  }
}
