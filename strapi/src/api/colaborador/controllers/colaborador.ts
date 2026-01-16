import { factories } from '@strapi/strapi';
import bcrypt from 'bcryptjs';

export default factories.createCoreController('api::colaborador.colaborador', ({ strapi }) => ({
  // Los métodos CRUD base (find, findOne, create, update, delete) se heredan automáticamente
  // cuando usas createCoreController. Solo definimos métodos personalizados adicionales.
  
  async login(ctx) {
    try {
      const { email_login, password } = ctx.request.body;

      if (!email_login || !password) {
        return ctx.badRequest('email_login y password son requeridos');
      }

      // Buscar colaborador por email_login
      // Necesitamos obtener el password que es privado, así que usamos entityService directamente
      const colaboradores = await strapi.entityService.findMany('api::colaborador.colaborador', {
        filters: { email_login },
        populate: {
          persona: {
            populate: {
              emails: true,
              telefonos: true,
              imagen: true,
            },
          },
          usuario: true,
        },
      });

      if (!colaboradores || colaboradores.length === 0) {
        return ctx.notFound('No se encontró un colaborador con este email_login');
      }

      const colaborador = colaboradores[0] as any;

      // Extraer campos (pueden venir en attributes si tiene draft/publish)
      const colaboradorAttrs = colaborador.attributes || colaborador;
      const activo = colaboradorAttrs.activo !== undefined ? colaboradorAttrs.activo : colaborador.activo;
      const emailLogin = colaboradorAttrs.email_login || colaborador.email_login;
      const rolRaw = colaboradorAttrs.rol || colaborador.rol;

      // Verificar que esté activo
      if (!activo) {
        return ctx.forbidden('Tu cuenta está desactivada. Contacta al administrador.');
      }

      // Obtener el password del colaborador (campo privado)
      // Necesitamos obtenerlo directamente de la base de datos
      const colaboradorCompleto = await strapi.db.query('api::colaborador.colaborador').findOne({
        where: { id: colaborador.id },
        select: ['id', 'password', 'email_login', 'activo'],
      });

      // Verificar password del colaborador
      if (!colaboradorCompleto?.password) {
        return ctx.forbidden('No se ha configurado una contraseña para este colaborador.');
      }

      const passwordMatch = await bcrypt.compare(password, colaboradorCompleto.password);

      if (!passwordMatch) {
        return ctx.unauthorized('Contraseña incorrecta');
      }

      // Obtener el rol del colaborador (normalizar el valor)
      const rol = rolRaw || 'soporte';

      // Si tiene usuario vinculado, generar JWT con ese usuario
      // Si no tiene usuario vinculado, generar un JWT temporal o usar el ID del colaborador
      let jwt: string;
      let usuarioData: any = null;

      const usuarioRelacion = colaborador.usuario as any;
      if (usuarioRelacion) {
        // Obtener el usuario vinculado
        const usuarioId = typeof usuarioRelacion === 'object' 
          ? usuarioRelacion.id 
          : usuarioRelacion;

        // Usar db.query para obtener el usuario con campos específicos
        const usuario = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: usuarioId },
          select: ['id', 'email', 'username'],
        });

        if (usuario) {
          // Generar JWT usando el servicio de Strapi con el usuario vinculado
          jwt = strapi.plugins['users-permissions'].services.jwt.issue({
            id: usuario.id,
          });
          usuarioData = {
            id: usuario.id,
            email: (usuario as any).email || null,
            username: (usuario as any).username || null,
          };
        } else {
          // Si el usuario no existe, generar JWT temporal con el ID del colaborador
          // Nota: Esto es temporal, idealmente debería tener un usuario vinculado
          jwt = strapi.plugins['users-permissions'].services.jwt.issue({
            id: colaborador.id,
            email: colaborador.email_login,
          });
        }
      } else {
        // No tiene usuario vinculado, generar JWT temporal con datos del colaborador
        // Nota: Esto es temporal, idealmente debería tener un usuario vinculado
        jwt = strapi.plugins['users-permissions'].services.jwt.issue({
          id: colaborador.id,
          email: colaborador.email_login,
        });
      }

      return ctx.send({
        jwt,
        usuario: usuarioData || {
          id: colaborador.id,
          email: colaborador.email_login,
          username: colaborador.email_login,
        },
        colaborador: {
          id: colaborador.id,
          email_login: emailLogin,
          activo: activo,
          rol: rol,
          persona: colaborador.persona || null,
        },
      });
    } catch (error: any) {
      strapi.log.error('[colaborador.login] Error:', error);
      return ctx.internalServerError(error.message || 'Error al iniciar sesión');
    }
  },
}));

