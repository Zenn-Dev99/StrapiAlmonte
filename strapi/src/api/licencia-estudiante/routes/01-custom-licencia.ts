export default {
  routes: [
    {
      method: 'POST',
      path: '/licencias-estudiantes/activar',
      handler: 'licencia-estudiante.activar',
      config: {
        auth: false, // Permite acceso sin autenticación (el controlador maneja JWT opcional)
        policies: [],
        middlewares: [],
      },
    },
  ],
};


