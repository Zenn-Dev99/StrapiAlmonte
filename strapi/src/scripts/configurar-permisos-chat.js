/**
 * Script para configurar permisos del content type intranet-chats
 * en el rol "Authenticated" de Strapi
 * 
 * Este script debe ejecutarse dentro del contexto de Strapi
 * Puede agregarse al bootstrap de Strapi o ejecutarse manualmente
 */

async function configurarPermisosChat(strapi) {
  try {
    strapi.log.info('[configurar-permisos-chat] 🚀 Iniciando configuración de permisos...')

    // Esperar un poco para asegurar que Strapi esté completamente inicializado
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 1. Obtener el rol "Authenticated"
    strapi.log.info('[configurar-permisos-chat] Buscando rol Authenticated...')
    const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    })

    if (!authenticatedRole) {
      strapi.log.warn('[configurar-permisos-chat] ⚠️  Rol Authenticated no encontrado')
      return
    }

    strapi.log.info(`[configurar-permisos-chat] ✅ Rol encontrado: ID ${authenticatedRole.id}, nombre: ${authenticatedRole.name}`)

    // 2. Acciones a configurar
    const acciones = ['find', 'findOne', 'create', 'update', 'delete']
    let creados = 0
    let existentes = 0
    let errores = 0

    // 3. Crear permisos faltantes
    for (const accion of acciones) {
      const accionCompleta = `api::intranet-chat.intranet-chat.${accion}`

      try {
        // Verificar si el permiso ya existe
        const permisoExistente = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: accionCompleta,
            role: authenticatedRole.id,
          },
        })

        if (permisoExistente) {
          strapi.log.info(`[configurar-permisos-chat] ℹ️  Permiso ya existe: ${accionCompleta} (ID: ${permisoExistente.id})`)
          existentes++
        } else {
          // Crear el permiso
          const nuevoPermiso = await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: accionCompleta,
              role: authenticatedRole.id,
            },
          })
          strapi.log.info(`[configurar-permisos-chat] ✅ Permiso creado: ${accionCompleta} (ID: ${nuevoPermiso.id})`)
          creados++
        }
      } catch (error) {
        strapi.log.error(`[configurar-permisos-chat] ❌ Error al procesar ${accionCompleta}:`, error.message)
        errores++
      }
    }

    // 4. Verificar permisos finales
    strapi.log.info('[configurar-permisos-chat] Verificando permisos finales...')
    const permisosFinales = await strapi.query('plugin::users-permissions.permission').findMany({
      where: {
        role: authenticatedRole.id,
        action: { $contains: 'api::intranet-chat.intranet-chat' },
      },
    })

    strapi.log.info(
      `[configurar-permisos-chat] ✅ Configuración completada: ${creados} creados, ${existentes} ya existían, ${errores} errores`
    )
    strapi.log.info(
      `[configurar-permisos-chat] 📊 Total de permisos de intranet-chat configurados: ${permisosFinales.length}`
    )

    if (permisosFinales.length > 0) {
      permisosFinales.forEach((perm) => {
        strapi.log.info(`[configurar-permisos-chat]   - ${perm.action} (ID: ${perm.id})`)
      })
    }

    return {
      creados,
      existentes,
      errores,
      total: permisosFinales.length,
    }
  } catch (error) {
    strapi.log.error('[configurar-permisos-chat] ❌ Error crítico:', error)
    strapi.log.error('[configurar-permisos-chat] Stack:', error.stack)
    throw error
  }
}

module.exports = configurarPermisosChat

