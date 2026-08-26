# QA y criterios de aceptacion

## Viewports obligatorios
360x800, 390x844, 430x932, 768x1024, 1024x768, 1366x768, 1440x900, 1920x1080.

## Matriz visual
Cada viewport se prueba Dark y Light. No debe haber scroll horizontal no intencional, tarjetas cortadas ni textos sobre botones.

## E2E criticos
- Login/logout.
- A la Cabeza.
- A los Premios.
- Invertida.
- Redoblona.
- Sapy'aite tradicional.
- Megaloto.
- Los 9 Instantaneos.
- Rodillo activo antes de jugar y reemplazo por resultado autoritativo.
- Fichas de Instantáneas limitadas a Gs. 500, 1.000, 2.000, 5.000 y 10.000.
- Ningún comprobante se abre automáticamente; se consulta desde Mis Jugadas.
- Idempotencia ante doble click/retry.
- Saldo se actualiza desde servidor.
- Mis Jugadas y comprobante.
- Resultados.
- Dark/Light.
- Sonido on/off.
- reduced-motion.
- RBAC de Gestion.

## No regresion
Codex debe comparar contra el HTML v25 y mockups. No puede quitar pantallas ni controles para hacer pasar tests.
