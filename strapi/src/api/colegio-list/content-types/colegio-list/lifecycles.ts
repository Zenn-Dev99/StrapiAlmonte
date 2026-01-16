import { extractEventListId, refreshEstadoGlobal } from '../../utils/estado-global';

export default {
  async afterCreate(event: any) {
    const listId = extractEventListId(event);
    if (listId) await refreshEstadoGlobal(listId);
  },
  async afterUpdate(event: any) {
    const listId = extractEventListId(event);
    if (listId) await refreshEstadoGlobal(listId);
  },
};
