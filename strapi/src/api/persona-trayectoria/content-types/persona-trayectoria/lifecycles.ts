import bcrypt from 'bcryptjs';

const normalizeRelationId = (value: any): number | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (Array.isArray(value) && value.length > 0) {
    return normalizeRelationId(value[0]);
  }

  if (typeof value === 'object') {
    if ('id' in value) {
      return normalizeRelationId(value.id);
    }
    if ('connect' in value) {
      return normalizeRelationId(value.connect);
    }
    if ('set' in value) {
      return normalizeRelationId(value.set);
    }
    if ('disconnect' in value) {
      return null;
    }
  }

  return null;
};

const syncColegioLocation = async (event) => {
  const data = event.params.data || {};

  let colegioId = normalizeRelationId(data.colegio);

  if (!colegioId && event.params.where?.id) {
    const existing = (await strapi.entityService.findOne(
      'api::persona-trayectoria.persona-trayectoria',
      event.params.where.id,
      {
        fields: [],
        populate: {
          colegio: {
            fields: ['id'],
          },
        },
      }
    )) as any;

    colegioId = existing?.colegio?.id ?? null;
  }

  if (!colegioId) {
    data.colegio_comuna = null;
    data.colegio_region = null;
    return;
  }

  // IMPORTANTE: NO hacer populate de 'region' porque es un string, no una relación
  // Esto causa el error "Invalid key region" en Strapi
  const colegio = (await strapi.entityService.findOne('api::colegio.colegio', colegioId, {
    fields: ['id', 'region'], // region es un string, va en fields, NO en populate
    populate: {
      comuna: { 
        fields: ['id', 'region_nombre'], // Obtener región desde comuna como respaldo
      },
    },
  })) as any;

  data.colegio_comuna = colegio?.comuna?.id ?? null;
  // Obtener región desde colegio.region (string) o desde comuna.region_nombre como respaldo
  data.colegio_region = colegio?.region ?? colegio?.comuna?.region_nombre ?? null;
};

export default {
  async beforeCreate(event) {
    strapi.log.info('[persona-trayectoria.lifecycle] 🔄 beforeCreate ejecutándose');
    const { data } = event.params;
    
    // PROTECCIÓN: Eliminar campos que no existen en el schema y causan errores
    // El campo 'region' NO existe en persona-trayectoria (existe 'colegio_region')
    if ('region' in data) {
      strapi.log.warn('[persona-trayectoria.lifecycle] ⚠️ Campo "region" detectado en beforeCreate, eliminándolo (debe ser colegio_region)');
      strapi.log.debug('[persona-trayectoria.lifecycle] Data recibida:', JSON.stringify(data, null, 2));
      delete data.region;
    } else {
      strapi.log.info('[persona-trayectoria.lifecycle] ✅ No hay campo "region" en data (correcto)');
    }
    
    await syncColegioLocation(event);
    
    // Asignar fecha de registro si no existe
    if (!data.fecha_registro) {
      data.fecha_registro = new Date();
    }
    
    // Encriptar contraseña si está presente
    if (data.password) {
      data.password = bcrypt.hashSync(data.password, 10);
    }
  },
  async beforeUpdate(event) {
    strapi.log.info('[persona-trayectoria.lifecycle] 🔄 beforeUpdate ejecutándose');
    const { data, where } = event.params;
    
    // PROTECCIÓN: Eliminar campos que no existen en el schema y causan errores
    // El campo 'region' NO existe en persona-trayectoria (existe 'colegio_region')
    if ('region' in data) {
      strapi.log.warn('[persona-trayectoria.lifecycle] ⚠️ Campo "region" detectado en beforeUpdate, eliminándolo (debe ser colegio_region)');
      delete data.region;
    } else {
      strapi.log.info('[persona-trayectoria.lifecycle] ✅ No hay campo "region" en data (correcto)');
    }
    
    await syncColegioLocation(event);
    
    // Actualizar último acceso cuando se actualiza el registro
    if (data.activo !== undefined) {
      data.ultimo_acceso = new Date();
    }
    
    // CRÍTICO: Solo procesar password si viene explícitamente en el data
    // Si no viene, NO tocarlo (evita problemas al publicar drafts)
    if (data.password !== undefined && data.password !== null) {
      const passwordStr = String(data.password);
      
      // Si el password está vacío, no hacer nada (mantener el existente)
      if (passwordStr.trim() === '') {
        strapi.log.info('[persona-trayectoria.lifecycle] Password vacío en beforeUpdate, eliminando del data para mantener el existente');
        delete data.password;
        return;
      }
      
      // Solo hashear si NO está hasheado (no empieza con $2a$ o $2b$)
      // También verificar longitud (los hashes de bcrypt tienen 60 caracteres)
      const isHashed = passwordStr.startsWith('$2a$') || passwordStr.startsWith('$2b$');
      const isCorrectLength = passwordStr.length >= 60;
      
      if (!isHashed && !isCorrectLength) {
        // Password en texto plano, hashearlo
        strapi.log.info('[persona-trayectoria.lifecycle] Hasheando contraseña en texto plano en beforeUpdate');
        data.password = bcrypt.hashSync(passwordStr, 10);
      } else if (isHashed && isCorrectLength) {
        // Ya está hasheado correctamente, mantenerlo
        strapi.log.info('[persona-trayectoria.lifecycle] Password ya está hasheado correctamente, manteniendo hash existente');
        // Asegurarse de que se mantenga el hash tal cual
        data.password = passwordStr;
      } else {
        // Hash inválido o corrupto, hashearlo de nuevo
        strapi.log.warn('[persona-trayectoria.lifecycle] Hash de password inválido, hasheando de nuevo');
        data.password = bcrypt.hashSync(passwordStr, 10);
      }
    } else {
      // Si password no viene en el data, NO tocarlo (mantener el existente en la BD)
      // Pero si estamos actualizando un draft y existe un publicado, preservar el password del publicado
      const documentId = where?.documentId || where?.id;
      if (documentId) {
        try {
          // Verificar si existe un registro publicado con el mismo documentId
          const publishedEntry = await strapi.db.query('api::persona-trayectoria.persona-trayectoria').findOne({
            where: { documentId, publishedAt: { $notNull: true } },
            select: ['id', 'password'],
          });
          
          // Si existe un publicado y estamos actualizando el draft, preservar el password del publicado
          if (publishedEntry && publishedEntry.password) {
            const hashStr = String(publishedEntry.password);
            const isHashValid = (hashStr.startsWith('$2a$') || hashStr.startsWith('$2b$')) && hashStr.length === 60;
            
            if (isHashValid) {
              strapi.log.info('[persona-trayectoria.lifecycle] Preservando password del registro publicado en beforeUpdate');
              data.password = publishedEntry.password;
            }
          }
        } catch (error: any) {
          // Si hay error, no hacer nada y dejar que el flujo normal continúe
          strapi.log.debug('[persona-trayectoria.lifecycle] Error al verificar registro publicado en beforeUpdate:', error.message);
        }
      }
    }
  },
};
