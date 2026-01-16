import type { Context } from 'koa';
import { factories } from '@strapi/strapi';

const isNumericId = (value: string | undefined): boolean => !!value && /^[0-9]+$/.test(value);

const pickPersonaSummary = (persona: any) => {
  if (!persona) return null;
  const {
    id,
    documentId,
    nombres,
    primer_apellido: primerApellido,
    segundo_apellido: segundoApellido,
    nombre_completo: nombreCompleto,
    emails,
    telefonos,
  } = persona;

  return {
    id,
    documentId,
    nombres,
    primer_apellido: primerApellido,
    segundo_apellido: segundoApellido,
    nombre_completo: nombreCompleto,
    emails: Array.isArray(emails) ? emails : [],
    telefonos: Array.isArray(telefonos) ? telefonos : [],
  };
};

const normalizeSmtpKey = (metadata: Record<string, any> | null | undefined): string | null => {
  if (!metadata) return null;
  const candidates = [
    metadata.smtpAccountKey,
    metadata.smtp_account_key,
    metadata.smtpAccount,
    metadata.smtp_account,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

export default factories.createCoreController(
  'api::cartera-asignacion.cartera-asignacion',
  ({ strapi }) => ({
    async findMailboxByColegio(ctx: Context) {
      const { colegioId } = ctx.params as { colegioId?: string };
      if (!colegioId) {
        return ctx.badRequest('Debes indicar el colegioId (id o documentId)');
      }

      const filters: Record<string, any> = {
        is_current: true,
        estado: { $in: ['activa', 'en_revision'] },
      };

      if (isNumericId(colegioId)) {
        filters.colegio = { id: { $eq: Number(colegioId) } };
      } else {
        filters.colegio = { documentId: { $eq: colegioId } };
      }

      const assignments = (await strapi.entityService.findMany(
        'api::cartera-asignacion.cartera-asignacion',
        {
          filters,
          sort: [
            { fecha_inicio: 'desc' },
            { createdAt: 'desc' },
          ],
          populate: {
            colegio: {
              fields: ['id', 'documentId', 'colegio_nombre', 'rbd'],
            },
            ejecutivo: {
              fields: [
                'id',
                'documentId',
                'nombres',
                'primer_apellido',
                'segundo_apellido',
                'nombre_completo',
              ],
              populate: {
                emails: true,
                telefonos: true,
              },
            },
          } as any,
          limit: 1,
        }
      )) as any[];

      if (!assignments?.length) {
        return ctx.notFound('No encontramos un ejecutivo asignado para este colegio');
      }

      const assignment = assignments[0] as any;
      const ejecutivo = pickPersonaSummary(assignment.ejecutivo);

      let colaborador: any = null;

      if (assignment?.ejecutivo?.id) {
        const colaboradores = (await strapi.entityService.findMany(
          'api::colaborador.colaborador',
          {
            filters: {
              persona: assignment.ejecutivo.id,
              activo: true,
            },
            sort: [{ updatedAt: 'desc' }],
            limit: 1,
            populate: {
              persona: {
                fields: ['id', 'documentId'],
              },
            } as any,
          }
        )) as any[];

        if (colaboradores?.length) {
          colaborador = colaboradores[0];
        }
      }

      const smtpAccountKey = normalizeSmtpKey(colaborador?.metadata);

      ctx.body = {
        data: {
          colegio: assignment?.colegio || null,
          assignment: {
            id: assignment.id,
            documentId: assignment.documentId,
            estado: assignment.estado,
            rol: assignment.rol,
            fecha_inicio: assignment.fecha_inicio,
            fecha_fin: assignment.fecha_fin,
            is_current: assignment.is_current,
          },
          ejecutivo: {
            persona: ejecutivo,
            colaborador: colaborador
              ? {
                  id: colaborador.id,
                  documentId: colaborador.documentId,
                  email_login: colaborador.email_login,
                  rol_operativo: colaborador.rol_operativo,
                  rol_principal: colaborador.rol_principal,
                  metadata: colaborador.metadata ?? null,
                  smtpAccountKey,
                }
              : null,
          },
        },
      };
    },
  })
);
