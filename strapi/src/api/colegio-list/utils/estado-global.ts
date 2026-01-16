type IdValue = string | number | null | undefined;
type EstadoGlobal = 'sin_versiones' | 'en_proceso' | 'publicado';

const normalizeId = (value: any): IdValue => {
  if (!value && value !== 0) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'object') {
    if (value.id) return normalizeId(value.id);
    if (Array.isArray(value.connect) && value.connect.length > 0) {
      return normalizeId(value.connect[0]);
    }
    if (Array.isArray(value.set) && value.set.length > 0) {
      return normalizeId(value.set[0]);
    }
  }
  return null;
};

const estadoFromVersion = (estado?: string | null): EstadoGlobal => {
  if (!estado) return 'sin_versiones';
  return estado === 'published' ? 'publicado' : 'en_proceso';
};

export const refreshEstadoGlobal = async (rawId: any) => {
  const listId = normalizeId(rawId);
  if (!listId) return;

  const entry = (await strapi.entityService.findOne(
    'api::colegio-list.colegio-list',
    listId,
    {
      fields: ['estado_global'],
      populate: {
        version_actual: {
          fields: ['estado'],
        },
        versiones: {
          fields: ['id'],
        },
      },
    } as any
  )) as any;

  if (!entry) return;

  let nextEstado: EstadoGlobal = 'sin_versiones';
  const versionEstado = entry?.version_actual?.estado;
  if (versionEstado) {
    nextEstado = estadoFromVersion(versionEstado);
  } else if (Array.isArray(entry?.versiones) && entry.versiones.length > 0) {
    nextEstado = 'en_proceso';
  }

  if (nextEstado !== entry.estado_global) {
    await strapi.entityService.update('api::colegio-list.colegio-list', listId, {
      data: { estado_global: nextEstado },
      fields: ['id'],
    } as any);
  }
};

export const extractEventListId = (event: any) =>
  normalizeId(
    event?.result?.id ||
      event?.params?.where?.id ||
      event?.params?.data?.id ||
      event?.params?.data?.documentId
  );

export const extractParentListId = (event: any) =>
  normalizeId(
    event?.result?.colegio_list ||
      event?.params?.data?.colegio_list ||
      event?.params?.where?.colegio_list
  );

export const extractParentListIdsFromMany = (results: any[]) => {
  const ids = new Set<IdValue>();
  for (const entry of results || []) {
    const id = normalizeId((entry as any)?.colegio_list?.id || (entry as any)?.colegio_list);
    if (id) ids.add(id);
  }
  return Array.from(ids).filter(Boolean) as Array<string | number>;
};
