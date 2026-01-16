import type { StrapiApp } from '@strapi/strapi/admin';

export default {
  config: {
    tutorials: false,
    guidedTour: false,
    notifications: { release: false },
  },
  bootstrap(_app: StrapiApp) {
    // Solo se ejecuta en el navegador en runtime, nunca durante el build
    if (typeof window === 'undefined') return;
    
    try {
      const STORAGE_KEY = 'STRAPI_GUIDED_TOUR';
      const win = window as any;
      if (!win.localStorage) {
        return;
      }
      const raw = win.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        win.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          enabled: false,
          tours: parsed.tours || {},
          completedActions: parsed.completedActions || [],
        }));
      }
    } catch {
      // Ignorar errores
    }
  },
};

