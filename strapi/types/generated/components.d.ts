import type { Schema, Struct } from '@strapi/strapi';

export interface CampaniasHero extends Struct.ComponentSchema {
  collectionName: 'components_campanias_heroes';
  info: {
    displayName: 'Hero';
    icon: 'bullhorn';
  };
  attributes: {
    eyebrow: Schema.Attribute.String;
    primaryCtaHref: Schema.Attribute.String;
    primaryCtaLabel: Schema.Attribute.String;
    secondaryCtaHref: Schema.Attribute.String;
    secondaryCtaLabel: Schema.Attribute.String;
    stats: Schema.Attribute.Component<'campanias.hero-stat', true>;
    subtitle: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface CampaniasHeroStat extends Struct.ComponentSchema {
  collectionName: 'components_campanias_hero_stats';
  info: {
    displayName: 'Hero stat';
    icon: 'chart-bar';
  };
  attributes: {
    label: Schema.Attribute.String;
    value: Schema.Attribute.String;
  };
}

export interface CampaniasHighlight extends Struct.ComponentSchema {
  collectionName: 'components_campanias_highlights';
  info: {
    displayName: 'Highlight';
    icon: 'star';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.Enumeration<
      ['curriculum', 'analytics', 'support', 'custom']
    >;
    title: Schema.Attribute.String;
  };
}

export interface CampaniasModule extends Struct.ComponentSchema {
  collectionName: 'components_campanias_modules';
  info: {
    displayName: 'Module';
    icon: 'layers';
  };
  attributes: {
    audience: Schema.Attribute.String;
    ctaHref: Schema.Attribute.String;
    ctaLabel: Schema.Attribute.String;
    duration: Schema.Attribute.String;
    name: Schema.Attribute.String;
    outcomes: Schema.Attribute.Component<'campanias.module-outcome', true>;
    summary: Schema.Attribute.RichText;
  };
}

export interface CampaniasModuleOutcome extends Struct.ComponentSchema {
  collectionName: 'components_campanias_module_outcomes';
  info: {
    displayName: 'Module outcome';
    icon: 'check';
  };
  attributes: {
    value: Schema.Attribute.String;
  };
}

export interface CampaniasNote extends Struct.ComponentSchema {
  collectionName: 'components_campanias_notes';
  info: {
    displayName: 'Note';
    icon: 'sticky-note';
  };
  attributes: {
    value: Schema.Attribute.Text;
  };
}

export interface CampaniasResource extends Struct.ComponentSchema {
  collectionName: 'components_campanias_resources';
  info: {
    displayName: 'Resource';
    icon: 'file';
  };
  attributes: {
    description: Schema.Attribute.Text;
    format: Schema.Attribute.Enumeration<['pdf', 'video', 'link', 'contact']>;
    href: Schema.Attribute.String;
    label: Schema.Attribute.String;
  };
}

export interface CampaniasSupport extends Struct.ComponentSchema {
  collectionName: 'components_campanias_supports';
  info: {
    displayName: 'Support';
    icon: 'life-ring';
  };
  attributes: {
    contactEmail: Schema.Attribute.Email;
    contactPhone: Schema.Attribute.String;
    contactWhatsapp: Schema.Attribute.String;
    description: Schema.Attribute.Text;
    officeHours: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface CampaniasTimelineStep extends Struct.ComponentSchema {
  collectionName: 'components_campanias_timeline_steps';
  info: {
    displayName: 'Timeline step';
    icon: 'time';
  };
  attributes: {
    description: Schema.Attribute.Text;
    detail: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface ContactoDireccion extends Struct.ComponentSchema {
  collectionName: 'components_contacto_direccions';
  info: {
    description: 'Direcci\u00F3n simplificada sin campos de verificaci\u00F3n (las interacciones se registran en otras colecciones)';
    displayName: 'Direcci\u00F3n';
    icon: 'house';
  };
  attributes: {
    complemento_direccion: Schema.Attribute.String;
    comuna: Schema.Attribute.Relation<'oneToOne', 'api::comuna.comuna'>;
    direccion_principal_envio_facturacion: Schema.Attribute.Enumeration<
      ['Principal', 'Env\u00EDo', 'Facturaci\u00F3n']
    >;
    nombre_calle: Schema.Attribute.String;
    numero_calle: Schema.Attribute.String;
    tipo_direccion: Schema.Attribute.Enumeration<
      ['Casa', 'Departamento', 'Colegio', 'Comercial']
    >;
  };
}

export interface ContactoEmail extends Struct.ComponentSchema {
  collectionName: 'components_contacto_email';
  info: {
    description: 'Email de contacto con estado y verificaci\u00F3n';
    displayName: 'Email';
  };
  attributes: {
    email: Schema.Attribute.Email & Schema.Attribute.Required;
    estado: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado']
    >;
    principal: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    status: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    tipo: Schema.Attribute.Enumeration<
      ['Personal', 'Laboral', 'Institucional']
    >;
    vigente_hasta: Schema.Attribute.Date;
  };
}

export interface ContactoLogoOAvatar extends Struct.ComponentSchema {
  collectionName: 'components_contacto_logo_o_avatars';
  info: {
    displayName: 'Logo o Avatar';
    icon: 'emotionHappy';
  };
  attributes: {
    estado: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado']
    >;
    formato: Schema.Attribute.Enumeration<
      ['Png', 'Jpg', 'WebP', 'SVG', 'Gif', 'Otro']
    >;
    imagen: Schema.Attribute.Media<
      'images' | 'files' | 'videos' | 'audios',
      true
    >;
    status: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    tipo: Schema.Attribute.Enumeration<['Logo', 'Foto Perf\u00EDl', 'Otro']>;
    vigente_hasta: Schema.Attribute.Date;
  };
}

export interface ContactoNombre extends Struct.ComponentSchema {
  collectionName: 'components_contacto_nombres';
  info: {
    displayName: 'Verificaci\u00F3n Nombre';
    icon: 'handHeart';
  };
  attributes: {
    aprobado_por: Schema.Attribute.String;
    confiance_score: Schema.Attribute.Integer;
    estado: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado', 'Rechazado', 'Otro']
    >;
    fecha_aprobacion: Schema.Attribute.Date;
    fecha_verificacion: Schema.Attribute.Date;
    fuente: Schema.Attribute.String;
    nota: Schema.Attribute.String;
    verificado_por: Schema.Attribute.String;
  };
}

export interface ContactoTelefono extends Struct.ComponentSchema {
  collectionName: 'components_contacto_telefono';
  info: {
    description: 'Tel\u00E9fono de contacto con normalizaci\u00F3n';
    displayName: 'Tel\u00E9fono';
  };
  attributes: {
    estado: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado']
    >;
    fijo_o_movil: Schema.Attribute.Enumeration<['Fijo', 'M\u00F3vil']>;
    principal: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    status: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    telefono_norm: Schema.Attribute.String;
    telefono_raw: Schema.Attribute.String;
    tipo: Schema.Attribute.Enumeration<
      ['Personal', 'Laboral', 'Institucional']
    >;
    vigente_hasta: Schema.Attribute.Date;
  };
}

export interface ContactoWebsite extends Struct.ComponentSchema {
  collectionName: 'components_contacto_websites';
  info: {
    displayName: 'Website';
    icon: 'globe';
  };
  attributes: {
    estado: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado']
    >;
    status: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    vigente_hasta: Schema.Attribute.Date;
    website: Schema.Attribute.String;
  };
}

export interface CotizacionesBeneficio extends Struct.ComponentSchema {
  collectionName: 'components_cotizaciones_beneficios';
  info: {
    displayName: 'Beneficio';
    icon: 'gift';
  };
  attributes: {
    descripcion: Schema.Attribute.Text;
    titulo: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface CotizacionesItem extends Struct.ComponentSchema {
  collectionName: 'components_cotizaciones_items';
  info: {
    displayName: 'Item';
    icon: 'shopping-cart';
  };
  attributes: {
    cantidad: Schema.Attribute.Decimal & Schema.Attribute.DefaultTo<1>;
    categoria: Schema.Attribute.String;
    descripcion: Schema.Attribute.Text;
    descuento: Schema.Attribute.Decimal;
    precio_unitario: Schema.Attribute.Decimal;
    producto: Schema.Attribute.String & Schema.Attribute.Required;
    subtotal: Schema.Attribute.Decimal;
  };
}

export interface HomeCtaLink extends Struct.ComponentSchema {
  collectionName: 'components_home_cta_links';
  info: {
    description: 'CTA principal/secundaria para el home hero';
    displayName: 'ctaLink';
  };
  attributes: {
    aria_label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    external: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    href: Schema.Attribute.String & Schema.Attribute.Required;
    is_primary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
  };
}

export interface HomeHeroStat extends Struct.ComponentSchema {
  collectionName: 'components_home_hero_stats';
  info: {
    description: 'Indicadores destacados para el home hero';
    displayName: 'heroStat';
  };
  attributes: {
    label: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    order: Schema.Attribute.Integer;
    value: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 40;
      }>;
  };
}

export interface IntegrationWooMap extends Struct.ComponentSchema {
  collectionName: 'components_integration_woo_map';
  info: {
    description: 'WooCommerce IDs and sync metadata per store';
    displayName: 'Woo Mapping';
  };
  attributes: {
    contentHash: Schema.Attribute.String;
    lastSyncedAt: Schema.Attribute.DateTime;
    storeKey: Schema.Attribute.Enumeration<['editorial', 'libreria']> &
      Schema.Attribute.Required;
    wooProductId: Schema.Attribute.Integer;
    wooVariantIds: Schema.Attribute.JSON;
  };
}

export interface InventoryEditorial extends Struct.ComponentSchema {
  collectionName: 'components_inventory_editorial';
  info: {
    description: 'Stock buckets for Editorial store';
    displayName: 'Editorial Inventory';
  };
  attributes: {
    comodato_libreria: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    operador_logistico: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
  };
}

export interface InventoryLibreria extends Struct.ComponentSchema {
  collectionName: 'components_inventory_libreria';
  info: {
    description: 'Stock buckets for Libreria Escolar store';
    displayName: 'Libreria Inventory';
  };
  attributes: {
    bodega: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    operador_logistico: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<0>;
    tienda: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface ListaDescuentoRegla extends Struct.ComponentSchema {
  collectionName: 'components_lista_descuento_reglas';
  info: {
    displayName: 'Regla de descuento';
    icon: 'percent';
  };
  attributes: {
    categoria: Schema.Attribute.String & Schema.Attribute.Required;
    descuento_especial: Schema.Attribute.Decimal;
  };
}

export interface ListasUtilesBoundingBox extends Struct.ComponentSchema {
  collectionName: 'components_listas_utiles_bounding_boxes';
  info: {
    description: 'Ubicaci\u00F3n normalizada del elemento dentro de un PDF de lista de \u00FAtiles';
    displayName: 'Bounding Box';
  };
  attributes: {
    height: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      >;
    page: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    width: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      >;
    x: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      >;
    y: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      >;
  };
}

export interface ListasUtilesChangeDiff extends Struct.ComponentSchema {
  collectionName: 'components_listas_utiles_change_diffs';
  info: {
    description: 'Resumen de cambios entre versiones de listas de \u00FAtiles';
    displayName: 'Change Diff';
  };
  attributes: {
    diff_type: Schema.Attribute.Enumeration<
      ['agregado', 'eliminado', 'modificado']
    > &
      Schema.Attribute.Required;
    impact: Schema.Attribute.Enumeration<['bajo', 'medio', 'alto']>;
    new_value: Schema.Attribute.JSON;
    previous_value: Schema.Attribute.JSON;
    reference: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
    scope: Schema.Attribute.Enumeration<['curso', 'item', 'nota']> &
      Schema.Attribute.Required;
  };
}

export interface ListasUtilesQualityFlag extends Struct.ComponentSchema {
  collectionName: 'components_listas_utiles_quality_flags';
  info: {
    description: 'Flags de control de calidad asociados a listas de \u00FAtiles';
    displayName: 'Quality Flag';
  };
  attributes: {
    code: Schema.Attribute.Enumeration<
      [
        'isbn_invalido',
        'editorial_incongruente',
        'nombre_inexacto',
        'instruccion_confusa',
        'faltan_productos',
        'otros',
      ]
    > &
      Schema.Attribute.Required;
    label: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    resolved: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    resolved_at: Schema.Attribute.DateTime;
    resolved_by: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    severity: Schema.Attribute.Enumeration<['info', 'warning', 'error']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'info'>;
  };
}

export interface ListasDocumento extends Struct.ComponentSchema {
  collectionName: 'components_listas_documentos';
  info: {
    description: 'Archivo original asociado a una lista escolar';
    displayName: 'Documento';
  };
  attributes: {
    archivo: Schema.Attribute.Media<'files'> & Schema.Attribute.Required;
    formato: Schema.Attribute.Enumeration<
      ['pdf', 'docx', 'xlsx', 'csv', 'otro']
    > &
      Schema.Attribute.DefaultTo<'pdf'>;
    metadatos: Schema.Attribute.JSON;
    nombre_original: Schema.Attribute.String;
    notas: Schema.Attribute.Text;
    pagina_inicio: Schema.Attribute.Integer;
  };
}

export interface ListasHistorial extends Struct.ComponentSchema {
  collectionName: 'components_listas_historiales';
  info: {
    description: 'Registro de cambios de estado y acciones realizadas';
    displayName: 'Historial';
  };
  attributes: {
    actor_nombre: Schema.Attribute.String;
    actor_rol: Schema.Attribute.String;
    creado_en: Schema.Attribute.DateTime;
    estado: Schema.Attribute.Enumeration<
      [
        'cargada',
        'analizada',
        'pendiente_validacion',
        'pendiente_aprobacion',
        'aprobada',
        'rechazada',
      ]
    >;
    mensaje: Schema.Attribute.Text;
  };
}

export interface ListasResaltado extends Struct.ComponentSchema {
  collectionName: 'components_listas_resaltados';
  info: {
    description: 'Coordenadas de un segmento identificado en el documento original';
    displayName: 'Resaltado';
  };
  attributes: {
    alto: Schema.Attribute.Decimal;
    ancho: Schema.Attribute.Decimal;
    pagina: Schema.Attribute.Integer;
    texto: Schema.Attribute.String;
    x: Schema.Attribute.Decimal;
    y: Schema.Attribute.Decimal;
  };
}

export interface ListasTabulacion extends Struct.ComponentSchema {
  collectionName: 'components_listas_tabulaciones';
  info: {
    description: 'Fila tabulada derivada del an\u00E1lisis del documento';
    displayName: 'Tabulaci\u00F3n';
  };
  attributes: {
    asignatura: Schema.Attribute.String;
    curso: Schema.Attribute.String & Schema.Attribute.Required;
    descripcion: Schema.Attribute.Text;
    estado_revision: Schema.Attribute.Enumeration<
      ['pendiente', 'ajustado', 'aprobado']
    > &
      Schema.Attribute.DefaultTo<'pendiente'>;
    libro_base: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    observaciones: Schema.Attribute.Text;
    resaltados: Schema.Attribute.Component<'listas.resaltado', true>;
    sugerido: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    titulo_item: Schema.Attribute.String;
  };
}

export interface PedidoItem extends Struct.ComponentSchema {
  collectionName: 'components_pedido_items';
  info: {
    description: 'Item de producto en un pedido de WooCommerce';
    displayName: 'Pedido \u00B7 Item';
    icon: 'shopping-cart';
  };
  attributes: {
    cantidad: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    item_id: Schema.Attribute.Integer;
    libro: Schema.Attribute.Relation<'manyToOne', 'api::libro.libro'>;
    libro_id: Schema.Attribute.Integer;
    metadata: Schema.Attribute.JSON;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    precio_unitario: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    producto_id: Schema.Attribute.Integer;
    sku: Schema.Attribute.String;
    total: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface PortalAccessRole extends Struct.ComponentSchema {
  collectionName: 'components_portal_access_roles';
  info: {
    description: 'Contexto de acceso al portal por rol';
    displayName: 'accessRole';
  };
  attributes: {
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    cursos: Schema.Attribute.Relation<'manyToMany', 'api::curso.curso'>;
    default_dashboard: Schema.Attribute.Enumeration<
      ['general', 'pedidos', 'licencias', 'documentos', 'soporte']
    >;
    dependientes: Schema.Attribute.Relation<
      'manyToMany',
      'api::persona.persona'
    >;
    is_primary: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    notes: Schema.Attribute.Text;
    role: Schema.Attribute.Enumeration<
      ['colegio_admin', 'docente', 'apoderado', 'estudiante', 'staff']
    > &
      Schema.Attribute.Required;
    scopes: Schema.Attribute.JSON;
    valid_until: Schema.Attribute.DateTime;
  };
}

export interface PortalAccount extends Struct.ComponentSchema {
  collectionName: 'components_portal_accounts';
  info: {
    description: 'Estado de cuenta del portal Moraleja';
    displayName: 'account';
  };
  attributes: {
    accepted_terms_at: Schema.Attribute.DateTime;
    last_login_at: Schema.Attribute.DateTime;
    mfa_enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    notes: Schema.Attribute.Text;
    onboarded_at: Schema.Attribute.DateTime;
    portal_id: Schema.Attribute.String;
    primary_email: Schema.Attribute.Email;
    sso_provider: Schema.Attribute.Enumeration<
      ['auth0', 'keycloak', 'google', 'microsoft', 'internal', 'otro']
    > &
      Schema.Attribute.DefaultTo<'auth0'>;
    status: Schema.Attribute.Enumeration<
      ['pending_invite', 'active', 'suspended', 'revoked']
    > &
      Schema.Attribute.DefaultTo<'pending_invite'>;
    username: Schema.Attribute.String;
  };
}

export interface PortalPreferences extends Struct.ComponentSchema {
  collectionName: 'components_portal_preferences';
  info: {
    description: 'Preferencias de uso del portal';
    displayName: 'preferences';
  };
  attributes: {
    default_dashboard: Schema.Attribute.Enumeration<
      ['general', 'pedidos', 'licencias', 'documentos', 'soporte']
    > &
      Schema.Attribute.DefaultTo<'general'>;
    hidden_widgets: Schema.Attribute.JSON;
    language: Schema.Attribute.Enumeration<['es', 'en']> &
      Schema.Attribute.DefaultTo<'es'>;
    marketing_opt_in: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    notifications_email: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    notifications_push: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    notifications_whatsapp: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    shortcuts: Schema.Attribute.Component<'portal.shortcut', true>;
    timezone: Schema.Attribute.String;
  };
}

export interface PortalShortcut extends Struct.ComponentSchema {
  collectionName: 'components_portal_shortcuts';
  info: {
    description: 'Accesos directos personalizados';
    displayName: 'shortcut';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.String;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    target_url: Schema.Attribute.String;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'campanias.hero': CampaniasHero;
      'campanias.hero-stat': CampaniasHeroStat;
      'campanias.highlight': CampaniasHighlight;
      'campanias.module': CampaniasModule;
      'campanias.module-outcome': CampaniasModuleOutcome;
      'campanias.note': CampaniasNote;
      'campanias.resource': CampaniasResource;
      'campanias.support': CampaniasSupport;
      'campanias.timeline-step': CampaniasTimelineStep;
      'contacto.direccion': ContactoDireccion;
      'contacto.email': ContactoEmail;
      'contacto.logo-o-avatar': ContactoLogoOAvatar;
      'contacto.nombre': ContactoNombre;
      'contacto.telefono': ContactoTelefono;
      'contacto.website': ContactoWebsite;
      'cotizaciones.beneficio': CotizacionesBeneficio;
      'cotizaciones.item': CotizacionesItem;
      'home.cta-link': HomeCtaLink;
      'home.hero-stat': HomeHeroStat;
      'integration.woo-map': IntegrationWooMap;
      'inventory.editorial': InventoryEditorial;
      'inventory.libreria': InventoryLibreria;
      'lista-descuento.regla': ListaDescuentoRegla;
      'listas-utiles.bounding-box': ListasUtilesBoundingBox;
      'listas-utiles.change-diff': ListasUtilesChangeDiff;
      'listas-utiles.quality-flag': ListasUtilesQualityFlag;
      'listas.documento': ListasDocumento;
      'listas.historial': ListasHistorial;
      'listas.resaltado': ListasResaltado;
      'listas.tabulacion': ListasTabulacion;
      'pedido.item': PedidoItem;
      'portal.access-role': PortalAccessRole;
      'portal.account': PortalAccount;
      'portal.preferences': PortalPreferences;
      'portal.shortcut': PortalShortcut;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
    }
  }
}
