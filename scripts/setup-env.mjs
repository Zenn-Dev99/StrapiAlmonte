#!/usr/bin/env node

/**
 * Script para configurar automáticamente el archivo .env
 * Facilita la configuración después de clonar el repositorio
 * 
 * Uso:
 *   node scripts/setup-env.mjs
 *   npm run setup:env
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear interfaz para leer input del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Crea el archivo .env con las credenciales proporcionadas
 */
function createEnvFile(credentials) {
  const envContent = `# ============================================
# Control de Sincronización
# ============================================
ENABLE_WOOCOMMERCE_SYNC=true

# ============================================
# WooCommerce - Moraleja
# ============================================
WOO_MORALEJA_URL=${credentials.moraleja.url}
WOO_MORALEJA_CONSUMER_KEY=${credentials.moraleja.key}
WOO_MORALEJA_CONSUMER_SECRET=${credentials.moraleja.secret}

# ============================================
# WooCommerce - Librería Escolar
# ============================================
WOO_ESCOLAR_URL=${credentials.escolar.url}
WOO_ESCOLAR_CONSUMER_KEY=${credentials.escolar.key}
WOO_ESCOLAR_CONSUMER_SECRET=${credentials.escolar.secret}
`;

  const envPath = join(__dirname, '..', '.env');
  writeFileSync(envPath, envContent, 'utf-8');
  console.log('\n✅ Archivo .env creado exitosamente!\n');
}

/**
 * Solicita credenciales al usuario
 */
async function askForCredentials() {
  console.log('\n📝 Configuración de Credenciales WooCommerce\n');
  console.log('Necesitarás las credenciales de WordPress:');
  console.log('1. Ve a WordPress → WooCommerce → Settings → Advanced → REST API');
  console.log('2. Crea una nueva clave con permisos Read/Write');
  console.log('3. Copia el Consumer Key y Consumer Secret\n');

  const credentials = {
    moraleja: {},
    escolar: {},
  };

  // Moraleja
  console.log('🔵 Configuración de Moraleja:');
  credentials.moraleja.url = await question('URL de Moraleja (ej: https://moraleja.cl): ') || 'https://moraleja.cl';
  credentials.moraleja.key = await question('Consumer Key de Moraleja (ck_...): ');
  credentials.moraleja.secret = await question('Consumer Secret de Moraleja (cs_...): ');

  // Escolar
  console.log('\n🟢 Configuración de Escolar:');
  const useEscolar = await question('¿Quieres configurar Escolar? (s/n): ');
  
  if (useEscolar.toLowerCase() === 's' || useEscolar.toLowerCase() === 'y') {
    credentials.escolar.url = await question('URL de Escolar (ej: https://libreriaescolar.cl): ') || 'https://libreriaescolar.cl';
    credentials.escolar.key = await question('Consumer Key de Escolar (ck_...): ');
    credentials.escolar.secret = await question('Consumer Secret de Escolar (cs_...): ');
  } else {
    // Valores por defecto (comentados)
    credentials.escolar.url = 'https://libreriaescolar.cl';
    credentials.escolar.key = '';
    credentials.escolar.secret = '';
  }

  return credentials;
}

/**
 * Función principal
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Configuración Automática de .env                   ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const envPath = join(__dirname, '..', '.env');
  
  // Verificar si ya existe .env
  if (existsSync(envPath)) {
    const overwrite = await question('⚠️  El archivo .env ya existe. ¿Deseas sobrescribirlo? (s/n): ');
    if (overwrite.toLowerCase() !== 's' && overwrite.toLowerCase() !== 'y') {
      console.log('\n❌ Operación cancelada. El archivo .env no fue modificado.');
      rl.close();
      return;
    }
  }

  // Opciones de configuración
  console.log('\n¿Cómo quieres configurar las credenciales?');
  console.log('1. Ingresar manualmente (tienes las credenciales)');
  console.log('2. Usar credenciales de producción (desde Railway/documento compartido)');
  console.log('3. Cancelar\n');

  const option = await question('Selecciona una opción (1/2/3): ');

  if (option === '3') {
    console.log('\n❌ Operación cancelada.');
    rl.close();
    return;
  }

  let credentials;

  if (option === '2') {
    console.log('\n📋 Ingresa las credenciales de producción:');
    console.log('(Puedes obtenerlas del administrador o desde Railway)\n');
    credentials = await askForCredentials();
  } else {
    // Opción 1 o por defecto
    credentials = await askForCredentials();
  }

  // Validar que al menos Moraleja esté configurada
  if (!credentials.moraleja.key || !credentials.moraleja.secret) {
    console.log('\n❌ Error: Debes configurar al menos las credenciales de Moraleja.');
    rl.close();
    return;
  }

  // Crear archivo .env
  createEnvFile(credentials);

  // Verificar configuración
  console.log('🔍 Verificando configuración...\n');
  
  // Cargar variables de entorno
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });

  // Importar y ejecutar verificación
  try {
    const { default: verifyConfig } = await import('./configurar-woocommerce.mjs');
    // El script se ejecutará automáticamente
  } catch (error) {
    console.log('✅ Configuración completada!');
    console.log('\n💡 Para verificar, ejecuta:');
    console.log('   node scripts/configurar-woocommerce.mjs\n');
  }

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  rl.close();
  process.exit(1);
});













