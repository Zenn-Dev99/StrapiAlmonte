/**
 * Logger estructurado para el sistema de sincronización WooCommerce
 * Proporciona contexto y niveles de logging consistentes
 */

export interface LogContext {
  platform?: string;
  entity?: string;
  entityId?: string | number;
  operation?: string;
  [key: string]: any;
}

export class StructuredLogger {
  constructor(private strapiLog: any) {}

  /**
   * Log de información
   */
  info(message: string, context?: LogContext): void {
    const logMessage = this.formatMessage(message, context);
    this.strapiLog.info(logMessage);
  }

  /**
   * Log de advertencia
   */
  warn(message: string, context?: LogContext): void {
    const logMessage = this.formatMessage(message, context);
    this.strapiLog.warn(logMessage);
  }

  /**
   * Log de error
   */
  error(message: string, error?: Error | any, context?: LogContext): void {
    const logMessage = this.formatMessage(message, context);
    if (error) {
      this.strapiLog.error(logMessage, error);
    } else {
      this.strapiLog.error(logMessage);
    }
  }

  /**
   * Log de debug
   */
  debug(message: string, context?: LogContext): void {
    const logMessage = this.formatMessage(message, context);
    this.strapiLog.debug(logMessage);
  }

  /**
   * Formatea el mensaje con contexto
   */
  private formatMessage(message: string, context?: LogContext): string {
    if (!context || Object.keys(context).length === 0) {
      return `[woo-sync] ${message}`;
    }

    const parts: string[] = [];
    if (context.platform) parts.push(`platform=${context.platform}`);
    if (context.entity) parts.push(`entity=${context.entity}`);
    if (context.entityId) parts.push(`id=${context.entityId}`);
    if (context.operation) parts.push(`op=${context.operation}`);

    const contextStr = parts.length > 0 ? ` [${parts.join(', ')}]` : '';
    return `[woo-sync]${contextStr} ${message}`;
  }
}

/**
 * Crea un logger estructurado
 */
export function createLogger(strapi: any): StructuredLogger {
  return new StructuredLogger(strapi.log);
}
