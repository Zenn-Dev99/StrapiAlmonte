// src/api/cartera-asignacion/content-types/cartera-asignacion/lifecycles.js

const UID = 'api::cartera-asignacion.cartera-asignacion';
const SHARED_FIELDS = ['prioridad', 'orden'];

function isEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return false;
}

async function loadEntry(id) {
  if (!id) return null;
  return strapi.db.query(UID).findOne({
    where: { id },
    select: ['id', 'documentId', 'prioridad', 'orden', 'rol', 'is_current'],
    populate: {
      periodo: { select: ['id'] },
      colegio: { select: ['id'] },
    },
  });
}

function buildSyncPayload(entry, previousState = {}) {
  const data = {};
  for (const field of SHARED_FIELDS) {
    const nextValue = entry?.[field];
    const prevValue = previousState?.[field];
    if (!isEqual(nextValue, prevValue)) {
      data[field] = nextValue ?? null;
    }
  }
  return data;
}

async function syncSiblings(event) {
  try {
    const id = event?.result?.id ?? event?.params?.where?.id;
    const entry = await loadEntry(id);
    if (!entry) return;

    if (entry.rol && entry.rol !== 'comercial') return;

    const syncData = buildSyncPayload(entry, event?.state);
    if (!Object.keys(syncData).length) return;

    const periodoId = entry.periodo?.id;
    const colegioId = entry.colegio?.id;
    if (!periodoId || !colegioId) return;

    await strapi.db.query(UID).updateMany({
      where: {
        id: { $ne: entry.id },
        periodo: periodoId,
        colegio: colegioId,
        is_current: entry.is_current ?? true,
      },
      data: syncData,
    });
  } catch (err) {
    strapi.log.error('[cartera-asignacion:lifecycle] syncSiblings error', err);
  }
}

export default {
  async afterUpdate(event) {
    await syncSiblings(event);
  },
};
