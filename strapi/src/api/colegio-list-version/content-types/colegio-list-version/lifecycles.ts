import {
  extractParentListId,
  extractParentListIdsFromMany,
  refreshEstadoGlobal,
} from '../../../colegio-list/utils/estado-global';

const getParentIds = async (event: any) => {
  if (Array.isArray(event?.result)) {
    const ids = extractParentListIdsFromMany(event.result);
    if (ids.length > 0) return ids;
  }

  const directId = extractParentListId(event);
  if (directId) return [directId];

  const versionId =
    event?.result?.id ||
    event?.params?.where?.id ||
    event?.params?.data?.id ||
    event?.params?.where?.documentId;

  if (!versionId) return [];

  const entity = (await strapi.entityService.findOne(
    'api::colegio-list-version.colegio-list-version',
    versionId,
    {
      fields: ['id'],
      populate: {
        colegio_list: {
          fields: ['id'],
        },
      },
    } as any
  )) as any;

  const parentId = extractParentListId({ result: entity });
  return parentId ? [parentId] : [];
};

const refreshRelatedLists = async (event: any) => {
  const listIds = await getParentIds(event);
  const uniqueIds = Array.from(new Set(listIds));
  for (const id of uniqueIds) {
    await refreshEstadoGlobal(id);
  }
};

export default {
  async afterCreate(event: any) {
    await refreshRelatedLists(event);
  },
  async afterUpdate(event: any) {
    await refreshRelatedLists(event);
  },
  async afterDelete(event: any) {
    await refreshRelatedLists(event);
  },
  async afterCreateMany(event: any) {
    await refreshRelatedLists(event);
  },
  async afterUpdateMany(event: any) {
    await refreshRelatedLists(event);
  },
  async afterDeleteMany(event: any) {
    await refreshRelatedLists(event);
  },
};
