// src/api/colegio/content-types/colegio/lifecycles.js

console.log('[colegio:lifecycle] CARGADO');

function log(...args) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[colegio:lifecycle]', ...args);
  }
}

function extractComunaConnect(val) {
  if (!val) return undefined;
  if (Array.isArray(val?.connect) && val.connect[0]) return val.connect[0];
  if (Array.isArray(val?.set) && val.set[0]) return val.set[0];
  return val;
}

function normalizeComunaIdentifier(val) {
  if (!val) return { id: undefined, documentId: undefined };
  if (typeof val === 'number') return { id: val, documentId: undefined };
  if (typeof val === 'string') return { id: undefined, documentId: val.trim() };
  if (typeof val === 'object') {
    const id = typeof val.id === 'number' ? val.id : undefined;
    const documentId = typeof val.documentId === 'string' ? val.documentId.trim() : undefined;
    return { id, documentId };
  }
  return { id: undefined, documentId: undefined };
}

async function fetchComuna(id, documentId) {
  let comunaId = id;

  if (!comunaId && documentId) {
    const byDoc = await strapi.entityService.findMany('api::comuna.comuna', {
      filters: { documentId: { $eq: documentId } },
      fields: ['id'],
      limit: 1,
    });
    comunaId = Array.isArray(byDoc) && byDoc[0]?.id ? byDoc[0].id : undefined;
  }

  if (!comunaId) return null;

  return strapi.entityService.findOne('api::comuna.comuna', comunaId, {
    fields: [
      'comuna_nombre',
      'provincia_nombre',
      'region_nombre',
      'zona_nombre',
    ],
  });
}

function assignGeo(data, comuna) {
  if (!comuna) {
    data.region = null;
    data.provincia = null;
    data.zona = null;
    return;
  }

  data.region = comuna.region_nombre || null;
  data.provincia = comuna.provincia_nombre || null;
  data.zona = comuna.zona_nombre || null;
}

module.exports = {
  async beforeCreate(event) {
    const data = event.params?.data;
    if (!data) return;

    const comunaConnect = extractComunaConnect(data.comuna);
    const { id, documentId } = normalizeComunaIdentifier(comunaConnect);
    const comuna = await fetchComuna(id, documentId);
    assignGeo(data, comuna);
  },

  async beforeUpdate(event) {
    const data = event.params?.data;
    if (!data) return;

    const comunaConnect = extractComunaConnect(data.comuna);
    if (!comunaConnect) return; // no se modifica la comuna

    const { id, documentId } = normalizeComunaIdentifier(comunaConnect);
    const comuna = await fetchComuna(id, documentId);
    assignGeo(data, comuna);
  },
};