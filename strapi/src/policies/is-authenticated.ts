import type { Core } from '@strapi/strapi';

const isAuthenticated = async (policyContext: any, _config: unknown, { strapi }: { strapi: Core.Strapi }) => {
  if (policyContext?.state?.user) {
    return true;
  }

  strapi.log.warn('Solicitud no autorizada a una ruta protegida');
  return policyContext.unauthorized('Debes iniciar sesión para acceder a este recurso');
};

export default isAuthenticated;
