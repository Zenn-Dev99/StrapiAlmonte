#!/usr/bin/env node

/**
 * Script para resetear la contraseña del usuario de prueba de MIRA.APP
 * 
 * Uso:
 *   node scripts/reset-password-mira-usuario.mjs <email> <nueva_password>
 * 
 * Ejemplo:
 *   node scripts/reset-password-mira-usuario.mjs prueba@mira.app 123456
 */

import bcrypt from 'bcryptjs';

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

if (!STRAPI_API_TOKEN) {
  console.error('❌ Error: STRAPI_API_TOKEN no está configurado');
  console.error('   Configura la variable de entorno STRAPI_API_TOKEN');
  process.exit(1);
}

const email = process.argv[2] || 'prueba@mira.app';
const nuevaPassword = process.argv[3] || '123456';

async function resetPassword() {
  try {
    console.log(`\n🔄 Reseteando contraseña para: ${email}`);
    console.log(`   Nueva contraseña: ${nuevaPassword}`);
    console.log(`   URL: ${STRAPI_URL}\n`);

    // 1. Buscar el usuario
    console.log('📡 Buscando usuario...');
    const searchResponse = await fetch(
      `${STRAPI_URL}/api/personas-mira?filters[email][$eq]=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Error al buscar usuario: ${searchResponse.status} - ${error}`);
    }

    const searchData = await searchResponse.json();
    const usuarios = searchData.data || [];

    if (usuarios.length === 0) {
      throw new Error(`❌ Usuario ${email} no encontrado`);
    }

    const usuario = usuarios[0];
    console.log(`✅ Usuario encontrado: ID ${usuario.id}`);

    // 2. Hashear la nueva contraseña
    console.log('🔐 Hasheando nueva contraseña...');
    const passwordHash = bcrypt.hashSync(nuevaPassword, 10);
    console.log(`✅ Hash generado: ${passwordHash.substring(0, 20)}...`);

    // 3. Actualizar la contraseña usando la API directa de Strapi
    console.log('💾 Actualizando contraseña en Strapi...');
    
    // Usar el endpoint de actualización de Strapi
    const updateResponse = await fetch(
      `${STRAPI_URL}/api/personas-mira/${usuario.id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${STRAPI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            password: passwordHash, // Enviar el hash directamente
          },
        }),
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Error al actualizar: ${updateResponse.status} - ${error}`);
    }

    const updateData = await updateResponse.json();
    console.log('✅ Contraseña actualizada exitosamente');
    console.log(`\n📋 Usuario actualizado:`);
    console.log(`   ID: ${updateData.data.id}`);
    console.log(`   Email: ${updateData.data.email}`);
    console.log(`   Activo: ${updateData.data.activo}`);
    console.log(`\n✅ Ahora puedes hacer login con:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${nuevaPassword}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

resetPassword();


