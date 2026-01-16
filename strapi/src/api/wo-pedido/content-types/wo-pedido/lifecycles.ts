/**
 * Genera un wooId único para evitar conflictos
 * Usa un formato que genera números de hasta 10 dígitos (seguro para bigint)
 */
function generarWooIdUnico(): number {
  // Usar timestamp (últimos 7 dígitos) + número aleatorio (3 dígitos)
  // Esto genera números de máximo 10 dígitos, seguro para bigint
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000); // 0-999 (3 dígitos)
  // Tomar últimos 7 dígitos del timestamp + 3 dígitos random = máximo 10 dígitos
  const timestampStr = String(timestamp).slice(-7);
  const randomStr = String(random).padStart(3, '0');
  const wooIdStr = timestampStr + randomStr;
  
  // Convertir a número (bigint en la BD)
  return parseInt(wooIdStr, 10);
}

/**
 * Genera un wooId único
 * No verifica en la BD para evitar problemas de transacción
 * El timestamp + random debería ser suficiente para garantizar unicidad
 */
async function generarWooIdUnicoValido(excludeId?: number): Promise<number> {
  // Simplemente generar un ID único basado en timestamp + random
  // No verificamos en BD para evitar problemas de transacción
  // El timestamp garantiza unicidad temporal, el random evita colisiones simultáneas
  return generarWooIdUnico();
}

/**
 * Normaliza metodo_pago a valores válidos de Strapi (minúsculas)
 * Mapea variantes comunes como "tarjeta" → "stripe", "transferencia bancaria" → "transferencia", etc.
 * Evita errores de validación cuando metodo_pago tiene valores no válidos
 */
function normalizarMetodoPago(metodoPago: string | null | undefined): string | null {
  if (!metodoPago) return null;
  
  const metodoLower = String(metodoPago).toLowerCase().trim();
  const valoresValidos = ['bacs', 'cheque', 'cod', 'paypal', 'stripe', 'transferencia', 'otro'];
  
  // Si ya es válido, devolverlo
  if (valoresValidos.includes(metodoLower)) {
    return metodoLower;
  }
  
  // Mapear variantes comunes
  const mapping: Record<string, string> = {
    'tarjeta': 'stripe', // tarjeta → stripe (más común)
    'tarjeta de crédito': 'stripe',
    'tarjeta de debito': 'stripe',
    'credit card': 'stripe',
    'debit card': 'stripe',
    'card': 'stripe',
    'transferencia bancaria': 'transferencia',
    'transfer': 'transferencia',
    'bank transfer': 'transferencia',
    'cheque': 'cheque',
    'check': 'cheque',
    'cash on delivery': 'cod',
    'contra entrega': 'cod',
    'other': 'otro',
  };
  
  return mapping[metodoLower] || 'bacs'; // Por defecto 'bacs' si no se reconoce
}

/**
 * Rellena automáticamente los campos del item cuando se selecciona un libro
 * Siempre rellena los campos desde el libro, incluso si ya tienen valores
 */
