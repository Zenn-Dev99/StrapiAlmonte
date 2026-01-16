/**
 * Script para verificar y corregir permisos del campo remitente_id en intranet-chat
 * 
 * Este script asegura que el campo remitente_id sea visible para todos los roles
 * que tienen acceso al content type intranet-chat.
 * 
 * Ejecutar desde la raíz del proyecto Strapi:
 * node scripts/verificar-permisos-chat-remitente-id.js
 */

const { createStrapi } = require('@strapi/strapi')
const path = require('path')

async function verificarYCorregirPermisos() {
  const projectDir = path.resolve(__dirname, '..')
  const distDir = path.join(projectDir, 'dist')
  
  // Crear y cargar la instancia de Strapi
  const app = await createStrapi({ distDir }).load()
  
  try {
    console.log('🔍 Verificando permisos del content type intranet-chat...\n')
    
    // Obtener todos los roles
    const roles = await app.db.query('plugin::users-permissions.role').findMany({
      populate: ['permissions'],
    })
    
    console.log(`📋 Encontrados ${roles.length} roles\n`)
    
    // Obtener el content type
    const contentType = app.contentTypes['api::intranet-chat.intranet-chat']
    if (!contentType) {
      console.error('❌ No se encontró el content type intranet-chat')
      return
    }
    
    console.log(`✅ Content type encontrado: api::intranet-chat.intranet-chat\n`)
    
    let cambiosRealizados = 0
    
    // Verificar permisos para cada rol
    for (const role of roles) {
      console.log(`\n👤 Verificando rol: ${role.name} (ID: ${role.id})`)
      
      // Buscar permisos existentes para intranet-chat
      const permissions = await app.db.query('plugin::users-permissions.permission').findMany({
        where: {
          role: role.id,
          action: {
            $contains: 'intranet-chat',
          },
        },
      })
      
      if (permissions.length === 0) {
        console.log(`   ⚠️  No hay permisos configurados para este rol`)
        continue
      }
      
      console.log(`   📝 Permisos encontrados: ${permissions.length}`)
      
      // Verificar cada permiso
      for (const permission of permissions) {
        const action = permission.action
        console.log(`   🔑 Permiso: ${action}`)
        
        // Verificar si el permiso tiene campos restringidos
        if (permission.properties && permission.properties.fields) {
          const campos = permission.properties.fields
          console.log(`      📋 Campos permitidos: ${campos.join(', ')}`)
          
          // Verificar si remitente_id está en la lista
          if (!campos.includes('remitente_id')) {
            console.log(`      ⚠️  PROBLEMA: remitente_id NO está en los campos permitidos`)
            console.log(`      🔧 Agregando remitente_id a los campos permitidos...`)
            
            // Agregar remitente_id a los campos permitidos
            campos.push('remitente_id')
            
            // Actualizar el permiso
            await app.db.query('plugin::users-permissions.permission').update({
              where: { id: permission.id },
              data: {
                properties: {
                  ...permission.properties,
                  fields: campos,
                },
              },
            })
            
            console.log(`      ✅ remitente_id agregado correctamente`)
            cambiosRealizados++
          } else {
            console.log(`      ✅ remitente_id ya está permitido`)
          }
        } else {
          // Si no hay restricción de campos, todos los campos están permitidos
          console.log(`      ✅ Sin restricciones de campos (todos los campos están permitidos)`)
        }
      }
    }
    
    console.log('\n\n✅ Verificación completada')
    if (cambiosRealizados > 0) {
      console.log(`\n🔧 Se realizaron ${cambiosRealizados} cambios`)
      console.log('\n💡 REINICIA Strapi para que los cambios surtan efecto')
    } else {
      console.log('\n✅ No se encontraron problemas con los permisos')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error.stack)
  } finally {
    await app.destroy()
  }
}

verificarYCorregirPermisos()

