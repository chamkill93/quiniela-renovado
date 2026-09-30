# Pantalla de lanzamiento

Ruta directa: `/contador`. No se enlaza desde menús ni se incluye en un sitemap.
Metadata y cabecera HTTP impiden indexación. Es una URL no anunciada, no un control de acceso.

Fecha: `2026-10-01T00:00:00-03:00`, medianoche en America/Asuncion.
Se calcula contra un instante absoluto, independientemente de la zona del dispositivo.
El reloj del dispositivo debe estar sincronizado. Se recalcula al volver a la pestaña.
El servidor proporciona el primer valor para evitar diferencias de hidratación.

El proxy sobrescribe una cabecera interna a partir de la ruta real. El layout omite
el acceso de desarrollo, proveedores, menú y pie solamente para esta pantalla.
Se conserva la protección existente de `/api/mock/*`.

Cuatro tarjetas pasan automáticamente a celebración sin redirección. El confeti aumenta
durante diez segundos y luego vuelve a ocho partículas. Animaciones desactivadas con
`prefers-reduced-motion`. No se carga Zendesk ni se hacen peticiones externas.

Recursos: dos fondos WebP y tres íconos del ZIP suministrado. La mascota forma parte
de esos fondos. El logo oficial se reutiliza mediante Logo. Las carpetas mascot y audio
documentan los archivos opcionales admitidos. No se agregaron sonidos de terceros.

Archivos creados:
- src/app/contador/page.tsx
- src/app/contador/screen.tsx
- src/app/contador/screen.module.css
- src/lib/countdown.ts
- tests/unit/countdown.test.ts
- tests/unit/countdown-screen.test.tsx
- tests/unit/countdown-routing.test.ts
- docs/contador.md
- public/assets/contador/background/quinie-contador-bg-1920x1080.webp
- public/assets/contador/background/quinie-contador-bg-mobile.webp
- public/assets/contador/decorations/confetti-red.svg
- public/assets/contador/icons/gear.svg
- public/assets/contador/icons/check.svg
- public/assets/contador/icons/rocket.svg
- public/assets/contador/logo/README.md
- public/assets/contador/mascot/README.md
- public/assets/contador/audio/README.md

Archivos modificados: src/app/layout.tsx y src/proxy.ts.