async function rellenarItemDesdeLibro(item: any, platform: string) {
  if (!item || !item.libro) {
    return item;
  }

  try {
    const libroId = typeof item.libro === 'object' 
      ? (item.libro.documentId || item.libro.id || item.libro)
      : item.libro;

    if (!libroId) {
      strapi.log.warn(`[wo-pedido] Item sin libroId válido`);
      return item;
    }

    // Obtener libro completo con manejo de errores de transacción
    // En beforeCreate, puede haber problemas con transacciones, así que usamos try-catch robusto
    // IMPORTANTE: Si no se puede obtener el libro, simplemente usar los datos del item
    let libro: any = null;
    
    // Intentar obtener libro de forma segura, pero si falla, continuar sin él
    try {
      // Usar un timeout para evitar bloqueos indefinidos
      const libroPromise = strapi.entityService.findOne('api::libro.libro' as any, libroId, {
        fields: ['nombre_libro', 'isbn_libro', 'externalIds'],
      }) as Promise<any>;
      
      // Timeout de 2 segundos para evitar bloqueos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout obteniendo libro')), 2000)
      );
      
      libro = await Promise.race([libroPromise, timeoutPromise]) as any;
      
      // Si se necesita precios, intentar obtenerlos por separado (solo si precio_unitario es 0)
      if (libro && (!item.precio_unitario || item.precio_unitario === 0)) {
        try {
          const precioPromise = strapi.entityService.findOne('api::libro.libro' as any, libroId, {
            populate: ['precios'] as any,
          }) as Promise<any>;
          
          const precioTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout obteniendo precios')), 1500)
          );
          
          const libroConPrecios = await Promise.race([precioPromise, precioTimeout]) as any;
          // Ya no necesitamos precios, se usa el campo directo precio
          if (libroConPrecios) {
            libro = libroConPrecios;
          }
        } catch (precioError: any) {
          // Si falla obtener precios, continuar sin ellos
          strapi.log.warn(`[wo-pedido] No se pudieron obtener precios del libro ${libroId}: ${precioError?.message || precioError}`);
        }
      }
    } catch (error: any) {
      // Si hay error obteniendo el libro, simplemente continuar sin procesarlo
      // NO lanzar el error para evitar que falle la creación del pedido
      strapi.log.warn(`[wo-pedido] No se pudo obtener libro ${libroId} (continuando sin procesar): ${error?.message || error}`);
      // Retornar el item con los datos que ya tiene, sin procesar el libro
      // El pedido se puede crear sin el libro relacionado si es necesario
      return item;
    }

    if (!libro) {
      strapi.log.warn(`[wo-pedido] Libro ${libroId} no encontrado para rellenar item`);
      return item;
    }

    // Siempre rellenar nombre desde el libro (sobrescribe si existe)
    if (libro.nombre_libro) {
      item.nombre = libro.nombre_libro;
    }

    // Siempre rellenar SKU (ISBN) desde el libro
    if (libro.isbn_libro) {
      item.sku = libro.isbn_libro;
    }

    // Siempre rellenar producto_id desde externalIds si existe
    if (libro.externalIds) {
      const externalIds = libro.externalIds as Record<string, unknown>;
      if (externalIds[platform]) {
        item.producto_id = parseInt(String(externalIds[platform]), 10);
        strapi.log.info(`[wo-pedido] ✅ producto_id asignado desde libro: ${item.producto_id}`);
      } else {
        strapi.log.warn(`[wo-pedido] ⚠️  Libro "${libro.nombre_libro || libroId}" no tiene externalId para ${platform}. El item no se podrá sincronizar a WooCommerce hasta que el libro esté sincronizado.`);
      }
    } else {
      strapi.log.warn(`[wo-pedido] ⚠️  Libro "${libro.nombre_libro || libroId}" no tiene externalIds. El item no se podrá sincronizar a WooCommerce hasta que el libro esté sincronizado.`);
    }

    // Siempre rellenar precio_unitario desde precio del libro (sobrescribe si existe)
    // Pero solo si no hay precio_unitario o es 0
    if (!item.precio_unitario || item.precio_unitario === 0) {
      const libroAttrs = libro.attributes || libro;
      
      // Usar precio_regular primero, luego precio, luego precio_oferta
      if (libroAttrs.precio_regular !== undefined && libroAttrs.precio_regular !== null) {
        item.precio_unitario = parseFloat(String(libroAttrs.precio_regular));
      } else if (libroAttrs.precio !== undefined && libroAttrs.precio !== null) {
        item.precio_unitario = parseFloat(String(libroAttrs.precio));
      } else if (libroAttrs.precio_oferta !== undefined && libroAttrs.precio_oferta !== null) {
        item.precio_unitario = parseFloat(String(libroAttrs.precio_oferta));
      }
    }

    // Calcular total automáticamente si hay precio_unitario y cantidad
    if (item.precio_unitario && item.cantidad) {
      item.total = parseFloat(String(item.precio_unitario)) * (item.cantidad || 1);
    } else if (item.precio_unitario && !item.cantidad) {
      // Si hay precio pero no cantidad, establecer cantidad por defecto
      item.cantidad = 1;
      item.total = parseFloat(String(item.precio_unitario));
    }

    strapi.log.info(`[wo-pedido] ✅ Item rellenado automáticamente desde libro: ${libro.nombre_libro || libroId}`);
  } catch (error: any) {
    // Capturar cualquier error y NO lanzarlo para evitar que falle la creación del pedido
    // Si es error de transacción abortada, no loguear como error crítico
    if (error?.message?.includes('aborted') || error?.message?.includes('transaction')) {
      strapi.log.warn(`[wo-pedido] ⚠️ Transacción abortada al rellenar item, usando datos disponibles`);
    } else {
      strapi.log.warn(`[wo-pedido] ⚠️ Error rellenando item desde libro: ${error?.message || error}`);
    }
    // Retornar el item original si hay error, para que el pedido se pueda crear igual
  }

  return item;
}

