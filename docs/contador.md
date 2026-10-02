# Pantalla de lanzamiento

Ruta directa: `/contador`. No se enlaza desde menús ni se incluye en un sitemap.
Metadata y cabecera HTTP impiden indexación. Es una URL no anunciada, no un control de acceso.

Fecha: `2026-10-02T01:00:00-03:00`, 1:00 AM en America/Asuncion.
Se calcula contra un instante absoluto, independientemente de la zona del dispositivo.
El reloj del dispositivo debe estar sincronizado. Se recalcula al volver a la pestaña.
El servidor proporciona el primer valor para evitar diferencias de hidratación.
Cada pantalla incluye el identificador del build y consulta `/api/contador-version`
cada 30 segundos sin caché; si ya hay una versión nueva, se recarga automáticamente.

El proxy sobrescribe una cabecera interna a partir de la ruta real. El layout omite
el acceso de desarrollo, proveedores, menú y pie solamente para esta pantalla.
Se conserva la protección existente de `/api/mock/*`.

La sirena de cinco segundos suena cuando el tiempo restante cruza una hora completa
(por ejemplo, al llegar a 02:00:00 o 01:00:00). El visitante debe activar el control
con un clic para habilitar el audio según las políticas del navegador. Si la pestaña
queda inactiva durante varios hitos, al volver se reproduce una sola vez, sin acumular
sonidos atrasados.

Cuatro tarjetas pasan automáticamente a celebración sin redirección. El confeti aumenta
durante diez segundos y luego vuelve a ocho partículas. Animaciones desactivadas con
`prefers-reduced-motion`. No se carga Zendesk ni se hacen peticiones externas.

Recursos: el fondo nocturno suministrado en f8d6fd38-1eb2-401a-a4e9-110096380df0.png
se conserva en alta calidad como `quinie-contador-lanzamiento-noche.png` (1672 × 941).
Se presenta completo con `contain` en escritorio y móvil, sin recortar ni duplicar
la mascota integrada en la imagen. En escritorio los laterales se rellenan para dar
continuidad visual sin deformar el original. Los rótulos se muestran en blanco sobre tarjetas
oscuras translúcidas. Se usan tres íconos del ZIP e íconos SVG de las redes.
El logo oficial se reutiliza mediante Logo. Las carpetas mascot y audio
documentan los archivos opcionales admitidos. No se agregaron sonidos de terceros.

Despliegue en Hostinger: `npm run build` usa Webpack para evitar los builds de
Turbopack que quedaron detenidos en el hosting compartido. `experimental.cpus: 2`
limita a dos los workers de generación de páginas durante la compilación.

Archivos creados:
- src/app/contador/page.tsx
- src/app/contador/screen.tsx
- src/app/api/contador-version/route.ts
- src/app/contador/screen.module.css
- src/lib/countdown.ts
- src/lib/deployment-version.ts
- tests/unit/countdown.test.ts
- tests/unit/countdown-screen.test.tsx
- tests/unit/countdown-routing.test.ts
- docs/contador.md
- public/assets/contador/background/quinie-contador-bg-1920x1080.webp
- public/assets/contador/background/quinie-contador-bg-mobile.webp
- public/assets/contador/background/quinie-contador-lanzamiento.webp
- public/assets/contador/background/quinie-contador-lanzamiento-noche.png
- public/assets/contador/decorations/confetti-red.svg
- public/assets/contador/icons/gear.svg
- public/assets/contador/icons/check.svg
- public/assets/contador/icons/rocket.svg
- public/assets/contador/logo/README.md
- public/assets/contador/mascot/README.md
- public/assets/contador/audio/README.md

Archivos modificados: src/app/layout.tsx y src/proxy.ts.
