import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::turno.turno', ({ strapi }) => ({
  async create(ctx) {
    const { telefono_cliente, nombre_cliente, tipo } = ctx.request.body.data || ctx.request.body;

    if (!telefono_cliente || !tipo) {
      return ctx.badRequest('Faltan campos requeridos: telefono_cliente, tipo');
    }

    // Validar tipo
    if (!['caja', 'retiros'].includes(tipo)) {
      return ctx.badRequest('Tipo inválido. Debe ser "caja" o "retiros"');
    }

    // Obtener el último turno del mismo tipo para generar el siguiente número
    const ultimoTurno = await strapi.entityService.findMany('api::turno.turno', {
      filters: {
        tipo: { $eq: tipo },
        estado: { $ne: 'cancelado' },
      },
      sort: { id: 'desc' },
      limit: 1,
    });

    let siguienteNumero = 1;
    if (ultimoTurno && ultimoTurno.length > 0) {
      const ultimoNumero = parseInt(ultimoTurno[0].numero.replace(/^[A-Z]/, ''), 10);
      siguienteNumero = ultimoNumero + 1;
    }

    // Determinar prefijo según tipo
    const prefijo = tipo === 'caja' ? 'A' : 'B';
    const numeroCompleto = `${prefijo}${siguienteNumero.toString().padStart(2, '0')}`;

    // Calcular tiempo estimado (simplificado: 5 minutos por turno pendiente)
    const turnosPendientes = await strapi.entityService.count('api::turno.turno', {
      filters: {
        tipo: { $eq: tipo },
        estado: { $in: ['pendiente', 'proximo'] },
      },
    });

    const tiempoEstimado = turnosPendientes * 5;

    const nuevoTurno = await strapi.entityService.create('api::turno.turno', {
      data: {
        numero: numeroCompleto,
        prefijo,
        tipo,
        telefono_cliente: telefono_cliente.replace(/\D/g, ''), // Solo números
        nombre_cliente: nombre_cliente || null,
        estado: 'pendiente',
        hora_creacion: new Date(),
        tiempo_espera_estimado: tiempoEstimado,
        notificacion_proximo_enviada: false,
        notificacion_llamado_enviada: false,
      },
    });

    // Enviar mensaje inicial por WhatsApp
    try {
      await strapi.service('api::turno.turno').enviarMensajeWhatsApp(
        telefono_cliente,
        `¡Hola! Tu número de atención es *${numeroCompleto}*. Tiempo estimado de espera: ${tiempoEstimado} minutos. Te avisaremos cuando estés próximo a ser llamado.`
      );
    } catch (error) {
      strapi.log.warn('Error al enviar mensaje WhatsApp inicial:', error);
    }

    return ctx.created({ data: nuevoTurno });
  },

  async llamarSiguiente(ctx) {
    const { tipo, ubicacion } = ctx.request.body.data || ctx.request.body;

    if (!tipo || !ubicacion) {
      return ctx.badRequest('Faltan campos requeridos: tipo, ubicacion');
    }

    // Validar ubicación según tipo
    if (tipo === 'caja' && !['caja-1', 'caja-2'].includes(ubicacion)) {
      return ctx.badRequest('Ubicación inválida para tipo caja');
    }
    if (tipo === 'retiros' && !['retiros-1', 'retiros-2'].includes(ubicacion)) {
      return ctx.badRequest('Ubicación inválida para tipo retiros');
    }

    // Buscar el siguiente turno pendiente o próximo del tipo especificado
    const siguienteTurno = await strapi.entityService.findMany('api::turno.turno', {
      filters: {
        tipo: { $eq: tipo },
        estado: { $in: ['pendiente', 'proximo'] },
      },
      sort: { hora_creacion: 'asc' },
      limit: 1,
    });

    if (!siguienteTurno || siguienteTurno.length === 0) {
      return ctx.notFound('No hay turnos pendientes');
    }

    const turno = siguienteTurno[0];

    // Actualizar turno
    const turnoActualizado = await strapi.entityService.update('api::turno.turno', turno.id, {
      data: {
        estado: 'llamado',
        ubicacion,
        hora_llamado: new Date(),
        notificacion_llamado_enviada: false,
      },
    });

    // Enviar notificación por WhatsApp
    try {
      const mensajeUbicacion = ubicacion.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      await strapi.service('api::turno.turno').enviarMensajeWhatsApp(
        turno.telefono_cliente,
        `¡Es tu turno! *${turno.numero}* - Por favor dirígete a ${mensajeUbicacion}`
      );
      await strapi.entityService.update('api::turno.turno', turno.id, {
        data: { notificacion_llamado_enviada: true },
      });
    } catch (error) {
      strapi.log.warn('Error al enviar notificación WhatsApp:', error);
    }

    return ctx.ok({ data: turnoActualizado });
  },

  async marcarAtendido(ctx) {
    const { id } = ctx.params;

    const turno = await strapi.entityService.findOne('api::turno.turno', id);

    if (!turno) {
      return ctx.notFound('Turno no encontrado');
    }

    const turnoActualizado = await strapi.entityService.update('api::turno.turno', id, {
      data: {
        estado: 'atendido',
        hora_atencion: new Date(),
      },
    });

    return ctx.ok({ data: turnoActualizado });
  },

  async obtenerEstado(ctx) {
    // Obtener el turno actual (llamado) y los próximos
    const turnoActual = await strapi.entityService.findMany('api::turno.turno', {
      filters: {
        estado: { $eq: 'llamado' },
      },
      sort: { hora_llamado: 'desc' },
      limit: 1,
    });

    const proximosTurnos = await strapi.entityService.findMany('api::turno.turno', {
      filters: {
        estado: { $in: ['pendiente', 'proximo'] },
      },
      sort: { hora_creacion: 'asc' },
      limit: 5,
    });

    return ctx.ok({
      data: {
        actual: turnoActual && turnoActual.length > 0 ? turnoActual[0] : null,
        proximos: proximosTurnos || [],
      },
    });
  },

  async verificarProximos(ctx) {
    // Verificar si hay turnos que deben recibir notificación de "próximo"
    const turnoActual = await strapi.entityService.findMany('api::turno.turno', {
      filters: {
        estado: { $eq: 'llamado' },
      },
      sort: { hora_llamado: 'desc' },
      limit: 1,
    });

    if (!turnoActual || turnoActual.length === 0) {
      return ctx.ok({ data: { notificados: 0 } });
    }

    const numeroActual = turnoActual[0].numero;
    const prefijoActual = numeroActual.charAt(0);
    const numeroActualInt = parseInt(numeroActual.replace(/^[A-Z]/, ''), 10);

    // Buscar turnos que están próximos (4 números antes del actual)
    const turnosProximos = await strapi.entityService.findMany('api::turno.turno', {
      filters: {
        prefijo: { $eq: prefijoActual },
        estado: { $eq: 'pendiente' },
        notificacion_proximo_enviada: { $eq: false },
      },
      sort: { hora_creacion: 'asc' },
    });

    let notificados = 0;
    for (const turno of turnosProximos) {
      const numeroTurno = parseInt(turno.numero.replace(/^[A-Z]/, ''), 10);
      const diferencia = numeroActualInt - numeroTurno;

      if (diferencia <= 4 && diferencia > 0) {
        try {
          await strapi.service('api::turno.turno').enviarMensajeWhatsApp(
            turno.telefono_cliente,
            `¡Estás próximo! Tu número *${turno.numero}* será llamado pronto. Por favor mantente atento.`
          );
          await strapi.entityService.update('api::turno.turno', turno.id, {
            data: {
              estado: 'proximo',
              notificacion_proximo_enviada: true,
            },
          });
          notificados++;
        } catch (error) {
          strapi.log.warn(`Error al notificar turno ${turno.numero}:`, error);
        }
      }
    }

    return ctx.ok({ data: { notificados } });
  },

  async iniciarWhatsApp(ctx) {
    const { telefono } = ctx.request.body.data || ctx.request.body;

    if (!telefono) {
      return ctx.badRequest('Falta el campo telefono');
    }

    try {
      await strapi.service('api::turno.turno').iniciarConversacionWhatsApp(telefono);
      return ctx.ok({ data: { mensaje: 'Conversación iniciada' } });
    } catch (error) {
      return ctx.internalServerError('Error al iniciar conversación WhatsApp');
    }
  },
}));

