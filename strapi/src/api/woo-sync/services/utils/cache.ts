/**
 * Cache simple en memoria para búsquedas repetitivas
 * Útil para atributos, términos, y otros datos que no cambian frecuentemente
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // Time to live en milisegundos
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) { // 5 minutos por defecto
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Obtiene un valor del cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Verificar si ha expirado
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Guarda un valor en el cache
   */
  set(key: string, value: T, ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
    });
  }

  /**
   * Elimina un valor del cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpia todo el cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Limpia entradas expiradas
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtiene o calcula un valor (patrón cache-aside)
   */
  async getOrSet(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    this.set(key, value, ttl);
    return value;
  }
}

// Caches globales para diferentes tipos de datos
export const attributeCache = new SimpleCache<any>(10 * 60 * 1000); // 10 minutos
export const termCache = new SimpleCache<any>(10 * 60 * 1000); // 10 minutos
export const productCache = new SimpleCache<any>(2 * 60 * 1000); // 2 minutos
