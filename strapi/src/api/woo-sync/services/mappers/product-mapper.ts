/**
 * Servicio de mapeo para Productos (Libros) entre Strapi y WooCommerce
 */

export default ({ strapi }) => ({
  /**
   * Mapea un libro de Strapi a formato WooCommerce
   * Mapea TODOS los campos disponibles en el schema de libro
   */
  async mapLibroToWooProduct(libro: any, platform: 'woo_moraleja' | 'woo_escolar'): Promise<any> {
    const wooProduct: any = {
      name: libro.nombre_libro || '',
      type: 'simple',
      sku: libro.isbn_libro || '', // ISBN es el SKU en WooCommerce
      status: 'publish',
    };
    
    // ============================================
    // CAMPOS BÁSICOS
    // ============================================
    
    // Subtítulo (si existe, agregarlo al nombre o como meta)
    if (libro.subtitulo_libro) {
      // Opción 1: Agregar al nombre
      // wooProduct.name = `${libro.nombre_libro} - ${libro.subtitulo_libro}`;
      // Opción 2: Guardar en meta_data (recomendado)
      wooProduct.meta_data = wooProduct.meta_data || [];
      wooProduct.meta_data.push({
        key: 'subtitulo_libro',
        value: libro.subtitulo_libro,
      });
    }

    // Descripciones
    if (libro.descripcion) {
      // Si es blocks (RichText), convertir a HTML
      if (Array.isArray(libro.descripcion)) {
        wooProduct.description = this.blocksToHtml(libro.descripcion);
      } else {
        wooProduct.description = libro.descripcion;
      }
    }
    
    // ============================================
    // PRECIOS
    // ============================================
    // Prioridad: precio > precio_regular
    if (libro.precio !== undefined && libro.precio !== null) {
      wooProduct.regular_price = String(libro.precio);
      // También actualizar precio_regular para mantener consistencia
      if (!libro.precio_regular) {
        libro.precio_regular = libro.precio;
      }
    } else if (libro.precio_regular !== undefined && libro.precio_regular !== null) {
      wooProduct.regular_price = String(libro.precio_regular);
    }
    
    if (libro.precio_oferta !== undefined && libro.precio_oferta !== null) {
      wooProduct.sale_price = String(libro.precio_oferta);
    }

    // ============================================
    // STOCK
    // ============================================
    if (libro.manage_stock !== undefined) {
      wooProduct.manage_stock = libro.manage_stock;
    } else {
      // Auto-determinar: gestionar stock si hay cantidad definida
      wooProduct.manage_stock = libro.stock_quantity !== undefined && libro.stock_quantity !== null;
    }
    
    if (libro.stock_quantity !== undefined && libro.stock_quantity !== null) {
      wooProduct.stock_quantity = libro.stock_quantity;
    }
    
    if (libro.stock_status) {
      wooProduct.stock_status = libro.stock_status;
    } else if (libro.stock_quantity !== undefined) {
      // Auto-determinar estado basado en cantidad
      wooProduct.stock_status = libro.stock_quantity > 0 ? 'instock' : 'outofstock';
    }

    // ============================================
    // DIMENSIONES Y PESO
    // ============================================
    if (libro.weight !== undefined && libro.weight !== null) {
      wooProduct.weight = String(libro.weight);
    }
    
    if (libro.length !== undefined && libro.length !== null) {
      wooProduct.length = String(libro.length);
    }
    
    if (libro.width !== undefined && libro.width !== null) {
      wooProduct.width = String(libro.width);
    }
    
    if (libro.height !== undefined && libro.height !== null) {
      wooProduct.height = String(libro.height);
    }

    // ============================================
    // IMÁGENES
    // ============================================
    wooProduct.images = [];
    
    // Portada principal
    if (libro.portada_libro) {
      const imageUrl = this.getImageUrl(libro.portada_libro);
      if (imageUrl) {
        wooProduct.images.push({
          src: imageUrl,
          alt: libro.nombre_libro || 'Portada del libro',
        });
      }
    }
    
    // Imágenes del interior
    if (libro.imagenes_interior && Array.isArray(libro.imagenes_interior)) {
      for (const imagen of libro.imagenes_interior) {
        const imageUrl = this.getImageUrl(imagen);
        if (imageUrl) {
          wooProduct.images.push({
            src: imageUrl,
            alt: `${libro.nombre_libro} - Imagen interior`,
          });
        }
      }
    }

    // ============================================
    // ESTADO Y VISIBILIDAD
    // ============================================
    // Status basado en estado_publicacion
    if (libro.estado_publicacion) {
      switch (libro.estado_publicacion) {
        case 'Publicado':
          wooProduct.status = 'publish';
          break;
        case 'Pendiente':
          wooProduct.status = 'pending';
          break;
        case 'Borrador':
          wooProduct.status = 'draft';
          break;
        default:
          wooProduct.status = 'publish';
      }
    }
    
    if (libro.featured !== undefined) {
      wooProduct.featured = libro.featured;
    }
    
    if (libro.catalog_visibility) {
      wooProduct.catalog_visibility = libro.catalog_visibility;
    }
    
    if (libro.virtual !== undefined) {
      wooProduct.virtual = libro.virtual;
    }
    
    if (libro.downloadable !== undefined) {
      wooProduct.downloadable = libro.downloadable;
    }

    // ============================================
    // IMPUESTOS
    // ============================================
    if (libro.tax_status) {
      wooProduct.tax_status = libro.tax_status;
    }
    
    if (libro.tax_class) {
      wooProduct.tax_class = libro.tax_class;
    }

    // ============================================
    // METADATOS ADICIONALES
    // ============================================
    wooProduct.meta_data = wooProduct.meta_data || [];
    
    // Guardar ISBN en meta_data (backup)
    if (libro.isbn_libro) {
      wooProduct.meta_data.push({
        key: 'isbn',
        value: String(libro.isbn_libro),
      });
    }
    
    // Guardar información de edición
    if (libro.numero_edicion) {
      wooProduct.meta_data.push({
        key: 'numero_edicion',
        value: String(libro.numero_edicion),
      });
    }
    
    if (libro.agno_edicion) {
      wooProduct.meta_data.push({
        key: 'agno_edicion',
        value: String(libro.agno_edicion),
      });
    }
    
    if (libro.idioma) {
      wooProduct.meta_data.push({
        key: 'idioma',
        value: libro.idioma,
      });
    }
    
    if (libro.tipo_libro) {
      wooProduct.meta_data.push({
        key: 'tipo_libro',
        value: libro.tipo_libro,
      });
    }
    
    if (libro.estado_edicion) {
      wooProduct.meta_data.push({
        key: 'estado_edicion',
        value: libro.estado_edicion,
      });
    }
    
    // IDs de relaciones (obtener desde las relaciones directamente)
    if (libro.autor_relacion) {
      const autorId = typeof libro.autor_relacion === 'object' 
        ? (libro.autor_relacion.id || libro.autor_relacion.documentId)
        : libro.autor_relacion;
      if (autorId) {
        wooProduct.meta_data.push({
          key: 'id_autor',
          value: String(autorId),
        });
      }
    }
    
    if (libro.editorial) {
      const editorialId = typeof libro.editorial === 'object' 
        ? (libro.editorial.id || libro.editorial.documentId)
        : libro.editorial;
      if (editorialId) {
        wooProduct.meta_data.push({
          key: 'id_editorial',
          value: String(editorialId),
        });
      }
    }
    
    if (libro.sello) {
      const selloId = typeof libro.sello === 'object' 
        ? (libro.sello.id || libro.sello.documentId)
        : libro.sello;
      if (selloId) {
        wooProduct.meta_data.push({
          key: 'id_sello',
          value: String(selloId),
        });
      }
    }
    
    if (libro.coleccion) {
      const coleccionId = typeof libro.coleccion === 'object' 
        ? (libro.coleccion.id || libro.coleccion.documentId)
        : libro.coleccion;
      if (coleccionId) {
        wooProduct.meta_data.push({
          key: 'id_coleccion',
          value: String(coleccionId),
        });
      }
    }
    
    if (libro.obra) {
      const obraId = typeof libro.obra === 'object' 
        ? (libro.obra.id || libro.obra.documentId)
        : libro.obra;
      if (obraId) {
        wooProduct.meta_data.push({
          key: 'id_obra',
          value: String(obraId),
        });
      }
    }

    // Categorías, tags, atributos se mapean en otros servicios
    // para mantener la separación de responsabilidades

    return wooProduct;
  },
  
  /**
   * Helper: Obtiene URL de imagen desde diferentes formatos
   */
  getImageUrl(imagen: any): string | null {
    if (!imagen) return null;
    
    if (typeof imagen === 'string') {
      return imagen;
    }
    
    if (imagen.url) {
      return imagen.url;
    }
    
    if (imagen.data) {
      const data = imagen.data;
      if (data.url) return data.url;
      if (data.formats) {
        if (data.formats.large?.url) return data.formats.large.url;
        if (data.formats.medium?.url) return data.formats.medium.url;
        if (data.formats.small?.url) return data.formats.small.url;
      }
    }
    
    if (imagen.formats) {
      if (imagen.formats.large?.url) return imagen.formats.large.url;
      if (imagen.formats.medium?.url) return imagen.formats.medium.url;
      if (imagen.formats.small?.url) return imagen.formats.small.url;
    }
    
    return null;
  },
  
  /**
   * Helper: Convierte blocks (RichText) a HTML
   */
  blocksToHtml(blocks: any[]): string {
    if (!Array.isArray(blocks)) return '';
    
    return blocks.map((block: any) => {
      if (block.type === 'paragraph') {
        return `<p>${block.children?.map((c: any) => c.text || '').join('') || ''}</p>`;
      }
      if (block.type === 'heading') {
        const level = block.level || 1;
        const text = block.children?.map((c: any) => c.text || '').join('') || '';
        return `<h${level}>${text}</h${level}>`;
      }
      if (block.type === 'list') {
        const items = block.children?.map((c: any) => `<li>${c.children?.map((cc: any) => cc.text || '').join('') || ''}</li>`).join('') || '';
        const tag = block.format === 'ordered' ? 'ol' : 'ul';
        return `<${tag}>${items}</${tag}>`;
      }
      return '';
    }).join('\n');
  },

  /**
   * Mapea un producto de WooCommerce a formato Strapi (libro)
   * IMPORTANTE: NO modifica campos estáticos como ISBN si ya existe en Strapi
   * @param wooProduct - Producto de WooCommerce
   * @param platform - Plataforma (woo_moraleja o woo_escolar)
   * @param libroExistente - Libro existente en Strapi (opcional, para proteger campos estáticos)
   */
  mapWooProductToLibro(
    wooProduct: any, 
    platform: 'woo_moraleja' | 'woo_escolar',
    libroExistente?: any
  ): any {
    const libro: any = {};
    
    // ============================================
    // CAMPOS BÁSICOS (siempre se actualizan desde WooCommerce)
    // ============================================
    if (wooProduct.name) {
      libro.nombre_libro = wooProduct.name;
    }
    
    // Descripciones
    if (wooProduct.short_description !== undefined) {
      libro.descripcion_corta = wooProduct.short_description || null;
    }
    
    if (wooProduct.description !== undefined) {
      libro.descripcion = wooProduct.description || null;
    }

    // ============================================
    // ISBN (CAMPO ESTÁTICO - Solo se actualiza si no existe)
    // ============================================
    // ⚠️ PROTECCIÓN: No sobrescribir ISBN si ya existe en Strapi
    if (wooProduct.sku) {
      const isbnWoo = String(wooProduct.sku).trim();
      const isbnExistente = libroExistente?.isbn_libro || libroExistente?.attributes?.isbn_libro;
      
      if (!isbnExistente) {
        // Solo actualizar si no existe ISBN en Strapi
        libro.isbn_libro = isbnWoo;
      } else if (isbnExistente !== isbnWoo) {
        // Si difieren, mantener el de Strapi y loguear advertencia
        strapi.log.warn(
          `[product-mapper] ISBN conflictivo: Strapi tiene "${isbnExistente}" pero WooCommerce tiene "${isbnWoo}". ` +
          `Manteniendo ISBN de Strapi (campo protegido).`
        );
        // NO actualizar isbn_libro
      }
      // Si son iguales, no hacer nada
    }

    // ============================================
    // PRECIOS (siempre se actualizan desde WooCommerce)
    // ============================================
    if (wooProduct.regular_price !== undefined) {
      const precioRegular = parseFloat(wooProduct.regular_price) || 0;
      libro.precio = precioRegular;
      libro.precio_regular = precioRegular;
    }
    
    if (wooProduct.sale_price !== undefined) {
      libro.precio_oferta = parseFloat(wooProduct.sale_price) || null;
    }

    // ============================================
    // STOCK (siempre se actualiza desde WooCommerce)
    // ============================================
    if (wooProduct.manage_stock !== undefined) {
      libro.manage_stock = wooProduct.manage_stock;
    }
    
    if (wooProduct.stock_quantity !== undefined) {
      libro.stock_quantity = parseInt(String(wooProduct.stock_quantity), 10) || 0;
    }
    
    if (wooProduct.stock_status) {
      libro.stock_status = wooProduct.stock_status;
    }

    // ============================================
    // DIMENSIONES Y PESO
    // ============================================
    if (wooProduct.weight !== undefined) {
      libro.weight = parseFloat(wooProduct.weight) || null;
    }
    
    if (wooProduct.length !== undefined) {
      libro.length = parseFloat(wooProduct.length) || null;
    }
    
    if (wooProduct.width !== undefined) {
      libro.width = parseFloat(wooProduct.width) || null;
    }
    
    if (wooProduct.height !== undefined) {
      libro.height = parseFloat(wooProduct.height) || null;
    }

    // ============================================
    // ESTADO Y VISIBILIDAD
    // ============================================
    // Estado de publicación basado en status de WooCommerce
    if (wooProduct.status) {
      switch (wooProduct.status) {
        case 'publish':
          libro.estado_publicacion = 'Publicado';
          break;
        case 'pending':
          libro.estado_publicacion = 'Pendiente';
          break;
        case 'draft':
          libro.estado_publicacion = 'Borrador';
          break;
        default:
          libro.estado_publicacion = 'Pendiente';
      }
    }
    
    if (wooProduct.featured !== undefined) {
      libro.featured = wooProduct.featured;
    }
    
    if (wooProduct.catalog_visibility) {
      libro.catalog_visibility = wooProduct.catalog_visibility;
    }
    
    if (wooProduct.virtual !== undefined) {
      libro.virtual = wooProduct.virtual;
    }
    
    if (wooProduct.downloadable !== undefined) {
      libro.downloadable = wooProduct.downloadable;
    }

    // ============================================
    // IMPUESTOS
    // ============================================
    if (wooProduct.tax_status) {
      libro.tax_status = wooProduct.tax_status;
    }
    
    if (wooProduct.tax_class !== undefined) {
      libro.tax_class = wooProduct.tax_class || null;
    }

    // ============================================
    // IMÁGENES
    // ============================================
    if (wooProduct.images && Array.isArray(wooProduct.images) && wooProduct.images.length > 0) {
      // Guardar URL de la imagen principal (para referencia)
      libro.imagen_portada_url = wooProduct.images[0].src;
      // Nota: La imagen real se debe descargar y subir a Strapi en otro proceso
    }

    // ============================================
    // METADATOS ADICIONALES (desde meta_data)
    // ============================================
    if (wooProduct.meta_data && Array.isArray(wooProduct.meta_data)) {
      const metaData = wooProduct.meta_data;
      
      // Buscar campos específicos en meta_data
      const getMetaValue = (key: string): string | null => {
        const meta = metaData.find((m: any) => m.key === key);
        return meta?.value || null;
      };
      
      // Subtítulo
      const subtitulo = getMetaValue('subtitulo_libro');
      if (subtitulo) {
        libro.subtitulo_libro = subtitulo;
      }
      
      // Información de edición
      const numeroEdicion = getMetaValue('numero_edicion');
      if (numeroEdicion) {
        libro.numero_edicion = parseInt(numeroEdicion, 10) || null;
      }
      
      const agnoEdicion = getMetaValue('agno_edicion');
      if (agnoEdicion) {
        libro.agno_edicion = parseInt(agnoEdicion, 10) || null;
      }
      
      const idioma = getMetaValue('idioma');
      if (idioma) {
        libro.idioma = idioma;
      }
      
      const tipoLibro = getMetaValue('tipo_libro');
      if (tipoLibro) {
        libro.tipo_libro = tipoLibro;
      }
      
      const estadoEdicion = getMetaValue('estado_edicion');
      if (estadoEdicion) {
        libro.estado_edicion = estadoEdicion;
      }
      
      // IDs de relaciones (solo para referencia, no se actualizan automáticamente)
      // Estos se mantienen como referencia pero no se usan para actualizar relaciones
    }

    // ============================================
    // EXTERNAL ID (siempre se actualiza)
    // ============================================
    if (wooProduct.id) {
      const existingExternalIds = libroExistente?.externalIds || libroExistente?.attributes?.externalIds || {};
      libro.externalIds = {
        ...existingExternalIds,
        [platform]: wooProduct.id,
      };
    }

    return libro;
  },

  /**
   * Encuentra el precio activo y vigente de una lista de precios
   */
  findActivePrice(precios: any[]): any | null {
    const ahora = new Date();
    
    // Buscar precio activo y vigente
    const preciosVigentes = precios.filter((precio: any) => {
      if (precio.activo === false) return false;
      
      if (precio.fecha_inicio) {
        const fechaInicio = new Date(precio.fecha_inicio);
        if (fechaInicio > ahora) return false;
      }
      
      if (precio.fecha_fin) {
        const fechaFin = new Date(precio.fecha_fin);
        if (fechaFin < ahora) return false;
      }
      
      return true;
    });
    
    if (preciosVigentes.length > 0) {
      return preciosVigentes.sort((a: any, b: any) => {
        const fechaA = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
        const fechaB = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
        return fechaB - fechaA;
      })[0];
    }
    
    // Si no hay vigentes, usar el más reciente activo
    const preciosActivos = precios.filter((p: any) => p.activo !== false);
    if (preciosActivos.length > 0) {
      return preciosActivos.sort((a: any, b: any) => {
        const fechaA = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const fechaB = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return fechaB - fechaA;
      })[0];
    }
    
    return null;
  },
});
