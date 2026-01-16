/**
 * Cliente para la API de Wix
 * 
 * Wix ofrece varias formas de acceder a contenido:
 * 1. REST API (recomendado para sincronización)
 * 2. SDK de Wix (más complejo pero más funcional)
 * 
 * Por ahora, usaremos la REST API directamente.
 */
import fetch from 'node-fetch';

const WIX_SITE_ID = process.env.WIX_SITE_ID;
const WIX_API_KEY = process.env.WIX_API_KEY;
const WIX_OAUTH_TOKEN = process.env.WIX_OAUTH_TOKEN; // Opcional

if (!WIX_SITE_ID || !WIX_API_KEY) {
  throw new Error('WIX_SITE_ID y WIX_API_KEY deben estar configurados en las variables de entorno');
}

const WIX_API_BASE = `https://www.wixapis.com`;

/**
 * Obtiene todas las entradas de una colección de Wix
 * 
 * Nota: Wix requiere autenticación OAuth para acceso completo.
 * Si tienes WIX_OAUTH_TOKEN, se usará. Si no, intentará con API key.
 */
export async function queryCollection(collectionId: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Usar OAuth token si está disponible (mejor para Content Manager)
  if (WIX_OAUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${WIX_OAUTH_TOKEN}`;
  } else {
    // API key como fallback (puede tener limitaciones)
    headers['Authorization'] = `Bearer ${WIX_API_KEY}`;
  }

  // Endpoint de Wix Content Manager API
  const url = `${WIX_API_BASE}/content/v1/collections/${collectionId}/items`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Wix API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Obtiene una entrada específica de una colección de Wix
 */
export async function getItem(collectionId: string, itemId: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (WIX_OAUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${WIX_OAUTH_TOKEN}`;
  } else {
    headers['Authorization'] = `Bearer ${WIX_API_KEY}`;
  }

  const url = `${WIX_API_BASE}/content/v1/collections/${collectionId}/items/${itemId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Wix API Error ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

/**
 * Crea o actualiza una entrada en una colección de Wix
 */
export async function upsertItem(collectionId: string, itemId: string | null, data: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (WIX_OAUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${WIX_OAUTH_TOKEN}`;
  } else {
    headers['Authorization'] = `Bearer ${WIX_API_KEY}`;
  }

  const method = itemId ? 'PUT' : 'POST';
  const url = itemId 
    ? `${WIX_API_BASE}/content/v1/collections/${collectionId}/items/${itemId}`
    : `${WIX_API_BASE}/content/v1/collections/${collectionId}/items`;

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify({ item: data }),
  });

  if (!response.ok) {
    throw new Error(`Wix API Error ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

