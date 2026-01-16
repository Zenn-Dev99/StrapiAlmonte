/**
 * Servicio de configuración de WooCommerce
 * Centraliza el acceso a las configuraciones de las diferentes plataformas
 */

export interface WooConfig {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

export default ({ strapi }) => ({
  /**
   * Obtiene la configuración de WooCommerce para una plataforma
   */
  getWooConfig(platform: 'woo_moraleja' | 'woo_escolar'): WooConfig | null {
    const configs: Record<string, WooConfig> = {
      woo_moraleja: {
        url: process.env.WOO_MORALEJA_URL || '',
        consumerKey: process.env.WOO_MORALEJA_CONSUMER_KEY || '',
        consumerSecret: process.env.WOO_MORALEJA_CONSUMER_SECRET || '',
      },
      woo_escolar: {
        url: process.env.WOO_ESCOLAR_URL || '',
        consumerKey: process.env.WOO_ESCOLAR_CONSUMER_KEY || '',
        consumerSecret: process.env.WOO_ESCOLAR_CONSUMER_SECRET || '',
      },
    };

    const config = configs[platform];
    if (!config.url || !config.consumerKey || !config.consumerSecret) {
      return null;
    }

    return config;
  },

  /**
   * Valida que una configuración esté completa
   */
  validateConfig(config: WooConfig | null): boolean {
    if (!config) return false;
    return !!(config.url && config.consumerKey && config.consumerSecret);
  },
});
