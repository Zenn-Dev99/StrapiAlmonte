export default {
  routes: [
    {
      method: 'GET',
      path: '/promocion/mailboxes/by-colegio/:colegioId',
      handler: 'cartera-asignacion.findMailboxByColegio',
    },
  ],
};
