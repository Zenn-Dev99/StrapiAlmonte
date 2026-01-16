export default {
  routes: [
    {
      method: 'POST',
      path: '/maintenance/content-manager-sync',
      handler: 'maintenance.contentManagerSync',
    },
    {
      method: 'GET',
      path: '/maintenance/content-manager-sync',
      handler: 'maintenance.contentManagerSync',
    },
    {
      method: 'POST',
      path: '/maintenance/configurar-permisos-chat',
      handler: 'maintenance.configurarPermisosChat',
    },
    {
      method: 'GET',
      path: '/maintenance/configurar-permisos-chat',
      handler: 'maintenance.configurarPermisosChat',
    },
  ],
};
