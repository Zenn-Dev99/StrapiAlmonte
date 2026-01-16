/**
 * Cliente para la API de Strapi
 */
import fetch from 'node-fetch';

const STRAPI_URL = process.env.STRAPI_URL || process.env.STRAPI_LOCAL_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN || process.env.IMPORT_TOKEN;

if (!STRAPI_TOKEN) {
  throw new Error('STRAPI_TOKEN o IMPORT_TOKEN no está configurado en las variables de entorno');
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${STRAPI_TOKEN}`,
};

/**
 * Busca un registro en Strapi por un campo específico
 */
export async function findOne(
  contentType: string,
  filters: Record<string, any>,
  populate?: string[]
) {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    params.append(`filters[${key}][$eq]`, String(value));
  });
  
  if (populate && populate.length > 0) {
    params.append('populate', populate.join(','));
  }

  const response = await fetch(`${STRAPI_URL}/api/${contentType}?${params.toString()}`, {
    headers: HEADERS,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data?.[0] || null;
}

/**
 * Crea un registro en Strapi
 */
export async function create(contentType: string, data: any) {
  const response = await fetch(`${STRAPI_URL}/api/${contentType}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

/**
 * Actualiza un registro en Strapi
 */
export async function update(contentType: string, id: string | number, data: any) {
  const response = await fetch(`${STRAPI_URL}/api/${contentType}/${id}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

/**
 * Crea o actualiza un registro en Strapi (upsert)
 */
export async function upsert(
  contentType: string,
  uniqueField: string,
  uniqueValue: any,
  data: any
) {
  // Buscar registro existente
  const existing = await findOne(contentType, { [uniqueField]: uniqueValue });

  if (existing) {
    // Actualizar
    const id = existing.documentId || existing.id;
    return await update(contentType, id, data);
  } else {
    // Crear
    return await create(contentType, { ...data, [uniqueField]: uniqueValue });
  }
}

