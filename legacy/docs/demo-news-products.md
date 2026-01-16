# Demo news & products content

El script `npm run seed:demo:content` crea datos de prueba para los módulos solicitados. Cada colección se rellena con al menos un registro publicado y con relaciones mínimas cruzadas para validar vistas en la intranet.

## News
- `News · Category`: Innovacion Pedagogica (`innovacion-pedagogica`).
- `News · Tag`: Ferias Educativas (`ferias-educativas`).
- `News · Author`: Camila Torres (activa, con enlace a LinkedIn).
- `News · Article`: “Guia rapida para lanzar proyectos STEM en basica”, asociada a la categoría, tag y autora anteriores. Incluye CTA y metadatos SEO.

## Productos
- `Product · Brand`: Editorial Horizonte.
- `Product · Coleccion`: Serie Numeria.
- `Product · Family product`: Numeria Basica.
- `Product · Género`: Matematica Escolar, con subgénero “Resolucion de Problemas”.
- `Product · Category`: Matematica 6 basico.
- `Product · Tag`: Aprendizaje Activo.
- `Product · Autor`: Laura Fuentes Rojas.
- `Product · Book Volume`: Numeria 6 basico Volumen 1.
- `Product · Proveedor`: Distribuidora Escolar SPA (contacto por email y teléfono).
- `Product`: “Numeria 6 basico Libro del estudiante” (SKU `NUM6B-2025`), publicado con URLs `tienda_url`, `catalogo_url` y `escolar_url`, dinámica “book specs” y stock en inventarios.
- `Destacados Home`: tres tarjetas (`Pack Numeria 6B + App Practica`, `Plan lector Juvenil edición 2025`, `Kit de arte colaborativo`) enlazadas a productos y con `cta_url` para probar redirecciones.

El script puede ejecutarse múltiples veces sin duplicar contenido; sólo crea lo que no existe. Recuerda que, en entornos donde WooCommerce no esté configurado, se ejecuta con `IMPORT_MODE=1` para evitar sincronizaciones accidentales.