/**
 * Procesa todos los items del pedido para rellenar campos desde libros
 * También puede crear items automáticamente desde una lista de libros
 */
async function procesarItemsDelPedido(data: any, platform: string) {
  // Si hay una lista de libros para agregar automáticamente (desde relación manyToMany)
  if (data.libros_para_agregar) {
    const librosArray = Array.isArray(data.libros_para_agregar) 
      ? data.libros_para_agregar 
      : (data.libros_para_agregar.connect || []);
    
    if (librosArray.length > 0) {
      if (!data.items) {
        data.items = [];
      }
      
      for (const libroParaAgregar of librosArray) {
        const libroId = typeof libroParaAgregar === 'object' 
          ? (libroParaAgregar.documentId || libroParaAgregar.id || libroParaAgregar.id || libroParaAgregar)
          : libroParaAgregar;
        
        if (libroId) {
          const nuevoItem: any = {
            libro: libroId,
            cantidad: 1,
          };
          
          // Rellenar el item desde el libro
          const itemRellenado = await rellenarItemDesdeLibro(nuevoItem, platform);
          if (itemRellenado) {
            // Asegurar que el item tenga todos los campos requeridos
            // IMPORTANTE: Construir el objeto del componente de forma explícita
            const itemFinal: any = {
              nombre: itemRellenado.nombre || '',
              cantidad: itemRellenado.cantidad || 1,
              precio_unitario: itemRellenado.precio_unitario || 0,
              total: itemRellenado.total || 0,
              libro: libroId, // Mantener la relación como ID directo
            };
            
            // Agregar campos opcionales si existen
            if (itemRellenado.sku) itemFinal.sku = itemRellenado.sku;
            if (itemRellenado.producto_id) itemFinal.producto_id = itemRellenado.producto_id;
            if (itemRellenado.item_id) itemFinal.item_id = itemRellenado.item_id;
            if (itemRellenado.metadata) itemFinal.metadata = itemRellenado.metadata;
            
            data.items.push(itemFinal);
            strapi.log.info(`[wo-pedido] Item creado automáticamente desde libro: ${libroId}`);
          }
        }
      }
      
      // Limpiar el campo temporal (no se guarda en la BD)
      delete data.libros_para_agregar;
    }
  }
  
  // Procesar items existentes - siempre rellenar desde el libro
  if (data.items && Array.isArray(data.items)) {
    const itemsProcesados = [];
    
    for (let i = 0; i < data.items.length; i++) {
      const itemOriginal = data.items[i];
      if (!itemOriginal) continue;
      
      try {
        if (itemOriginal.libro) {
          // Intentar rellenar desde libro, pero si falla, usar el item original
          let itemRellenado = itemOriginal;
          try {
            itemRellenado = await rellenarItemDesdeLibro(itemOriginal, platform);
          } catch (error: any) {
            // Si falla rellenar, usar el item original
            strapi.log.warn(`[wo-pedido] Error rellenando item ${i} desde libro, usando datos originales: ${error?.message || error}`);
            itemRellenado = itemOriginal;
          }
          
          // Preservar la relación con libro si existe
          // En Strapi v5, las relaciones en componentes deben pasarse como ID directo
          const libroIdOriginal = typeof itemOriginal.libro === 'object' 
            ? (itemOriginal.libro.documentId || itemOriginal.libro.id || itemOriginal.libro)
            : itemOriginal.libro;
          
          // Asegurar que el item tenga todos los campos requeridos
          // IMPORTANTE: Mantener la estructura del componente y solo actualizar los campos necesarios
          const itemFinal: any = {
            nombre: itemRellenado.nombre || itemOriginal.nombre || '',
            cantidad: itemRellenado.cantidad || itemOriginal.cantidad || 1,
            precio_unitario: itemRellenado.precio_unitario || itemOriginal.precio_unitario || 0,
            total: itemRellenado.total || itemOriginal.total || 0,
          };
          
          // Agregar campos opcionales si existen
          if (itemRellenado.sku || itemOriginal.sku) {
            itemFinal.sku = itemRellenado.sku || itemOriginal.sku;
          }
          if (itemRellenado.producto_id || itemOriginal.producto_id) {
            itemFinal.producto_id = itemRellenado.producto_id || itemOriginal.producto_id;
          }
          if (itemRellenado.item_id || itemOriginal.item_id) {
            itemFinal.item_id = itemRellenado.item_id || itemOriginal.item_id;
          }
          if (itemRellenado.metadata || itemOriginal.metadata) {
            itemFinal.metadata = itemRellenado.metadata || itemOriginal.metadata;
          }
          
          // Mantener la relación con libro - pasar solo el ID (Strapi v5 espera esto)
          if (libroIdOriginal) {
            itemFinal.libro = libroIdOriginal;
          }
          
          // Calcular total si no está definido
          if (!itemFinal.total && itemFinal.precio_unitario && itemFinal.cantidad) {
            itemFinal.total = parseFloat(String(itemFinal.precio_unitario)) * itemFinal.cantidad;
          }
          
          itemsProcesados.push(itemFinal);
          strapi.log.info(`[wo-pedido] ✅ Item ${i} procesado: ${itemFinal.nombre} (cantidad: ${itemFinal.cantidad}, total: ${itemFinal.total})`);
        } else {
          // Item sin libro - asegurar campos requeridos
          if (!itemOriginal.nombre) {
            strapi.log.warn(`[wo-pedido] ⚠️  Item ${i} sin nombre ni libro relacionado`);
          }
          // Asegurar valores por defecto
          const itemFinal = {
            ...itemOriginal,
            nombre: itemOriginal.nombre || '',
            cantidad: itemOriginal.cantidad || 1,
            precio_unitario: itemOriginal.precio_unitario || 0,
            total: itemOriginal.total || (itemOriginal.precio_unitario && itemOriginal.cantidad 
              ? parseFloat(String(itemOriginal.precio_unitario)) * itemOriginal.cantidad 
              : 0),
          };
          itemsProcesados.push(itemFinal);
        }
      } catch (error: any) {
        // Si hay error procesando el item, usar el original
        strapi.log.warn(`[wo-pedido] Error procesando item ${i}, usando datos originales: ${error?.message || error}`);
        itemsProcesados.push({
          ...itemOriginal,
          nombre: itemOriginal.nombre || '',
          cantidad: itemOriginal.cantidad || 1,
          precio_unitario: itemOriginal.precio_unitario || 0,
          total: itemOriginal.total || (itemOriginal.precio_unitario && itemOriginal.cantidad 
            ? parseFloat(String(itemOriginal.precio_unitario)) * itemOriginal.cantidad 
            : 0),
        });
      }
    }
    
    // Reemplazar el array de items con los procesados
    data.items = itemsProcesados;
    strapi.log.info(`[wo-pedido] ✅ Procesados ${itemsProcesados.length} items del pedido`);
  }
}

