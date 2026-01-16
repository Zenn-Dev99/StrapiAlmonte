/**
 * Utilidad para reintentos con backoff exponencial
 * Útil para llamadas a API que pueden fallar temporalmente
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 segundo
  maxDelay: 10000, // 10 segundos
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504], // Rate limit y errores del servidor
};

/**
 * Ejecuta una función con reintentos automáticos
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  onRetry?: (error: Error, attempt: number) => void
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Si es el último intento, lanzar el error
      if (attempt === opts.maxRetries) {
        break;
      }

      // Verificar si el error es retryable
      if (!isRetryableError(error, opts.retryableStatusCodes)) {
        throw error;
      }

      // Calcular delay con backoff exponencial
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      if (onRetry) {
        onRetry(error as Error, attempt + 1);
      }

      // Esperar antes del siguiente intento
      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error in retry');
}

/**
 * Verifica si un error es retryable
 */
function isRetryableError(error: any, retryableStatusCodes: number[]): boolean {
  // Si el error tiene un statusCode, verificar si es retryable
  if (error.statusCode && retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }

  // Si el mensaje contiene información de rate limit
  if (error.message && typeof error.message === 'string') {
    const message = error.message.toLowerCase();
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }
  }

  // Errores de red son generalmente retryable
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  return false;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
