# quinie.LA — frontend integrable

Este repositorio contiene la interfaz de quinie.LA reconstruida con Next.js. No
incluye un backend de negocio: identidad, catálogo, saldo, jugadas, resultados y
comprobantes deben provenir del backoffice externo mediante los gateways
tipados de `src/lib/backoffice` y `src/lib/product/gateway`.

## Fuente de verdad
1. `reference/original-v25/quinie_v25_SOURCE_OF_TRUTH.html` = fuente funcional obligatoria.
2. `public/assets/mockups/` = direccion visual y de calidad.
3. `reference/fernando-secondary/` = referencia secundaria de recursos. No sustituye reglas ni flujos de v25.
4. Aposta.LA = marca madre para lenguaje visual, componentes y contenidos corporativos aplicables.

## Qué ya está incluido

- Next.js, React y TypeScript strict.
- Interfaz responsive, temas, sonido, iconos y rodillos.
- Las 6 quinielas tradicionales y 9 Instantáneas.
- Login, registro, sesión y cierre de sesión detrás de `AuthGateway`.
- Catálogo, jugadas, resultados y billetera detrás de gateways sustituibles.
- Cliente HTTP validado, gateway preview y fixtures deterministas para QA.
- GitHub Actions, Vitest y Playwright.

## Primer uso

1. Instalar Node.js 22.
2. Ejecutar `npm ci`.
3. Copiar `.env.example` a `.env.local`.
4. Mantener `NEXT_PUBLIC_PRODUCT_GATEWAY_MODE=preview` solo para desarrollo/QA.
5. Ejecutar `npm run dev` y abrir `http://localhost:3000`.

No hace falta MySQL, Prisma ni Docker. Para conectar el backoffice real, usar
modo `backoffice` y completar los endpoints públicos descriptos en
`docs/BACKOFFICE_INTEGRATION.md`; nunca colocar secretos en variables
`NEXT_PUBLIC_*`.

## Regla de implementación

La UI no genera resultados, calcula premios ni modifica saldos. Los rodillos
solo animan el resultado autoritativo recibido del gateway. Las rutas
`/api/mock/*` son una vista previa heredada y quedan bloqueadas fuera del modo
preview explícito.

## Recursos visuales
- `public/assets/brand/`
- `public/assets/game-art/`
- `public/assets/icons/game/`
- `public/assets/icons/ui/`
- `public/assets/sounds/`
- `public/assets/mockups/`
- `reference/reference-screens/` (no se publica con Next.js)

## No incluir en Git
- `node_modules/`
- `.next/`
- `.env*` reales
- tokens, contraseñas o credenciales del backoffice

## Verificación y despliegue

Ejecutar `npm run verify` y `npm run test:e2e`. El despliegue productivo queda
diferido hasta disponer del contrato real, dominios/cookies/CORS y ambiente UAT
del backoffice. Consultar `project-docs/HOSTINGER_DEPLOY.md`.