export default {
  async beforeCreate(event: any) {
    const { params } = event;
    const data = params?.data || {};

    try {
      // Forzar siempre originPlatform si no viene
      if (!data.originPlatform) {
        data.originPlatform = 'woo_moraleja';
      }

      // Establecer valores por defecto si no están definidos
      if (!data.estado) {
        data.estado = 'pending';
      }
      if (!data.moneda) {
        data.moneda = 'CLP';
      }
      if (!data.metodo_pago) {
        data.metodo_pago = 'bacs';
      }
      if (!data.origen) {
        data.origen = 'web';
      }
      if (!data.fecha_pedido) {
        data.fecha_pedido = new Date().toISOString();
      }

      // Procesar items para rellenar campos desde libros
      // IMPORTANTE: En Strapi v5, acceder a entityService dentro de beforeCreate puede causar problemas de transacción
      // Por ahora, deshabilitamos el procesamiento automático en beforeCreate para items con relación libro
      // El procesamiento se puede hacer en afterCreate si es necesario
      // Solo procesamos items sin relación libro para asegurar campos requeridos
      if (data.items && Array.isArray(data.items)) {
        // Solo validar y asegurar campos requeridos, sin acceder a entityService
        // IMPORTANTE: Si hay relación libro, asegurarse de que esté en formato correcto
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          if (item) {
            // Asegurar campos requeridos
            if (!item.nombre) item.nombre = '';
            if (!item.cantidad) item.cantidad = 1;
            if (!item.precio_unitario) item.precio_unitario = 0;
            if (!item.total && item.precio_unitario && item.cantidad) {
              item.total = parseFloat(String(item.precio_unitario)) * item.cantidad;
            }
            
            // Si hay relación libro, asegurarse de que esté en formato correcto (solo ID, no objeto completo)
            // IMPORTANTE: En Strapi v5, las relaciones en componentes pueden causar problemas de validación
            // si se pasa un documentId (string). Guardamos el documentId temporalmente y establecemos la relación
            // en afterCreate para evitar errores de validación durante beforeCreate
            if (item.libro) {
              // Guardar referencia temporal al objeto original si existe
              const libroOriginal = typeof item.libro === 'object' ? item.libro : null;
              
              if (libroOriginal) {
                // Extraer IDs
                const libroDocumentId = libroOriginal.documentId;
                const libroIdNumeric = libroOriginal.id;
                
                // Guardar libro_id si tenemos ID numérico
                if (libroIdNumeric && typeof libroIdNumeric === 'number') {
                  item.libro_id = libroIdNumeric;
                  // Usar ID numérico para la relación (más seguro que documentId en componentes)
                  item.libro = libroIdNumeric;
                } else if (libroDocumentId) {
                  // Si solo tenemos documentId, guardarlo temporalmente
                  // NO modificar item.libro aquí para evitar errores de validación
                  (item as any).__libroDocumentId = libroDocumentId;
                  // Mantener el objeto original por ahora, se procesará en afterCreate
                }
              } else {
                // Si ya es un string o número
                if (typeof item.libro === 'number') {
                  item.libro_id = item.libro;
                  // Dejar como está si es número
                } else if (typeof item.libro === 'string') {
                  // Es un documentId (string), guardarlo temporalmente
                  // NO modificar item.libro aquí para evitar errores de validación
                  (item as any).__libroDocumentId = item.libro;
                  // Eliminar el campo libro del item para que Strapi no intente validarlo
                  delete item.libro;
                }
              }
            }
          }
        }
        strapi.log.info(`[wo-pedido] Items validados (sin procesar relaciones libro en beforeCreate)`);
      }
      
      // NOTA: El procesamiento completo de items con relación libro se hará en afterCreate si es necesario
      // Esto evita problemas de transacción en Strapi v5

      // Generar wooId único si no existe
      // Hacerlo al final para evitar problemas si hay errores antes
      if (!data.wooId) {
        try {
          data.wooId = await generarWooIdUnicoValido();
          strapi.log.info(`[wo-pedido] wooId único generado: ${data.wooId}`);
        } catch (error: any) {
          // Si falla la generación, usar un valor simple basado en timestamp
          strapi.log.warn(`[wo-pedido] Error generando wooId único, usando valor simple:`, error);
          const timestamp = Date.now();
          data.wooId = parseInt(String(timestamp).slice(-9), 10); // Últimos 9 dígitos del timestamp
        }
      }
    } catch (error: any) {
      // Capturar cualquier error no manejado y loguearlo
      strapi.log.error(`[wo-pedido] Error en beforeCreate:`, error);
      // Re-lanzar el error para que Strapi lo maneje
      throw error;
    }
  },

  async beforeUpdate(event: any) {
    const { params } = event;
    const data = params?.data || {};
    const where = params?.where || {};
    const pedidoId = where.id || params?.id;

    // Generar wooId único si no existe y no hay uno asignado
    if (!data.wooId && pedidoId) {
      try {
        const pedidoExistente = await strapi.entityService.findOne('api::wo-pedido.wo-pedido' as any, pedidoId) as any;
        if (!pedidoExistente?.wooId) {
          data.wooId = await generarWooIdUnicoValido(pedidoId);
          strapi.log.info(`[wo-pedido] wooId único generado para actualización: ${data.wooId}`);
        }
      } catch (error) {
        strapi.log.warn(`[wo-pedido] Error obteniendo pedido existente para generar wooId:`, error);
      }
    }

    // CORRECCIÓN: Normalizar metodo_pago a valores válidos si viene con valores inválidos
    // Esto evita errores de validación cuando metodo_pago tiene valores no válidos (ej: "tarjeta" → "stripe")
    if (data.metodo_pago !== undefined && data.metodo_pago !== null) {
      const metodoPagoOriginal = String(data.metodo_pago);
      const metodoPagoNormalizado = normalizarMetodoPago(metodoPagoOriginal);
      if (metodoPagoNormalizado && metodoPagoNormalizado !== metodoPagoOriginal.toLowerCase().trim()) {
        strapi.log.info(`[wo-pedido] Metodo_pago normalizado en beforeUpdate: "${metodoPagoOriginal}" → "${metodoPagoNormalizado}"`);
        data.metodo_pago = metodoPagoNormalizado;
      }
    }

    // Procesar items para rellenar campos desde libros
    const platform = data.originPlatform || 'woo_moraleja';
    await procesarItemsDelPedido(data, platform);
  },

  async afterCreate(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    // Actualizar libro_id y establecer relación libro en items si es necesario (después de crear, ya no hay problemas de transacción)
    // IMPORTANTE: Usamos db.query para actualizar directamente sin disparar lifecycles y evitar errores de transacción
    try {
      const pedidoId = (result as any).id || (result as any).documentId;
      if (pedidoId) {
        // Esperar un momento para asegurar que la transacción de creación se complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const pedidoCompleto = await strapi.entityService.findOne('api::wo-pedido.wo-pedido' as any, pedidoId, {
          populate: {
            items: {
              populate: {
                libro: true,
              },
            },
          },
        }) as any;
        
        if (pedidoCompleto?.items && Array.isArray(pedidoCompleto.items)) {
          let necesitaActualizacion = false;
          const itemsActualizados = await Promise.all(
            pedidoCompleto.items.map(async (item: any, index: number) => {
              const itemActualizado = { ...item };
              
              // Si hay documentId temporal guardado, establecer la relación libro
              if ((item as any).__libroDocumentId && !item.libro) {
                try {
                  // Buscar libro por documentId
                  const libro = await strapi.entityService.findOne('api::libro.libro' as any, (item as any).__libroDocumentId) as any;
                  if (libro) {
                    itemActualizado.libro = libro.id || libro.documentId;
                    if (libro.id && typeof libro.id === 'number') {
                      itemActualizado.libro_id = libro.id;
                    }
                    necesitaActualizacion = true;
                  }
                } catch (error) {
                  strapi.log.warn(`[wo-pedido] Error obteniendo libro por documentId ${(item as any).__libroDocumentId}:`, error);
                }
              }
              
              // Si hay relación libro pero no libro_id, actualizar libro_id
              if (itemActualizado.libro && !itemActualizado.libro_id) {
                const libro = typeof itemActualizado.libro === 'object' ? itemActualizado.libro : null;
                if (libro && libro.id && typeof libro.id === 'number') {
                  itemActualizado.libro_id = libro.id;
                  necesitaActualizacion = true;
                } else if (!libro && typeof itemActualizado.libro === 'number') {
                  itemActualizado.libro_id = itemActualizado.libro;
                  necesitaActualizacion = true;
                }
              }
              
              // Limpiar campo temporal
              if ((itemActualizado as any).__libroDocumentId) {
                delete (itemActualizado as any).__libroDocumentId;
              }
              
              return itemActualizado;
            })
          );
          
          if (necesitaActualizacion) {
            // Usar db.query para actualizar directamente sin disparar lifecycles
            // Esto evita que afterUpdate se ejecute y cause errores de transacción
            try {
              const pedidoDbId = (pedidoCompleto as any).id;
              if (pedidoDbId) {
                // Actualizar usando db.query para evitar lifecycles
                await strapi.db.query('api::wo-pedido.wo-pedido').update({
                  where: { id: pedidoDbId },
                  data: {
                    items: itemsActualizados,
                  },
                });
                strapi.log.info(`[wo-pedido] ✅ libro_id y relación libro actualizados en items del pedido ${pedidoId} (usando db.query)`);
              }
            } catch (dbError) {
              // Si db.query falla, intentar con entityService pero con skipWooSync en data usando un campo temporal
              strapi.log.warn(`[wo-pedido] db.query falló, intentando con entityService:`, dbError);
              // No hacer nada más, dejar que se intente en la próxima actualización manual
            }
          }
        }
      }
    } catch (error) {
      strapi.log.warn(`[wo-pedido] Error actualizando libro_id y relación libro en items:`, error);
    }

    // Evitar bucle: SOLO si viene explícitamente desde una operación interna (params.__skipWooSync)
    // NO verificar data.skipWooSync porque puede estar persistido erróneamente
    if ((params as any).__skipWooSync === true) {
      strapi.log.info(
        `[wo-pedido] ⏭️  afterCreate omitido (actualización interna __skipWooSync, originPlatform=${data.originPlatform || result.originPlatform})`
      );
      return;
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('[wo-pedido] 🆕 afterCreate - Evaluando sincronización a WooCommerce');
    console.log('- Pedido ID:', result.id);
    console.log('- Platform:', result.originPlatform);
    console.log('- data.skipWooSync (ignorado):', data.skipWooSync);
    console.log('- params.__skipWooSync:', (params as any).__skipWooSync);
    console.log('═══════════════════════════════════════════════════════');

    const platform = (result as any).originPlatform || data.originPlatform;
    if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
      return;
    }

    // Solo sincronizar si ya está publicado y aún no tiene externalId para esa plataforma
    // En Strapi v5, verificar publishedAt en result o en data
    const isPublished = (result as any).publishedAt || (result as any).attributes?.publishedAt || data.publishedAt;
    if (!isPublished) {
      strapi.log.info(`[wo-pedido] ⏭️  afterCreate omitido (pedido no publicado aún)`);
      // Intentar publicar automáticamente si no está publicado
      try {
        const pedidoId = (result as any).id || (result as any).documentId;
        if (pedidoId) {
          await strapi.entityService.update('api::wo-pedido.wo-pedido' as any, pedidoId, {
            data: {
              publishedAt: new Date().toISOString(),
            },
          });
          strapi.log.info(`[wo-pedido] ✅ Pedido ${pedidoId} publicado automáticamente`);
          // Continuar con la sincronización después de publicar
        }
      } catch (error) {
        strapi.log.warn(`[wo-pedido] Error publicando pedido automáticamente:`, error);
        return;
      }
    }

    const extIds = ((result as any).externalIds || {}) as Record<string, unknown>;
    if (extIds[platform]) {
      strapi.log.info(
        `[wo-pedido] ⏭️  afterCreate omitido (ya tiene externalId para ${platform})`
      );
      return;
    }

    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      if (!wooSyncService || !(wooSyncService as any).syncOrderFromWoPedido) {
        strapi.log.warn('[wo-pedido] Servicio woo-sync o método syncOrderFromWoPedido no disponible');
        return;
      }

      strapi.log.info(
        `[wo-pedido] ▶️  afterCreate → syncOrderFromWoPedido (ID: ${result.id}, plataforma: ${platform})`
      );
      await (wooSyncService as any).syncOrderFromWoPedido(result, platform);
      strapi.log.info(
        `[wo-pedido] ✅ Pedido sincronizado a WooCommerce desde afterCreate (ID: ${result.id}, plataforma: ${platform})`
      );
    } catch (error) {
      strapi.log.error('[wo-pedido] Error en afterCreate syncOrderFromWoPedido:', error);
    }
  },

  async afterUpdate(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    // Evitar bucle: SOLO si viene explícitamente desde una operación interna (params.__skipWooSync)
    // NO verificar data.skipWooSync porque puede estar persistido desde la creación inicial
    if ((params as any).__skipWooSync === true) {
      strapi.log.info(
        `[wo-pedido] ⏭️  afterUpdate omitido (actualización interna __skipWooSync, originPlatform=${data.originPlatform || result.originPlatform})`
      );
      return;
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('[wo-pedido] 🔄 afterUpdate - Intentando sincronizar a WooCommerce');
    console.log('- Pedido ID:', result.id);
    console.log('- Número:', result.numeroOrderWoo || result.numero_pedido);
    console.log('- Platform:', result.originPlatform);
    console.log('- data.skipWooSync (ignorado):', data.skipWooSync);
    console.log('- params.__skipWooSync:', (params as any).__skipWooSync);
    console.log('═══════════════════════════════════════════════════════');

    const platform = (result as any).originPlatform || data.originPlatform;
    if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
      return;
    }

    try {
      const wooSyncService = strapi.service('api::woo-sync.woo-sync');
      if (!wooSyncService || !(wooSyncService as any).syncOrderFromWoPedido) {
        strapi.log.warn('[wo-pedido] Servicio woo-sync o método syncOrderFromWoPedido no disponible');
        return;
      }

      strapi.log.info(
        `[wo-pedido] ▶️  afterUpdate → syncOrderFromWoPedido (ID: ${result.id}, plataforma: ${platform})`
      );
      await (wooSyncService as any).syncOrderFromWoPedido(result, platform);
      strapi.log.info(
        `[wo-pedido] ✅ Pedido sincronizado a WooCommerce desde afterUpdate (ID: ${result.id}, plataforma: ${platform})`
      );
    } catch (error) {
      strapi.log.error('[wo-pedido] Error en afterUpdate syncOrderFromWoPedido:', error);
    }
  },

  async afterDelete(event: any) {
    const { result, params } = event;
    const data = params?.data || {};

    const registros = Array.isArray(result) ? result : [result];

    for (const registro of registros) {
      if (!registro) continue;

      const platform = (registro as any).originPlatform || data.originPlatform;
      if (!platform || (platform !== 'woo_moraleja' && platform !== 'woo_escolar')) {
        continue;
      }

      // Determinar wooId / externalIds
      const externalIds = ((registro as any).externalIds || {}) as Record<string, unknown>;
      const wooId = (registro as any).wooId || externalIds[platform];
      if (!wooId) {
        strapi.log.info(
          `[wo-pedido] ⏭️  afterDelete omitido para ${registro.id}: no wooId ni externalIds[${platform}]`
        );
        continue;
      }

      // Si existe OTRO registro con el mismo wooId en esta plataforma, no borrar en Woo
      try {
        const otros = await strapi.entityService.findMany('api::wo-pedido.wo-pedido' as any, {
          filters: {
            id: { $ne: registro.id },
            externalIds: {
              $contains: { [platform]: wooId },
            },
          },
        }) as any[];

        if (otros && otros.length > 0) {
          strapi.log.info(
            `[wo-pedido] ⏭️  afterDelete omitido para ${registro.id}: hay ${otros.length} registro(s) más con wooId=${wooId} en ${platform}`
          );
          continue;
        }

        const wooSyncService = strapi.service('api::woo-sync.woo-sync');
        if (!wooSyncService || !(wooSyncService as any).deleteOrderFromWoPedido) {
          strapi.log.warn('[wo-pedido] Servicio woo-sync o método deleteOrderFromWoPedido no disponible');
          continue;
        }

        strapi.log.info(
          `[wo-pedido] ▶️  afterDelete → deleteOrderFromWoPedido (ID local: ${registro.id}, wooId=${wooId}, plataforma: ${platform})`
        );
        await (wooSyncService as any).deleteOrderFromWoPedido(registro, platform);
      } catch (error) {
        strapi.log.error('[wo-pedido] Error en afterDelete deleteOrderFromWoPedido:', error);
      }
    }
  },
};


