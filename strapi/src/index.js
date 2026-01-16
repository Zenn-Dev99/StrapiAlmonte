// src/index.js
const path = require('node:path');
const { syncFromRegistry } = require('../data-model/generators/strapi-sync.cjs');

// Función para configurar mainFields en content-manager
async function ensureContentManagerMainFields(strapi) {
  const setContentTypeMainField = async (uid, field, relations = []) => {
    const key = `configuration_content_types::${uid}`;
    try {
      const store = strapi.store({ type: 'plugin', name: 'content-manager', key });
      const cur = await store.get();
      const settings = { ...(cur?.settings || {}) };
      const metadatas = { ...(cur?.metadatas || {}) };
      let changed = false;
      
      if (settings.mainField !== field) {
        settings.mainField = field;
        changed = true;
      }
      if (settings.defaultSortBy !== field) {
        settings.defaultSortBy = field;
        changed = true;
      }
      
      if (Array.isArray(relations) && relations.length) {
        for (const rel of relations) {
          if (!metadatas[rel.field]) {
            metadatas[rel.field] = {};
          }
          if (!metadatas[rel.field].edit) {
            metadatas[rel.field].edit = {};
          }
          if (!metadatas[rel.field].list) {
            metadatas[rel.field].list = {};
          }
          
          if (metadatas[rel.field].edit.mainField !== rel.mainField) {
            metadatas[rel.field].edit.mainField = rel.mainField;
            changed = true;
          }
          if (metadatas[rel.field].list.mainField !== rel.mainField) {
            metadatas[rel.field].list.mainField = rel.mainField;
            changed = true;
          }
        }
      }
      
      if (changed) {
        await store.set({ value: { ...(cur || {}), settings, metadatas } });
        strapi.log.info(`[content-manager] Set CT mainField '${field}' for ${uid}`);
      }
    } catch (e) {
      strapi.log.warn(`[content-manager] Unable to set CT mainField for ${uid}: ${e?.message || e}`);
    }
  };

  // Configurar Persona para usar RUT como mainField
  strapi.log.info('[bootstrap] Configurando mainField de Persona a "rut"');
  await setContentTypeMainField('api::persona.persona', 'rut');
  
  // Configurar Colaborador y su relación con Persona
  strapi.log.info('[bootstrap] Configurando mainField de Colaborador y relación persona');
  await setContentTypeMainField('api::colaborador.colaborador', 'email_login', [
    { field: 'persona', mainField: 'rut' },
  ]);
  
  // Forzar actualización de la configuración de la relación persona en colaborador
  try {
    const key = `configuration_content_types::api::colaborador.colaborador`;
    const store = strapi.store({ type: 'plugin', name: 'content-manager', key });
    const cur = await store.get();
    const metadatas = { ...(cur?.metadatas || {}) };
    
    if (!metadatas.persona) {
      metadatas.persona = {};
    }
    if (!metadatas.persona.edit) {
      metadatas.persona.edit = {};
    }
    if (!metadatas.persona.list) {
      metadatas.persona.list = {};
    }
    
    let changed = false;
    if (metadatas.persona.edit.mainField !== 'rut') {
      metadatas.persona.edit.mainField = 'rut';
      changed = true;
    }
    if (metadatas.persona.list.mainField !== 'rut') {
      metadatas.persona.list.mainField = 'rut';
      changed = true;
    }
    
    if (changed) {
      await store.set({ value: { ...(cur || {}), metadatas } });
      strapi.log.info('[bootstrap] Forzada actualización de mainField "rut" en relación persona de Colaborador');
    }
  } catch (e) {
    strapi.log.warn(`[bootstrap] Error al forzar mainField en relación persona: ${e?.message || e}`);
  }
}

