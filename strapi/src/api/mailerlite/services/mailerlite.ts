import { factories } from '@strapi/strapi';
import axios, { AxiosInstance } from 'axios';

export default factories.createCoreService('api::mailerlite.mailerlite' as any, ({ strapi }) => {
  let mailerliteClient: AxiosInstance | null = null;

  /**
   * Obtiene el cliente de MailerLite configurado
   */
  const getClient = (): AxiosInstance => {
    if (mailerliteClient) {
      return mailerliteClient;
    }

    const apiKey = process.env.MAILERLITE_API_KEY;
    if (!apiKey) {
      throw new Error('MAILERLITE_API_KEY no está configurada en las variables de entorno');
    }

    // MailerLite API v3 usa Bearer token y base URL connect.mailerlite.com
    mailerliteClient = axios.create({
      baseURL: 'https://connect.mailerlite.com/api',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    return mailerliteClient;
  };

  return {
    /**
     * Agrega o actualiza un suscriptor en MailerLite
     * @param email Email del suscriptor
     * @param name Nombre completo del suscriptor
     * @param fields Campos adicionales (opcional)
     * @param groups IDs de grupos a los que agregar el suscriptor (opcional)
     */
    async addSubscriber(
    email: string,
    name?: string,
    fields?: Record<string, any>,
    groups?: string[]
  ) {
    try {
      const client = getClient();
      
      // Buscar suscriptor existente (API v3)
      let subscriberId: string | null = null;
      try {
        const searchResponse = await client.get('/subscribers', {
          params: { filter: { email } },
        });
        if (searchResponse.data?.data?.length > 0) {
          subscriberId = searchResponse.data.data[0].id.toString();
        }
      } catch (error: any) {
        // Si no existe, continuamos para crearlo
        if (error.response?.status !== 404) {
          strapi.log.warn('Error al buscar suscriptor en MailerLite:', error.message);
        }
      }

      // Preparar datos para API v3
      const subscriberData: any = {
        email,
        status: 'active',
      };

      // Campos personalizados (API v3)
      if (name || fields) {
        subscriberData.fields = {
          name: name || fields?.name || '',
          ...fields,
        };
      }

      // Grupos (API v3)
      if (groups && groups.length > 0) {
        subscriberData.groups = groups;
      }

      let response;
      if (subscriberId) {
        // Actualizar suscriptor existente (API v3)
        response = await client.put(`/subscribers/${subscriberId}`, subscriberData);
        strapi.log.info(`✅ Suscriptor actualizado en MailerLite: ${email}`);
      } else {
        // Crear nuevo suscriptor (API v3)
        response = await client.post('/subscribers', subscriberData);
        strapi.log.info(`✅ Suscriptor agregado a MailerLite: ${email}`);
      }

      return response.data;
    } catch (error: any) {
      strapi.log.error('Error al agregar/actualizar suscriptor en MailerLite:', {
        email,
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
    },

    /**
     * Elimina un suscriptor de MailerLite
     * @param email Email del suscriptor a eliminar
     */
    async removeSubscriber(email: string) {
    try {
      const client = getClient();
      
      // Buscar suscriptor (API v3)
      const searchResponse = await client.get('/subscribers', {
        params: { filter: { email } },
      });

      if (!searchResponse.data?.data?.length) {
        strapi.log.warn(`Suscriptor no encontrado en MailerLite: ${email}`);
        return null;
      }

      const subscriberId = searchResponse.data.data[0].id;
      await client.delete(`/subscribers/${subscriberId}`);
      strapi.log.info(`✅ Suscriptor eliminado de MailerLite: ${email}`);
      
      return { success: true };
    } catch (error: any) {
      strapi.log.error('Error al eliminar suscriptor de MailerLite:', {
        email,
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }
    },

    /**
     * Obtiene información de un suscriptor
     * @param email Email del suscriptor
     */
    async getSubscriber(email: string) {
    try {
      const client = getClient();
      const response = await client.get('/subscribers', {
        params: { filter: { email } },
      });

      if (response.data?.data?.length > 0) {
        return response.data.data[0];
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // No encontrado, no es un error
      }
      strapi.log.error('Error al obtener suscriptor de MailerLite:', {
        email,
        error: error.message,
      });
      throw error;
    }
    },

    /**
     * Agrega un suscriptor a un grupo específico
     * @param email Email del suscriptor
     * @param groupId ID del grupo en MailerLite
     */
    async addToGroup(email: string, groupId: string) {
      try {
        const client = getClient();
        
        // Buscar suscriptor
        const subscriber = await strapi.service('api::mailerlite.mailerlite').getSubscriber(email);
        if (!subscriber) {
          throw new Error(`Suscriptor no encontrado: ${email}`);
        }

        // API v3: agregar a grupo
        await client.post(`/subscribers/${subscriber.id}/groups/${groupId}`);
        strapi.log.info(`✅ Suscriptor ${email} agregado al grupo ${groupId}`);
        
        return { success: true };
      } catch (error: any) {
        strapi.log.error('Error al agregar suscriptor a grupo:', {
          email,
          groupId,
          error: error.message,
        });
        throw error;
      }
    },

    /**
     * Remueve un suscriptor de un grupo específico
     * @param email Email del suscriptor
     * @param groupId ID del grupo en MailerLite
     */
    async removeFromGroup(email: string, groupId: string) {
      try {
        const client = getClient();
        
        // Buscar suscriptor
        const subscriber = await strapi.service('api::mailerlite.mailerlite').getSubscriber(email);
        if (!subscriber) {
          strapi.log.warn(`Suscriptor no encontrado: ${email}`);
          return { success: false, message: 'Suscriptor no encontrado' };
        }

        // API v3: remover de grupo
        await client.delete(`/subscribers/${subscriber.id}/groups/${groupId}`);
        strapi.log.info(`✅ Suscriptor ${email} removido del grupo ${groupId}`);
        
        return { success: true };
      } catch (error: any) {
        // Si el suscriptor no está en el grupo, no es un error crítico
        if (error.response?.status === 404) {
          strapi.log.warn(`Suscriptor ${email} no está en el grupo ${groupId}`);
          return { success: false, message: 'No está en el grupo' };
        }
        strapi.log.error('Error al remover suscriptor de grupo:', {
          email,
          groupId,
          error: error.message,
        });
        throw error;
      }
    },

    /**
     * Actualiza los grupos de un suscriptor (remueve de grupos antiguos y agrega a nuevos)
     * @param email Email del suscriptor
     * @param newGroupIds IDs de los grupos a los que debe pertenecer
     * @param oldGroupIds IDs de los grupos de los que debe ser removido (opcional, se infiere si no se proporciona)
     */
    async updateGroups(email: string, newGroupIds: string[], oldGroupIds?: string[]) {
      try {
        const service = strapi.service('api::mailerlite.mailerlite');
        const subscriber = await service.getSubscriber(email);
        if (!subscriber) {
          throw new Error(`Suscriptor no encontrado: ${email}`);
        }

        // Si no se proporcionan grupos antiguos, obtener los actuales del suscriptor
        let currentGroupIds: string[] = [];
        if (!oldGroupIds && subscriber.groups) {
          currentGroupIds = subscriber.groups.map((g: any) => String(g.id || g));
        } else if (oldGroupIds) {
          currentGroupIds = oldGroupIds;
        }

        // Normalizar IDs a strings
        const newGroups = newGroupIds.map(id => String(id));
        const currentGroups = new Set(currentGroupIds.map(id => String(id)));

        // Grupos a agregar (están en nuevos pero no en actuales)
        const toAdd = newGroups.filter(id => !currentGroups.has(id));
        
        // Grupos a remover (están en actuales pero no en nuevos)
        const toRemove = Array.from(currentGroups).filter(id => !newGroups.includes(id));

        // Remover de grupos antiguos
        for (const groupId of toRemove) {
          await service.removeFromGroup(email, groupId);
        }

        // Agregar a grupos nuevos
        for (const groupId of toAdd) {
          await service.addToGroup(email, groupId);
        }

        strapi.log.info(`✅ Grupos actualizados para ${email}: agregados ${toAdd.length}, removidos ${toRemove.length}`);
        
        return { success: true, added: toAdd, removed: toRemove };
      } catch (error: any) {
        strapi.log.error('Error al actualizar grupos del suscriptor:', {
          email,
          error: error.message,
        });
        throw error;
      }
    },

    /**
     * Obtiene todos los grupos disponibles
     */
    async getGroups() {
    try {
      const client = getClient();
      const response = await client.get('/groups');
      // API v3 devuelve { data: [...] }
      return response.data?.data || [];
    } catch (error: any) {
      strapi.log.error('Error al obtener grupos de MailerLite:', error.message);
      throw error;
    }
    },

    /**
     * Determina los grupos de MailerLite según el origen y estado de validación de una Persona
     * @param persona Persona de Strapi
     * @param groupMapping Mapeo de origen/estado a IDs de grupos (opcional)
     * @returns Array de IDs de grupos
     */
    determineGroupsForPersona(persona: any, groupMapping?: Record<string, string[]>): string[] {
      const groups: string[] = [];
      const origen = persona.origen || 'manual';
      const emails = persona.emails || [];
      
      // Obtener estado de validación del email principal
      const primaryEmailObj = emails.find((e: any) => e.principal === true) || emails[0];
      const emailEstado = primaryEmailObj?.estado || 'Por Verificar';
      const isEmailValidated = emailEstado === 'Verificado' || emailEstado === 'Aprobado';

      // Si hay un mapeo personalizado, usarlo
      if (groupMapping) {
        const key = `${origen}_${isEmailValidated ? 'validado' : 'no_validado'}`;
        if (groupMapping[key]) {
          return groupMapping[key];
        }
      }

      // Lógica por defecto: grupos por origen y validación
      // Formato: "Origen: {origen}" y "Origen: {origen} - {estado}"
      
      // Grupo base por origen (ej: "Origen: Web")
      const origenGroupKey = `origen_${origen}`;
      if (groupMapping?.[origenGroupKey]) {
        groups.push(...groupMapping[origenGroupKey]);
      }

      // Grupos específicos por origen y validación
      if (origen === 'web') {
        // Para web, crear grupos específicos: "Web - Validados" y "Web - No Validados"
        const webGroupKey = isEmailValidated ? 'web_validado' : 'web_no_validado';
        if (groupMapping?.[webGroupKey]) {
          groups.push(...groupMapping[webGroupKey]);
        }
      } else {
        // Para otros orígenes, grupos generales de validación
        const validacionGroupKey = isEmailValidated ? 'validados' : 'no_validados';
        if (groupMapping?.[validacionGroupKey]) {
          groups.push(...groupMapping[validacionGroupKey]);
        }
      }

      return groups;
    },

    /**
     * Sincroniza una Persona de Strapi a MailerLite
     * @param persona Persona de Strapi
     * @param options Opciones adicionales (grupos, campos personalizados, groupMapping)
     */
    async syncPersona(persona: any, options?: { 
      groups?: string[]; 
      fields?: Record<string, any>;
      groupMapping?: Record<string, string[]>;
      updateGroups?: boolean; // Si true, actualiza grupos en lugar de solo agregar
    }) {
    try {
      // Obtener email principal de la persona
      const emails = persona.emails || [];
      const primaryEmail = emails.find((e: any) => e.principal === true)?.email 
        || emails[0]?.email;

      if (!primaryEmail) {
        strapi.log.warn(`Persona ${persona.id} no tiene email, no se puede sincronizar con MailerLite`);
        return null;
      }

      // Construir nombre completo
      const nombreCompleto = persona.nombre_completo 
        || `${persona.nombres || ''} ${persona.primer_apellido || ''} ${persona.segundo_apellido || ''}`.trim()
        || persona.nombres || '';

      // Campos adicionales
      const fields: Record<string, any> = {
        name: nombreCompleto,
        ...options?.fields,
      };

      // Agregar campos de la persona si existen
      if (persona.rut) fields.rut = persona.rut;
      if (persona.nombres) fields.nombres = persona.nombres;
      if (persona.primer_apellido) fields.primer_apellido = persona.primer_apellido;
      if (persona.origen) fields.origen = persona.origen;

      // Determinar grupos
      let groupsToUse: string[] = [];
      if (options?.groups) {
        // Si se proporcionan grupos explícitos, usarlos
        groupsToUse = options.groups;
      } else if (options?.groupMapping) {
        // Si hay un mapeo, determinar grupos automáticamente
        const service = strapi.service('api::mailerlite.mailerlite');
        groupsToUse = service.determineGroupsForPersona(persona, options.groupMapping);
      }

      const service = strapi.service('api::mailerlite.mailerlite');
      
      // Verificar si el suscriptor ya existe
      const existingSubscriber = await service.getSubscriber(primaryEmail);
      
      if (existingSubscriber && options?.updateGroups && groupsToUse.length > 0) {
        // Si existe y se debe actualizar grupos, actualizar en lugar de solo agregar
        await service.addSubscriber(primaryEmail, nombreCompleto, fields, groupsToUse);
        const updateResult = await service.updateGroups(primaryEmail, groupsToUse);
        return { updated: true, groups: groupsToUse, ...updateResult };
      } else {
        // Crear o actualizar suscriptor con grupos
        return await service.addSubscriber(
          primaryEmail,
          nombreCompleto,
          fields,
          groupsToUse.length > 0 ? groupsToUse : undefined
        );
      }
    } catch (error: any) {
      strapi.log.error('Error al sincronizar Persona con MailerLite:', {
        personaId: persona.id,
        error: error.message,
      });
      throw error;
    }
    },
  };
});

