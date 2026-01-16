/**
 * Cliente para la API de Notion
 */
import { Client } from '@notionhq/client';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_API_VERSION = process.env.NOTION_API_VERSION || '2022-06-28';

if (!NOTION_API_KEY) {
  throw new Error('NOTION_API_KEY no está configurado en las variables de entorno');
}

export const notionClient = new Client({
  auth: NOTION_API_KEY,
  notionVersion: NOTION_API_VERSION,
});

/**
 * Obtiene todas las páginas de una base de datos de Notion
 */
export async function queryDatabase(databaseId: string) {
  const response = await notionClient.databases.query({
    database_id: databaseId,
  });
  
  return response.results;
}

/**
 * Obtiene una página específica de Notion
 */
export async function getPage(pageId: string) {
  return await notionClient.pages.retrieve({ page_id: pageId });
}

/**
 * Actualiza una página en Notion
 */
export async function updatePage(pageId: string, properties: any) {
  return await notionClient.pages.update({
    page_id: pageId,
    properties,
  });
}

