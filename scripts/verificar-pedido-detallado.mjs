#!/usr/bin/env node

/**
 * Script para verificar en detalle un pedido específico
 */

import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL || 'https://strapi.moraleja.cl';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.argv[2];
const PEDIDO_ID = process.argv[3];

if (!STRAPI_TOKEN || !PEDIDO_ID) {
  console.error('❌ Uso: node verificar-pedido-detallado.mjs <token> <pedido_id>');
  process.exit(1);
}

const STRAPI_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${STRAPI_TOKEN}`,
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function strapiRequest(path, options = {}) {
  const { method = 'GET', body } = options;
  const res = await fetch(`${STRAPI_URL}${path}`, {
    method,
    headers: STRAPI_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strapi ${method} ${path} -> ${res.status}: ${text.substring(0, 500)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function verificarPedido() {
  log('\n🔍 Verificando pedido en detalle...', 'cyan');
  log(`   ID: ${PEDIDO_ID}`, 'blue');
  
  try {
    // Intentar diferentes formas de obtener el pedido
    const pedido1 = await strapiRequest(`/api/wo-pedidos/${PEDIDO_ID}`);
    log('\n📦 Respuesta básica:', 'cyan');
    console.log(JSON.stringify(pedido1, null, 2));
    
    const pedido2 = await strapiRequest(`/api/wo-pedidos/${PEDIDO_ID}?populate=*`);
    log('\n📦 Respuesta con populate=*:', 'cyan');
    console.log(JSON.stringify(pedido2, null, 2));
    
    const pedido3 = await strapiRequest(`/api/wo-pedidos/${PEDIDO_ID}?populate[items]=*&populate[cliente]=*`);
    log('\n📦 Respuesta con populate anidado:', 'cyan');
    console.log(JSON.stringify(pedido3, null, 2));
    
    const pedido4 = await strapiRequest(`/api/wo-pedidos/${PEDIDO_ID}?populate[items][populate][libro]=*&populate[cliente]=*`);
    log('\n📦 Respuesta con populate items.libro:', 'cyan');
    console.log(JSON.stringify(pedido4, null, 2));
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  }
}

verificarPedido();
