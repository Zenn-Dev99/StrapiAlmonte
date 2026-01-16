#!/usr/bin/env node
/**
 * Script para habilitar permiso agregarPrecio en rol Public
 * Ejecutar: node scripts/habilitar-permiso-agregar-precio.mjs
 */

import Strapi from '@strapi/strapi';

async function habilitarPermiso() {
  console.log('🚀 Iniciando Strapi...');
  const strapi = await Strapi().load();
  
  try {
    console.log('🔍 Buscando rol Public...');
    
    // Buscar rol Public
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    });
    
    if (!publicRole) {
      console.error('❌ No se encontró el rol Public');
      process.exit(1);
    }
    
    console.log(`✅ Rol Public encontrado (ID: ${publicRole.id})`);
    
    // Verificar si ya existe el permiso
    const permisoExistente = await strapi.query('plugin::users-permissions.permission').findOne({
      where: {
        action: 'api::libro.libro.agregarPrecio',
        role: publicRole.id,
      },
    });
    
    if (permisoExistente) {
      console.log('ℹ️  El permiso ya existe');
      console.log('✅ Permiso:', permisoExistente);
    } else {
      console.log('📝 Creando permiso...');
      
      // Crear permiso
      const nuevoPermiso = await strapi.query('plugin::users-permissions.permission').create({
        data: {
          action: 'api::libro.libro.agregarPrecio',
          role: publicRole.id,
        },
      });
      
      console.log('✅ Permiso creado exitosamente!');
      console.log('📋 Detalles:', nuevoPermiso);
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Configuración completada');
    console.log('El endpoint /api/libros/agregar-precio ahora es público');
    console.log('═══════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await strapi.destroy();
  }
}

habilitarPermiso();

