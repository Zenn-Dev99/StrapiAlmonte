import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::woo-webhook.woo-webhook', ({ strapi }) => ({
  /**
   * Buscar atributo en WooCommerce por nombre o slug
   */
  async findAttributeByName(config: any, attributeName: string) {
    if (!attributeName) return null;
    
    try {
      const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
      const response = await fetch(`${config.url}/wp-json/wc/v3/products/attributes`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) return null;
      
      const attributesData = await response.json() as any;
      const attributes = Array.isArray(attributesData) ? attributesData : (attributesData && Array.isArray(attributesData.data) ? attributesData.data : []);
      const attribute = attributes.find((attr: any) => 
        attr.name.toLowerCase() === attributeName.toLowerCase() || 
        attr.slug.toLowerCase() === attributeName.toLowerCase()
      );
      
      return attribute || null;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error buscando atributo "${attributeName}":`, error);
      return null;
    }
  },

  /**
   * Obtener detalles completos de un término desde WooCommerce
   */
  async getTermDetails(config: any, attributeId: number, termName: string) {
    if (!termName || !attributeId || attributeId === 0) return null;
    
    try {
      const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
      const response = await fetch(`${config.url}/wp-json/wc/v3/products/attributes/${attributeId}/terms`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        strapi.log.warn(`[woo-webhook] Error obteniendo términos para atributo ${attributeId}: ${response.status}`);
        return null;
      }
      
      const termsData = await response.json() as any;
      const terms = Array.isArray(termsData) ? termsData : (termsData && Array.isArray(termsData.data) ? termsData.data : []);
      const term = terms.find((t: any) => 
        t.name === termName || 
        t.name.toLowerCase() === termName.toLowerCase() ||
        t.slug === termName.toLowerCase().replace(/\s+/g, '-')
      );
      
      return term || null;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error obteniendo detalles del término "${termName}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Autor desde nombre
   */
  async findOrCreateAutor(autorName: string, descripcion?: string) {
    if (!autorName || autorName.trim() === '') return null;
    
    try {
      // Buscar primero por coincidencia exacta (case insensitive)
      const nombreNormalizado = autorName.trim();
      const autores = await strapi.entityService.findMany('api::autor.autor', {
        filters: {
          nombre_completo_autor: { $eqi: nombreNormalizado },
        },
      }) as any[];
      
      if (autores.length > 0) {
        strapi.log.info(`[woo-webhook] Autor encontrado (exacto): "${autorName}" → ID: ${autores[0].id}`);
        return autores[0].id;
      }
      
      // Si no encuentra exacto, buscar por contiene (búsqueda parcial)
      const autoresParcial = await strapi.entityService.findMany('api::autor.autor', {
        filters: {
          nombre_completo_autor: { $containsi: nombreNormalizado },
        },
      }) as any[];
      
      if (autoresParcial.length > 0) {
        strapi.log.info(`[woo-webhook] Autor encontrado (parcial): "${autorName}" → ID: ${autoresParcial[0].id} (${autoresParcial[0].nombre_completo_autor})`);
        return autoresParcial[0].id;
      }
      
      // Parsear nombre completo en nombres, primer_apellido, segundo_apellido
      const partesNombre = nombreNormalizado.split(' ').filter(p => p.trim());
      let nombres = '';
      let primerApellido = '';
      let segundoApellido = '';
      
      if (partesNombre.length === 1) {
        // Solo un nombre
        nombres = partesNombre[0];
      } else if (partesNombre.length === 2) {
        // Nombre y apellido
        nombres = partesNombre[0];
        primerApellido = partesNombre[1];
      } else {
        // Nombre y dos apellidos (o más)
        nombres = partesNombre[0];
        primerApellido = partesNombre[1];
        segundoApellido = partesNombre.slice(2).join(' ');
      }
      
      // Crear nuevo autor
      const autorData: any = {
        nombre_completo_autor: autorName,
        nombres: nombres,
        primer_apellido: primerApellido,
        segundo_apellido: segundoApellido,
      };
      
      // Si hay descripción, guardarla en resegna (blocks type - convertir texto plano a blocks)
      if (descripcion && descripcion.trim()) {
        // Convertir texto plano a formato blocks de Strapi
        autorData.resegna = [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: descripcion.trim() }],
          },
        ];
      }
      
      const nuevoAutor = await strapi.entityService.create('api::autor.autor', {
        data: autorData,
      });
      strapi.log.info(`[woo-webhook] Autor creado: ${autorName} (ID: ${nuevoAutor.id})${descripcion ? ' con descripción' : ''}`);
      return nuevoAutor.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando autor "${autorName}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Editorial desde nombre
   */
  async findOrCreateEditorial(editorialName: string) {
    if (!editorialName || editorialName.trim() === '') return null;
    
    try {
      const nombreNormalizado = editorialName.trim();
      // Buscar primero por coincidencia exacta
      const editoriales = await strapi.entityService.findMany('api::editorial.editorial', {
        filters: {
          nombre_editorial: { $eqi: nombreNormalizado },
        },
      }) as any[];
      
      if (editoriales.length > 0) {
        strapi.log.info(`[woo-webhook] Editorial encontrada (exacto): "${editorialName}" → ID: ${editoriales[0].id}`);
        return editoriales[0].id;
      }
      
      // Búsqueda parcial si no encuentra exacto
      const editorialesParcial = await strapi.entityService.findMany('api::editorial.editorial', {
        filters: {
          nombre_editorial: { $containsi: nombreNormalizado },
        },
      }) as any[];
      
      if (editorialesParcial.length > 0) {
        strapi.log.info(`[woo-webhook] Editorial encontrada (parcial): "${editorialName}" → ID: ${editorialesParcial[0].id} (${editorialesParcial[0].nombre_editorial})`);
        return editorialesParcial[0].id;
      }
      
      // Buscar el máximo id_editorial para generar uno nuevo
      const allEditoriales = await strapi.entityService.findMany('api::editorial.editorial', {
        fields: ['id_editorial'],
      }) as any[];
      const maxId = allEditoriales.length > 0 
        ? Math.max(...allEditoriales.map(e => e.id_editorial || 0))
        : 0;
      
      // Crear nueva editorial
      const nuevaEditorial = await strapi.entityService.create('api::editorial.editorial', {
        data: {
          id_editorial: maxId + 1,
          nombre_editorial: editorialName,
        },
      });
      strapi.log.info(`[woo-webhook] Editorial creada: ${editorialName} (ID: ${nuevaEditorial.id})`);
      return nuevaEditorial.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando editorial "${editorialName}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Sello desde nombre
   */
  async findOrCreateSello(selloName: string) {
    if (!selloName || selloName.trim() === '') return null;
    
    try {
      const nombreNormalizado = selloName.trim();
      const sellos = await strapi.entityService.findMany('api::sello.sello', {
        filters: {
          nombre_sello: { $eqi: nombreNormalizado },
        },
      }) as any[];
      
      if (sellos.length > 0) {
        strapi.log.info(`[woo-webhook] Sello encontrado (exacto): "${selloName}" → ID: ${sellos[0].id}`);
        return sellos[0].id;
      }
      
      const sellosParcial = await strapi.entityService.findMany('api::sello.sello', {
        filters: {
          nombre_sello: { $containsi: nombreNormalizado },
        },
      }) as any[];
      
      if (sellosParcial.length > 0) {
        strapi.log.info(`[woo-webhook] Sello encontrado (parcial): "${selloName}" → ID: ${sellosParcial[0].id} (${sellosParcial[0].nombre_sello})`);
        return sellosParcial[0].id;
      }
      
      // Buscar el máximo id_sello para generar uno nuevo
      const allSellos = await strapi.entityService.findMany('api::sello.sello', {
        fields: ['id_sello'],
      }) as any[];
      const maxId = allSellos.length > 0 
        ? Math.max(...allSellos.map(s => s.id_sello || 0))
        : 0;
      
      const nuevoSello = await strapi.entityService.create('api::sello.sello', {
        data: {
          id_sello: maxId + 1,
          nombre_sello: selloName,
        },
      });
      strapi.log.info(`[woo-webhook] Sello creado: ${selloName} (ID: ${nuevoSello.id})`);
      return nuevoSello.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando sello "${selloName}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Colección desde nombre
   */
  async findOrCreateColeccion(coleccionName: string) {
    if (!coleccionName || coleccionName.trim() === '') return null;
    
    try {
      const nombreNormalizado = coleccionName.trim();
      const colecciones = await strapi.entityService.findMany('api::coleccion.coleccion', {
        filters: {
          nombre_coleccion: { $eqi: nombreNormalizado },
        },
      }) as any[];
      
      if (colecciones.length > 0) {
        strapi.log.info(`[woo-webhook] Colección encontrada (exacto): "${coleccionName}" → ID: ${colecciones[0].id}`);
        return colecciones[0].id;
      }
      
      const coleccionesParcial = await strapi.entityService.findMany('api::coleccion.coleccion', {
        filters: {
          nombre_coleccion: { $containsi: nombreNormalizado },
        },
      }) as any[];
      
      if (coleccionesParcial.length > 0) {
        strapi.log.info(`[woo-webhook] Colección encontrada (parcial): "${coleccionName}" → ID: ${coleccionesParcial[0].id} (${coleccionesParcial[0].nombre_coleccion})`);
        return coleccionesParcial[0].id;
      }
      
      const nuevaColeccion = await strapi.entityService.create('api::coleccion.coleccion', {
        data: {
          nombre_coleccion: coleccionName,
        },
      });
      strapi.log.info(`[woo-webhook] Colección creada: ${coleccionName} (ID: ${nuevaColeccion.id})`);
      return nuevaColeccion.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando colección "${coleccionName}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Obra desde nombre
   */
  async findOrCreateObra(obraName: string, descripcion?: string) {
    if (!obraName || obraName.trim() === '') return null;
    
    try {
      const nombreNormalizado = obraName.trim();
      const obras = await strapi.entityService.findMany('api::obra.obra', {
        filters: {
          nombre_obra: { $eqi: nombreNormalizado },
        },
      }) as any[];
      
      if (obras.length > 0) {
        strapi.log.info(`[woo-webhook] Obra encontrada (exacto): "${obraName}" → ID: ${obras[0].id}`);
        return obras[0].id;
      }
      
      const obrasParcial = await strapi.entityService.findMany('api::obra.obra', {
        filters: {
          nombre_obra: { $containsi: nombreNormalizado },
        },
      }) as any[];
      
      if (obrasParcial.length > 0) {
        strapi.log.info(`[woo-webhook] Obra encontrada (parcial): "${obraName}" → ID: ${obrasParcial[0].id} (${obrasParcial[0].nombre_obra})`);
        return obrasParcial[0].id;
      }
      
      const obraData: any = {
        nombre_obra: obraName,
        codigo_obra: `OBRA-${Date.now()}`,
      };
      
      // Si hay descripción, guardarla
      if (descripcion && descripcion.trim()) {
        obraData.descripcion = descripcion.trim();
      }
      
      const nuevaObra = await strapi.entityService.create('api::obra.obra', {
        data: obraData,
      });
      strapi.log.info(`[woo-webhook] Obra creada: ${obraName} (ID: ${nuevaObra.id})${descripcion ? ' con descripción' : ''}`);
      return nuevaObra.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando obra "${obraName}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Categoría desde WooCommerce
   */
  async findOrCreateCategoria(wooCategory: any, platform: string) {
    if (!wooCategory || !wooCategory.name) return null;
    
    try {
      const wooConfig = this.getWooConfig(platform as 'woo_moraleja' | 'woo_escolar');
      if (!wooConfig) return null;
      
      const categorySlug = wooCategory.slug || wooCategory.id; // Usar slug como documentId
      const categoryName = wooCategory.name.trim();
      
      // Buscar primero por slug (que debe ser documentId)
      if (categorySlug) {
        const categorias = await strapi.db.query('api::categoria-producto.categoria-producto').findMany({
          where: {},
        });
        
        // Buscar por externalIds que contenga este slug como documentId
        // O buscar categorías y verificar sus externalIds
        const categoriaExistente = categorias.find((c: any) => {
          // Si el slug de WooCommerce coincide con un documentId, es la misma categoría
          if (c.documentId === categorySlug) return true;
          // También buscar por externalIds
          const extIds = c.externalIds || {};
          return extIds[platform] === wooCategory.id;
        });
        
        if (categoriaExistente) {
          strapi.log.info(`[woo-webhook] Categoría encontrada por slug/externalId: "${categoryName}" → ID: ${categoriaExistente.id}`);
          
          // Actualizar externalIds si no está
          const extIds = categoriaExistente.externalIds || {};
          if (!extIds[platform]) {
            const updatedExtIds = { ...extIds, [platform]: wooCategory.id };
            await strapi.db.query('api::categoria-producto.categoria-producto').update({
              where: { id: categoriaExistente.id },
              data: { externalIds: updatedExtIds },
            });
          }
          
          return categoriaExistente.id;
        }
      }
      
      // Buscar por nombre
      const categorias = await strapi.entityService.findMany('api::categoria-producto.categoria-producto' as any, {
        filters: {
          name: { $eqi: categoryName },
        },
      }) as any[];
      
      if (categorias.length > 0) {
        strapi.log.info(`[woo-webhook] Categoría encontrada por nombre: "${categoryName}" → ID: ${categorias[0].id}`);
        const extIds = categorias[0].externalIds || {};
        if (!extIds[platform]) {
          const updatedExtIds = { ...extIds, [platform]: wooCategory.id };
          await strapi.db.query('api::categoria-producto.categoria-producto').updateMany({
            where: { id: categorias[0].id },
            data: { externalIds: updatedExtIds },
          });
        }
        return categorias[0].id;
      }
      
      // Crear nueva categoría usando db.query para manejar campos JSON
      const categoriaData: any = {
        name: categoryName,
        descripcion: wooCategory.description || '',
        externalIds: { [platform]: wooCategory.id },
      };
      
      if (wooCategory.display) {
        categoriaData.tipo_visualizacion = wooCategory.display;
      }
      
      if (wooCategory.parent && wooCategory.parent > 0) {
        // Buscar categoría padre por externalId
        const categoriasPadre = await strapi.db.query('api::categoria-producto.categoria-producto').findMany({
          where: {},
        });
        const categoriaPadre = categoriasPadre.find((c: any) => {
          const extIds = c.externalIds || {};
          return extIds[platform] === wooCategory.parent;
        });
        if (categoriaPadre) {
          categoriaData.categoria_padre = categoriaPadre.id;
        }
      }
      
      const nuevaCategoria = await strapi.db.query('api::categoria-producto.categoria-producto').create({
        data: categoriaData,
      });
      strapi.log.info(`[woo-webhook] Categoría creada: ${categoryName} (ID: ${nuevaCategoria.id})`);
      return nuevaCategoria.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando categoría "${wooCategory.name}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Etiqueta desde WooCommerce
   */
  async findOrCreateEtiqueta(wooTag: any, platform: string) {
    if (!wooTag || !wooTag.name) return null;
    
    try {
      const tagSlug = wooTag.slug || wooTag.id; // Usar slug como documentId
      const tagName = wooTag.name.trim();
      
      // Buscar primero por slug (documentId) o externalIds
      if (tagSlug) {
        const etiquetas = await strapi.db.query('api::etiqueta.etiqueta').findMany({
          where: {},
        });
        
        const etiquetaExistente = etiquetas.find((e: any) => {
          if (e.documentId === tagSlug) return true;
          const extIds = e.externalIds || {};
          return extIds[platform] === wooTag.id;
        });
        
        if (etiquetaExistente) {
          strapi.log.info(`[woo-webhook] Etiqueta encontrada por slug/externalId: "${tagName}" → ID: ${etiquetaExistente.id}`);
          
          const extIds = etiquetaExistente.externalIds || {};
          if (!extIds[platform]) {
            const updatedExtIds = { ...extIds, [platform]: wooTag.id };
            await strapi.db.query('api::etiqueta.etiqueta').updateMany({
              where: { id: etiquetaExistente.id },
              data: { externalIds: updatedExtIds },
            });
          }
          
          return etiquetaExistente.id;
        }
      }
      
      // Buscar por nombre
      const etiquetas = await strapi.entityService.findMany('api::etiqueta.etiqueta' as any, {
        filters: {
          name: { $eqi: tagName },
        },
      }) as any[];
      
      if (etiquetas.length > 0) {
        strapi.log.info(`[woo-webhook] Etiqueta encontrada por nombre: "${tagName}" → ID: ${etiquetas[0].id}`);
        const extIds = etiquetas[0].externalIds || {};
        if (!extIds[platform]) {
          const updatedExtIds = { ...extIds, [platform]: wooTag.id };
          await strapi.db.query('api::etiqueta.etiqueta').updateMany({
            where: { id: etiquetas[0].id },
            data: { externalIds: updatedExtIds },
          });
        }
        return etiquetas[0].id;
      }
      
      // Crear nueva etiqueta usando db.query para manejar campos JSON
      const nuevaEtiqueta = await strapi.db.query('api::etiqueta.etiqueta').create({
        data: {
          name: tagName,
          descripcion: wooTag.description || '',
          externalIds: { [platform]: wooTag.id },
        },
      });
      strapi.log.info(`[woo-webhook] Etiqueta creada: ${tagName} (ID: ${nuevaEtiqueta.id})`);
      return nuevaEtiqueta.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando etiqueta "${wooTag.name}":`, error);
      return null;
    }
  },

  /**
   * Buscar o crear Marca desde WooCommerce (como término de atributo "Marca")
   */
  async findOrCreateMarca(wooBrandName: string, platform: string) {
    if (!wooBrandName || !wooBrandName.trim()) return null;
    
    try {
      const wooConfig = this.getWooConfig(platform as 'woo_moraleja' | 'woo_escolar');
      if (!wooConfig) return null;
      
      const marcaName = wooBrandName.trim();
      
      // Buscar marca en Strapi por nombre
      const marcas = await strapi.entityService.findMany('api::marca.marca' as any, {
        filters: {
          name: { $eqi: marcaName },
        },
      }) as any[];
      
      if (marcas.length > 0) {
        strapi.log.info(`[woo-webhook] Marca encontrada por nombre: "${marcaName}" → ID: ${marcas[0].id}`);
        
        // Buscar el término en WooCommerce para obtener su ID y actualizar externalIds
        const marcaAttr = await this.findAttributeByName(wooConfig, 'Marca');
        if (marcaAttr && marcaAttr.id) {
          const termDetails = await this.getTermDetails(wooConfig, marcaAttr.id, marcaName);
          if (termDetails && termDetails.id) {
            const extIds = marcas[0].externalIds || {};
            if (!extIds[platform]) {
              const updatedExtIds = { ...extIds, [platform]: termDetails.id };
              await strapi.db.query('api::marca.marca').updateMany({
                where: { id: marcas[0].id },
                data: { externalIds: updatedExtIds },
              });
            }
          }
        }
        
        return marcas[0].id;
      }
      
      // Buscar término en WooCommerce para obtener descripción
      const marcaAttr = await this.findAttributeByName(wooConfig, 'Marca');
      let termDescription = null;
      if (marcaAttr && marcaAttr.id) {
        const termDetails = await this.getTermDetails(wooConfig, marcaAttr.id, marcaName);
        if (termDetails) {
          termDescription = termDetails.description || null;
        }
      }
      
      // Crear nueva marca usando db.query para manejar campos JSON si se necesita
      const marcaData: any = {
        name: marcaName,
        descripcion: termDescription || '',
      };
      
      // Si encontramos el término en WooCommerce, guardar externalIds
      if (marcaAttr && marcaAttr.id) {
        const termDetails = await this.getTermDetails(wooConfig, marcaAttr.id, marcaName);
        if (termDetails && termDetails.id) {
          marcaData.externalIds = { [platform]: termDetails.id };
        }
      }
      
      const nuevaMarca = await strapi.db.query('api::marca.marca').create({
        data: marcaData,
      });
      strapi.log.info(`[woo-webhook] Marca creada: ${marcaName} (ID: ${nuevaMarca.id})`);
      return nuevaMarca.id;
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error creando/buscando marca "${wooBrandName}":`, error);
      return null;
    }
  },

  /**
   * Sincroniza un producto de WooCommerce a Strapi (libro)
   */
  async syncProduct(wooProduct: any, platform: string) {
    // Extraer todos los campos posibles del producto WooCommerce
    const { 
      id: wooId, 
      name, 
      sku, 
      description, 
      short_description,
      regular_price, 
      sale_price, 
      price,
      images, 
      meta_data, 
      attributes, 
      categories, 
      tags,
      stock_status,
      stock_quantity,
      manage_stock,
      global_unique_id,
      status,
      type,
      permalink,
      price_html,
      // Agregar cualquier otro campo que pueda ser útil
      ...restFields
    } = wooProduct;
    
    strapi.log.info(`[woo-webhook] Producto recibido completo - ID: ${wooId}, SKU: ${sku}, Global Unique ID: ${global_unique_id}, Stock: ${stock_status}`);

    // Buscar canal por key (moraleja, escolar, listas)
    const canalKey = platform === 'woo_moraleja' ? 'moraleja' : platform === 'woo_escolar' ? 'escolar' : null;
    let canalId = null;
    if (canalKey) {
      const canales = await strapi.entityService.findMany('api::canal.canal', {
        filters: { key: canalKey },
      });
      canalId = canales[0]?.id;
    }

    // Buscar libro existente por externalIds
    // Strapi no soporta bien filtros JSON anidados, así que buscamos todos y filtramos
    const allLibros = await strapi.entityService.findMany('api::libro.libro', {
      populate: ['canales'],
    }) as any[];
    const existingLibro = allLibros.find((libro: any) => {
      const extIds = libro.externalIds || {};
      return extIds.woo_moraleja === wooId || extIds.woo_escolar === wooId;
    });

    // Preparar externalIds
    const externalIds = existingLibro?.externalIds || {};
    externalIds[platform] = wooId;

    // Preparar canales (añadir el canal actual si no está)
    const existingLibroCanales = (existingLibro as any)?.canales || [];
    const canalesIds = existingLibroCanales.map((c: any) => c.id) || [];
    if (canalId && !canalesIds.includes(canalId)) {
      canalesIds.push(canalId);
    }

    // Extraer identificadores del SKU, meta_data o global_unique_id
    // Prioridad: meta_data.isbn > global_unique_id > sku > meta_data.ean
    const isbnFromMeta = meta_data?.find((m: any) => m.key === 'isbn')?.value || null;
    const ean = meta_data?.find((m: any) => m.key === 'ean')?.value || null;
    
    // Guardar el SKU original (importante para tracking e inventario)
    const skuOriginal = sku || null;
    
    // El ISBN puede venir de:
    // 1. meta_data.isbn (más específico)
    // 2. global_unique_id (si es un ISBN válido)
    // 3. SKU (si es un ISBN válido, típicamente 13 dígitos)
    let isbn = isbnFromMeta;
    if (!isbn && global_unique_id && String(global_unique_id).length >= 10) {
      isbn = String(global_unique_id);
      strapi.log.info(`[woo-webhook] Usando global_unique_id como ISBN: ${global_unique_id}`);
    }
    if (!isbn && skuOriginal && skuOriginal.length >= 10) {
      isbn = skuOriginal;
      strapi.log.info(`[woo-webhook] Usando SKU como ISBN: ${skuOriginal}`);
    }

    // Preparar datos del libro
    const libroData: any = {
      nombre_libro: name || 'Sin nombre',
      externalIds,
      canales: canalesIds,
    };

    // Si hay ISBN, usarlo (requerido y único)
    // Si no hay ISBN pero hay SKU, usamos el SKU como ISBN (puede ser el ISBN mismo)
    if (isbn) {
      libroData.isbn_libro = String(isbn);
      strapi.log.info(`[woo-webhook] ISBN asignado: ${isbn} ${isbnFromMeta ? '(desde meta_data)' : '(desde SKU)'}`);
    } else if (skuOriginal) {
      // Si no hay ISBN pero hay SKU, usar SKU como ISBN (requerido en Strapi)
      libroData.isbn_libro = String(skuOriginal);
      strapi.log.info(`[woo-webhook] SKU usado como ISBN: ${skuOriginal}`);
    }
    
    // Guardar SKU original y global_unique_id en externalIds para referencia
    if (skuOriginal) {
      externalIds.sku = skuOriginal;
      strapi.log.info(`[woo-webhook] SKU guardado en externalIds: ${skuOriginal}`);
    }
    
    if (global_unique_id) {
      externalIds.global_unique_id = String(global_unique_id);
      strapi.log.info(`[woo-webhook] Global Unique ID guardado en externalIds: ${global_unique_id}`);
    }
    
    // Si hay EAN, guardarlo (si el campo existe en el schema)
    if (ean) {
      libroData.ean_libro = String(ean);
    }

    // ✅ CORRECCIÓN: Guardar descripciones en los campos correctos
    // description → descripcion (campo blocks de Strapi)
    // short_description → subtitulo_libro (texto simple)
    
    // Convertir description HTML a formato blocks de Strapi
    if (description) {
      // Limpiar HTML y convertir a texto plano para blocks
      const textoLimpio = description.replace(/<[^>]*>/g, '').trim();
      if (textoLimpio) {
        libroData.descripcion = [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: textoLimpio }],
          },
        ];
      }
    }
    
    // short_description → subtitulo_libro (campo de texto simple)
    if (short_description) {
      const textoCorto = short_description.replace(/<[^>]*>/g, '').trim();
      if (textoCorto) {
        libroData.subtitulo_libro = textoCorto.substring(0, 255);
      }
    }
    
    // Guardar información adicional del producto WooCommerce en externalIds para referencia
    // Esto permite mantener trazabilidad completa
    if (price !== undefined) externalIds.price = price;
    if (regular_price !== undefined) externalIds.regular_price = regular_price;
    if (sale_price !== undefined) externalIds.sale_price = sale_price;
    if (stock_status) externalIds.stock_status = stock_status;
    if (stock_quantity !== undefined) externalIds.stock_quantity = stock_quantity;
    if (status) externalIds.woo_status = status;
    if (type) externalIds.woo_type = type;
    if (permalink) externalIds.woo_permalink = permalink;

    // Procesar atributos de WooCommerce y crear/buscar relaciones en Strapi
    if (attributes && Array.isArray(attributes)) {
      strapi.log.info(`[woo-webhook] Procesando ${attributes.length} atributo(s) del producto ${wooId}`);
      
      // Necesitamos obtener el ID del atributo para buscar detalles del término
      const wooConfig = this.getWooConfig(platform as 'woo_moraleja' | 'woo_escolar');
      
      for (const attr of attributes) {
        const attrNameRaw = attr.name || '';
        const attrName = attrNameRaw.toLowerCase().trim();
        const attrSlug = (attr.slug || '').toLowerCase().trim();
        const options = attr.options || [];
        let attrId = attr.id; // ID del atributo en WooCommerce
        
        if (options.length === 0) {
          strapi.log.info(`[woo-webhook] ⏭️  Atributo "${attrNameRaw}" sin términos, saltando`);
          continue;
        }
        
        // Procesar cada término del atributo (puede haber múltiples)
        for (const option of options) {
          const value = String(option).trim();
          if (!value) continue;
          
          strapi.log.info(`[woo-webhook] Procesando atributo: "${attrNameRaw}" → término: "${value}"`);
          
          // Si no tenemos un ID válido del atributo, buscarlo por nombre
          if (wooConfig && (!attrId || attrId === 0)) {
            const foundAttribute = await this.findAttributeByName(wooConfig, attrNameRaw);
            if (foundAttribute && foundAttribute.id) {
              attrId = foundAttribute.id;
              strapi.log.info(`[woo-webhook] Atributo "${attrNameRaw}" encontrado con ID: ${attrId}`);
            } else {
              strapi.log.warn(`[woo-webhook] ⚠️  No se encontró el atributo "${attrNameRaw}" en WooCommerce`);
            }
          }
          
          // Obtener detalles completos del término (incluyendo descripción)
          let termDetails = null;
          if (wooConfig && attrId && attrId !== 0) {
            termDetails = await this.getTermDetails(wooConfig, attrId, value);
            if (termDetails) {
              strapi.log.info(`[woo-webhook] ✅ Detalles del término obtenidos: nombre="${termDetails.name}", descripción="${termDetails.description || 'sin descripción'}"`);
            } else {
              strapi.log.warn(`[woo-webhook] ⚠️  Término "${value}" no encontrado en el atributo ${attrId}`);
            }
          }
          
          const termDescription = termDetails?.description || null;
        
          // Mapear atributos a relaciones de Strapi
          if (attrName === 'autor' || attrName === 'author' || attrSlug === 'autor' || attrSlug === 'author') {
            const autorId = await this.findOrCreateAutor(value, termDescription);
            if (autorId) {
              libroData.autor_relacion = autorId;
              strapi.log.info(`[woo-webhook] ✅ Autor asignado: ${value} (ID: ${autorId})`);
            }
          } else if (attrName === 'editorial' || attrName === 'publisher' || attrSlug === 'editorial' || attrSlug === 'publisher') {
            const editorialId = await this.findOrCreateEditorial(value);
            if (editorialId) {
              libroData.editorial = editorialId;
              strapi.log.info(`[woo-webhook] ✅ Editorial asignada: ${value} (ID: ${editorialId})`);
            }
          } else if (attrName === 'sello' || attrSlug === 'sello') {
            const selloId = await this.findOrCreateSello(value);
            if (selloId) {
              libroData.sello = selloId;
              strapi.log.info(`[woo-webhook] ✅ Sello asignado: ${value} (ID: ${selloId})`);
            }
          } else if (attrName === 'colección' || attrName === 'coleccion' || attrName === 'collection' || attrSlug === 'coleccion' || attrSlug === 'colección') {
            const coleccionId = await this.findOrCreateColeccion(value);
            if (coleccionId) {
              libroData.coleccion = coleccionId;
              strapi.log.info(`[woo-webhook] ✅ Colección asignada: ${value} (ID: ${coleccionId})`);
            }
          } else if (attrName === 'obra' || attrName === 'work' || attrSlug === 'obra' || attrSlug === 'work') {
            const obraId = await this.findOrCreateObra(value, termDescription);
            if (obraId) {
              libroData.obra = obraId;
              strapi.log.info(`[woo-webhook] ✅ Obra asignada: ${value} (ID: ${obraId})`);
            }
          } else if (attrName === 'idioma' || attrName === 'language' || attrSlug === 'idioma' || attrSlug === 'language') {
            libroData.idioma = value;
            strapi.log.info(`[woo-webhook] ✅ Idioma asignado: ${value}`);
          } else if (attrName === 'tipo libro' || attrName === 'tipo-libro' || attrName === 'book-type' || attrSlug === 'tipo-libro' || attrSlug === 'tipo_libro') {
            libroData.tipo_libro = value;
            strapi.log.info(`[woo-webhook] ✅ Tipo Libro asignado: ${value}`);
          } else if (attrName === 'estado edición' || attrName === 'estado-edicion' || attrName === 'edition-status' || attrSlug === 'estado-edicion' || attrSlug === 'estado_edicion') {
            libroData.estado_edicion = value;
            strapi.log.info(`[woo-webhook] ✅ Estado Edición asignado: ${value}`);
          } else if (attrName === 'marca' || attrName === 'brand' || attrSlug === 'marca' || attrSlug === 'brand') {
            // Procesar marca como relación manyToMany
            const marcaId = await this.findOrCreateMarca(value, platform);
            if (marcaId) {
              if (!libroData.marcas) libroData.marcas = [];
              if (!libroData.marcas.includes(marcaId)) {
                libroData.marcas.push(marcaId);
              }
              strapi.log.info(`[woo-webhook] ✅ Marca asignada: ${value} (ID: ${marcaId})`);
            }
          } else {
            strapi.log.info(`[woo-webhook] ℹ️  Atributo desconocido "${attrNameRaw}" (slug: "${attrSlug}") con término "${value}" - ignorado`);
          }
        }
      }
    }

    // Procesar categorías de WooCommerce
    if (categories && Array.isArray(categories)) {
      strapi.log.info(`[woo-webhook] Procesando ${categories.length} categoría(s) del producto ${wooId}`);
      const categoriasIds: number[] = [];
      
      for (const wooCategory of categories) {
        if (!wooCategory.name) continue;
        const categoriaId = await this.findOrCreateCategoria(wooCategory, platform);
        if (categoriaId) {
          categoriasIds.push(categoriaId);
          strapi.log.info(`[woo-webhook] ✅ Categoría asignada: ${wooCategory.name} (ID: ${categoriaId})`);
        }
      }
      
      if (categoriasIds.length > 0) {
        libroData.categorias_producto = categoriasIds;
      }
    }
    
    // Procesar etiquetas (tags) de WooCommerce
    if (tags && Array.isArray(tags)) {
      strapi.log.info(`[woo-webhook] Procesando ${tags.length} etiqueta(s) del producto ${wooId}`);
      const etiquetasIds: number[] = [];
      
      for (const wooTag of tags) {
        if (!wooTag.name) continue;
        const etiquetaId = await this.findOrCreateEtiqueta(wooTag, platform);
        if (etiquetaId) {
          etiquetasIds.push(etiquetaId);
          strapi.log.info(`[woo-webhook] ✅ Etiqueta asignada: ${wooTag.name} (ID: ${etiquetaId})`);
        }
      }
      
      if (etiquetasIds.length > 0) {
        libroData.etiquetas = etiquetasIds;
      }
    }
    
    // Procesar marcas (brands) - buscar en atributos
    // Las marcas vienen como atributo "Marca" en WooCommerce (sin plugin)
    // Ya se procesan arriba en el bloque de attributes, pero también podemos buscar específicamente
    // si viene como campo separado en el producto
    
    // También procesar meta_data para campos adicionales
    if (meta_data && Array.isArray(meta_data)) {
      for (const meta of meta_data) {
        const key = (meta.key || '').toLowerCase();
        const value = String(meta.value || '').trim();
        
        if (!value) continue;
        
        if (key === 'idioma' && !libroData.idioma) {
          libroData.idioma = value;
        } else if (key === 'tipo_libro' && !libroData.tipo_libro) {
          libroData.tipo_libro = value;
        } else if (key === 'estado_edicion' && !libroData.estado_edicion) {
          libroData.estado_edicion = value;
        }
      }
    }

    let libro;
    if (existingLibro) {
      // Actualizar libro existente
      libro = await strapi.entityService.update('api::libro.libro', existingLibro.id, {
        data: libroData,
      });
      strapi.log.info(`[woo-webhook] Libro actualizado: ${libro.id} (WooCommerce ID: ${wooId})`);
    } else {
      // Crear nuevo libro (requiere ISBN)
      if (!isbn) {
        throw new Error('No se puede crear libro sin ISBN (SKU requerido)');
      }
      libro = await strapi.entityService.create('api::libro.libro', {
        data: libroData,
      });
      strapi.log.info(`[woo-webhook] Libro creado: ${libro.id} (WooCommerce ID: ${wooId})`);
    }

    return libro;
  },

  /**
   * Sincroniza un cliente de WooCommerce a Strapi (customer + persona)
   */
  async syncCustomer(wooCustomer: any, platform: string) {
    const { id: wooId, email, first_name, last_name, username, billing, shipping, meta_data } = wooCustomer;

    if (!email) {
      throw new Error('Cliente sin email');
    }

    // Buscar customer existente por email
    const customers = await strapi.entityService.findMany('api::customer.customer', {
      filters: { email },
      populate: ['persona'],
    });
    let customer = customers[0];

    // Preparar externalIds
    const externalIds = customer?.externalIds || {};
    externalIds[platform] = wooId;

    // Declarar woCliente y woClienteData fuera del try para que estén disponibles en todo el scope
    let woCliente: any = null;
    let woClienteData: any = null;

    // --- WO-Clientes: guardar datos de negocio + estructura cruda de WooCommerce para trazabilidad ---
    try {
      // Calcular campos derivados para el content type WO-Clientes
      const nombreCompleto = [first_name, last_name].filter(Boolean).join(' ') || email.split('@')[0];
      const fechaRegistro = (wooCustomer as any).date_created ? new Date((wooCustomer as any).date_created) : null;
      const ultimaActividad = (wooCustomer as any).date_modified
        ? new Date((wooCustomer as any).date_modified)
        : fechaRegistro;

      const pedidos = (wooCustomer as any).orders_count ?? null;
      const gastoTotalRaw = (wooCustomer as any).total_spent ?? null;
      const gastoTotal = typeof gastoTotalRaw === 'string' ? parseFloat(gastoTotalRaw) : gastoTotalRaw;
      const aov =
        pedidos && pedidos > 0 && typeof gastoTotal === 'number'
          ? Number((gastoTotal / pedidos).toFixed(2))
          : null;

      const billingData = billing || {};
      const shippingData = shipping || {};

      const paisRegion =
        billingData.country ||
        shippingData.country ||
        '';
      const ciudad =
        billingData.city ||
        shippingData.city ||
        '';
      const region =
        billingData.state ||
        shippingData.state ||
        '';
      const codigoPostal =
        billingData.postcode ||
        shippingData.postcode ||
        '';

      // Buscar wo-cliente existente por email + plataforma o por externalIds
      const existingWoClientes = await strapi.entityService.findMany('api::wo-cliente.wo-cliente' as any, {
        filters: {
          $or: [
            {
              correo_electronico: email,
              originPlatform: platform,
            },
            {
              externalIds: {
                $contains: { [platform]: wooId },
              },
            },
          ],
        },
      }) as any[];

      woCliente = existingWoClientes[0];
      const woExternalIds = (woCliente?.externalIds || {}) as Record<string, unknown>;
      woExternalIds[platform] = wooId;

      woClienteData = {
        nombre: nombreCompleto,
        ultima_actividad: ultimaActividad,
        fecha_registro: fechaRegistro,
        correo_electronico: email,
        pedidos,
        gasto_total: gastoTotal,
        aov,
        pais_region: paisRegion,
        ciudad,
        region,
        codigo_postal: codigoPostal,
        originPlatform: platform,
        wooId,
        skipWooSync: true, // viene desde Woo, no volver a sincronizar hacia Woo
        externalIds: woExternalIds,
        rawWooData: wooCustomer,
      };

      if (woCliente) {
        woCliente = await strapi.entityService.update('api::wo-cliente.wo-cliente' as any, woCliente.id, {
          data: woClienteData,
        });
        strapi.log.info(`[woo-webhook] WO-Cliente actualizado: ${woCliente.id} (${email}, plataforma: ${platform})`);
      } else {
        woCliente = await strapi.entityService.create('api::wo-cliente.wo-cliente' as any, {
          data: woClienteData,
        });
        strapi.log.info(`[woo-webhook] WO-Cliente creado: ${woCliente.id} (${email}, plataforma: ${platform})`);
      }
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error sincronizando WO-Cliente desde ${platform}:`, error);
      // Si falla la creación de wo-cliente, woCliente será undefined
      // pero continuamos para crear/actualizar persona de todas formas
    }

    // ============================================
    // EXTRAER DATOS DE META_DATA DE WOOCOMMERCE
    // ============================================
    const getMetaValue = (key: string): string | null => {
      if (!meta_data || !Array.isArray(meta_data)) return null;
      const meta = meta_data.find((m: any) => m.key === key);
      return meta?.value || null;
    };
    
    // Extraer datos personales desde meta_data
    const rut = getMetaValue('rut') || getMetaValue('RUT') || getMetaValue('documento') || null;
    const fechaNacimiento = getMetaValue('fecha_nacimiento') || getMetaValue('birthday') || getMetaValue('date_of_birth') || null;
    const genero = getMetaValue('genero') || getMetaValue('gender') || getMetaValue('sexo') || null;
    const telefono = billing?.phone || shipping?.phone || getMetaValue('telefono') || getMetaValue('phone') || null;
    const segundoApellido = getMetaValue('segundo_apellido') || getMetaValue('second_last_name') || null;
    
    // Normalizar RUT (remover puntos y guiones)
    const normalizeRut = (rutStr: string | null): string | null => {
      if (!rutStr) return null;
      return String(rutStr).replace(/[.\-]/g, '').trim() || null;
    };
    
    const rutNormalizado = rut ? normalizeRut(rut) : null;
    
    // Normalizar género
    const normalizeGenero = (gen: string | null): 'Mujer' | 'Hombre' | null => {
      if (!gen) return null;
      const genLower = String(gen).toLowerCase();
      if (genLower.includes('mujer') || genLower.includes('femenino') || genLower.includes('female') || genLower === 'f') {
        return 'Mujer';
      }
      if (genLower.includes('hombre') || genLower.includes('masculino') || genLower.includes('male') || genLower === 'm') {
        return 'Hombre';
      }
      return null;
    };
    
    const generoNormalizado = normalizeGenero(genero);
    
    // Normalizar fecha de nacimiento
    const normalizeFechaNacimiento = (fechaStr: string | null): string | null => {
      if (!fechaStr) return null;
      try {
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return null;
        return fecha.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      } catch {
        return null;
      }
    };
    
    const fechaNacimientoNormalizada = normalizeFechaNacimiento(fechaNacimiento);
    
    // Normalizar teléfono
    const normalizeTelefono = (tel: string | null): { telefono_norm: string; telefono_raw: string; fijo_o_movil: 'Fijo' | 'Móvil' } | null => {
      if (!tel) return null;
      const telStr = String(tel).trim();
      if (!telStr) return null;
      
      // Remover caracteres no numéricos excepto +
      const telNorm = telStr.replace(/[^\d+]/g, '');
      
      // Determinar si es fijo o móvil (Chile: móvil empieza con 9, fijo con 2)
      const fijoOMovil = telNorm.startsWith('+569') || telNorm.startsWith('9') || (telNorm.length >= 8 && telNorm[0] === '9')
        ? 'Móvil'
        : 'Fijo';
      
      return {
        telefono_norm: telNorm,
        telefono_raw: telStr,
        fijo_o_movil: fijoOMovil,
      };
    };
    
    const telefonoNormalizado = normalizeTelefono(telefono);

    // ============================================
    // BUSCAR O CREAR PERSONA
    // ============================================
    let persona = (customer as any)?.persona;
    
    if (!persona) {
      // Buscar persona por RUT (prioridad 1)
      if (rutNormalizado) {
        const personasPorRut = await strapi.entityService.findMany('api::persona.persona', {
          filters: { rut: rutNormalizado },
          limit: 1,
        });
        if (personasPorRut.length > 0) {
          persona = personasPorRut[0];
          strapi.log.info(`[woo-webhook] Persona encontrada por RUT: ${persona.id} (RUT: ${rutNormalizado})`);
        }
      }
      
      // Buscar persona por email (prioridad 2)
      if (!persona) {
        const personasPorEmail = await strapi.entityService.findMany('api::persona.persona', {
          filters: {
            emails: {
              $contains: [{ email }],
            },
          },
          limit: 1,
        });
        if (personasPorEmail.length > 0) {
          persona = personasPorEmail[0];
          strapi.log.info(`[woo-webhook] Persona encontrada por email: ${persona.id} (${email})`);
        }
      }
      
      // Crear nueva persona con TODOS los datos disponibles
      if (!persona) {
        const nombreCompleto = [first_name, last_name, segundoApellido].filter(Boolean).join(' ') || email.split('@')[0];
        const nombres = first_name || '';
        const primerApellido = last_name || '';
        
        const personaData: any = {
          nombre_completo: nombreCompleto,
          nombres: nombres,
          primer_apellido: primerApellido,
          emails: [{ 
            email: email.toLowerCase().trim(), 
            status: true,
            principal: true,
            tipo: 'Personal',
          }],
          origen: 'web',
          activo: true,
        };
        
        // Agregar RUT si existe
        if (rutNormalizado) {
          personaData.rut = rutNormalizado;
        }
        
        // Agregar segundo apellido si existe
        if (segundoApellido) {
          personaData.segundo_apellido = segundoApellido;
        }
        
        // Agregar género si existe
        if (generoNormalizado) {
          personaData.genero = generoNormalizado;
        }
        
        // Agregar fecha de nacimiento si existe
        if (fechaNacimientoNormalizada) {
          personaData.cumpleagno = fechaNacimientoNormalizada;
        }
        
        // Agregar teléfono si existe
        if (telefonoNormalizado) {
          personaData.telefonos = [{
            ...telefonoNormalizado,
            principal: true,
            status: true,
            tipo: 'Personal',
          }];
        }
        
        // Guardar identificadores externos de WooCommerce
        personaData.identificadores_externos = {
          woo_commerce: {
            [platform]: {
              customer_id: wooId,
              email: email,
              synced_at: new Date().toISOString(),
            },
          },
        };
        
        persona = await strapi.entityService.create('api::persona.persona', {
          data: personaData,
        });
        strapi.log.info(`[woo-webhook] ✅ Persona creada con datos completos: ${persona.id} (${email}, RUT: ${rutNormalizado || 'N/A'})`);
      } else {
        // Actualizar persona existente con datos adicionales de WooCommerce
        const updateData: any = {};
        let necesitaActualizacion = false;
        
        // Agregar email si no existe
        const personaEmails = (persona as any).emails || [];
        const tieneEmail = personaEmails.some((e: any) => 
          (typeof e === 'object' ? e.email : e)?.toLowerCase() === email.toLowerCase()
        );
        
        if (!tieneEmail) {
          updateData.emails = [
            ...personaEmails,
            {
              email: email.toLowerCase().trim(),
              status: true,
              principal: personaEmails.length === 0,
              tipo: 'Personal',
            },
          ];
          necesitaActualizacion = true;
        }
        
        // Agregar RUT si no existe y viene de WooCommerce
        if (rutNormalizado && !(persona as any).rut) {
          updateData.rut = rutNormalizado;
          necesitaActualizacion = true;
        }
        
        // Agregar segundo apellido si no existe
        if (segundoApellido && !(persona as any).segundo_apellido) {
          updateData.segundo_apellido = segundoApellido;
          necesitaActualizacion = true;
        }
        
        // Agregar género si no existe
        if (generoNormalizado && !(persona as any).genero) {
          updateData.genero = generoNormalizado;
          necesitaActualizacion = true;
        }
        
        // Agregar fecha de nacimiento si no existe
        if (fechaNacimientoNormalizada && !(persona as any).cumpleagno) {
          updateData.cumpleagno = fechaNacimientoNormalizada;
          necesitaActualizacion = true;
        }
        
        // Agregar teléfono si no existe
        const personaTelefonos = (persona as any).telefonos || [];
        if (telefonoNormalizado && personaTelefonos.length === 0) {
          updateData.telefonos = [{
            ...telefonoNormalizado,
            principal: true,
            status: true,
            tipo: 'Personal',
          }];
          necesitaActualizacion = true;
        }
        
        // Actualizar identificadores externos
        const identificadoresExistentes = (persona as any).identificadores_externos || {};
        updateData.identificadores_externos = {
          ...identificadoresExistentes,
          woo_commerce: {
            ...(identificadoresExistentes.woo_commerce || {}),
            [platform]: {
              customer_id: wooId,
              email: email,
              synced_at: new Date().toISOString(),
            },
          },
        };
        necesitaActualizacion = true;
        
        if (necesitaActualizacion) {
          persona = await strapi.entityService.update('api::persona.persona', persona.id, {
            data: updateData,
          });
          strapi.log.info(`[woo-webhook] ✅ Persona actualizada con datos de WooCommerce: ${persona.id} (${email})`);
        }
      }
    }
    
    // ============================================
    // VINCULAR WO-CLIENTE CON PERSONA
    // ============================================
    if (woCliente && persona) {
      const woClienteId = typeof woCliente === 'object' ? (woCliente.id || woCliente.documentId) : woCliente;
      if (woClienteId) {
        try {
          await strapi.entityService.update('api::wo-cliente.wo-cliente', woClienteId, {
            data: {
              persona: persona.id,
            },
          });
          strapi.log.info(`[woo-webhook] ✅ WO-Cliente ${woClienteId} vinculado con Persona ${persona.id}`);
        } catch (error) {
          strapi.log.warn(`[woo-webhook] Error vinculando wo-cliente con persona:`, error);
        }
      }
    }

    // Preparar datos del customer
    const customerData: any = {
      email,
      originPlatform: platform,
      externalIds,
      persona: persona.id,
      createdFromOrder: true,
    };

    if (customer) {
      // Actualizar customer existente
      customer = await strapi.entityService.update('api::customer.customer', customer.id, {
        data: customerData,
      });
      strapi.log.info(`[woo-webhook] Customer actualizado: ${customer.id} (${email})`);
    } else {
      // Crear nuevo customer
      customer = await strapi.entityService.create('api::customer.customer', {
        data: customerData,
      });
      strapi.log.info(`[woo-webhook] Customer creado: ${customer.id} (${email})`);
    }

    return customer;
  },

  /**
   * Sincroniza un pedido de WooCommerce a Strapi
   * Crea/actualiza el pedido y sincroniza los productos del pedido
   */
  async syncOrder(wooOrder: any, platform: string) {
    const { 
      id: wooOrderId, 
      number: orderNumber,
      status: orderStatus,
      date_created: dateCreated,
      date_modified: dateModified,
      total: total,
      subtotal: subtotal,
      total_tax: totalTax,
      shipping_total: shippingTotal,
      discount_total: discountTotal,
      created_via: createdVia,
      currency: currency,
      billing: billing,
      shipping: shipping,
      line_items: lineItems,
      customer_id: customerId,
      customer_note: customerNote,
      payment_method: paymentMethod,
      payment_method_title: paymentMethodTitle,
      meta_data: metaData,
    } = wooOrder;

    strapi.log.info(`[woo-webhook] Sincronizando pedido ${wooOrderId} desde ${platform}`);

    // Buscar o crear customer asociado
    let customer = null;
    if (customerId) {
      // Buscar customer por externalId
      const allCustomers = await strapi.entityService.findMany('api::customer.customer', {
        populate: ['persona'],
      }) as any[];
      
      customer = allCustomers.find((c: any) => {
        const extIds = c.externalIds || {};
        return extIds[platform] === customerId;
      });

      // Si no existe, intentar sincronizar el customer desde WooCommerce
      if (!customer && billing?.email) {
        try {
          // Aquí podrías hacer una llamada a WooCommerce para obtener el customer completo
          // Por ahora, creamos un customer básico con los datos del billing
          const customerData: any = {
            email: billing.email,
            originPlatform: platform,
            externalIds: { [platform]: customerId },
            createdFromOrder: true,
          };

          customer = await strapi.entityService.create('api::customer.customer', {
            data: customerData,
          });
          strapi.log.info(`[woo-webhook] Customer creado desde pedido: ${customer.id}`);
        } catch (error) {
          strapi.log.warn(`[woo-webhook] Error creando customer desde pedido:`, error);
        }
      }
    }

    // Procesar productos del pedido (line_items) - igual estructura que WooCommerce
    const items = [];
    if (lineItems && Array.isArray(lineItems)) {
      for (const item of lineItems) {
        const { 
          id: itemId, 
          product_id: productId, 
          sku, 
          name, 
          quantity, 
          price, 
          total: itemTotal,
          meta_data: itemMetaData,
        } = item;
        
        // Buscar libro por SKU o por externalId para relacionarlo
        let libroId = null;
        if (sku) {
          // Buscar libro por ISBN (que es el SKU)
          const libros = await strapi.entityService.findMany('api::libro.libro', {
            filters: { isbn_libro: sku },
          });
          if (libros.length > 0) {
            libroId = libros[0].id;
          }
        }

        // Si no se encuentra por SKU, buscar por externalId
        if (!libroId && productId) {
          const allLibros = await strapi.entityService.findMany('api::libro.libro') as any[];
          const libro = allLibros.find((l: any) => {
            const extIds = l.externalIds || {};
            return extIds[platform] === productId;
          });
          if (libro) {
            libroId = libro.id;
          }
        }

        // Crear item con la misma estructura que WooCommerce
        items.push({
          item_id: itemId,
          producto_id: productId,
          sku: sku || '',
          nombre: name || 'Producto sin nombre',
          cantidad: quantity || 1,
          precio_unitario: parseFloat(price) || 0,
          total: parseFloat(itemTotal) || 0,
          libro: libroId,
          metadata: itemMetaData || [],
        });
      }
    }

    // Preparar datos del pedido - misma estructura que WooCommerce
    const orderData: any = {
      numero_pedido: String(orderNumber || wooOrderId),
      estado: orderStatus || 'pending',
      fecha_creacion: dateCreated ? new Date(dateCreated) : new Date(),
      fecha_modificacion: dateModified ? new Date(dateModified) : null,
      total: parseFloat(total) || 0,
      subtotal: parseFloat(subtotal) || 0,
      impuestos: parseFloat(totalTax) || 0,
      envio: parseFloat(shippingTotal) || 0,
      descuento: parseFloat(discountTotal) || 0,
      moneda: currency || 'CLP',
      metodo_pago: paymentMethod || '',
      metodo_pago_titulo: paymentMethodTitle || '',
      nota_cliente: customerNote || '',
      items: items.length > 0 ? items : [],
      billing: billing || {},
      shipping: shipping || {},
      originPlatform: platform,
      externalIds: { [platform]: wooOrderId },
      metadata: metaData || [],
    };

    // Agregar relación con customer si existe
    if (customer) {
      orderData.customer = customer.id;
    }

    // Buscar pedido existente por externalId o número de pedido
    let pedidoExistente = null;
    try {
      // Buscar por externalId
      const allPedidos = await strapi.entityService.findMany('api::pedido.pedido' as any) as any[];
      pedidoExistente = allPedidos.find((p: any) => {
        const extIds = p.externalIds || {};
        return extIds[platform] === wooOrderId;
      });

      // Si no se encuentra por externalId, buscar por número de pedido
      if (!pedidoExistente) {
        pedidoExistente = allPedidos.find((p: any) => 
          p.numero_pedido === String(orderNumber || wooOrderId)
        );
      }
    } catch (error) {
      strapi.log.warn(`[woo-webhook] Error buscando pedido existente:`, error);
    }

    let pedido;
    try {
      if (pedidoExistente) {
        // Actualizar pedido existente
        pedido = await strapi.entityService.update('api::pedido.pedido' as any, pedidoExistente.id, {
          data: orderData,
        });
        strapi.log.info(`[woo-webhook] Pedido actualizado: ${pedido.id} (WooCommerce ID: ${wooOrderId}, Número: ${orderNumber})`);
      } else {
        // Crear nuevo pedido
        pedido = await strapi.entityService.create('api::pedido.pedido' as any, {
          data: orderData,
        });
        strapi.log.info(`[woo-webhook] Pedido creado: ${pedido.id} (WooCommerce ID: ${wooOrderId}, Número: ${orderNumber}) con ${items.length} productos`);
      }
    } catch (error) {
      strapi.log.error(`[woo-webhook] Error guardando pedido ${wooOrderId}:`, error);
      throw error;
    }

    // Además guardar/actualizar un resumen completo en WO-Pedidos (para vista tipo Woo)
    try {
      const numeroPedido = String(orderNumber || wooOrderId);
      const totalDecimal = parseFloat(total) || 0;
      const subtotalDecimal = parseFloat(subtotal) || 0;
      const impuestosDecimal = parseFloat(totalTax) || 0;
      const envioDecimal = parseFloat(shippingTotal) || 0;
      const descuentoDecimal = parseFloat(discountTotal) || 0;
      const origen =
        createdVia ||
        (billing?.email ? 'web' : 'directo');

      // Buscar cliente relacionado si existe
      let clienteId = null;
      if (customerId) {
        const woClientes = await strapi.entityService.findMany('api::wo-cliente.wo-cliente' as any, {
          filters: {
            externalIds: {
              $contains: { [platform]: customerId },
            },
            originPlatform: platform,
          },
        }) as any[];
        if (woClientes.length > 0) {
          clienteId = woClientes[0].id;
        }
      }

      const existingWoPedidos = await strapi.entityService.findMany('api::wo-pedido.wo-pedido' as any, {
        filters: {
          $or: [
            {
              externalIds: {
                $contains: { [platform]: wooOrderId },
              },
            },
            {
              numero_pedido: numeroPedido,
              originPlatform: platform,
            },
          ],
        },
        populate: ['items', 'cliente'],
      }) as any[];

      let woPedido = existingWoPedidos[0];
      const externalIdsWo = (woPedido?.externalIds || {}) as Record<string, unknown>;
      externalIdsWo[platform] = wooOrderId;

      // Preparar items para WO-Pedidos (usando el mismo formato que pedido)
      const woItems = items.map((item: any) => ({
        item_id: item.item_id,
        producto_id: item.producto_id,
        sku: item.sku,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        total: item.total,
        libro: item.libro,
        metadata: item.metadata,
      }));

      // Obtener mapper de pedidos
      let mappers: any = null;
      try {
        // Intentar obtener el servicio de mappers
        mappers = strapi.service('api::woo-sync.mappers-service');
        if (!mappers) {
          // Si no está disponible como servicio, importar directamente
          const mappersModule = require('../../woo-sync/services/mappers-service');
          mappers = mappersModule.default({ strapi });
        }
      } catch (error) {
        strapi.log.warn('[woo-webhook] Error obteniendo mappers, usando importación directa:', error);
        const mappersModule = require('../../woo-sync/services/mappers-service');
        mappers = mappersModule.default({ strapi });
      }

      // Usar mapper para mapear desde WooCommerce a Strapi
      // Esto incluye protección de campos estáticos como numero_pedido
      const woPedidoData = mappers?.order?.mapWooOrderToWoPedido(
        wooOrder,
        platform as 'woo_moraleja' | 'woo_escolar',
        woPedido
      ) || {};

      // Agregar campos adicionales que no están en el mapper
      woPedidoData.items = woItems;
      woPedidoData.originPlatform = platform;
      // NO guardar skipWooSync en data - usar __skipWooSync en params
      
      // Asegurar que externalIds y wooId estén actualizados
      woPedidoData.externalIds = externalIdsWo;
      woPedidoData.wooId = wooOrderId;

      // Agregar relación con cliente si existe
      if (clienteId) {
        woPedidoData.cliente = clienteId;
      }

      if (woPedido) {
        woPedido = await strapi.entityService.update('api::wo-pedido.wo-pedido' as any, woPedido.id, {
          data: woPedidoData,
          __skipWooSync: true, // viene desde Woo, no sincronizar de vuelta
        });
        strapi.log.info(
          `[woo-webhook] WO-Pedido actualizado: ${woPedido.id} (Woo ID: ${wooOrderId}, Número: ${numeroPedido}) con ${woItems.length} items`
        );
      } else {
        woPedido = await strapi.entityService.create('api::wo-pedido.wo-pedido' as any, {
          data: woPedidoData,
          __skipWooSync: true, // viene desde Woo, no sincronizar de vuelta
        });
        strapi.log.info(
          `[woo-webhook] WO-Pedido creado: ${woPedido.id} (Woo ID: ${wooOrderId}, Número: ${numeroPedido}) con ${woItems.length} items`
        );
      }
    } catch (error) {
      strapi.log.warn('[woo-webhook] Error sincronizando WO-Pedido:', error);
    }

    return pedido;
  },

  /**
   * Obtiene la configuración de WooCommerce según la plataforma
   */
  getWooConfig(platform: 'woo_moraleja' | 'woo_escolar') {
    const configs: Record<string, any> = {
      woo_moraleja: {
        url: process.env.WOO_MORALEJA_URL,
        consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY,
        consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET,
      },
      woo_escolar: {
        url: process.env.WOO_ESCOLAR_URL,
        consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY,
        consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET,
      },
    };
    
    const config = configs[platform];
    if (!config || !config.url || !config.consumerKey || !config.consumerSecret) {
      return null;
    }
    
    return config;
  },

  /**
   * Sincroniza un cupón de WooCommerce a Strapi (WO-Cupones)
   * Usa el mapper para mapear todos los campos de forma consistente
   */
  async syncCoupon(wooCoupon: any, platform: string) {
    if (!wooCoupon.code) {
      throw new Error('Cupón sin código');
    }

    // Obtener mapper de cupones
    let mappers: any = null;
    try {
      // Intentar obtener el servicio de mappers
      mappers = strapi.service('api::woo-sync.mappers-service');
      if (!mappers) {
        // Si no está disponible como servicio, importar directamente
        const mappersModule = require('../../woo-sync/services/mappers-service');
        mappers = mappersModule.default({ strapi });
      }
    } catch (error) {
      strapi.log.warn('[woo-webhook] Error obteniendo mappers, usando importación directa:', error);
      const mappersModule = require('../../woo-sync/services/mappers-service');
      mappers = mappersModule.default({ strapi });
    }
    
    if (!mappers || !mappers.coupon) {
      throw new Error('Mapper de cupones no disponible');
    }

    // Buscar cupón existente por externalIds o código
    const existingCupones = await strapi.entityService.findMany('api::wo-cupon.wo-cupon' as any, {
      filters: {
        $or: [
          {
            externalIds: {
              $contains: { [platform]: wooCoupon.id },
            },
          },
          {
            codigo: wooCoupon.code,
            originPlatform: platform,
          },
        ],
      },
    }) as any[];

    const cuponExistente = existingCupones[0];

    // Usar mapper para mapear desde WooCommerce a Strapi
    // Esto incluye protección de campos estáticos como código
    const cuponData = mappers.coupon.mapWooCouponToWoCupon(
      wooCoupon,
      platform as 'woo_moraleja' | 'woo_escolar',
      cuponExistente
    );

    // Agregar flag para evitar sincronización circular
    cuponData.skipWooSync = true;

    let cupon;
    if (cuponExistente) {
      cupon = await strapi.entityService.update('api::wo-cupon.wo-cupon' as any, cuponExistente.id, {
        data: cuponData,
      });
      strapi.log.info(`[woo-webhook] Cupón actualizado: ${cupon.id} (WooCommerce ID: ${wooCoupon.id}, código: ${wooCoupon.code})`);
    } else {
      cupon = await strapi.entityService.create('api::wo-cupon.wo-cupon' as any, {
        data: cuponData,
      });
      strapi.log.info(`[woo-webhook] Cupón creado: ${cupon.id} (WooCommerce ID: ${wooCoupon.id}, código: ${wooCoupon.code})`);
    }

    return cupon;
  },

  /**
   * Sincroniza un término de atributo desde WooCommerce a Strapi
   * Útil cuando se crea/actualiza un término en WooCommerce y no se activa el webhook automáticamente
   * 
   * @param platform - 'woo_moraleja' o 'woo_escolar'
   * @param attributeName - Nombre del atributo (ej: "Autor", "Obra", "Editorial")
   * @param termName - Nombre del término (ej: "Gabriel García Márquez")
   * @param termObject - (Opcional) Objeto del término completo de WooCommerce. Si se proporciona, evita buscar el término nuevamente.
   */
  async syncTermFromWooCommerce(
    platform: 'woo_moraleja' | 'woo_escolar', 
    attributeName: string, 
    termName: string,
    termObject?: any
  ) {
    strapi.log.info(`[woo-webhook] Iniciando sincronización manual de término: "${termName}" del atributo "${attributeName}" desde ${platform}`);
    
    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    let termDetails = termObject;
    let attribute = termObject ? { id: termObject.attribute_id || null } : null;

    // Si no se proporciona el objeto del término, buscarlo
    if (!termDetails) {
      // 1. Buscar el atributo en WooCommerce
      attribute = await this.findAttributeByName(wooConfig, attributeName);
      if (!attribute || !attribute.id) {
        throw new Error(`Atributo "${attributeName}" no encontrado en WooCommerce`);
      }

      strapi.log.info(`[woo-webhook] Atributo encontrado: "${attributeName}" (ID: ${attribute.id})`);

      // 2. Obtener detalles del término desde WooCommerce
      termDetails = await this.getTermDetails(wooConfig, attribute.id, termName);
      if (!termDetails) {
        // Si el término no existe en WooCommerce, no es un error crítico en sincronización periódica
        // Solo loguear como warning y retornar null
        strapi.log.warn(`[woo-webhook] Término "${termName}" no encontrado en el atributo "${attributeName}" en WooCommerce. Puede que solo exista en Strapi.`);
        return null;
      }
    } else {
      // Si se proporciona el objeto, usar el attribute_id del término
      if (!attribute && termDetails.attribute_id) {
        attribute = { id: termDetails.attribute_id };
      }
    }

    const termDescription = termDetails.description || null;
    strapi.log.info(`[woo-webhook] Término encontrado: "${termName}" con descripción: ${termDescription ? 'Sí' : 'No'}`);

    // 3. Sincronizar a Strapi según el tipo de atributo
    let result;
    switch (attributeName.toLowerCase()) {
      case 'autor':
        result = await this.findOrCreateAutor(termName, termDescription);
        strapi.log.info(`[woo-webhook] ✅ Autor sincronizado: "${termName}" → ID: ${result || 'null'}`);
        break;
      
      case 'obra':
        result = await this.findOrCreateObra(termName, termDescription);
        strapi.log.info(`[woo-webhook] ✅ Obra sincronizada: "${termName}" → ID: ${result || 'null'}`);
        break;
      
      case 'editorial':
        // Las editoriales no tienen descripción por ahora
        result = await this.findOrCreateEditorial(termName);
        strapi.log.info(`[woo-webhook] ✅ Editorial sincronizada: "${termName}" → ID: ${result || 'null'}`);
        break;
      
      case 'sello':
        result = await this.findOrCreateSello(termName);
        strapi.log.info(`[woo-webhook] ✅ Sello sincronizado: "${termName}" → ID: ${result || 'null'}`);
        break;
      
      case 'colección':
      case 'coleccion':
        result = await this.findOrCreateColeccion(termName);
        strapi.log.info(`[woo-webhook] ✅ Colección sincronizada: "${termName}" → ID: ${result || 'null'}`);
        break;
      
      default:
        throw new Error(`Tipo de atributo "${attributeName}" no soportado para sincronización manual`);
    }

      return {
        success: true,
        platform,
        attributeName,
        termName,
        termDescription,
        strapiId: result,
        wooAttributeId: attribute.id,
        wooTermId: termDetails.id,
      };
  },

  /**
   * Sincroniza todos los términos de atributos bidireccionalmente
   * Evita bucles infinitos usando comparación de timestamps
   * 
   * @param platform - 'woo_moraleja' o 'woo_escolar'
   * @param options - Opciones de sincronización
   */
  async syncAllTerms(platform: 'woo_moraleja' | 'woo_escolar', options: {
    recentHours?: number;
    attributeTypes?: string[];
    dryRun?: boolean;
  } = {}) {
    // Si no se especifica recentHours, usar 24 horas por defecto
    // Pero si se ejecuta cada 2 horas, se recomienda usar recentHours=3 para capturar cambios con margen
    const { recentHours = 24, attributeTypes, dryRun = false } = options;
    
    strapi.log.info(`[sync-all] Iniciando sincronización periódica para ${platform}`, {
      recentHours,
      attributeTypes: attributeTypes || 'todos',
      dryRun,
      nota: 'Solo sincronizará cambios recientes, no re-sincronizará todo desde cero',
    });

    const wooConfig = this.getWooConfig(platform);
    if (!wooConfig) {
      throw new Error(`Configuración de WooCommerce no encontrada para ${platform}`);
    }

    const results = {
      wooToStrapi: {
        nuevos: 0,
        actualizados: 0,
        omitidos: 0,
        errores: 0,
      },
      strapiToWoo: {
        nuevos: 0,
        actualizados: 0,
        omitidos: 0,
        errores: 0,
      },
    };

    // Atributos a sincronizar
    const attributesToSync = attributeTypes || ['Autor', 'Obra', 'Editorial', 'Sello', 'Colección'];
    
    // 1. Sincronizar desde WooCommerce → Strapi
    strapi.log.info(`[sync-all] Sincronizando términos desde WooCommerce → Strapi`);
    for (const attributeName of attributesToSync) {
      try {
        const result = await this.syncTermsFromWooToStrapi(wooConfig, platform, attributeName, recentHours, dryRun);
        results.wooToStrapi.nuevos += result.nuevos;
        results.wooToStrapi.actualizados += result.actualizados;
        results.wooToStrapi.omitidos += result.omitidos;
        results.wooToStrapi.errores += result.errores;
      } catch (error) {
        strapi.log.error(`[sync-all] Error sincronizando ${attributeName} desde WooCommerce:`, error);
        results.wooToStrapi.errores++;
      }
    }

    // 2. Sincronizar desde Strapi → WooCommerce
    strapi.log.info(`[sync-all] Sincronizando términos desde Strapi → WooCommerce`);
    for (const attributeName of attributesToSync) {
      try {
        const result = await this.syncTermsFromStrapiToWoo(wooConfig, platform, attributeName, recentHours, dryRun);
        results.strapiToWoo.nuevos += result.nuevos;
        results.strapiToWoo.actualizados += result.actualizados;
        results.strapiToWoo.omitidos += result.omitidos;
        results.strapiToWoo.errores += result.errores;
      } catch (error) {
        strapi.log.error(`[sync-all] Error sincronizando ${attributeName} desde Strapi:`, error);
        results.strapiToWoo.errores++;
      }
    }

    const totalSincronizados = 
      results.wooToStrapi.nuevos + results.wooToStrapi.actualizados +
      results.strapiToWoo.nuevos + results.strapiToWoo.actualizados;

    strapi.log.info(`[sync-all] ✅ Sincronización completada: ${totalSincronizados} términos sincronizados`, results);

    return {
      success: true,
      platform,
      results,
      summary: {
        totalSincronizados,
        totalOmitidos: results.wooToStrapi.omitidos + results.strapiToWoo.omitidos,
        totalErrores: results.wooToStrapi.errores + results.strapiToWoo.errores,
      },
    };
  },

  /**
   * Sincroniza términos desde WooCommerce a Strapi
   */
  async syncTermsFromWooToStrapi(
    wooConfig: any,
    platform: string,
    attributeName: string,
    recentHours: number,
    dryRun: boolean
  ) {
    const results = { nuevos: 0, actualizados: 0, omitidos: 0, errores: 0 };

    try {
      // Buscar atributo en WooCommerce
      const attribute = await this.findAttributeByName(wooConfig, attributeName);
      if (!attribute || !attribute.id) {
        strapi.log.warn(`[sync-all] Atributo "${attributeName}" no encontrado en WooCommerce`);
        return results;
      }

      // Obtener todos los términos del atributo (con paginación optimizada)
      const auth = Buffer.from(`${wooConfig.consumerKey}:${wooConfig.consumerSecret}`).toString('base64');
      let allTerms: any[] = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      // Obtener términos con paginación
      while (hasMore) {
        const response = await fetch(
          `${wooConfig.url}/wp-json/wc/v3/products/attributes/${attribute.id}/terms?per_page=${perPage}&page=${page}`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Error obteniendo términos: ${response.status}`);
        }

        const termsData = await response.json() as any;
        const terms = Array.isArray(termsData) ? termsData : (termsData?.data || []);
        
        allTerms = allTerms.concat(terms);
        
        // Si obtenemos menos términos que perPage, no hay más páginas
        hasMore = terms.length === perPage;
        page++;
      }

      const terms = allTerms;

      // Filtrar términos recientes (solo cambios de las últimas X horas)
      const cutoffDate = new Date(Date.now() - recentHours * 60 * 60 * 1000);
      const recentTerms = terms.filter((term: any) => {
        if (!term.date_modified && !term.date_created) {
          // Si no tiene fecha, verificar si existe en Strapi
          // Si no existe, incluir (es nuevo); si existe, omitir (ya está sincronizado)
          return true; // Se verificará en shouldSyncFromWooToStrapi
        }
        const termDate = term.date_modified || term.date_created;
        return new Date(termDate) >= cutoffDate;
      });

      strapi.log.info(`[sync-all] Atributo "${attributeName}": ${recentTerms.length} términos recientes (últimas ${recentHours}h) de ${terms.length} totales`);
      strapi.log.info(`[sync-all] Solo se sincronizarán cambios nuevos o modificados, no se re-sincronizará todo`);

      // Sincronizar cada término
      for (const term of recentTerms) {
        try {
          const shouldSync = await this.shouldSyncFromWooToStrapi(attributeName, term);
          
          if (!shouldSync) {
            results.omitidos++;
            continue;
          }

          if (dryRun) {
            strapi.log.info(`[sync-all] [DRY RUN] Sincronizaría término: "${term.name}"`);
            results.nuevos++;
            continue;
          }

          // Sincronizar término usando el método existente (pasar el objeto term completo para evitar búsqueda redundante)
          const syncResult = await this.syncTermFromWooCommerce(
            platform as 'woo_moraleja' | 'woo_escolar', 
            attributeName, 
            term.name,
            term // Pasar el objeto completo
          );
          
          // Si el término no existe en WooCommerce (solo en Strapi), no es un error
          if (syncResult === null) {
            results.omitidos++;
            continue;
          }
          
          // Determinar si es nuevo o actualizado
          const exists = await this.termExistsInStrapi(attributeName, term.name);
          if (exists) {
            results.actualizados++;
          } else {
            results.nuevos++;
          }
        } catch (error) {
          strapi.log.error(`[sync-all] Error sincronizando término "${term.name}":`, error);
          results.errores++;
        }
      }
    } catch (error) {
      strapi.log.error(`[sync-all] Error en syncTermsFromWooToStrapi:`, error);
      throw error;
    }

    return results;
  },

  /**
   * Sincroniza términos desde Strapi a WooCommerce
   */
  async syncTermsFromStrapiToWoo(
    wooConfig: any,
    platform: string,
    attributeName: string,
    recentHours: number,
    dryRun: boolean
  ) {
    const results = { nuevos: 0, actualizados: 0, omitidos: 0, errores: 0 };

    try {
      // Obtener entidades de Strapi según el tipo de atributo
      const entities = await this.getStrapiEntitiesForAttribute(attributeName, recentHours);
      
      strapi.log.info(`[sync-all] Atributo "${attributeName}": ${entities.length} entidades recientes en Strapi`);

      // Buscar atributo en WooCommerce
      const attribute = await this.findAttributeByName(wooConfig, attributeName);
      if (!attribute || !attribute.id) {
        strapi.log.warn(`[sync-all] Atributo "${attributeName}" no encontrado en WooCommerce`);
        return results;
      }

      // Sincronizar cada entidad
      for (const entity of entities) {
        try {
          const termName = this.getTermNameFromEntity(attributeName, entity);
          if (!termName) continue;

          const shouldSync = await this.shouldSyncFromStrapiToWoo(wooConfig, attribute.id, attributeName, entity, termName);
          
          if (!shouldSync) {
            results.omitidos++;
            continue;
          }

          if (dryRun) {
            strapi.log.info(`[sync-all] [DRY RUN] Sincronizaría término: "${termName}"`);
            results.nuevos++;
            continue;
          }

          // Sincronizar usando el servicio de woo-sync
          const wooSyncService = strapi.service('api::woo-sync.woo-sync');
          if (wooSyncService) {
            // Obtener o crear término en WooCommerce
            await wooSyncService.getOrCreateAttributeTerm(
              wooConfig,
              attribute.id,
              termName,
              this.getTermDescriptionFromEntity(attributeName, entity)
            );
            
            results.actualizados++;
          }
        } catch (error) {
          strapi.log.error(`[sync-all] Error sincronizando entidad ${entity.id}:`, error);
          results.errores++;
        }
      }
    } catch (error) {
      strapi.log.error(`[sync-all] Error en syncTermsFromStrapiToWoo:`, error);
      throw error;
    }

    return results;
  },

  /**
   * Determina si se debe sincronizar un término desde WooCommerce a Strapi
   * Evita bucles infinitos verificando timestamps
   * Solo sincroniza si:
   * - El término no existe en Strapi (nuevo)
   * - El término existe pero WooCommerce tiene versión más reciente
   * - La descripción cambió
   */
  async shouldSyncFromWooToStrapi(attributeName: string, wooTerm: any): Promise<boolean> {
    // Verificar si el término existe en Strapi
    const entity = await this.findEntityByTermName(attributeName, wooTerm.name);
    
    if (!entity) {
      // No existe en Strapi → Es nuevo, sincronizar
      strapi.log.debug(`[sync-all] Término "${wooTerm.name}" no existe en Strapi → Sincronizar (nuevo)`);
      return true;
    }

    // Verificar timestamp (si Strapi tiene una versión más reciente, no sincronizar)
    const strapiUpdatedAt = new Date(entity.updatedAt || entity.createdAt);
    const wooUpdatedAt = new Date(wooTerm.date_modified || wooTerm.date_created);
    
    if (strapiUpdatedAt > wooUpdatedAt) {
      // Strapi tiene versión más reciente → Ya está actualizado, no sincronizar
      strapi.log.debug(`[sync-all] Término "${wooTerm.name}" omitido: Strapi tiene versión más reciente (${strapiUpdatedAt.toISOString()} > ${wooUpdatedAt.toISOString()})`);
      return false;
    }

    // Verificar si la descripción cambió
    const wooDescription = wooTerm.description || '';
    const strapiDescription = this.getDescriptionFromEntity(attributeName, entity) || '';
    
    if (wooDescription === strapiDescription && strapiUpdatedAt >= wooUpdatedAt) {
      // Sin cambios → Ya está sincronizado, no sincronizar
      strapi.log.debug(`[sync-all] Término "${wooTerm.name}" omitido: Sin cambios (descripción igual y timestamps iguales o Strapi más reciente)`);
      return false;
    }

    // Hay cambios → Sincronizar
    strapi.log.debug(`[sync-all] Término "${wooTerm.name}" necesita sincronización: WooCommerce tiene cambios más recientes`);
    return true;
  },

  /**
   * Determina si se debe sincronizar un término desde Strapi a WooCommerce
   * Solo sincroniza si:
   * - El término no existe en WooCommerce (nuevo)
   * - El término existe pero Strapi tiene versión más reciente
   * - La descripción cambió
   */
  async shouldSyncFromStrapiToWoo(
    wooConfig: any,
    attributeId: number,
    attributeName: string,
    strapiEntity: any,
    termName: string
  ): Promise<boolean> {
    // Obtener término de WooCommerce
    const wooTerm = await this.getTermDetails(wooConfig, attributeId, termName);
    
    if (!wooTerm) {
      // No existe en WooCommerce → Es nuevo, sincronizar
      strapi.log.debug(`[sync-all] Término "${termName}" no existe en WooCommerce → Sincronizar (nuevo)`);
      return true;
    }

    // Verificar timestamp
    const strapiUpdatedAt = new Date(strapiEntity.updatedAt || strapiEntity.createdAt);
    const wooUpdatedAt = new Date(wooTerm.date_modified || wooTerm.date_created);
    
    if (wooUpdatedAt > strapiUpdatedAt) {
      // WooCommerce tiene versión más reciente → Ya está actualizado, no sincronizar
      strapi.log.debug(`[sync-all] Término "${termName}" omitido: WooCommerce tiene versión más reciente (${wooUpdatedAt.toISOString()} > ${strapiUpdatedAt.toISOString()})`);
      return false;
    }

    // Verificar si la descripción cambió
    const strapiDescription = this.getDescriptionFromEntity(attributeName, strapiEntity) || '';
    const wooDescription = wooTerm.description || '';
    
    if (strapiDescription === wooDescription && wooUpdatedAt >= strapiUpdatedAt) {
      // Sin cambios → Ya está sincronizado, no sincronizar
      strapi.log.debug(`[sync-all] Término "${termName}" omitido: Sin cambios (descripción igual y timestamps iguales o WooCommerce más reciente)`);
      return false;
    }

    // Hay cambios → Sincronizar
    strapi.log.debug(`[sync-all] Término "${termName}" necesita sincronización: Strapi tiene cambios más recientes`);
    return true;
  },

  /**
   * Helper: Obtener entidades de Strapi según el tipo de atributo
   */
  async getStrapiEntitiesForAttribute(attributeName: string, recentHours: number): Promise<any[]> {
    const cutoffDate = new Date(Date.now() - recentHours * 60 * 60 * 1000);
    
    // Campos mínimos necesarios para la sincronización (optimización)
    // Usamos type assertion para evitar errores de TypeScript con fields
    const commonFields = ['id', 'updatedAt', 'createdAt'];
    
    switch (attributeName.toLowerCase()) {
      case 'autor':
        return await strapi.entityService.findMany('api::autor.autor', {
          filters: {
            updatedAt: { $gte: cutoffDate.toISOString() },
          },
          fields: [...commonFields, 'nombre_completo_autor', 'resegna'] as any,
          limit: 1000,
        }) as any[];
      
      case 'obra':
        return await strapi.entityService.findMany('api::obra.obra', {
          filters: {
            updatedAt: { $gte: cutoffDate.toISOString() },
          },
          fields: [...commonFields, 'nombre_obra', 'descripcion'] as any,
          limit: 1000,
        }) as any[];
      
      case 'editorial':
        return await strapi.entityService.findMany('api::editorial.editorial', {
          filters: {
            updatedAt: { $gte: cutoffDate.toISOString() },
          },
          fields: [...commonFields, 'nombre_editorial'] as any,
          limit: 1000,
        }) as any[];
      
      case 'sello':
        return await strapi.entityService.findMany('api::sello.sello', {
          filters: {
            updatedAt: { $gte: cutoffDate.toISOString() },
          },
          fields: [...commonFields, 'nombre_sello'] as any,
          limit: 1000,
        }) as any[];
      
      case 'colección':
      case 'coleccion':
        return await strapi.entityService.findMany('api::coleccion.coleccion', {
          filters: {
            updatedAt: { $gte: cutoffDate.toISOString() },
          },
          fields: [...commonFields, 'nombre_coleccion'] as any,
          limit: 1000,
        }) as any[];
      
      default:
        return [];
    }
  },

  /**
   * Helper: Obtener nombre del término desde entidad de Strapi
   */
  getTermNameFromEntity(attributeName: string, entity: any): string | null {
    switch (attributeName.toLowerCase()) {
      case 'autor':
        return entity.nombre_completo_autor || null;
      case 'obra':
        return entity.nombre_obra || null;
      case 'editorial':
        return entity.nombre_editorial || null;
      case 'sello':
        return entity.nombre_sello || null;
      case 'colección':
      case 'coleccion':
        return entity.nombre_coleccion || null;
      default:
        return null;
    }
  },

  /**
   * Helper: Obtener descripción del término desde entidad de Strapi
   */
  getTermDescriptionFromEntity(attributeName: string, entity: any): string | null {
    switch (attributeName.toLowerCase()) {
      case 'autor':
        // Convertir blocks a texto
        if (entity.resegna && Array.isArray(entity.resegna)) {
          return entity.resegna
            .map((block: any) => {
              if (block.children) {
                return block.children.map((child: any) => child.text || '').join('');
              }
              return '';
            })
            .filter((text: string) => text.trim())
            .join('\n');
        }
        return null;
      case 'obra':
        return entity.descripcion || null;
      default:
        return null;
    }
  },

  /**
   * Helper: Obtener descripción desde entidad (para comparación)
   */
  getDescriptionFromEntity(attributeName: string, entity: any): string | null {
    return this.getTermDescriptionFromEntity(attributeName, entity);
  },

  /**
   * Helper: Buscar entidad por nombre de término
   */
  async findEntityByTermName(attributeName: string, termName: string): Promise<any | null> {
    switch (attributeName.toLowerCase()) {
      case 'autor':
        const autores = await strapi.entityService.findMany('api::autor.autor', {
          filters: {
            nombre_completo_autor: { $eqi: termName },
          },
          limit: 1,
        }) as any[];
        return autores[0] || null;
      
      case 'obra':
        const obras = await strapi.entityService.findMany('api::obra.obra', {
          filters: {
            nombre_obra: { $eqi: termName },
          },
          limit: 1,
        }) as any[];
        return obras[0] || null;
      
      case 'editorial':
        const editoriales = await strapi.entityService.findMany('api::editorial.editorial', {
          filters: {
            nombre_editorial: { $eqi: termName },
          },
          limit: 1,
        }) as any[];
        return editoriales[0] || null;
      
      case 'sello':
        const sellos = await strapi.entityService.findMany('api::sello.sello', {
          filters: {
            nombre_sello: { $eqi: termName },
          },
          limit: 1,
        }) as any[];
        return sellos[0] || null;
      
      case 'colección':
      case 'coleccion':
        const colecciones = await strapi.entityService.findMany('api::coleccion.coleccion', {
          filters: {
            nombre_coleccion: { $eqi: termName },
          },
          limit: 1,
        }) as any[];
        return colecciones[0] || null;
      
      default:
        return null;
    }
  },

  /**
   * Helper: Verificar si término existe en Strapi
   */
  async termExistsInStrapi(attributeName: string, termName: string): Promise<boolean> {
    const entity = await this.findEntityByTermName(attributeName, termName);
    return !!entity;
  },
}));



