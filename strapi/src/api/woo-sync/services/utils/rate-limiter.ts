/**
 * Rate limiter simple para proteger contra límites de WooCommerce
 * WooCommerce típicamente permite 2-3 requests por segundo
 */

interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize?: number;
}

interface RequestQueue {
  timestamp: number;
  resolve: () => void;
}

export class RateLimiter {
  private queue: RequestQueue[] = [];
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private windowStart: number = Date.now();

  constructor(private config: RateLimitConfig) {
    this.config.burstSize = config.burstSize || config.requestsPerSecond * 2;
  }

  /**
   * Espera hasta que sea seguro hacer una petición
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const windowMs = 1000; // 1 segundo

    // Resetear contador si ha pasado una ventana
    if (now - this.windowStart >= windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Si estamos dentro del límite, permitir inmediatamente
    if (this.requestCount < this.config.requestsPerSecond) {
      this.requestCount++;
      this.lastRequestTime = now;
      return;
    }

    // Si hay espacio en el burst, permitir con un pequeño delay
    if (this.requestCount < this.config.burstSize!) {
      this.requestCount++;
      const delay = Math.max(0, 1000 / this.config.requestsPerSecond - (now - this.lastRequestTime));
      if (delay > 0) {
        await this.sleep(delay);
      }
      this.lastRequestTime = Date.now();
      return;
    }

    // Esperar hasta que haya espacio
    return new Promise(resolve => {
      const waitTime = windowMs - (now - this.windowStart);
      setTimeout(() => {
        this.requestCount = 0;
        this.windowStart = Date.now();
        this.requestCount++;
        this.lastRequestTime = Date.now();
        resolve();
      }, Math.max(0, waitTime));
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instancias globales por plataforma
const rateLimiters = new Map<string, RateLimiter>();

/**
 * Obtiene o crea un rate limiter para una plataforma
 */
export function getRateLimiter(platform: string): RateLimiter {
  if (!rateLimiters.has(platform)) {
    // WooCommerce típicamente permite 2-3 requests/segundo
    // Usamos 2 para ser conservadores
    rateLimiters.set(platform, new RateLimiter({ requestsPerSecond: 2 }));
  }
  return rateLimiters.get(platform)!;
}