module.exports = {
  register({ strapi }) {
    console.log('[global] register: lifecycles subscribe');

    const colegioContentType = typeof strapi.contentType === 'function'
      ? strapi.contentType('api::colegio.colegio')
      : null;
    const hasDireccionCompleta = Boolean(colegioContentType?.attributes?.colegio_direccion_completa);

    // Helpers
    function getRelDocId(val) {
      if (!val) return null;
      if (typeof val === 'string' && val.trim()) return val.trim();
      if (typeof val === 'object' && typeof val.id === 'string') return val.id.trim();
      const bag = val.connect || val.set;
      if (Array.isArray(bag) && bag.length > 0) {
        const first = bag[0];
        if (typeof first === 'string') return first.trim();
        if (first && typeof first === 'object' && typeof first.id === 'string') return first.id.trim();
      }
      return null;
    }

    function normalizePhoneCL(v) {
      if (!v) return v;
      const d = String(v).replace(/\D+/g, '');
      if (!d) return v;
      if (d.startsWith('56')) return `+${d}`;
      if (d.length === 9 && d.startsWith('9')) return `+569${d.slice(1)}`;
      if (d.length === 8) return `+562${d}`;
      return `+56${d}`;
    }

    async function enrichColegio(data, hook) {
      try {
        if (!data) return;
        // Permite desactivar enriquecimiento durante importaciones masivas
        if (process.env.SKIP_ENRICH === '1') return;
        console.log('[global:lifecycle]', hook, 'payload inicial:', JSON.stringify(data));

        // NOTA: Las relaciones geográficas (provincia, region, zona) se eliminaron
        // Ahora solo usamos comuna y derivamos el resto cuando sea necesario
        // Esto simplifica el modelo y elimina redundancias

        const comunaDocId = getRelDocId(data.comuna);

        // Dirección completa (si existe el campo)
        if (hasDireccionCompleta && comunaDocId) {
          const parts = [];
          if (data.colegio_direccion_calle)  parts.push(String(data.colegio_direccion_calle).trim());
          if (data.colegio_direccion_numero) parts.push(String(data.colegio_direccion_numero).trim());
          if (comunaDocId) {
            const c = await strapi.entityService.findOne('api::comuna.comuna', comunaDocId, { fields: ['comuna_nombre'] });
            if (c?.comuna_nombre) parts.push(c.comuna_nombre);
          }
          data.colegio_direccion_completa = parts.join(', ');
        }

        // Teléfonos y web
        ['colegio_telefono_mc01', 'colegio_telefono_mc02'].forEach((k) => {
          if (data[k]) data[k] = normalizePhoneCL(data[k]);
        });
        if (data.colegio_web && !/^https?:\/\//i.test(data.colegio_web)) {
          data.colegio_web = `https://${data.colegio_web}`;
        }

        console.log('[global:lifecycle]', hook, 'payload final:', JSON.stringify(data));
      } catch (err) {
        console.error('[global:lifecycle] error', err);
      }
    }

    // Suscripción global al modelo Colegio
    strapi.db.lifecycles.subscribe({
      models: ['api::colegio.colegio'],
      async beforeCreate(event) {
        await enrichColegio(event.params?.data, 'beforeCreate');
      },
      async beforeUpdate(event) {
        await enrichColegio(event.params?.data, 'beforeUpdate');
      },
    });
  },

  async bootstrap({ strapi }) {
    // 1. Sincronizar desde registro de data-model
    try {
      const registryRoot = path.resolve(__dirname, '../data-model');
      await syncFromRegistry(strapi, registryRoot);
    } catch (err) {
      strapi.log.error('[data-model] fallo al sincronizar', err);
    }

    // 2. Configurar mainFields para content-manager (comboboxes)
    try {
      await ensureContentManagerMainFields(strapi);
    } catch (err) {
      strapi.log.error('[bootstrap] fallo al configurar mainFields:', err);
    }

    // 3. Configurar permisos de intranet-chats para rol Authenticated
    // Ejecutar después de un delay para asegurar que todo esté inicializado
    setTimeout(async () => {
      try {
        strapi.log.info('[bootstrap] 🚀 Iniciando configuración automática de permisos de chat...');
        
        // Función inline para evitar problemas de import
        const configurarPermisosChat = async (strapiInstance) => {
          try {
            strapiInstance.log.info('[configurar-permisos-chat] 🚀 Iniciando configuración de permisos...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const authenticatedRole = await strapiInstance.query('plugin::users-permissions.role').findOne({
              where: { type: 'authenticated' },
            });
            
            if (!authenticatedRole) {
              strapiInstance.log.warn('[configurar-permisos-chat] ⚠️  Rol Authenticated no encontrado');
              return null;
            }
            
            strapiInstance.log.info(`[configurar-permisos-chat] ✅ Rol encontrado: ID ${authenticatedRole.id}`);
            
            const acciones = ['find', 'findOne', 'create', 'update', 'delete'];
            let creados = 0;
            let existentes = 0;
            
            for (const accion of acciones) {
              const accionCompleta = `api::intranet-chat.intranet-chat.${accion}`;
              
              try {
                const permisoExistente = await strapiInstance.query('plugin::users-permissions.permission').findOne({
                  where: {
                    action: accionCompleta,
                    role: authenticatedRole.id,
                  },
                });
                
                if (permisoExistente) {
                  strapiInstance.log.info(`[configurar-permisos-chat] ℹ️  Permiso ya existe: ${accionCompleta}`);
                  existentes++;
                } else {
                  await strapiInstance.query('plugin::users-permissions.permission').create({
                    data: {
                      action: accionCompleta,
                      role: authenticatedRole.id,
                    },
                  });
                  strapiInstance.log.info(`[configurar-permisos-chat] ✅ Permiso creado: ${accionCompleta}`);
                  creados++;
                }
              } catch (error) {
                strapiInstance.log.error(`[configurar-permisos-chat] ❌ Error al procesar ${accionCompleta}:`, error.message);
              }
            }
            
            strapiInstance.log.info(`[configurar-permisos-chat] ✅ Configuración completada: ${creados} creados, ${existentes} ya existían`);
            return { creados, existentes };
          } catch (error) {
            strapiInstance.log.error('[configurar-permisos-chat] ❌ Error crítico:', error);
            throw error;
          }
        };
        
        const resultado = await configurarPermisosChat(strapi);
        if (resultado) {
          strapi.log.info(`[bootstrap] ✅ Configuración de permisos de chat completada: ${resultado.creados} creados, ${resultado.existentes} existentes`);
        } else {
          strapi.log.warn('[bootstrap] ⚠️  Configuración de permisos de chat no se completó (resultado null)');
        }
      } catch (err) {
        strapi.log.error('[bootstrap] ❌ Error al configurar permisos de chat:', err);
        strapi.log.error('[bootstrap] Stack trace:', err.stack);
      }
    }, 3000);
  },
};
