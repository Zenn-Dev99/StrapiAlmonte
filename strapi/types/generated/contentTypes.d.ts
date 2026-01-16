import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminSession extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_sessions';
  info: {
    description: 'Session Manager storage';
    displayName: 'Session';
    name: 'Session';
    pluralName: 'sessions';
    singularName: 'session';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
    i18n: {
      localized: false;
    };
  };
  attributes: {
    absoluteExpiresAt: Schema.Attribute.DateTime & Schema.Attribute.Private;
    childId: Schema.Attribute.String & Schema.Attribute.Private;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    deviceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    expiresAt: Schema.Attribute.DateTime &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::session'> &
      Schema.Attribute.Private;
    origin: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    sessionId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique;
    status: Schema.Attribute.String & Schema.Attribute.Private;
    type: Schema.Attribute.String & Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    userId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAsignaturaAsignatura extends Struct.CollectionTypeSchema {
  collectionName: 'asignaturas';
  info: {
    displayName: 'Colegio \u00B7 Asignaturas';
    pluralName: 'asignaturas';
    singularName: 'asignatura';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    area_general: Schema.Attribute.String;
    area_subsector: Schema.Attribute.String;
    cod_subsector: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    hola: Schema.Attribute.DynamicZone<
      [
        'shared.seo',
        'shared.media',
        'inventory.libreria',
        'inventory.editorial',
      ]
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::asignatura.asignatura'
    > &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    nota: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'nombre'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAutorAutor extends Struct.CollectionTypeSchema {
  collectionName: 'autores';
  info: {
    description: 'Autores registrados';
    displayName: 'Product \u00B7 Libro \u00B7 Autor';
    pluralName: 'autores';
    singularName: 'autor';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    estado_publicacion: Schema.Attribute.Enumeration<
      ['pendiente', 'publicado']
    > &
      Schema.Attribute.DefaultTo<'pendiente'>;
    externalIds: Schema.Attribute.JSON;
    fecha_muerte: Schema.Attribute.Date;
    fecha_nacimiento: Schema.Attribute.Date;
    foto: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    id_autor: Schema.Attribute.Integer & Schema.Attribute.Unique;
    libros: Schema.Attribute.Relation<'oneToMany', 'api::libro.libro'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::autor.autor'> &
      Schema.Attribute.Private;
    nombre_completo_autor: Schema.Attribute.String & Schema.Attribute.Required;
    nombres: Schema.Attribute.String;
    obras: Schema.Attribute.Relation<'manyToMany', 'api::obra.obra'>;
    pais: Schema.Attribute.Enumeration<
      [
        'Afganist\u00E1n',
        'Albania',
        'Alemania',
        'Andorra',
        'Angola',
        'Antigua y Barbuda',
        'Arabia Saud\u00ED',
        'Argelia',
        'Argentina',
        'Armenia',
        'Australia',
        'Austria',
        'Azerbaiy\u00E1n',
        'Bahamas',
        'Banglad\u00E9s',
        'Barbados',
        'Bar\u00E9in',
        'B\u00E9lgica',
        'Belice',
        'Ben\u00EDn',
        'Bielorrusia',
        'Birmania',
        'Bolivia',
        'Bosnia y Herzegovina',
        'Botsuana',
        'Brasil',
        'Brun\u00E9i',
        'Bulgaria',
        'Burkina Faso',
        'Burundi',
        'But\u00E1n',
        'Cabo Verde',
        'Camboya',
        'Camer\u00FAn',
        'Canad\u00E1',
        'Catar',
        'Chad',
        'Chile',
        'China',
        'Chipre',
        'Colombia',
        'Comoras',
        'Corea del Norte',
        'Corea del Sur',
        'Costa de Marfil',
        'Costa Rica',
        'Croacia',
        'Cuba',
        'Dinamarca',
        'Dominica',
        'Ecuador',
        'Egipto',
        'El Salvador',
        'Emiratos \u00C1rabes Unidos',
        'Eritrea',
        'Eslovaquia',
        'Eslovenia',
        'Espa\u00F1a',
        'Estados Unidos',
        'Estonia',
        'Esuatini',
        'Etiop\u00EDa',
        'Filipinas',
        'Finlandia',
        'Fiyi',
        'Francia',
        'Gab\u00F3n',
        'Gambia',
        'Georgia',
        'Ghana',
        'Granada',
        'Grecia',
        'Guatemala',
        'Guinea',
        'Guinea-Bis\u00E1u',
        'Guinea Ecuatorial',
        'Guyana',
        'Hait\u00ED',
        'Honduras',
        'Hungr\u00EDa',
        'India',
        'Indonesia',
        'Irak',
        'Ir\u00E1n',
        'Irlanda',
        'Islandia',
        'Islas Marshall',
        'Islas Salom\u00F3n',
        'Israel',
        'Italia',
        'Jamaica',
        'Jap\u00F3n',
        'Jordania',
        'Kazajist\u00E1n',
        'Kenia',
        'Kirguist\u00E1n',
        'Kiribati',
        'Kuwait',
        'Laos',
        'Lesoto',
        'Letonia',
        'L\u00EDbano',
        'Liberia',
        'Libia',
        'Liechtenstein',
        'Lituania',
        'Luxemburgo',
        'Madagascar',
        'Malasia',
        'Malaui',
        'Maldivas',
        'Mal\u00ED',
        'Malta',
        'Marruecos',
        'Mauricio',
        'Mauritania',
        'M\u00E9xico',
        'Micronesia',
        'Moldavia',
        'M\u00F3naco',
        'Mongolia',
        'Montenegro',
        'Mozambique',
        'Namibia',
        'Nauru',
        'Nepal',
        'Nicaragua',
        'N\u00EDger',
        'Nigeria',
        'Noruega',
        'Nueva Zelanda',
        'Om\u00E1n',
        'Pa\u00EDses Bajos',
        'Pakist\u00E1n',
        'Palaos',
        'Palestina',
        'Panam\u00E1',
        'Pap\u00FAa Nueva Guinea',
        'Paraguay',
        'Per\u00FA',
        'Polonia',
        'Portugal',
        'Reino Unido',
        'Rep\u00FAblica Centroafricana',
        'Rep\u00FAblica Checa',
        'Rep\u00FAblica del Congo',
        'Rep\u00FAblica Democr\u00E1tica del Congo',
        'Rep\u00FAblica Dominicana',
        'Ruanda',
        'Rumania',
        'Rusia',
        'Samoa',
        'San Crist\u00F3bal y Nieves',
        'San Marino',
        'San Vicente y las Granadinas',
        'Santa Luc\u00EDa',
        'Santo Tom\u00E9 y Pr\u00EDncipe',
        'Senegal',
        'Serbia',
        'Seychelles',
        'Sierra Leona',
        'Singapur',
        'Siria',
        'Somalia',
        'Sri Lanka',
        'Sud\u00E1frica',
        'Sud\u00E1n',
        'Sud\u00E1n del Sur',
        'Suecia',
        'Suiza',
        'Surinam',
        'Tailandia',
        'Tanzania',
        'Tayikist\u00E1n',
        'Timor Oriental',
        'Togo',
        'Tonga',
        'Trinidad y Tobago',
        'T\u00FAnez',
        'Turkmenist\u00E1n',
        'Turqu\u00EDa',
        'Tuvalu',
        'Ucrania',
        'Uganda',
        'Uruguay',
        'Uzbekist\u00E1n',
        'Vanuatu',
        'Vaticano',
        'Venezuela',
        'Vietnam',
        'Yemen',
        'Yibuti',
        'Zambia',
        'Zimbabue',
      ]
    >;
    primer_apellido: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resegna: Schema.Attribute.Blocks;
    segundo_apellido: Schema.Attribute.String;
    tipo_autor: Schema.Attribute.Enumeration<['Persona', 'Empresa']>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vivo_muerto: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    website: Schema.Attribute.String;
  };
}

export interface ApiCanalCanal extends Struct.CollectionTypeSchema {
  collectionName: 'canales';
  info: {
    displayName: 'Product \u00B7 Libro \u00B7 Canal';
    pluralName: 'canales';
    singularName: 'canal';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    key: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::canal.canal'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCarteraAsignacionCarteraAsignacion
  extends Struct.CollectionTypeSchema {
  collectionName: 'cartera_asignaciones';
  info: {
    description: 'Asignaci\u00F3n de colegio a ejecutivo comercial en un periodo';
    displayName: 'Promoci\u00F3n \u00B7 Colegios \u00B7 Cartera Asignaci\u00F3n';
    pluralName: 'cartera-asignaciones';
    singularName: 'cartera-asignacion';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ejecutivo: Schema.Attribute.Relation<'manyToOne', 'api::persona.persona'>;
    estado: Schema.Attribute.Enumeration<['activa', 'en_revision', 'cerrada']> &
      Schema.Attribute.DefaultTo<'activa'>;
    fecha_fin: Schema.Attribute.Date;
    fecha_inicio: Schema.Attribute.Date;
    is_current: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::cartera-asignacion.cartera-asignacion'
    > &
      Schema.Attribute.Private;
    meta_ingresos: Schema.Attribute.Decimal;
    notas: Schema.Attribute.Text;
    orden: Schema.Attribute.Integer;
    periodo: Schema.Attribute.Relation<
      'manyToOne',
      'api::cartera-periodo.cartera-periodo'
    >;
    prioridad: Schema.Attribute.Enumeration<['alta', 'media', 'baja']>;
    publishedAt: Schema.Attribute.DateTime;
    rol: Schema.Attribute.Enumeration<['comercial', 'soporte1', 'soporte2']>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCarteraPeriodoCarteraPeriodo
  extends Struct.CollectionTypeSchema {
  collectionName: 'cartera_periodos';
  info: {
    description: 'Periodo o ciclo para la asignaci\u00F3n comercial';
    displayName: 'Promoci\u00F3n \u00B7 Colegios \u00B7 Cartera Periodo';
    pluralName: 'cartera-periodos';
    singularName: 'cartera-periodo';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    asignaciones: Schema.Attribute.Relation<
      'oneToMany',
      'api::cartera-asignacion.cartera-asignacion'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    estado: Schema.Attribute.Enumeration<['borrador', 'vigente', 'cerrado']> &
      Schema.Attribute.DefaultTo<'borrador'>;
    fecha_fin: Schema.Attribute.Date;
    fecha_inicio: Schema.Attribute.Date;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::cartera-periodo.cartera-periodo'
    > &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    notas: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'nombre'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCategoriaProductoCategoriaProducto
  extends Struct.CollectionTypeSchema {
  collectionName: 'categorias_producto';
  info: {
    description: 'Categor\u00EDas de productos para WooCommerce (Product Categories)';
    displayName: 'Categor\u00EDa de Producto';
    pluralName: 'categorias-producto';
    singularName: 'categoria-producto';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    categoria_padre: Schema.Attribute.Relation<
      'manyToOne',
      'api::categoria-producto.categoria-producto'
    >;
    categorias_hijas: Schema.Attribute.Relation<
      'oneToMany',
      'api::categoria-producto.categoria-producto'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Text;
    externalIds: Schema.Attribute.JSON;
    imagen: Schema.Attribute.Media;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::categoria-producto.categoria-producto'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    tipo_visualizacion: Schema.Attribute.Enumeration<
      ['default', 'products', 'subcategories', 'both']
    > &
      Schema.Attribute.DefaultTo<'default'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiColaboradorColaborador extends Struct.CollectionTypeSchema {
  collectionName: 'colaboradores';
  info: {
    description: 'Usuarios internos que operan roles en la intranet';
    displayName: 'Intranet \u00B7 Colaboradores';
    pluralName: 'colaboradores';
    singularName: 'colaborador';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email_login: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colaborador.colaborador'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password & Schema.Attribute.Private;
    persona: Schema.Attribute.Relation<'oneToOne', 'api::persona.persona'> &
      Schema.Attribute.Required &
      Schema.Attribute.SetPluginOptions<{
        'content-manager': {
          mainField: 'rut';
          visible: true;
        };
      }>;
    publishedAt: Schema.Attribute.DateTime;
    rol: Schema.Attribute.Enumeration<
      ['super_admin', 'encargado_adquisiciones', 'supervisor', 'soporte']
    > &
      Schema.Attribute.DefaultTo<'soporte'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usuario: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Unique;
  };
}

export interface ApiColeccionColeccion extends Struct.CollectionTypeSchema {
  collectionName: 'colecciones';
  info: {
    description: 'Series o colecciones de libros. Pueden estar asociadas a una editorial/sello o ser independientes';
    displayName: 'Product \u00B7 Libro \u00B7 Serie / Colecci\u00F3n';
    pluralName: 'colecciones';
    singularName: 'coleccion';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    editorial: Schema.Attribute.Relation<
      'manyToOne',
      'api::editorial.editorial'
    >;
    estado_publicacion: Schema.Attribute.Enumeration<
      ['pendiente', 'publicado', 'borrador']
    > &
      Schema.Attribute.DefaultTo<'pendiente'>;
    externalIds: Schema.Attribute.JSON;
    id_coleccion: Schema.Attribute.Integer & Schema.Attribute.Unique;
    libros: Schema.Attribute.Relation<'oneToMany', 'api::libro.libro'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::coleccion.coleccion'
    > &
      Schema.Attribute.Private;
    nombre_coleccion: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    sello: Schema.Attribute.Relation<'manyToOne', 'api::sello.sello'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiColegioCampanaColegioCampana
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_campanas';
  info: {
    description: 'Contenido de landing pages de campa\u00F1as por colegio';
    displayName: 'Promoci\u00F3n \u00B7 Colegios \u00B7 Campa\u00F1as';
    pluralName: 'colegio-campanas';
    singularName: 'colegio-campana';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ejecutivo: Schema.Attribute.Relation<'manyToOne', 'api::persona.persona'>;
    hero: Schema.Attribute.Component<'campanias.hero', false>;
    highlights: Schema.Attribute.Component<'campanias.highlight', true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-campana.colegio-campana'
    > &
      Schema.Attribute.Private;
    modules: Schema.Attribute.Component<'campanias.module', true>;
    notes: Schema.Attribute.Component<'campanias.note', true>;
    periodo: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    resources: Schema.Attribute.Component<'campanias.resource', true>;
    slug: Schema.Attribute.UID<'title'> & Schema.Attribute.Required;
    support: Schema.Attribute.Component<'campanias.support', false>;
    tagline: Schema.Attribute.Text;
    timeline: Schema.Attribute.Component<'campanias.timeline-step', true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedAt_manual: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiColegioEventColegioEvent
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_events';
  info: {
    description: 'Bit\u00E1cora de acciones y cambios en un colegio';
    displayName: 'Colegio \u00B7 Event';
    pluralName: 'colegio-events';
    singularName: 'colegio-event';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    action: Schema.Attribute.Enumeration<
      ['create', 'edit', 'verify', 'approve', 'reject', 'note']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'edit'>;
    actor_email: Schema.Attribute.Email;
    actor_name: Schema.Attribute.String;
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    field: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-event.colegio-event'
    > &
      Schema.Attribute.Private;
    meta: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    value: Schema.Attribute.Text;
  };
}

export interface ApiColegioListDocumentColegioListDocument
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_list_documents';
  info: {
    description: 'Documentos fuente (PDF) utilizados para indexar listas de \u00FAtiles';
    displayName: 'Listas \u00B7 Documento';
    pluralName: 'colegio-list-documents';
    singularName: 'colegio-list-document';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    archivo_pdf: Schema.Attribute.Media<'files'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    curso_detectado: Schema.Attribute.String;
    curso_normalizado: Schema.Attribute.String;
    estado_procesamiento: Schema.Attribute.Enumeration<
      ['pendiente', 'procesando', 'completado', 'error']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pendiente'>;
    items: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-item.colegio-list-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-document.colegio-list-document'
    > &
      Schema.Attribute.Private;
    nombre_archivo: Schema.Attribute.String & Schema.Attribute.Required;
    notas: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-note.colegio-list-note'
    >;
    orden: Schema.Attribute.Integer;
    pagina_fin: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pagina_inicio: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pdf_hash: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 191;
      }>;
    procesamiento_log: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list-version.colegio-list-version'
    > &
      Schema.Attribute.Required;
  };
}

export interface ApiColegioListItemAuditColegioListItemAudit
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_list_item_audits';
  info: {
    description: 'Historial de acciones realizadas sobre \u00EDtems de listas de \u00FAtiles';
    displayName: 'Listas \u00B7 Item Audit';
    pluralName: 'colegio-list-item-audits';
    singularName: 'colegio-list-item-audit';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    accion: Schema.Attribute.Enumeration<
      ['match', 'update', 'revert', 'marcar_no_comprar', 'comentario']
    > &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    datos_nuevos: Schema.Attribute.JSON;
    datos_previos: Schema.Attribute.JSON;
    descripcion: Schema.Attribute.Text;
    estado_version: Schema.Attribute.Enumeration<
      ['draft', 'in_review', 'ready_for_publish', 'published']
    >;
    item: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list-item.colegio-list-item'
    > &
      Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-item-audit.colegio-list-item-audit'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    realizado_en: Schema.Attribute.DateTime;
    realizado_por: Schema.Attribute.Relation<'manyToOne', 'admin::user'> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiColegioListItemColegioListItem
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_list_items';
  info: {
    description: '\u00CDtems individuales presentes en versiones de listas de \u00FAtiles';
    displayName: 'Listas \u00B7 Item';
    pluralName: 'colegio-list-items';
    singularName: 'colegio-list-item';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    aprobado_en: Schema.Attribute.DateTime;
    aprobado_por: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    asignatura: Schema.Attribute.String;
    audits: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-item-audit.colegio-list-item-audit'
    >;
    bounding_boxes: Schema.Attribute.Component<
      'listas-utiles.bounding-box',
      true
    >;
    cantidad: Schema.Attribute.Decimal;
    categoria_texto: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    detectado_en: Schema.Attribute.DateTime;
    detectado_por: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    documento: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list-document.colegio-list-document'
    > &
      Schema.Attribute.Required;
    instrucciones: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-item.colegio-list-item'
    > &
      Schema.Attribute.Private;
    nombre_detectado: Schema.Attribute.String & Schema.Attribute.Required;
    nombre_normalizado: Schema.Attribute.String;
    omit_purchase: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    orden: Schema.Attribute.Integer;
    precio_unitario_referencia: Schema.Attribute.Decimal;
    prioridad_revision: Schema.Attribute.Enumeration<['normal', 'alta']> &
      Schema.Attribute.DefaultTo<'normal'>;
    producto: Schema.Attribute.Relation<'manyToOne', 'api::material.material'>;
    producto_creado_en_revision: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    publishedAt: Schema.Attribute.DateTime;
    unidad: Schema.Attribute.Enumeration<
      [
        'unidad',
        'paquete',
        'caja',
        'litro',
        'kilo',
        'cuaderno',
        'libro',
        'otro',
      ]
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    validacion_estado: Schema.Attribute.Enumeration<
      ['pendiente', 'en_revision', 'aprobado', 'rechazado']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pendiente'>;
    validation_errors: Schema.Attribute.JSON;
    verificado_en: Schema.Attribute.DateTime;
    verificado_por: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list-version.colegio-list-version'
    > &
      Schema.Attribute.Required;
  };
}

export interface ApiColegioListNoteColegioListNote
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_list_notes';
  info: {
    description: 'Notas y anotaciones encontradas en listas de \u00FAtiles';
    displayName: 'Listas \u00B7 Nota';
    pluralName: 'colegio-list-notes';
    singularName: 'colegio-list-note';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    bounding_box: Schema.Attribute.Component<
      'listas-utiles.bounding-box',
      false
    >;
    contenido: Schema.Attribute.Text & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    documento: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list-document.colegio-list-document'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-note.colegio-list-note'
    > &
      Schema.Attribute.Private;
    orden: Schema.Attribute.Integer;
    pagina: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    tipo: Schema.Attribute.Enumeration<
      ['encabezado', 'pie', 'general', 'instruccion']
    > &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list-version.colegio-list-version'
    > &
      Schema.Attribute.Required;
  };
}

export interface ApiColegioListVersionColegioListVersion
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_list_versions';
  info: {
    description: 'Versiones de listas de \u00FAtiles procesadas por colegio y a\u00F1o';
    displayName: 'Listas \u00B7 Versi\u00F3n';
    pluralName: 'colegio-list-versions';
    singularName: 'colegio-list-version';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    aprobado_en: Schema.Attribute.DateTime;
    aprobado_por: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    change_summary: Schema.Attribute.Component<
      'listas-utiles.change-diff',
      true
    >;
    colegio_list: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list.colegio-list'
    > &
      Schema.Attribute.Required;
    comentario_aprobador: Schema.Attribute.Text;
    comparison_base: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-list-version.colegio-list-version'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    derivatives: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-version.colegio-list-version'
    > &
      Schema.Attribute.Private;
    documentos: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-document.colegio-list-document'
    >;
    error_rate: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    estado: Schema.Attribute.Enumeration<
      ['draft', 'in_review', 'ready_for_publish', 'published', 'archived']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    estimated_value: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    etiqueta: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    fecha_actualizacion_fuente: Schema.Attribute.Date;
    fecha_publicacion_fuente: Schema.Attribute.Date;
    hash_fuentes: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 191;
      }>;
    indexado_en: Schema.Attribute.DateTime;
    indexado_por: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    items: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-item.colegio-list-item'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-version.colegio-list-version'
    > &
      Schema.Attribute.Private;
    match_score: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 100;
          min: 0;
        },
        number
      >;
    mensaje_apoderados: Schema.Attribute.RichText;
    notas: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-note.colegio-list-note'
    >;
    publishedAt: Schema.Attribute.DateTime;
    quality_flags: Schema.Attribute.Component<
      'listas-utiles.quality-flag',
      true
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url_fuente: Schema.Attribute.String;
    verificado_en: Schema.Attribute.DateTime;
    verificado_por: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    version_number: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
  };
}

export interface ApiColegioListColegioList extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_lists';
  info: {
    description: 'Cabecera de listas de \u00FAtiles por colegio y a\u00F1o';
    displayName: 'Listas \u00B7 Colegio';
    pluralName: 'colegio-lists';
    singularName: 'colegio-list';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    anio: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 2000;
        },
        number
      >;
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'> &
      Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion_interna: Schema.Attribute.Text;
    estado_global: Schema.Attribute.Enumeration<
      ['sin_versiones', 'en_proceso', 'publicado']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'sin_versiones'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list.colegio-list'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version_actual: Schema.Attribute.Relation<
      'oneToOne',
      'api::colegio-list-version.colegio-list-version'
    >;
    versiones: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list-version.colegio-list-version'
    >;
  };
}

export interface ApiColegioSostenedorColegioSostenedor
  extends Struct.CollectionTypeSchema {
  collectionName: 'colegio_sostenedores';
  info: {
    description: 'Registro de sostenedores de colegios';
    displayName: 'Colegio \u00B7 Sostenedores';
    pluralName: 'colegio-sostenedores';
    singularName: 'colegio-sostenedor';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    colegios: Schema.Attribute.Relation<'oneToMany', 'api::colegio.colegio'>;
    contacto: Schema.Attribute.Relation<'oneToOne', 'api::persona.persona'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    direccion: Schema.Attribute.Component<'contacto.direccion', false>;
    dv_rut: Schema.Attribute.String & Schema.Attribute.Required;
    emails: Schema.Attribute.Component<'contacto.email', true>;
    giro: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-sostenedor.colegio-sostenedor'
    > &
      Schema.Attribute.Private;
    nombre_fantasia: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    razon_social: Schema.Attribute.String & Schema.Attribute.Required;
    rut_completo: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    rut_sostenedor: Schema.Attribute.BigInteger &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    telefonos: Schema.Attribute.Component<'contacto.telefono', true>;
    tipo_sostenedor: Schema.Attribute.Enumeration<
      [
        'Municipalidad',
        'Corporaci\u00F3n Municipal',
        'Servicio Local de Educaci\u00F3n',
        'SLEP',
        'Particular',
        'Corporaci\u00F3n',
        'Fundaci\u00F3n',
        'Otro',
      ]
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiColegioColegio extends Struct.CollectionTypeSchema {
  collectionName: 'colegios';
  info: {
    displayName: 'Colegio';
    pluralName: 'colegios';
    singularName: 'colegio';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    attio_company_id: Schema.Attribute.String & Schema.Attribute.Unique;
    attio_metadata: Schema.Attribute.JSON;
    cartera_asignaciones: Schema.Attribute.Relation<
      'oneToMany',
      'api::cartera-asignacion.cartera-asignacion'
    >;
    colegio_nombre: Schema.Attribute.String & Schema.Attribute.Required;
    comuna: Schema.Attribute.Relation<'manyToOne', 'api::comuna.comuna'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dependencia: Schema.Attribute.Enumeration<
      [
        'Corporaci\u00F3n de Administraci\u00F3n Delegada',
        'Municipal',
        'Particular Subvencionado',
        'Particular Pagado',
        'Servicio Local de Educaci\u00F3n',
      ]
    >;
    direcciones: Schema.Attribute.Component<'contacto.direccion', true>;
    emails: Schema.Attribute.Component<'contacto.email', true>;
    estado: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado']
    > &
      Schema.Attribute.DefaultTo<'Por Verificar'>;
    estado_estab: Schema.Attribute.Enumeration<
      ['Funcionando', 'En receso', 'Cerrado', 'Autorizado sin matr\u00EDcula']
    >;
    estado_nombre: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado', 'Rechazado']
    > &
      Schema.Attribute.DefaultTo<'Por Verificar'>;
    listas_escolares: Schema.Attribute.Relation<
      'oneToMany',
      'api::lista-escolar.lista-escolar'
    >;
    listas_utiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio-list.colegio-list'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::colegio.colegio'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Component<'contacto.logo-o-avatar', false>;
    persona_trayectorias: Schema.Attribute.Relation<
      'oneToMany',
      'api::persona-trayectoria.persona-trayectoria'
    >;
    provincia: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rbd: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    rbd_digito_verificador: Schema.Attribute.String;
    region: Schema.Attribute.String;
    ruralidad: Schema.Attribute.Enumeration<['Urbano', 'Rural']>;
    sostenedor: Schema.Attribute.Relation<
      'manyToOne',
      'api::colegio-sostenedor.colegio-sostenedor'
    >;
    telefonos: Schema.Attribute.Component<'contacto.telefono', true>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    Website: Schema.Attribute.Component<'contacto.website', true>;
    zona: Schema.Attribute.String;
  };
}

export interface ApiComunaComuna extends Struct.CollectionTypeSchema {
  collectionName: 'comunas';
  info: {
    displayName: 'Ubicaci\u00F3n. Comuna';
    pluralName: 'comunas';
    singularName: 'comuna';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    colegios: Schema.Attribute.Relation<'oneToMany', 'api::colegio.colegio'>;
    comuna_id: Schema.Attribute.Integer & Schema.Attribute.Unique;
    comuna_nombre: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::comuna.comuna'
    > &
      Schema.Attribute.Private;
    provincia_id: Schema.Attribute.Integer;
    provincia_nombre: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    region_id: Schema.Attribute.Integer;
    region_nombre: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    zona_id: Schema.Attribute.Integer;
    zona_nombre: Schema.Attribute.String;
  };
}

export interface ApiConfiguracionTurnosConfiguracionTurnos
  extends Struct.SingleTypeSchema {
  collectionName: 'configuracion_turnos';
  info: {
    description: 'Configuraci\u00F3n general del sistema de turnos';
    displayName: 'Configuraci\u00F3n Turnos';
    pluralName: 'configuracion-turnos-settings';
    singularName: 'configuracion-turnos';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    diferencia_notificacion_proximo: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<4>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::configuracion-turnos.configuracion-turnos'
    > &
      Schema.Attribute.Private;
    mensaje_bienvenida: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<'\u00A1Hola! Bienvenido al sistema de turnos.'>;
    mensaje_llamado: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<'\u00A1Es tu turno! {numero} - Por favor dir\u00EDgete a {ubicacion}'>;
    mensaje_proximo: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<'\u00A1Est\u00E1s pr\u00F3ximo! Tu n\u00FAmero {numero} ser\u00E1 llamado pronto.'>;
    mensaje_turno_asignado: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<'Tu n\u00FAmero de atenci\u00F3n es {numero}. Tiempo estimado: {tiempo} minutos.'>;
    publishedAt: Schema.Attribute.DateTime;
    tiempo_estimado_por_turno: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<5>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    whatsapp_api_url: Schema.Attribute.String;
    whatsapp_numero: Schema.Attribute.String;
  };
}

export interface ApiCotizacionesCotizacion extends Struct.CollectionTypeSchema {
  collectionName: 'cotizaciones';
  info: {
    description: 'Cotizaciones comerciales generadas en intranet';
    displayName: 'Documentos \u00B7 Cotizaci\u00F3n';
    pluralName: 'cotizaciones';
    singularName: 'cotizacion';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    anio: Schema.Attribute.Integer & Schema.Attribute.Required;
    beneficios: Schema.Attribute.Component<'cotizaciones.beneficio', true>;
    cliente: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    condiciones: Schema.Attribute.RichText;
    contacto: Schema.Attribute.Relation<'manyToOne', 'api::persona.persona'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descuento_total: Schema.Attribute.Decimal;
    ejecutiva: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    estado: Schema.Attribute.Enumeration<
      ['borrador', 'enviada', 'aceptada', 'rechazada']
    > &
      Schema.Attribute.DefaultTo<'borrador'>;
    fecha: Schema.Attribute.Date;
    fecha_vencimiento: Schema.Attribute.Date;
    items: Schema.Attribute.Component<'cotizaciones.item', true>;
    lista_descuento: Schema.Attribute.Relation<
      'manyToOne',
      'api::lista-descuento.lista-descuento'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::cotizaciones.cotizacion'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    numero: Schema.Attribute.UID & Schema.Attribute.Required;
    observaciones: Schema.Attribute.RichText;
    pdf_url: Schema.Attribute.Media<'files'>;
    publishedAt: Schema.Attribute.DateTime;
    subtotal: Schema.Attribute.Decimal;
    total: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCursoAsignaturaCursoAsignatura
  extends Struct.CollectionTypeSchema {
  collectionName: 'curso_asignaturas';
  info: {
    description: 'Oferta de una asignatura en un curso y a\u00F1o, con matr\u00EDcula';
    displayName: 'Colegio \u00B7 Curso Asignatura';
    pluralName: 'curso-asignaturas';
    singularName: 'curso-asignatura';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    anio: Schema.Attribute.Integer;
    asignatura: Schema.Attribute.Relation<
      'manyToOne',
      'api::asignatura.asignatura'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    curso: Schema.Attribute.Relation<'manyToOne', 'api::curso.curso'>;
    curso_letra_anio: Schema.Attribute.String;
    grupo: Schema.Attribute.String;
    letra: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::curso-asignatura.curso-asignatura'
    > &
      Schema.Attribute.Private;
    matricula: Schema.Attribute.Integer;
    nota: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    uniq_key: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCursoCurso extends Struct.CollectionTypeSchema {
  collectionName: 'cursos';
  info: {
    displayName: 'Colegio \u00B7 Cursos';
    pluralName: 'cursos';
    singularName: 'curso';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    anio: Schema.Attribute.Integer;
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    curso_letra_anio: Schema.Attribute.String;
    letra: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::curso.curso'> &
      Schema.Attribute.Private;
    matricula: Schema.Attribute.Integer;
    nivel_ref: Schema.Attribute.Relation<'manyToOne', 'api::nivel.nivel'>;
    nota: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    titulo: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCustomerCustomer extends Struct.CollectionTypeSchema {
  collectionName: 'customers';
  info: {
    displayName: 'Persona \u00B7 Clientes';
    pluralName: 'customers';
    singularName: 'customer';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    createdFromOrder: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    email: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    externalIds: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::customer.customer'
    > &
      Schema.Attribute.Private;
    originPlatform: Schema.Attribute.Enumeration<
      ['woo_moraleja', 'woo_escolar', 'otros']
    >;
    persona: Schema.Attribute.Relation<'manyToOne', 'api::persona.persona'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDatosFacturacionDatosFacturacion
  extends Struct.CollectionTypeSchema {
  collectionName: 'datos_facturacions';
  info: {
    displayName: 'Datos Facturaci\u00F3n';
    pluralName: 'datos-facturacions';
    singularName: 'datos-facturacion';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    comuna_colegio: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    dependencia: Schema.Attribute.String;
    direccion: Schema.Attribute.Component<'contacto.direccion', false>;
    giro: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::datos-facturacion.datos-facturacion'
    > &
      Schema.Attribute.Private;
    nombre_colegio: Schema.Attribute.String;
    nombre_facturacion: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rbd: Schema.Attribute.Integer;
    rut: Schema.Attribute.String & Schema.Attribute.Unique;
    tipo_empresa: Schema.Attribute.Enumeration<
      ['Empresa', 'Colegio', 'Librer\u00EDa', 'Editorial', 'Otro']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEditorialEditorial extends Struct.CollectionTypeSchema {
  collectionName: 'editoriales';
  info: {
    description: 'Cat\u00E1logo de editoriales disponibles';
    displayName: 'Product \u00B7 Libro \u00B7 Editorial';
    pluralName: 'editoriales';
    singularName: 'editorial';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    acronimo: Schema.Attribute.String;
    colecciones: Schema.Attribute.Relation<
      'oneToMany',
      'api::coleccion.coleccion'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    externalIds: Schema.Attribute.JSON;
    id_editorial: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    libros: Schema.Attribute.Relation<'oneToMany', 'api::libro.libro'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::editorial.editorial'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    nombre_editorial: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    sellos: Schema.Attribute.Relation<'oneToMany', 'api::sello.sello'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    website: Schema.Attribute.String;
  };
}

export interface ApiEmailLogEmailLog extends Struct.CollectionTypeSchema {
  collectionName: 'email_logs';
  info: {
    description: 'Historial de env\u00EDos de correos automatizados';
    displayName: 'Email \u00B7 Log';
    pluralName: 'email-logs';
    singularName: 'email-log';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    attachments: Schema.Attribute.JSON;
    bcc: Schema.Attribute.JSON;
    campaign_id: Schema.Attribute.String;
    cc: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    error_message: Schema.Attribute.Text;
    from_address: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::email-log.email-log'
    > &
      Schema.Attribute.Private;
    payload: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    reply_to: Schema.Attribute.String;
    response: Schema.Attribute.JSON;
    sent_at: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['pending', 'sent', 'failed']> &
      Schema.Attribute.DefaultTo<'pending'>;
    subject: Schema.Attribute.String;
    template: Schema.Attribute.Relation<
      'manyToOne',
      'api::email-template.email-template'
    >;
    template_key: Schema.Attribute.String & Schema.Attribute.Required;
    to: Schema.Attribute.JSON & Schema.Attribute.Required;
    to_primary: Schema.Attribute.String;
    triggered_by: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEmailTemplateEmailTemplate
  extends Struct.CollectionTypeSchema {
  collectionName: 'email_templates';
  info: {
    description: 'Plantillas parametrizables para los env\u00EDos autom\u00E1ticos';
    displayName: 'Email \u00B7 Template';
    pluralName: 'email-templates';
    singularName: 'email-template';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    aprobado_en: Schema.Attribute.DateTime;
    aprobado_por: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    autores: Schema.Attribute.Relation<
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    bcc: Schema.Attribute.JSON;
    body_html: Schema.Attribute.RichText;
    body_text: Schema.Attribute.Text;
    cc: Schema.Attribute.JSON;
    Ciclo: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    estado: Schema.Attribute.Enumeration<
      ['Borrador', 'En revisi\u00F3n', 'Aprobado', 'Archivado']
    > &
      Schema.Attribute.DefaultTo<'Borrador'>;
    etapa: Schema.Attribute.Enumeration<['Inicio', 'Curso', 'Cierre', 'Fin']>;
    fecha_sugerida: Schema.Attribute.Date;
    from_email: Schema.Attribute.Email;
    from_name: Schema.Attribute.String;
    key: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::email-template.email-template'
    > &
      Schema.Attribute.Private;
    logs: Schema.Attribute.Relation<'oneToMany', 'api::email-log.email-log'>;
    meta: Schema.Attribute.JSON;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    notes: Schema.Attribute.Text;
    preheader: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    reply_to: Schema.Attribute.Email;
    segmentos_asignaturas: Schema.Attribute.JSON;
    segmentos_niveles: Schema.Attribute.JSON;
    subject: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEmpresaEmpresa extends Struct.CollectionTypeSchema {
  collectionName: 'empresas';
  info: {
    displayName: 'Intranet \u00B7 Empresa';
    pluralName: 'empresas';
    singularName: 'empresa';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    colaboradores: Schema.Attribute.Relation<
      'oneToMany',
      'api::colaborador.colaborador'
    >;
    colores: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    favicon: Schema.Attribute.Component<'shared.media', false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::empresa.empresa'
    > &
      Schema.Attribute.Private;
    logo_principal: Schema.Attribute.Component<'shared.media', false>;
    logo_secundario: Schema.Attribute.Component<'shared.media', false>;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    nombre_corto: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'nombre'> & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    website: Schema.Attribute.String;
  };
}

export interface ApiEtiquetaEtiqueta extends Struct.CollectionTypeSchema {
  collectionName: 'etiquetas';
  info: {
    description: 'Etiquetas de productos para WooCommerce (Product Tags)';
    displayName: 'Etiqueta (Tag)';
    pluralName: 'etiquetas';
    singularName: 'etiqueta';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Text;
    externalIds: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::etiqueta.etiqueta'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiHomeHeroHomeHero extends Struct.SingleTypeSchema {
  collectionName: 'home_hero';
  info: {
    description: 'Configuraci\u00F3n de campa\u00F1as y hero principal de la portada';
    displayName: 'Home \u00B7 Hero';
    pluralName: 'home-heroes';
    singularName: 'home-hero';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    active_from: Schema.Attribute.DateTime & Schema.Attribute.Required;
    active_until: Schema.Attribute.DateTime;
    background_style: Schema.Attribute.Enumeration<
      ['gradient', 'image', 'video']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'gradient'>;
    campaign_tag: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    highlight: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 80;
      }>;
    is_default: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::home-hero.home-hero'
    > &
      Schema.Attribute.Private;
    media: Schema.Attribute.Media<'images'>;
    primary_cta: Schema.Attribute.Component<'home.cta-link', false> &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    secondary_cta: Schema.Attribute.Component<'home.cta-link', false>;
    seo: Schema.Attribute.Component<'shared.seo', false>;
    stats: Schema.Attribute.Component<'home.hero-stat', true> &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          max: 4;
          min: 1;
        },
        number
      >;
    structured_data: Schema.Attribute.JSON;
    subtitle: Schema.Attribute.RichText & Schema.Attribute.Required;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    video_url: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 2048;
      }>;
  };
}

export interface ApiIntranetChatIntranetChat
  extends Struct.CollectionTypeSchema {
  collectionName: 'intranet_chats';
  info: {
    description: 'Mensajes del chat de la intranet con clientes de WO-Clientes';
    displayName: 'Intranet-Chats';
    pluralName: 'intranet-chats';
    singularName: 'intranet-chat';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    cliente_id: Schema.Attribute.Integer & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fecha: Schema.Attribute.DateTime & Schema.Attribute.Required;
    leido: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::intranet-chat.intranet-chat'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    remitente_id: Schema.Attribute.Integer & Schema.Attribute.Required;
    texto: Schema.Attribute.Text & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiIntranetUsuarioClienteIntranetUsuarioCliente
  extends Struct.CollectionTypeSchema {
  collectionName: 'intranet_usuarios_clientes';
  info: {
    description: 'Vincula usuarios de Strapi (users-permissions) con clientes de WO-Clientes para autenticaci\u00F3n en la intranet';
    displayName: 'Intranet \u00B7 Usuarios Cliente';
    pluralName: 'intranet-usuarios-clientes';
    singularName: 'intranet-usuario-cliente';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    cliente: Schema.Attribute.Relation<
      'oneToOne',
      'api::wo-cliente.wo-cliente'
    > &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fecha_registro: Schema.Attribute.DateTime &
      Schema.Attribute.DefaultTo<'now()'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::intranet-usuario-cliente.intranet-usuario-cliente'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    ultimo_acceso: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    usuario: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
  };
}

export interface ApiLibroLibro extends Struct.CollectionTypeSchema {
  collectionName: 'libros';
  info: {
    description: 'Libros con los campos m\u00EDnimos para catalogar';
    displayName: 'Product \u00B7 Libro \u00B7 Edici\u00F3n';
    pluralName: 'libros';
    singularName: 'libro';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    agno_edicion: Schema.Attribute.Integer;
    autor_relacion: Schema.Attribute.Relation<'manyToOne', 'api::autor.autor'>;
    canales: Schema.Attribute.Relation<'manyToMany', 'api::canal.canal'>;
    catalog_visibility: Schema.Attribute.Enumeration<
      ['visible', 'catalog', 'search', 'hidden']
    > &
      Schema.Attribute.DefaultTo<'visible'>;
    categorias_producto: Schema.Attribute.Relation<
      'manyToMany',
      'api::categoria-producto.categoria-producto'
    >;
    coleccion: Schema.Attribute.Relation<
      'manyToOne',
      'api::coleccion.coleccion'
    >;
    completitud_basica: Schema.Attribute.JSON;
    completo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Blocks;
    downloadable: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    editorial: Schema.Attribute.Relation<
      'manyToOne',
      'api::editorial.editorial'
    >;
    estado_edicion: Schema.Attribute.Enumeration<
      ['Vigente', 'Stock Limitado', 'Descatalogado']
    > &
      Schema.Attribute.DefaultTo<'Vigente'>;
    estado_publicacion: Schema.Attribute.Enumeration<
      ['Publicado', 'Pendiente', 'Borrador']
    > &
      Schema.Attribute.DefaultTo<'Pendiente'>;
    etiquetas: Schema.Attribute.Relation<
      'manyToMany',
      'api::etiqueta.etiqueta'
    >;
    externalIds: Schema.Attribute.JSON;
    faltantes: Schema.Attribute.JSON;
    featured: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    height: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    idioma: Schema.Attribute.Enumeration<
      ['Espa\u00F1ol', 'Ingl\u00E9s', 'Franc\u00E9s', 'Alem\u00E1n', 'Otro']
    >;
    imagenes_interior: Schema.Attribute.Media<undefined, true>;
    isbn_libro: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    length: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    libros_relacionados: Schema.Attribute.Relation<
      'manyToMany',
      'api::libro.libro'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::libro.libro'> &
      Schema.Attribute.Private;
    manage_stock: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    marcas: Schema.Attribute.Relation<'manyToMany', 'api::marca.marca'>;
    nombre_libro: Schema.Attribute.String & Schema.Attribute.Required;
    numero_edicion: Schema.Attribute.Integer;
    obra: Schema.Attribute.Relation<'manyToOne', 'api::obra.obra'>;
    ofertas: Schema.Attribute.Relation<
      'oneToMany',
      'api::oferta-producto.oferta-producto'
    >;
    portada_libro: Schema.Attribute.Media;
    precio: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    precio_oferta: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    precio_regular: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    sello: Schema.Attribute.Relation<'manyToOne', 'api::sello.sello'>;
    stock_quantity: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    stock_status: Schema.Attribute.Enumeration<
      ['instock', 'outofstock', 'onbackorder']
    > &
      Schema.Attribute.DefaultTo<'instock'>;
    subtitulo_libro: Schema.Attribute.String;
    tax_class: Schema.Attribute.String;
    tax_status: Schema.Attribute.Enumeration<['taxable', 'shipping', 'none']> &
      Schema.Attribute.DefaultTo<'taxable'>;
    tipo_libro: Schema.Attribute.Enumeration<
      [
        'Plan Lector',
        'Texto Curricular',
        'Texto PAES',
        'Texto Complementario',
        'Otro',
      ]
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    virtual: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    weight: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    width: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface ApiListaDescuentoListaDescuento
  extends Struct.CollectionTypeSchema {
  collectionName: 'lista_descuentos';
  info: {
    description: 'Listas de descuento aplicables a cotizaciones';
    displayName: 'Documentos \u00B7 Lista de descuento';
    pluralName: 'lista-descuentos';
    singularName: 'lista-descuento';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Text;
    descuento_base: Schema.Attribute.Decimal;
    ejecutivas_autorizadas: Schema.Attribute.Relation<
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    items: Schema.Attribute.Component<'lista-descuento.regla', true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lista-descuento.lista-descuento'
    > &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vigencia_fin: Schema.Attribute.Date;
    vigencia_inicio: Schema.Attribute.Date;
  };
}

export interface ApiListaEscolarListaEscolar
  extends Struct.CollectionTypeSchema {
  collectionName: 'listas_escolares';
  info: {
    description: 'Flujo de carga, tabulaci\u00F3n y aprobaci\u00F3n de listas escolares';
    displayName: 'Lista Escolar';
    pluralName: 'listas-escolares';
    singularName: 'lista-escolar';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    anio: Schema.Attribute.Integer & Schema.Attribute.Required;
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    documentos: Schema.Attribute.Component<'listas.documento', true>;
    estado: Schema.Attribute.Enumeration<
      [
        'cargada',
        'analizada',
        'pendiente_validacion',
        'pendiente_aprobacion',
        'aprobada',
        'rechazada',
      ]
    > &
      Schema.Attribute.DefaultTo<'cargada'>;
    etiquetas: Schema.Attribute.JSON;
    historial: Schema.Attribute.Component<'listas.historial', true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::lista-escolar.lista-escolar'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    tabulaciones: Schema.Attribute.Component<'listas.tabulacion', true>;
    titulo: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    version_actual: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<1>;
  };
}

export interface ApiMailerliteMailerlite extends Struct.SingleTypeSchema {
  collectionName: 'mailerlite_config';
  info: {
    description: 'Configuraci\u00F3n de integraci\u00F3n con MailerLite';
    displayName: 'MailerLite';
    pluralName: 'mailerlites';
    singularName: 'mailerlite';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    default_groups: Schema.Attribute.JSON;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    group_mapping: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::mailerlite.mailerlite'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMarcaMarca extends Struct.CollectionTypeSchema {
  collectionName: 'marcas';
  info: {
    description: 'Marcas de productos para WooCommerce (Brands)';
    displayName: 'Marca (Brand)';
    pluralName: 'marcas';
    singularName: 'marca';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Text;
    estado_publicacion: Schema.Attribute.Enumeration<
      ['pendiente', 'publicado']
    > &
      Schema.Attribute.DefaultTo<'pendiente'>;
    externalIds: Schema.Attribute.JSON;
    imagen: Schema.Attribute.Media;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::marca.marca'> &
      Schema.Attribute.Private;
    marca_padre: Schema.Attribute.Relation<'manyToOne', 'api::marca.marca'>;
    marcas_hijas: Schema.Attribute.Relation<'oneToMany', 'api::marca.marca'>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMaterialMaterial extends Struct.CollectionTypeSchema {
  collectionName: 'materials';
  info: {
    description: 'Material o insumo b\u00E1sico';
    displayName: 'Product \u00B7 Material \u00B7 Ficha';
    pluralName: 'materials';
    singularName: 'material';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    categoria: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ean: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::material.material'
    > &
      Schema.Attribute.Private;
    marca: Schema.Attribute.String;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    obra: Schema.Attribute.Relation<'manyToOne', 'api::obra.obra'>;
    publishedAt: Schema.Attribute.DateTime;
    subcategoria: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMediaAssetMediaAsset extends Struct.CollectionTypeSchema {
  collectionName: 'media_assets';
  info: {
    description: 'Repositorio centralizado de archivos multimedia';
    displayName: 'Media Asset';
    pluralName: 'media-assets';
    singularName: 'media-asset';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assetType: Schema.Attribute.Enumeration<
      ['image', 'video', 'audio', 'document', 'other']
    > &
      Schema.Attribute.DefaultTo<'other'>;
    categories: Schema.Attribute.Relation<
      'manyToMany',
      'api::media-category.media-category'
    >;
    colorPalette: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.RichText;
    durationSeconds: Schema.Attribute.Integer;
    externalUrl: Schema.Attribute.String;
    file: Schema.Attribute.Media<'images' | 'videos' | 'files' | 'audios'> &
      Schema.Attribute.Required;
    fileSizeBytes: Schema.Attribute.Integer;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-asset.media-asset'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    mimeType: Schema.Attribute.String;
    publicUrl: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'title'> &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    source: Schema.Attribute.Enumeration<
      ['interno', 'proveedor', 'fotografo', 'campana', 'otro']
    >;
    status: Schema.Attribute.Enumeration<['active', 'hidden']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'active'>;
    tags: Schema.Attribute.Relation<'manyToMany', 'api::media-tag.media-tag'>;
    thumbnail: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 200;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    uploadedAt: Schema.Attribute.DateTime;
    uploadedBy: Schema.Attribute.Relation<'manyToOne', 'admin::user'>;
    usageNotes: Schema.Attribute.Text;
    width: Schema.Attribute.Integer;
  };
}

export interface ApiMediaCategoryMediaCategory
  extends Struct.CollectionTypeSchema {
  collectionName: 'media_categories';
  info: {
    displayName: 'Media Category';
    pluralName: 'media-categories';
    singularName: 'media-category';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assets: Schema.Attribute.Relation<
      'manyToMany',
      'api::media-asset.media-asset'
    >;
    children: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-category.media-category'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-category.media-category'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 160;
      }>;
    parent: Schema.Attribute.Relation<
      'manyToOne',
      'api::media-category.media-category'
    >;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiMediaTagMediaTag extends Struct.CollectionTypeSchema {
  collectionName: 'media_tags';
  info: {
    displayName: 'Media Tag';
    pluralName: 'media-tags';
    singularName: 'media-tag';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    assets: Schema.Attribute.Relation<
      'manyToMany',
      'api::media-asset.media-asset'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-tag.media-tag'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 120;
      }>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'> &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiNivelNivel extends Struct.CollectionTypeSchema {
  collectionName: 'niveles';
  info: {
    description: 'Cat\u00E1logo de niveles educativos';
    displayName: 'Colegio \u00B7 Niveles';
    pluralName: 'niveles';
    singularName: 'nivel';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    ciclo: Schema.Attribute.String;
    clave: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ensenanza: Schema.Attribute.Enumeration<
      ['Parvularia', 'B\u00E1sica', 'Media']
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::nivel.nivel'> &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    orden: Schema.Attribute.Integer;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiObraObra extends Struct.CollectionTypeSchema {
  collectionName: 'obras';
  info: {
    description: 'Contenido abstracto independiente de la edici\u00F3n';
    displayName: 'Product \u00B7 Libro \u00B7 Obra';
    pluralName: 'obras';
    singularName: 'obra';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    autores: Schema.Attribute.Relation<'manyToMany', 'api::autor.autor'>;
    codigo_obra: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Text;
    ediciones: Schema.Attribute.Relation<'oneToMany', 'api::libro.libro'>;
    estado_publicacion: Schema.Attribute.Enumeration<
      ['pendiente', 'publicado', 'borrador']
    > &
      Schema.Attribute.DefaultTo<'pendiente'>;
    etiquetas: Schema.Attribute.JSON;
    externalIds: Schema.Attribute.JSON;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::obra.obra'> &
      Schema.Attribute.Private;
    materiales: Schema.Attribute.Relation<
      'oneToMany',
      'api::material.material'
    >;
    nombre_obra: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOfertaProductoOfertaProducto
  extends Struct.CollectionTypeSchema {
  collectionName: 'oferta_productos';
  info: {
    description: 'Registro de precios y stock observados para un producto';
    displayName: 'Product \u00B7 Precio \u00B7 Oferta \u00B7 Canal';
    pluralName: 'oferta-productos';
    singularName: 'oferta-producto';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    canal: Schema.Attribute.String;
    condicion: Schema.Attribute.Enumeration<
      ['nuevo', 'usado', 'reacondicionado']
    > &
      Schema.Attribute.DefaultTo<'nuevo'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ean: Schema.Attribute.String & Schema.Attribute.Required;
    libro: Schema.Attribute.Relation<'manyToOne', 'api::libro.libro'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::oferta-producto.oferta-producto'
    > &
      Schema.Attribute.Private;
    moneda: Schema.Attribute.String & Schema.Attribute.DefaultTo<'CLP'>;
    notas: Schema.Attribute.Text;
    precio: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    stock: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    tipo_producto: Schema.Attribute.Enumeration<['libro', 'material', 'otro']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'libro'>;
    ubicacion: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    vendedor: Schema.Attribute.String;
  };
}

export interface ApiPedidoPedido extends Struct.CollectionTypeSchema {
  collectionName: 'pedidos';
  info: {
    description: 'Pedidos sincronizados desde WooCommerce (Moraleja y Librer\u00EDa Escolar)';
    displayName: 'Ecommerce \u00B7 Pedido';
    pluralName: 'pedidos';
    singularName: 'pedido';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    billing: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    customer: Schema.Attribute.Relation<'manyToOne', 'api::customer.customer'>;
    descuento: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    envio: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    estado: Schema.Attribute.Enumeration<
      [
        'pending',
        'processing',
        'on-hold',
        'completed',
        'cancelled',
        'refunded',
        'failed',
      ]
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    externalIds: Schema.Attribute.JSON;
    fecha_creacion: Schema.Attribute.DateTime & Schema.Attribute.Required;
    fecha_modificacion: Schema.Attribute.DateTime;
    impuestos: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    items: Schema.Attribute.Component<'pedido.item', true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::pedido.pedido'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    metodo_envio: Schema.Attribute.String;
    metodo_pago: Schema.Attribute.String;
    metodo_pago_titulo: Schema.Attribute.String;
    moneda: Schema.Attribute.String & Schema.Attribute.DefaultTo<'CLP'>;
    nota_cliente: Schema.Attribute.Text;
    notas_privadas: Schema.Attribute.Text;
    numero_pedido: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    originPlatform: Schema.Attribute.Enumeration<
      ['woo_moraleja', 'woo_escolar']
    > &
      Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    shipping: Schema.Attribute.JSON;
    subtotal: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    total: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    woocommerce_id: Schema.Attribute.String;
  };
}

export interface ApiPersonaTagPersonaTag extends Struct.CollectionTypeSchema {
  collectionName: 'persona_tags';
  info: {
    displayName: 'Persona \u00B7 Persona Tag';
    pluralName: 'persona-tags';
    singularName: 'persona-tag';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::persona-tag.persona-tag'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPersonaTrayectoriaPersonaTrayectoria
  extends Struct.CollectionTypeSchema {
  collectionName: 'persona_trayectorias';
  info: {
    description: 'Historial de cargos por colegio/curso/asignatura';
    displayName: 'Colegio \u00B7 Profesores';
    pluralName: 'persona-trayectorias';
    singularName: 'persona-trayectoria';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    anio: Schema.Attribute.Integer;
    asignatura: Schema.Attribute.Relation<
      'manyToOne',
      'api::asignatura.asignatura'
    >;
    cargo: Schema.Attribute.String;
    colegio: Schema.Attribute.Relation<'manyToOne', 'api::colegio.colegio'>;
    colegio_comuna: Schema.Attribute.Relation<
      'manyToOne',
      'api::comuna.comuna'
    >;
    colegio_region: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    curso: Schema.Attribute.Relation<'manyToOne', 'api::curso.curso'>;
    curso_asignatura: Schema.Attribute.Relation<
      'manyToOne',
      'api::curso-asignatura.curso-asignatura'
    >;
    department: Schema.Attribute.String;
    fecha_fin: Schema.Attribute.Date;
    fecha_inicio: Schema.Attribute.Date;
    is_current: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::persona-trayectoria.persona-trayectoria'
    > &
      Schema.Attribute.Private;
    notas: Schema.Attribute.Text;
    org_display_name: Schema.Attribute.String;
    persona: Schema.Attribute.Relation<'manyToOne', 'api::persona.persona'> &
      Schema.Attribute.SetPluginOptions<{
        'content-manager': {
          mainField: 'nombre_completo';
          visible: true;
        };
      }>;
    publishedAt: Schema.Attribute.DateTime;
    role_key: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPersonaPersona extends Struct.CollectionTypeSchema {
  collectionName: 'personas';
  info: {
    description: 'Contacto acad\u00E9mico y general';
    displayName: 'Persona';
    mainField: 'rut';
    pluralName: 'personas';
    singularName: 'persona';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    cartera_asignaciones: Schema.Attribute.Relation<
      'oneToMany',
      'api::cartera-asignacion.cartera-asignacion'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    cumpleagno: Schema.Attribute.Date;
    emails: Schema.Attribute.Component<'contacto.email', true>;
    genero: Schema.Attribute.Enumeration<['Mujer', 'Hombre']>;
    identificadores_externos: Schema.Attribute.JSON;
    imagen: Schema.Attribute.Component<'contacto.logo-o-avatar', false>;
    iniciales: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::persona.persona'
    > &
      Schema.Attribute.Private;
    nivel_confianza: Schema.Attribute.Enumeration<['baja', 'media', 'alta']> &
      Schema.Attribute.DefaultTo<'baja'>;
    nombre_apellidos: Schema.Attribute.String;
    nombre_completo: Schema.Attribute.String;
    nombres: Schema.Attribute.String;
    notas: Schema.Attribute.Text;
    origen: Schema.Attribute.Enumeration<
      ['mineduc', 'csv', 'manual', 'crm', 'web', 'otro']
    > &
      Schema.Attribute.DefaultTo<'manual'>;
    portal_account: Schema.Attribute.Component<'portal.account', false>;
    portal_last_synced_at: Schema.Attribute.DateTime;
    portal_preferences: Schema.Attribute.Component<'portal.preferences', false>;
    portal_roles: Schema.Attribute.Component<'portal.access-role', true>;
    portal_snapshot: Schema.Attribute.JSON;
    primer_apellido: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rut: Schema.Attribute.String & Schema.Attribute.Unique;
    segundo_apellido: Schema.Attribute.String;
    status_nombres: Schema.Attribute.Enumeration<
      ['Por Verificar', 'Verificado', 'Aprobado', 'Eliminado', 'Rechazado']
    >;
    tags: Schema.Attribute.Relation<
      'manyToMany',
      'api::persona-tag.persona-tag'
    >;
    telefonos: Schema.Attribute.Component<'contacto.telefono', true>;
    trayectorias: Schema.Attribute.Relation<
      'oneToMany',
      'api::persona-trayectoria.persona-trayectoria'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPrecioPrecio extends Struct.CollectionTypeSchema {
  collectionName: 'precios';
  info: {
    description: 'Precios de venta y costo de los libros con fechas de vigencia';
    displayName: 'Product \u00B7 Precio';
    pluralName: 'precios';
    singularName: 'precio';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fecha_fin: Schema.Attribute.DateTime;
    fecha_inicio: Schema.Attribute.DateTime & Schema.Attribute.Required;
    libro: Schema.Attribute.Relation<'manyToOne', 'api::libro.libro'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::precio.precio'
    > &
      Schema.Attribute.Private;
    precio_costo: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    precio_venta: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPromocionContactoPromocionContacto
  extends Struct.CollectionTypeSchema {
  collectionName: 'promocion_contactos';
  info: {
    description: 'Listado temporal para campa\u00F1as de correo.';
    displayName: 'Promoci\u00F3n Contactos';
    pluralName: 'promocion-contactos';
    singularName: 'promocion-contacto';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: true;
    };
    'content-type-builder': {
      visible: true;
    };
  };
  attributes: {
    apellido: Schema.Attribute.String;
    asignaturas: Schema.Attribute.Text;
    cargo: Schema.Attribute.String;
    cartera_comercial_ejecutivo_nombre: Schema.Attribute.Enumeration<
      ['Ana Dolores De la Hoz', 'Margarita Salcedo', 'Sin Asignar']
    >;
    cartera_comercial_prioridad: Schema.Attribute.Enumeration<
      ['Alta', 'Media', 'Baja']
    >;
    ciclo: Schema.Attribute.JSON;
    colegio_nombre: Schema.Attribute.String & Schema.Attribute.Required;
    comuna_nombre: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    departamento: Schema.Attribute.JSON;
    dependencia: Schema.Attribute.Enumeration<
      [
        'Particular Pagado',
        'Particular Subvencionado',
        'Municipal',
        'Administraci\u00F3n Delegada',
        'Corporaci\u00F3n Municipal',
        'Preuniversitario',
      ]
    >;
    email: Schema.Attribute.Email;
    email_1_email: Schema.Attribute.Email;
    id_rut: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::promocion-contacto.promocion-contacto'
    > &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    orden: Schema.Attribute.Integer;
    promocion_2025: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    publishedAt: Schema.Attribute.DateTime;
    rbd: Schema.Attribute.String & Schema.Attribute.Required;
    region_nombre: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    website_1_website: Schema.Attribute.String;
  };
}

export interface ApiPromocionPantallaPromocionPantalla
  extends Struct.CollectionTypeSchema {
  collectionName: 'promociones_pantalla';
  info: {
    description: 'Promociones para mostrar en la pantalla p\u00FAblica de turnos';
    displayName: 'Promoci\u00F3n \u00B7 Pantalla';
    pluralName: 'promociones-pantalla';
    singularName: 'promocion-pantalla';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    color_fin: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'purple-600'>;
    color_inicio: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'blue-600'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Text;
    duracion_segundos: Schema.Attribute.Integer &
      Schema.Attribute.DefaultTo<10>;
    imagen: Schema.Attribute.Media<'images'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::promocion-pantalla.promocion-pantalla'
    > &
      Schema.Attribute.Private;
    orden: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    subtitulo: Schema.Attribute.String;
    titulo: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    video: Schema.Attribute.Media<'videos' | 'files'>;
  };
}

export interface ApiProveedorProveedor extends Struct.CollectionTypeSchema {
  collectionName: 'proveedores';
  info: {
    description: 'Proveedores de productos (editoriales, distribuidores, etc.)';
    displayName: 'Product \u00B7 Inventario \u00B7 Proveedor';
    pluralName: 'proveedores';
    singularName: 'proveedor';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    codigo: Schema.Attribute.String & Schema.Attribute.Unique;
    contacto_email: Schema.Attribute.Email;
    contacto_nombre: Schema.Attribute.String;
    contacto_telefono: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    direccion: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::proveedor.proveedor'
    > &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    rut: Schema.Attribute.String;
    tiempo_entrega_dias: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSelloSello extends Struct.CollectionTypeSchema {
  collectionName: 'sellos';
  info: {
    description: 'Sellos editoriales asociados a una editorial';
    displayName: 'Product \u00B7 Libro \u00B7 Sello';
    pluralName: 'sellos';
    singularName: 'sello';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    acronimo: Schema.Attribute.String;
    colecciones: Schema.Attribute.Relation<
      'oneToMany',
      'api::coleccion.coleccion'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    editorial: Schema.Attribute.Relation<
      'manyToOne',
      'api::editorial.editorial'
    >;
    estado_publicacion: Schema.Attribute.Enumeration<
      ['pendiente', 'publicado']
    > &
      Schema.Attribute.DefaultTo<'pendiente'>;
    externalIds: Schema.Attribute.JSON;
    id_sello: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    libros: Schema.Attribute.Relation<'oneToMany', 'api::libro.libro'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::sello.sello'> &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    nombre_sello: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    website: Schema.Attribute.String;
  };
}

export interface ApiStockStock extends Struct.CollectionTypeSchema {
  collectionName: 'stocks';
  info: {
    description: 'Registro de stock de un libro en una ubicaci\u00F3n espec\u00EDfica';
    displayName: 'Product \u00B7 Inventario \u00B7 Stock';
    pluralName: 'stocks';
    singularName: 'stock';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    caja: Schema.Attribute.String;
    cantidad_disponible: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    cantidad_en_produccion: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    cantidad_en_transito: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    cantidad_preventa: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    fecha_estimada_produccion: Schema.Attribute.Date;
    fecha_estimada_transito: Schema.Attribute.Date;
    libro: Schema.Attribute.Relation<'manyToOne', 'api::libro.libro'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::stock.stock'> &
      Schema.Attribute.Private;
    pasillo: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    rack: Schema.Attribute.String;
    repisa: Schema.Attribute.String;
    stock_minimo: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    ubicacion: Schema.Attribute.Relation<
      'manyToOne',
      'api::ubicacion.ubicacion'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTurnoTurno extends Struct.CollectionTypeSchema {
  collectionName: 'turnos';
  info: {
    description: 'Sistema de gesti\u00F3n de turnos para atenci\u00F3n al cliente';
    displayName: 'Turnos \u00B7 Tienda';
    pluralName: 'turnos';
    singularName: 'turno';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    estado: Schema.Attribute.Enumeration<
      ['pendiente', 'proximo', 'llamado', 'atendido', 'cancelado']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pendiente'>;
    hora_atencion: Schema.Attribute.DateTime;
    hora_creacion: Schema.Attribute.DateTime & Schema.Attribute.Required;
    hora_llamado: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::turno.turno'> &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    nombre_cliente: Schema.Attribute.String;
    notificacion_llamado_enviada: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    notificacion_proximo_enviada: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    numero: Schema.Attribute.String & Schema.Attribute.Required;
    prefijo: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'A'>;
    publishedAt: Schema.Attribute.DateTime;
    telefono_cliente: Schema.Attribute.String & Schema.Attribute.Required;
    tiempo_espera_estimado: Schema.Attribute.Integer;
    tipo: Schema.Attribute.Enumeration<['caja', 'retiros']> &
      Schema.Attribute.Required;
    ubicacion: Schema.Attribute.Enumeration<
      ['caja-1', 'caja-2', 'retiros-1', 'retiros-2']
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiUbicacionUbicacion extends Struct.CollectionTypeSchema {
  collectionName: 'ubicaciones';
  info: {
    description: 'Ubicaciones f\u00EDsicas donde se almacena el stock (bodegas, tiendas)';
    displayName: 'Product \u00B7 Inventario \u00B7 Ubicaci\u00F3n';
    pluralName: 'ubicaciones';
    singularName: 'ubicacion';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    activo: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    codigo: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    direccion: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::ubicacion.ubicacion'
    > &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiUserMailboxUserMailbox extends Struct.CollectionTypeSchema {
  collectionName: 'user_mailboxes';
  info: {
    description: 'Credenciales SMTP asociadas a usuarios o cuentas compartidas';
    displayName: 'User \u00B7 Mailbox';
    pluralName: 'user-mailboxes';
    singularName: 'user-mailbox';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    from_name: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::user-mailbox.user-mailbox'
    > &
      Schema.Attribute.Private;
    meta: Schema.Attribute.JSON;
    password: Schema.Attribute.Password &
      Schema.Attribute.Required &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    reply_to: Schema.Attribute.Email;
    secure: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    smtp_host: Schema.Attribute.String & Schema.Attribute.Required;
    smtp_port: Schema.Attribute.Integer & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ApiWoClienteWoCliente extends Struct.CollectionTypeSchema {
  collectionName: 'wo_clientes';
  info: {
    description: 'Clientes crudos sincronizados desde WooCommerce (Moraleja/Escolar)';
    displayName: 'WO-Clientes';
    pluralName: 'wo-clientes';
    singularName: 'wo-cliente';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    aov: Schema.Attribute.Decimal;
    ciudad: Schema.Attribute.String;
    codigo_postal: Schema.Attribute.String;
    correo_electronico: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    externalIds: Schema.Attribute.JSON;
    fecha_registro: Schema.Attribute.DateTime;
    gasto_total: Schema.Attribute.Decimal;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::wo-cliente.wo-cliente'
    > &
      Schema.Attribute.Private;
    nombre: Schema.Attribute.String;
    originPlatform: Schema.Attribute.Enumeration<
      ['woo_moraleja', 'woo_escolar', 'otros']
    >;
    pais_region: Schema.Attribute.String;
    pedidos: Schema.Attribute.Integer;
    persona: Schema.Attribute.Relation<'manyToOne', 'api::persona.persona'>;
    publishedAt: Schema.Attribute.DateTime;
    rawWooData: Schema.Attribute.JSON;
    region: Schema.Attribute.String;
    ultima_actividad: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    wooId: Schema.Attribute.Integer;
  };
}

export interface ApiWoCuponWoCupon extends Struct.CollectionTypeSchema {
  collectionName: 'wo_cupones';
  info: {
    description: 'Cupones sincronizados desde WooCommerce (Moraleja/Escolar)';
    displayName: 'WO-Cupones';
    pluralName: 'wo-cupones';
    singularName: 'wo-cupon';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    codigo: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descripcion: Schema.Attribute.Text;
    externalIds: Schema.Attribute.JSON;
    fecha_caducidad: Schema.Attribute.DateTime;
    importe_cupon: Schema.Attribute.Decimal;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::wo-cupon.wo-cupon'
    > &
      Schema.Attribute.Private;
    originPlatform: Schema.Attribute.Enumeration<
      ['woo_moraleja', 'woo_escolar', 'otros']
    >;
    producto_ids: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    rawWooData: Schema.Attribute.JSON;
    tipo_cupon: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    uso_limite: Schema.Attribute.Integer;
    wooId: Schema.Attribute.Integer;
  };
}

export interface ApiWoPedidoWoPedido extends Struct.CollectionTypeSchema {
  collectionName: 'wo_pedidos';
  info: {
    description: 'Pedidos de WooCommerce (Moraleja/Escolar) con todos los datos necesarios';
    displayName: 'WO-Pedidos';
    pluralName: 'wo-pedidos';
    singularName: 'wo-pedido';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    billing: Schema.Attribute.JSON;
    cliente: Schema.Attribute.Relation<
      'manyToOne',
      'api::wo-cliente.wo-cliente'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    descuento: Schema.Attribute.Decimal;
    envio: Schema.Attribute.Decimal;
    estado: Schema.Attribute.Enumeration<
      [
        'auto-draft',
        'pending',
        'processing',
        'on-hold',
        'completed',
        'cancelled',
        'refunded',
        'failed',
        'checkout-draft',
      ]
    > &
      Schema.Attribute.DefaultTo<'pending'>;
    externalIds: Schema.Attribute.JSON;
    fecha_pedido: Schema.Attribute.DateTime;
    impuestos: Schema.Attribute.Decimal;
    items: Schema.Attribute.Component<'pedido.item', true>;
    libros_para_agregar: Schema.Attribute.Relation<
      'manyToMany',
      'api::libro.libro'
    > &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::wo-pedido.wo-pedido'
    > &
      Schema.Attribute.Private;
    metodo_pago: Schema.Attribute.Enumeration<
      ['bacs', 'cheque', 'cod', 'paypal', 'stripe', 'transferencia', 'otro']
    > &
      Schema.Attribute.DefaultTo<'bacs'>;
    metodo_pago_titulo: Schema.Attribute.String;
    moneda: Schema.Attribute.String & Schema.Attribute.DefaultTo<'CLP'>;
    nota_cliente: Schema.Attribute.Text;
    numero_pedido: Schema.Attribute.String & Schema.Attribute.Required;
    origen: Schema.Attribute.Enumeration<
      ['web', 'checkout', 'rest-api', 'admin', 'mobile', 'directo', 'otro']
    > &
      Schema.Attribute.DefaultTo<'web'>;
    originPlatform: Schema.Attribute.Enumeration<
      ['woo_moraleja', 'woo_escolar', 'otros']
    >;
    publishedAt: Schema.Attribute.DateTime;
    rawWooData: Schema.Attribute.JSON;
    shipping: Schema.Attribute.JSON;
    subtotal: Schema.Attribute.Decimal;
    total: Schema.Attribute.Decimal;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    wooId: Schema.Attribute.BigInteger;
  };
}

export interface ApiWooSyncWooSync extends Struct.SingleTypeSchema {
  collectionName: 'woo_syncs';
  info: {
    description: 'Configuraci\u00F3n y estado de sincronizaci\u00F3n con WooCommerce. Este es un servicio t\u00E9cnico - la sincronizaci\u00F3n se maneja autom\u00E1ticamente cuando creas/editas libros.';
    displayName: 'WooCommerce Sync';
    pluralName: 'woo-syncs';
    singularName: 'woo-sync';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    lastSync: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::woo-sync.woo-sync'
    > &
      Schema.Attribute.Private;
    notes: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.String & Schema.Attribute.DefaultTo<'active'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiWooWebhookWooWebhook extends Struct.SingleTypeSchema {
  collectionName: 'woo_webhooks';
  info: {
    displayName: 'WooCommerce Webhook';
    pluralName: 'woo-webhooks';
    singularName: 'woo-webhook';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::woo-webhook.woo-webhook'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.String;
    caption: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.String;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    smtp_account_key: Schema.Attribute.String;
    smtp_accounts_allowed: Schema.Attribute.JSON;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::session': AdminSession;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::asignatura.asignatura': ApiAsignaturaAsignatura;
      'api::autor.autor': ApiAutorAutor;
      'api::canal.canal': ApiCanalCanal;
      'api::cartera-asignacion.cartera-asignacion': ApiCarteraAsignacionCarteraAsignacion;
      'api::cartera-periodo.cartera-periodo': ApiCarteraPeriodoCarteraPeriodo;
      'api::categoria-producto.categoria-producto': ApiCategoriaProductoCategoriaProducto;
      'api::colaborador.colaborador': ApiColaboradorColaborador;
      'api::coleccion.coleccion': ApiColeccionColeccion;
      'api::colegio-campana.colegio-campana': ApiColegioCampanaColegioCampana;
      'api::colegio-event.colegio-event': ApiColegioEventColegioEvent;
      'api::colegio-list-document.colegio-list-document': ApiColegioListDocumentColegioListDocument;
      'api::colegio-list-item-audit.colegio-list-item-audit': ApiColegioListItemAuditColegioListItemAudit;
      'api::colegio-list-item.colegio-list-item': ApiColegioListItemColegioListItem;
      'api::colegio-list-note.colegio-list-note': ApiColegioListNoteColegioListNote;
      'api::colegio-list-version.colegio-list-version': ApiColegioListVersionColegioListVersion;
      'api::colegio-list.colegio-list': ApiColegioListColegioList;
      'api::colegio-sostenedor.colegio-sostenedor': ApiColegioSostenedorColegioSostenedor;
      'api::colegio.colegio': ApiColegioColegio;
      'api::comuna.comuna': ApiComunaComuna;
      'api::configuracion-turnos.configuracion-turnos': ApiConfiguracionTurnosConfiguracionTurnos;
      'api::cotizaciones.cotizacion': ApiCotizacionesCotizacion;
      'api::curso-asignatura.curso-asignatura': ApiCursoAsignaturaCursoAsignatura;
      'api::curso.curso': ApiCursoCurso;
      'api::customer.customer': ApiCustomerCustomer;
      'api::datos-facturacion.datos-facturacion': ApiDatosFacturacionDatosFacturacion;
      'api::editorial.editorial': ApiEditorialEditorial;
      'api::email-log.email-log': ApiEmailLogEmailLog;
      'api::email-template.email-template': ApiEmailTemplateEmailTemplate;
      'api::empresa.empresa': ApiEmpresaEmpresa;
      'api::etiqueta.etiqueta': ApiEtiquetaEtiqueta;
      'api::home-hero.home-hero': ApiHomeHeroHomeHero;
      'api::intranet-chat.intranet-chat': ApiIntranetChatIntranetChat;
      'api::intranet-usuario-cliente.intranet-usuario-cliente': ApiIntranetUsuarioClienteIntranetUsuarioCliente;
      'api::libro.libro': ApiLibroLibro;
      'api::lista-descuento.lista-descuento': ApiListaDescuentoListaDescuento;
      'api::lista-escolar.lista-escolar': ApiListaEscolarListaEscolar;
      'api::mailerlite.mailerlite': ApiMailerliteMailerlite;
      'api::marca.marca': ApiMarcaMarca;
      'api::material.material': ApiMaterialMaterial;
      'api::media-asset.media-asset': ApiMediaAssetMediaAsset;
      'api::media-category.media-category': ApiMediaCategoryMediaCategory;
      'api::media-tag.media-tag': ApiMediaTagMediaTag;
      'api::nivel.nivel': ApiNivelNivel;
      'api::obra.obra': ApiObraObra;
      'api::oferta-producto.oferta-producto': ApiOfertaProductoOfertaProducto;
      'api::pedido.pedido': ApiPedidoPedido;
      'api::persona-tag.persona-tag': ApiPersonaTagPersonaTag;
      'api::persona-trayectoria.persona-trayectoria': ApiPersonaTrayectoriaPersonaTrayectoria;
      'api::persona.persona': ApiPersonaPersona;
      'api::precio.precio': ApiPrecioPrecio;
      'api::promocion-contacto.promocion-contacto': ApiPromocionContactoPromocionContacto;
      'api::promocion-pantalla.promocion-pantalla': ApiPromocionPantallaPromocionPantalla;
      'api::proveedor.proveedor': ApiProveedorProveedor;
      'api::sello.sello': ApiSelloSello;
      'api::stock.stock': ApiStockStock;
      'api::turno.turno': ApiTurnoTurno;
      'api::ubicacion.ubicacion': ApiUbicacionUbicacion;
      'api::user-mailbox.user-mailbox': ApiUserMailboxUserMailbox;
      'api::wo-cliente.wo-cliente': ApiWoClienteWoCliente;
      'api::wo-cupon.wo-cupon': ApiWoCuponWoCupon;
      'api::wo-pedido.wo-pedido': ApiWoPedidoWoPedido;
      'api::woo-sync.woo-sync': ApiWooSyncWooSync;
      'api::woo-webhook.woo-webhook': ApiWooWebhookWooWebhook;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
