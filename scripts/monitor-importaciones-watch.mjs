#!/usr/bin/env node

/**
 * Monitor de procesos de importación en modo watch
 * Actualización automática cada 3 segundos
 * 
 * Uso:
 *   node scripts/monitor-importaciones-watch.mjs
 */

import { spawn } from 'child_process';

const monitorPath = new URL('../scripts/monitor-importaciones.mjs', import.meta.url).pathname;

// Ejecutar monitor en modo watch
const proceso = spawn('node', [monitorPath, '--watch'], {
  stdio: 'inherit',
  shell: false,
});

proceso.on('error', (error) => {
  console.error('❌ Error ejecutando monitor:', error.message);
  process.exit(1);
});

proceso.on('exit', (code) => {
  process.exit(code);
});

