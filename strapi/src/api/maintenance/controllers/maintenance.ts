import type { Context } from 'koa';

import { ensureContentManagerMainFields } from '../../../utils/bootstrap-maintenance';

declare const strapi: any;

// Función para configurar permisos de chat (inline para evitar problemas de import)
async function configurarPermisosChatInline(strapiInstance: any) {
  try {
    strapiInstance.log.info('[configurar-permisos-chat] 🚀 Iniciando configuración de permisos...');

    // Esperar un poco para asegurar que Strapi esté completamente inicializado
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Obtener el rol "Authenticated"
    strapiInstance.log.info('[configurar-permisos-chat] Buscando rol Authenticated...');
    const authenticatedRole = await strapiInstance.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    if (!authenticatedRole) {
      strapiInstance.log.warn('[configurar-permisos-chat] ⚠️  Rol Authenticated no encontrado');
      return null;
    }

    strapiInstance.log.info(`[configurar-permisos-chat] ✅ Rol encontrado: ID ${authenticatedRole.id}, nombre: ${authenticatedRole.name}`);

    // 2. Acciones a configurar
    const acciones = ['find', 'findOne', 'create', 'update', 'delete'];
    let creados = 0;
    let existentes = 0;
    let errores = 0;

    // 3. Crear permisos faltantes
    for (const accion of acciones) {
      const accionCompleta = `api::intranet-chat.intranet-chat.${accion}`;

      try {
        // Verificar si el permiso ya existe
        const permisoExistente = await strapiInstance.query('plugin::users-permissions.permission').findOne({
          where: {
            action: accionCompleta,
            role: authenticatedRole.id,
          },
        });

        if (permisoExistente) {
          strapiInstance.log.info(`[configurar-permisos-chat] ℹ️  Permiso ya existe: ${accionCompleta} (ID: ${permisoExistente.id})`);
          existentes++;
        } else {
          // Crear el permiso
          const nuevoPermiso = await strapiInstance.query('plugin::users-permissions.permission').create({
            data: {
              action: accionCompleta,
              role: authenticatedRole.id,
            },
          });
          strapiInstance.log.info(`[configurar-permisos-chat] ✅ Permiso creado: ${accionCompleta} (ID: ${nuevoPermiso.id})`);
          creados++;
        }
      } catch (error: any) {
        strapiInstance.log.error(`[configurar-permisos-chat] ❌ Error al procesar ${accionCompleta}:`, error.message);
        errores++;
      }
    }

    // 4. Verificar permisos finales
    strapiInstance.log.info('[configurar-permisos-chat] Verificando permisos finales...');
    const permisosFinales = await strapiInstance.query('plugin::users-permissions.permission').findMany({
      where: {
        role: authenticatedRole.id,
        action: { $contains: 'api::intranet-chat.intranet-chat' },
      },
    });

    strapiInstance.log.info(
      `[configurar-permisos-chat] ✅ Configuración completada: ${creados} creados, ${existentes} ya existían, ${errores} errores`
    );
    strapiInstance.log.info(
      `[configurar-permisos-chat] 📊 Total de permisos de intranet-chat configurados: ${permisosFinales.length}`
    );

    if (permisosFinales.length > 0) {
      permisosFinales.forEach((perm: any) => {
        strapiInstance.log.info(`[configurar-permisos-chat]   - ${perm.action} (ID: ${perm.id})`);
      });
    }

    return {
      creados,
      existentes,
      errores,
      total: permisosFinales.length,
    };
  } catch (error: any) {
    strapiInstance.log.error('[configurar-permisos-chat] ❌ Error crítico:', error);
    strapiInstance.log.error('[configurar-permisos-chat] Stack:', error.stack);
    throw error;
  }
}

const extractBearer = (ctx: Context): string | undefined => {
  const header =
    (ctx.request?.header?.authorization as string | undefined) ||
    (ctx.request?.header?.Authorization as string | undefined);
  if (!header) return undefined;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
};

export default {
  async contentManagerSync(ctx: Context) {
    try {
      const bearer = extractBearer(ctx);
      const authState = ctx.state || {};
      const isApiToken = authState?.auth?.strategy?.name === 'api-token';
      const isAdminUser = Boolean(authState?.user);

      if (!bearer || (!isApiToken && !isAdminUser)) {
        return ctx.unauthorized('Missing or invalid credentials');
      }

      await ensureContentManagerMainFields(strapi);
      ctx.body = { ok: true };
    } catch (error) {
      const message =
        (error && typeof error === 'object' && 'message' in error
          ? (error as any).message
          : 'Internal error');
      strapi.log.error('[maintenance] contentManagerSync failed', error);
      ctx.internalServerError(message);
    }
  },

  async configurarPermisosChat(ctx: Context) {
    try {
      const bearer = extractBearer(ctx);
      const authState = ctx.state || {};
      const isApiToken = authState?.auth?.strategy?.name === 'api-token';
      const isAdminUser = Boolean(authState?.user);

      if (!bearer || (!isApiToken && !isAdminUser)) {
        return ctx.unauthorized('Missing or invalid credentials');
      }

      strapi.log.info('[maintenance] Ejecutando configuración de permisos de chat manualmente...');
      const resultado = await configurarPermisosChatInline(strapi);
      
      ctx.body = { 
        ok: true,
        resultado: resultado || { message: 'Script ejecutado pero no retornó resultado' }
      };
    } catch (error) {
      const message =
        (error && typeof error === 'object' && 'message' in error
          ? (error as any).message
          : 'Internal error');
      strapi.log.error('[maintenance] configurarPermisosChat failed', error);
      ctx.internalServerError(message);
    }
  },
};
