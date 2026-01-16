#!/usr/bin/env node

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno desde .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

try {
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
} catch (err) {
  // .env no existe o no se puede leer
}

const WOO_URL = process.env.WOO_MORALEJA_URL || 'https://staging.moraleja.cl';
const WOO_KEY = process.env.WOO_MORALEJA_CONSUMER_KEY;
const WOO_SECRET = process.env.WOO_MORALEJA_CONSUMER_SECRET;

if (!WOO_KEY || !WOO_SECRET) {
  console.error('❌ Falta WOO_MORALEJA_CONSUMER_KEY o WOO_MORALEJA_CONSUMER_SECRET');
  process.exit(1);
}

const auth = Buffer.from(`${WOO_KEY}:${WOO_SECRET}`).toString('base64');

async function checkProducts() {
  try {
    const response = await fetch(`${WOO_URL}/wp-json/wc/v3/products?per_page=10&orderby=date&order=desc`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${response.status} ${errorText}`);
      process.exit(1);
    }

    const products = await response.json();
    const total = response.headers.get('x-wp-total') || products.length;

    console.log(`\n📦 Últimos ${Math.min(10, products.length)} productos en WooCommerce:\n`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   SKU: ${product.sku || 'N/A'}`);
      console.log(`   Fecha: ${new Date(product.date_created).toLocaleString()}`);
      console.log('');
    });

    console.log(`Total de productos: ${total}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProducts();

