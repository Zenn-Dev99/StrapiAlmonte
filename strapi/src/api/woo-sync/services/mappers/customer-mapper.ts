/**
 * Servicio de mapeo para Clientes (Customers) entre Strapi y WooCommerce
 */

import addressMapper from './address-mapper';

export default ({ strapi }) => {
  const address = addressMapper({ strapi });

  return {
    /**
     * Mapea un wo-cliente de Strapi a formato WooCommerce
     * Mapea TODOS los campos disponibles en el schema de wo-cliente
     * Incluye datos de persona relacionada (RUT, fecha nacimiento, etc.)
     */
    async mapWoClienteToWooCustomer(woCliente: any, platform: 'woo_moraleja' | 'woo_escolar'): Promise<any> {
      const wooCustomer: any = {
        email: woCliente.correo_electronico || '',
      };

      // ============================================
      // CAMPOS BÁSICOS
      // ============================================
      
      // Nombres (si viene nombre completo, intentar separar)
      if (woCliente.nombre) {
        const nombreParts = woCliente.nombre.trim().split(/\s+/);
        if (nombreParts.length > 1) {
          wooCustomer.first_name = nombreParts[0];
          wooCustomer.last_name = nombreParts.slice(1).join(' ');
        } else {
          wooCustomer.first_name = woCliente.nombre;
        }
      }
      
      // Si hay apellido separado, usarlo
      if (woCliente.apellido) {
        wooCustomer.last_name = woCliente.apellido;
      }
      
      // Username (si existe)
      if (woCliente.username) {
        wooCustomer.username = woCliente.username;
      }

      // ============================================
      // DIRECCIONES
      // ============================================
      // Direcciones desde billing/shipping si existen (usar address-mapper)
      if (woCliente.billing) {
        wooCustomer.billing = address.mapBillingToWoo(woCliente.billing);
      } else if (woCliente.ciudad || woCliente.region || woCliente.codigo_postal) {
        // Si no hay billing pero hay datos de ubicación, crear billing básico
        wooCustomer.billing = {
          first_name: wooCustomer.first_name || '',
          last_name: wooCustomer.last_name || '',
          city: woCliente.ciudad || '',
          state: woCliente.region || '',
          postcode: woCliente.codigo_postal || '',
          country: woCliente.pais_region || 'CL',
          email: woCliente.correo_electronico || '',
        };
      }
      
      if (woCliente.shipping) {
        wooCustomer.shipping = address.mapShippingToWoo(woCliente.shipping);
      } else if (woCliente.ciudad || woCliente.region || woCliente.codigo_postal) {
        // Si no hay shipping pero hay datos de ubicación, crear shipping básico
        wooCustomer.shipping = {
          first_name: wooCustomer.first_name || '',
          last_name: wooCustomer.last_name || '',
          city: woCliente.ciudad || '',
          state: woCliente.region || '',
          postcode: woCliente.codigo_postal || '',
          country: woCliente.pais_region || 'CL',
        };
      }

      // ============================================
      // METADATOS ADICIONALES
      // ============================================
      wooCustomer.meta_data = wooCustomer.meta_data || [];
      
      // Guardar datos de negocio en meta_data
      if (woCliente.pedidos !== undefined && woCliente.pedidos !== null) {
        wooCustomer.meta_data.push({
          key: 'pedidos',
          value: String(woCliente.pedidos),
        });
      }
      
      if (woCliente.gasto_total !== undefined && woCliente.gasto_total !== null) {
        wooCustomer.meta_data.push({
          key: 'gasto_total',
          value: String(woCliente.gasto_total),
        });
      }
      
      if (woCliente.aov !== undefined && woCliente.aov !== null) {
        wooCustomer.meta_data.push({
          key: 'aov',
          value: String(woCliente.aov),
        });
      }
      
      if (woCliente.fecha_registro) {
        wooCustomer.meta_data.push({
          key: 'fecha_registro',
          value: woCliente.fecha_registro instanceof Date 
            ? woCliente.fecha_registro.toISOString() 
            : String(woCliente.fecha_registro),
        });
      }
      
      if (woCliente.ultima_actividad) {
        wooCustomer.meta_data.push({
          key: 'ultima_actividad',
          value: woCliente.ultima_actividad instanceof Date 
            ? woCliente.ultima_actividad.toISOString() 
            : String(woCliente.ultima_actividad),
        });
      }
      
      // ============================================
      // DATOS DE PERSONA (si está relacionada)
      // ============================================
      // Obtener persona relacionada si existe
      let persona = null;
      if (woCliente.persona) {
        if (typeof woCliente.persona === 'object') {
          persona = woCliente.persona;
        } else {
          // Si es solo el ID, obtener la persona completa
          try {
            persona = await strapi.entityService.findOne('api::persona.persona', woCliente.persona, {
              populate: ['emails', 'telefonos'],
            });
          } catch (error) {
            strapi.log.warn(`[customer-mapper] Error obteniendo persona ${woCliente.persona}:`, error);
          }
        }
      }
      
      // Si hay persona, agregar sus datos a meta_data
      if (persona) {
        // RUT
        if (persona.rut) {
          wooCustomer.meta_data.push({
            key: 'rut',
            value: String(persona.rut),
          });
        }
        
        // Fecha de nacimiento
        if (persona.cumpleagno) {
          const fechaNac = persona.cumpleagno instanceof Date 
            ? persona.cumpleagno.toISOString().split('T')[0]
            : String(persona.cumpleagno).split('T')[0];
          wooCustomer.meta_data.push({
            key: 'fecha_nacimiento',
            value: fechaNac,
          });
        }
        
        // Género
        if (persona.genero) {
          wooCustomer.meta_data.push({
            key: 'genero',
            value: persona.genero,
          });
        }
        
        // Segundo apellido
        if (persona.segundo_apellido) {
          wooCustomer.meta_data.push({
            key: 'segundo_apellido',
            value: persona.segundo_apellido,
          });
        }
        
        // Teléfono principal
        const telefonos = persona.telefonos || [];
        const telefonoPrincipal = telefonos.find((t: any) => t.principal) || telefonos[0];
        if (telefonoPrincipal) {
          const tel = telefonoPrincipal.telefono_norm || telefonoPrincipal.telefono_raw;
          if (tel) {
            wooCustomer.meta_data.push({
              key: 'telefono',
              value: tel,
            });
          }
        }
        
        // ID de persona en Strapi (para referencia)
        const personaId = persona.id || persona.documentId;
        if (personaId) {
          wooCustomer.meta_data.push({
            key: 'persona_id',
            value: String(personaId),
          });
        }
      }

      return wooCustomer;
    },

    /**
     * Mapea un cliente de WooCommerce a formato Strapi (wo-cliente)
     * IMPORTANTE: NO modifica campos estáticos como email si ya existe en Strapi
     * @param wooCustomer - Cliente de WooCommerce
     * @param platform - Plataforma (woo_moraleja o woo_escolar)
     * @param woClienteExistente - Cliente existente en Strapi (opcional, para proteger campos estáticos)
     */
    mapWooCustomerToWoCliente(
      wooCustomer: any, 
      platform: 'woo_moraleja' | 'woo_escolar',
      woClienteExistente?: any
    ): any {
      const woCliente: any = {
        originPlatform: platform,
      };
      
      // ============================================
      // EMAIL (CAMPO ESTÁTICO - Solo se actualiza si no existe)
      // ============================================
      // ⚠️ PROTECCIÓN: No sobrescribir email si ya existe en Strapi
      if (wooCustomer.email) {
        const emailWoo = String(wooCustomer.email).trim().toLowerCase();
        const emailExistente = woClienteExistente?.correo_electronico || woClienteExistente?.attributes?.correo_electronico;
        
        if (!emailExistente) {
          // Solo actualizar si no existe email en Strapi
          woCliente.correo_electronico = emailWoo;
        } else if (emailExistente.toLowerCase() !== emailWoo) {
          // Si difieren, mantener el de Strapi y loguear advertencia
          strapi.log.warn(
            `[customer-mapper] Email conflictivo: Strapi tiene "${emailExistente}" pero WooCommerce tiene "${emailWoo}". ` +
            `Manteniendo email de Strapi (campo protegido).`
          );
          // NO actualizar correo_electronico
        }
        // Si son iguales, no hacer nada
      }

      // ============================================
      // CAMPOS BÁSICOS (siempre se actualizan desde WooCommerce)
      // ============================================
      // Nombres
      const firstName = wooCustomer.first_name || '';
      const lastName = wooCustomer.last_name || '';
      
      if (firstName || lastName) {
        woCliente.nombre = [firstName, lastName].filter(Boolean).join(' ').trim() || '';
        if (lastName) {
          woCliente.apellido = lastName;
        }
      } else if (wooCustomer.username) {
        // Si no hay nombres pero hay username, usar username como nombre
        woCliente.nombre = wooCustomer.username;
      }
      
      // Username
      if (wooCustomer.username) {
        woCliente.username = wooCustomer.username;
      }

      // ============================================
      // DIRECCIONES (siempre se actualizan desde WooCommerce)
      // ============================================
      if (wooCustomer.billing) {
        woCliente.billing = address.mapWooBillingToStrapi(wooCustomer.billing);
        
        // Extraer datos de ubicación desde billing si no están en campos directos
        if (!woCliente.ciudad && wooCustomer.billing.city) {
          woCliente.ciudad = wooCustomer.billing.city;
        }
        if (!woCliente.region && wooCustomer.billing.state) {
          woCliente.region = wooCustomer.billing.state;
        }
        if (!woCliente.codigo_postal && wooCustomer.billing.postcode) {
          woCliente.codigo_postal = wooCustomer.billing.postcode;
        }
        if (!woCliente.pais_region && wooCustomer.billing.country) {
          woCliente.pais_region = wooCustomer.billing.country;
        }
      }
      
      if (wooCustomer.shipping) {
        woCliente.shipping = address.mapWooShippingToStrapi(wooCustomer.shipping);
        
        // Extraer datos de ubicación desde shipping si no están en campos directos
        if (!woCliente.ciudad && wooCustomer.shipping.city) {
          woCliente.ciudad = wooCustomer.shipping.city;
        }
        if (!woCliente.region && wooCustomer.shipping.state) {
          woCliente.region = wooCustomer.shipping.state;
        }
        if (!woCliente.codigo_postal && wooCustomer.shipping.postcode) {
          woCliente.codigo_postal = wooCustomer.shipping.postcode;
        }
        if (!woCliente.pais_region && wooCustomer.shipping.country) {
          woCliente.pais_region = wooCustomer.shipping.country;
        }
      }

      // ============================================
      // DATOS DE NEGOCIO (desde WooCommerce o meta_data)
      // ============================================
      // Pedidos
      if (wooCustomer.orders_count !== undefined) {
        woCliente.pedidos = parseInt(String(wooCustomer.orders_count), 10) || 0;
      }
      
      // Gasto total
      if (wooCustomer.total_spent !== undefined) {
        const totalSpent = typeof wooCustomer.total_spent === 'string' 
          ? parseFloat(wooCustomer.total_spent) 
          : wooCustomer.total_spent;
        woCliente.gasto_total = totalSpent || 0;
      }
      
      // AOV (Average Order Value) - calcular si hay pedidos y gasto
      if (woCliente.pedidos && woCliente.pedidos > 0 && woCliente.gasto_total) {
        woCliente.aov = Number((woCliente.gasto_total / woCliente.pedidos).toFixed(2));
      }
      
      // Fechas
      if (wooCustomer.date_created) {
        woCliente.fecha_registro = new Date(wooCustomer.date_created);
      }
      
      if (wooCustomer.date_modified) {
        woCliente.ultima_actividad = new Date(wooCustomer.date_modified);
      } else if (wooCustomer.date_created) {
        woCliente.ultima_actividad = new Date(wooCustomer.date_created);
      }

      // ============================================
      // METADATOS ADICIONALES (desde meta_data)
      // ============================================
      if (wooCustomer.meta_data && Array.isArray(wooCustomer.meta_data)) {
        const metaData = wooCustomer.meta_data;
        
        // Buscar campos específicos en meta_data
        const getMetaValue = (key: string): string | null => {
          const meta = metaData.find((m: any) => m.key === key);
          return meta?.value || null;
        };
        
        // Datos de negocio desde meta_data (backup)
        const pedidosMeta = getMetaValue('pedidos');
        if (pedidosMeta && !woCliente.pedidos) {
          woCliente.pedidos = parseInt(pedidosMeta, 10) || 0;
        }
        
        const gastoTotalMeta = getMetaValue('gasto_total');
        if (gastoTotalMeta && !woCliente.gasto_total) {
          woCliente.gasto_total = parseFloat(gastoTotalMeta) || 0;
        }
        
        const aovMeta = getMetaValue('aov');
        if (aovMeta && !woCliente.aov) {
          woCliente.aov = parseFloat(aovMeta) || null;
        }
        
        const fechaRegistroMeta = getMetaValue('fecha_registro');
        if (fechaRegistroMeta && !woCliente.fecha_registro) {
          woCliente.fecha_registro = new Date(fechaRegistroMeta);
        }
        
        const ultimaActividadMeta = getMetaValue('ultima_actividad');
        if (ultimaActividadMeta && !woCliente.ultima_actividad) {
          woCliente.ultima_actividad = new Date(ultimaActividadMeta);
        }
      }

      // ============================================
      // EXTERNAL ID (siempre se actualiza)
      // ============================================
      if (wooCustomer.id) {
        const existingExternalIds = woClienteExistente?.externalIds || woClienteExistente?.attributes?.externalIds || {};
        woCliente.externalIds = {
          ...existingExternalIds,
          [platform]: wooCustomer.id,
        };
        woCliente.wooId = wooCustomer.id;
      }

      // ============================================
      // DATOS RAW (siempre se guardan)
      // ============================================
      woCliente.rawWooData = wooCustomer;

      return woCliente;
    },
  };
};
