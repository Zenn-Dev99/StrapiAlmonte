export default {
  routes: [
    {
      method: 'POST',
      path: '/turnos/llamar-siguiente',
      handler: 'api::turno.turno.llamarSiguiente',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/turnos/:id/marcar-atendido',
      handler: 'api::turno.turno.marcarAtendido',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/turnos/estado',
      handler: 'api::turno.turno.obtenerEstado',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/turnos/verificar-proximos',
      handler: 'api::turno.turno.verificarProximos',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/turnos/iniciar-whatsapp',
      handler: 'api::turno.turno.iniciarWhatsApp',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

