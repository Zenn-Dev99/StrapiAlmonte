import type { Core } from '@strapi/strapi';

const getBearer = (ctx: any): string | undefined => {
  const h = ctx?.request?.header?.authorization || ctx?.request?.header?.Authorization;
  if (!h || typeof h !== 'string') return undefined;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : undefined;
};

/**
 * Permite acceso si:
 * - Hay un usuario autenticado (Users & Permissions), o
 * - El Authorization Bearer (o header x-api-token) coincide con EMAIL_API_TOKENS (CSV en env).
 */
const isAuthenticatedOrApiToken = async (
  policyContext: any,
  _config: unknown,
  { strapi }: { strapi: Core.Strapi }
) => {
  if (policyContext?.state?.user) return true;

  const extra = [
    process.env.IMPORT_TOKEN,
    process.env.STRAPI_FORCE_TOKEN,
    process.env.STRAPI_API_TOKEN,
  ]
    .flat()
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim());

  const allowed = String(process.env.EMAIL_API_TOKENS || '')
    // admitir separadores por coma, salto de línea o espacios múltiples
    .split(/[\s,]+/)
    .map((s) => s.replace(/^"|"$/g, '').trim())
    .filter(Boolean)
    .concat(extra);

  const bearer = getBearer(policyContext);
  const headerToken = policyContext?.request?.header?.['x-api-token'] as string | undefined;
  const token = (bearer || headerToken || '').replace(/^"|"$/g, '').trim();

  if (token) {
    if (allowed.includes(token)) return true;

    try {
      const apiTokenService = strapi.service('admin::api-token');
      if (apiTokenService) {
        const hashed = apiTokenService.hash(token);
        const found = await apiTokenService.getBy({ accessKey: hashed });
        if (found) return true;
      }
    } catch (error) {
      strapi.log.warn('Fallo validando api-token en admin::api-token service', error);
      return false;
    }
  }

  strapi.log.warn('Solicitud no autorizada (user/api-token) a una ruta protegida');
  return false;
};

export default isAuthenticatedOrApiToken;
