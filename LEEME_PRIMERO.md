# quinie.LA - Proyecto listo para Codex

Este paquete NO parte de cero. La raiz ya contiene el starter tecnico del proyecto y los recursos necesarios para reconstruir quinie.LA de forma modular.

## Fuente de verdad
1. `reference/original-v25/quinie_v25_SOURCE_OF_TRUTH.html` = fuente funcional obligatoria.
2. `public/assets/mockups/` = direccion visual y de calidad.
3. `reference/fernando-secondary/` = referencia secundaria de recursos. No sustituye reglas ni flujos de v25.
4. Aposta.LA = marca madre para lenguaje visual, componentes y contenidos corporativos aplicables.

## Que ya esta incluido
- Next.js + React + TypeScript starter.
- Prisma + MySQL schema y seed.
- Docker Compose para MySQL local.
- GitHub Actions.
- Playwright/Vitest.
- Kodexa provider abstraction.
- Design tokens iniciales.
- Logo quinie.LA.
- Game art WebP.
- Iconos SVG de juegos y UI.
- Sonidos WAV.
- Mockups de rodillos, desktop/mobile e iconografia.
- Pantallas de referencia.
- 9 Instantaneas documentadas.
- Flujos UX.
- OpenAPI.
- Seguridad y QA.
- Prompts de Codex por 3 fases.
- Guia GitHub y Hostinger.

## Primer uso
1. Descomprimir esta carpeta.
2. Crear repositorio vacio en GitHub.
3. Copiar todo el contenido de esta carpeta al repositorio.
4. Ejecutar `git init`, agregar remoto y hacer primer commit/push.
5. Copiar `.env.example` a `.env.local` y completar solo variables locales.
6. Ejecutar `docker compose up -d` para MySQL local.
7. Ejecutar `npm install`.
8. Ejecutar `npx prisma generate` y migraciones segun el README.
9. Ejecutar `npm run dev`.
10. Abrir `CODEX_PROMPTS/00_MASTER_PROMPT_CODEX_SOL_ULTRA.md` y usarlo como contexto principal en Codex.

## Regla de implementacion
No convertir literalmente el HTML gigante a componentes sin limpiar. Usar v25 para conservar funcionalidad, pero reconstruir la UI con componentes, design tokens, assets independientes y APIs server-side.

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
- backups de base de datos
- credenciales Kodexa

## Deploy
Leer `project-docs/HOSTINGER_DEPLOY.md` y `project-docs/PREDEPLOY_CHECKLIST.md` antes de publicar.
