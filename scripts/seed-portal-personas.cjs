const path = require('node:path');
const { createStrapi } = require('@strapi/strapi');

const nowISO = () => new Date().toISOString();

async function main() {
  const projectDir = process.cwd();
  const distDir = path.join(projectDir, 'dist');
  const strapi = await createStrapi({ distDir }).load();

  try {
    const personas = await strapi.db
      .query('api::persona.persona')
      .findMany({
        limit: 5,
        select: ['id', 'nombre_completo', 'rut'],
        populate: { emails: true },
      });

    if (!personas.length) {
      throw new Error('No se encontraron personas para actualizar.');
    }

    const sampleRoles = [
      {
        role: 'colegio_admin',
        default_dashboard: 'general',
        scopes: { modules: ['pedidos', 'licencias', 'soporte'], canApproveOrders: true },
      },
      {
        role: 'docente',
        default_dashboard: 'licencias',
        scopes: { modules: ['licencias', 'documentos'], notifyWorkshops: true },
      },
      {
        role: 'apoderado',
        default_dashboard: 'pedidos',
        scopes: { modules: ['pedidos', 'documentos'], canManageDependents: true },
      },
      {
        role: 'estudiante',
        default_dashboard: 'licencias',
        scopes: { modules: ['licencias'], miraAccess: true },
      },
      {
        role: 'staff',
        default_dashboard: 'soporte',
        scopes: { modules: ['soporte', 'pedidos'], internal: true },
      },
    ];

    for (const [index, persona] of personas.entries()) {
      const baseRole = sampleRoles[index % sampleRoles.length];
      const email = Array.isArray(persona.emails) && persona.emails[0]?.email
        ? persona.emails[0].email
        : `usuario${persona.id}@moraleja.cl`;

      const portalAccount = {
        status:
          index % 4 === 0 ? 'active' :
          index % 4 === 1 ? 'pending_invite' :
          index % 4 === 2 ? 'suspended' : 'active',
        sso_provider: index % 3 === 0 ? 'auth0' : index % 3 === 1 ? 'google' : 'keycloak',
        username: email,
        primary_email: email,
        portal_id: `PORTAL-${persona.id}`,
        mfa_enabled: index % 2 === 0,
        last_login_at: index % 4 === 0 ? nowISO() : null,
        onboarded_at: index % 3 === 0 ? nowISO() : null,
        accepted_terms_at: nowISO(),
        notes: 'Datos cargados para pruebas del portal de cuenta.'
      };

      const portalRole = {
        role: baseRole.role,
        is_primary: true,
        default_dashboard: baseRole.default_dashboard,
        scopes: baseRole.scopes,
        valid_until: index % 4 === 3 ? null : nowISO(),
        notes: 'Rol asignado automáticamente para pruebas.'
      };

      const preferences = {
        language: index % 3 === 0 ? 'es' : 'en',
        timezone: 'America/Santiago',
        notifications_email: true,
        notifications_push: index % 2 === 0,
        notifications_whatsapp: index % 2 === 1,
        marketing_opt_in: index % 3 === 0,
        default_dashboard: baseRole.default_dashboard,
        shortcuts: [
          {
            label: 'Pedidos recientes',
            description: 'Accede al historial de pedidos del colegio',
            target_url: '/cuenta/pedidos',
            icon: 'shopping-cart',
            order: 10
          },
          {
            label: 'Licencias activas',
            description: 'Gestiona las licencias digitales disponibles',
            target_url: '/cuenta/licencias',
            icon: 'key',
            order: 20
          }
        ],
        hidden_widgets: index % 2 === 0 ? ['calendario'] : []
      };

      const snapshot = {
        summary: {
          pedidos_abiertos: Math.floor(Math.random() * 5),
          licencias_por_vencer: Math.floor(Math.random() * 3),
          tickets_activos: Math.floor(Math.random() * 2)
        },
        last_modules: ['pedidos', 'licencias', 'soporte'].slice(0, 1 + (index % 3))
      };

      await strapi.entityService.update('api::persona.persona', persona.id, {
        data: {
          portal_account: portalAccount,
          portal_roles: [portalRole],
          portal_preferences: preferences,
          portal_snapshot: snapshot,
          portal_last_synced_at: nowISO()
        }
      });

      console.log(`Persona ${persona.id} actualizada con rol ${baseRole.role}.`);
    }

    console.log('✅ Personas enriquecidas con datos del portal.');
  } finally {
    try {
      await strapi.destroy();
    } catch (error) {
      const message = error && error.message ? String(error.message) : '';
      if (!message.includes('aborted')) {
        throw error;
      }
    }
  }
}

main().catch((error) => {
  console.error('❌ Error al cargar datos de portal en personas:', error);
  process.exit(1);
});
