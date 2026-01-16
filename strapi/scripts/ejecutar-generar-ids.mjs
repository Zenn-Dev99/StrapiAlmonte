#!/usr/bin/env node

/**
 * Script para ejecutar la generación de IDs desde fuera de Strapi
 * Inicializa Strapi y ejecuta el script de generación
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cambiar al directorio de Strapi
process.chdir(resolve(__dirname, '..'));

// Importar y ejecutar Strapi
const strapi = (await import('@strapi/strapi')).default;

const app = await strapi({
  distDir: resolve(__dirname, '..', 'dist'),
  autoReload: false,
  serveAdminPanel: false,
}).load();

console.log('✅ Strapi inicializado\n');

// Importar y ejecutar el script de generación
const generarIds = (await import('./generar-id-colecciones.mjs')).default;

try {
  await generarIds({ strapi: app });
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  await app.destroy();
  process.exit(0);
}

