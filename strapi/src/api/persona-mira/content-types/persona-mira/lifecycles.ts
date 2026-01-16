import bcrypt from 'bcryptjs';

export default {
  async beforeCreate(event: any) {
    const { data } = event.params;
    
    strapi.log.info('[persona-mira.lifecycle] beforeCreate ejecutado');
    strapi.log.info('[persona-mira.lifecycle] Keys en data:', Object.keys(data || {}));
    strapi.log.info('[persona-mira.lifecycle] Password presente:', !!data.password);
    strapi.log.info('[persona-mira.lifecycle] Password tipo:', typeof data.password);
    strapi.log.info('[persona-mira.lifecycle] Password valor (primeros 10 chars):', data.password ? String(data.password).substring(0, 10) : 'N/A');
    
    // CRÍTICO: En Strapi v5, los campos private pueden no llegar directamente
    // Intentar acceder desde event.params.data o event.params.inputData
    let passwordValue = data.password;
    
    // Si no está en data, intentar desde inputData (puede estar ahí para campos private)
    if (!passwordValue && event.params.inputData) {
      passwordValue = event.params.inputData.password;
      strapi.log.info('[persona-mira.lifecycle] Password encontrado en inputData');
    }
    
    // Si aún no está, intentar desde el request body directamente
    if (!passwordValue && event.params.request?.body?.data) {
      passwordValue = event.params.request.body.data.password;
      strapi.log.info('[persona-mira.lifecycle] Password encontrado en request.body.data');
    }
    
    // Asignar fecha de registro si no existe
    if (!data.fecha_registro) {
      data.fecha_registro = new Date();
    }
    
    // Encriptar contraseña si está presente
    if (passwordValue) {
      const passwordStr = String(passwordValue);
      // Verificar si ya está hasheado (no hashear dos veces)
      const isHashed = passwordStr.startsWith('$2a$') || passwordStr.startsWith('$2b$');
      
      if (!isHashed) {
        strapi.log.info('[persona-mira.lifecycle] Hasheando contraseña en texto plano');
        data.password = bcrypt.hashSync(passwordStr, 10);
        strapi.log.info('[persona-mira.lifecycle] Contraseña hasheada correctamente');
      } else {
        strapi.log.info('[persona-mira.lifecycle] Contraseña ya está hasheada, manteniendo');
        data.password = passwordStr;
      }
    } else {
      strapi.log.error('[persona-mira.lifecycle] ⚠️ CRÍTICO: No se recibió password en beforeCreate');
      strapi.log.error('[persona-mira.lifecycle] event.params keys:', Object.keys(event.params || {}));
      strapi.log.error('[persona-mira.lifecycle] data keys:', Object.keys(data || {}));
    }
  },
  async beforeUpdate(event: any) {
    const { data, where } = event.params;
    
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
        strapi.log.info('[persona-mira.lifecycle] Password vacío en beforeUpdate, eliminando del data para mantener el existente');
        delete data.password;
        return;
      }
      
      // Solo hashear si NO está hasheado (no empieza con $2a$ o $2b$)
      // También verificar longitud (los hashes de bcrypt tienen 60 caracteres)
      const isHashed = passwordStr.startsWith('$2a$') || passwordStr.startsWith('$2b$');
      const isCorrectLength = passwordStr.length >= 60;
      
      if (!isHashed && !isCorrectLength) {
        // Password en texto plano, hashearlo
        strapi.log.info('[persona-mira.lifecycle] Hasheando contraseña en texto plano en beforeUpdate');
        data.password = bcrypt.hashSync(passwordStr, 10);
      } else if (isHashed && isCorrectLength) {
        // Ya está hasheado correctamente, mantenerlo
        strapi.log.info('[persona-mira.lifecycle] Password ya está hasheado correctamente, manteniendo hash existente');
        // Asegurarse de que se mantenga el hash tal cual
        data.password = passwordStr;
      } else {
        // Hash inválido o corrupto, hashearlo de nuevo
        strapi.log.warn('[persona-mira.lifecycle] Hash de password inválido, hasheando de nuevo');
        data.password = bcrypt.hashSync(passwordStr, 10);
      }
    } else {
      // Si password no viene en el data, NO tocarlo (mantener el existente en la BD)
      // Pero si estamos actualizando un draft y existe un publicado, preservar el password del publicado
      const documentId = where?.documentId || where?.id;
      if (documentId) {
        try {
          // Verificar si existe un registro publicado con el mismo documentId
          const publishedEntry = await strapi.db.query('api::persona-mira.persona-mira').findOne({
            where: { documentId, publishedAt: { $notNull: true } },
            select: ['id', 'password'],
          });
          
          // Si existe un publicado y estamos actualizando el draft, preservar el password del publicado
          if (publishedEntry && publishedEntry.password) {
            const hashStr = String(publishedEntry.password);
            const isHashValid = (hashStr.startsWith('$2a$') || hashStr.startsWith('$2b$')) && hashStr.length === 60;
            
            if (isHashValid) {
              strapi.log.info('[persona-mira.lifecycle] Preservando password del registro publicado en beforeUpdate');
              data.password = publishedEntry.password;
            }
          }
        } catch (error: any) {
          // Si hay error, no hacer nada y dejar que el flujo normal continúe
          strapi.log.debug('[persona-mira.lifecycle] Error al verificar registro publicado en beforeUpdate:', error.message);
        }
      }
    }
  },
};

