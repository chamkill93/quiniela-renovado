# MASTER PROMPT - CODEX SOL ULTRA - quinie.LA

> **Actualización de alcance vigente:** la indicación posterior del propietario
> reemplaza la arquitectura full-stack de este documento. quinie.LA se entrega
> como frontend conectado a un backoffice externo. No implementar backend
> local, MySQL/Prisma, RNG, payouts, ledger, Kodexa, panel administrativo ni
> despliegue salvo nueva autorización explícita. Para Fase 2 rige
> `PHASE_2_BACKEND_SECURITY.md`.

Actua como arquitecto full-stack senior, product engineer, UX engineer, especialista en seguridad web y QA. Debes construir quinie.LA desde cero en este repositorio y dejarlo ejecutable, testeado, versionable en GitHub y desplegable en Hostinger.

## FUENTES Y PRIORIDAD
Lee primero:
1. `reference/original-v25/quinie_v25_SOURCE_OF_TRUTH.html` - fuente funcional obligatoria.
2. `reference/SOURCE_PRIORITY.md`.
3. `project-docs/BRANDING_SYSTEM.md`.
4. `project-docs/GAME_RULES_AND_MATH.md`.
5. `project-docs/UX_FLOWS.md`.
6. `project-docs/ARCHITECTURE.md`.
7. `prisma/schema.prisma`.
8. `project-docs/openapi.yaml`.
9. `project-docs/SECURITY_BASELINE.md`.
10. `project-docs/QA_ACCEPTANCE.md`.
11. `public/assets/` y mockups.
12. `reference/fernando-secondary/` solo como referencia secundaria.

Si existe conflicto, respeta este orden. No uses la version Fernando para reemplazar logica del HTML v25.

## OBJETIVO DE PRODUCTO
Reconstruir el prototipo como una aplicacion full-stack premium, mucho mas limpia, consistente y segura, manteniendo el branding de quinie.LA como subproducto de Aposta.LA. Debe parecer un producto final, no una pagina de prueba. No mostrar textos DEMO, MOCK, prototipo o similares en la UI publica. El entorno tecnico puede usar MOCK internamente.

## STACK OBLIGATORIO
- Node.js 22
- Next.js 16 App Router
- React 19
- TypeScript strict
- Tailwind CSS 4 + CSS variables/tokens
- MySQL + Prisma
- Zod
- Argon2id
- Jose o equivalente para tokens cuando sea necesario
- Pino logging
- Motion para microanimaciones
- Vitest
- Playwright

No introducir frameworks redundantes.

## BRANDING OBLIGATORIO
- quinie.LA es familia Aposta.LA.
- CTA principal rojo #E30613.
- Todos los contornos redondeados: cards 24px, banners 28-30px, inputs 18px, botones 16-18px, pills 999px.
- Dark principal. Light calido #EFEDE8 / #F7F4EE, nunca blanco puro.
- No usar `ECOSISTEMA .LA`.
- No usar `NUEVO` en Instantaneas.
- Tema y sonido: botones icon-only.
- No balance/card de recarga abajo del sidebar. Saldo en topbar.
- No emojis como iconos finales. Usar `public/assets/icons` y game-art.
- No usar fuente externa empaquetada en el repo. Usar stack web seguro.
- El footer debe seguir la estructura conceptual de Aposta.LA, pero el texto regulatorio de apuestas deportivas NO se copia a Quiniela sin aprobacion legal.

## PAGINAS
- Inicio
- Quinielas
- Juego tradicional
- Instantaneas
- Juego instantaneo
- Reglas
- Mis Jugadas
- Resultados
- Cuenta
- Gestion/Admin solo con rol
- Paginas legales/ayuda con placeholders aprobables

## QUINIELA TRADICIONAL
Mantener las reglas definidas en `GAME_RULES_AND_MATH.md`. Los numeros de Quiniela son 001-999. No renderizar 999 botones; usar input numerico compacto y selector aleatorio cuando aplique.

## 9 INSTANTANEAS
Implementar EXACTAMENTE estas 9:
1. Sapy'aite - acertar exactamente un numero de 000 a 999
2. Po'a - Centena
3. Pya'e - Mayor/Menor 500
4. Petei - Ultima cifra
5. Mokoi - Ultimas 2 cifras
6. Mbohapy - Exacto 3 cifras
7. Po'a 5 - elegir 3 numeros, 5 rodillos
8. Po'a 10 - elegir 3 numeros, 10 rodillos
9. Racha 5 - Par/Impar, 5 rodillos, premio por racha

Usar `project-docs/instant-games.config.json`.

## RODILLOS
- Son numericos, no de simbolos.
- Resultado 001-999.
- El backend determina/recibe el resultado ANTES de la animacion.
- React anima hasta el resultado autoritativo.
- Desaceleracion progresiva y parada secuencial.
- Para 5/10 rodillos, distribuirlos responsive sin scroll horizontal.
- Resaltar coincidencias solo despues de detener cada rodillo.
- Sonidos: reel_start, reel_tick, reel_stop.
- reduced-motion: reemplazar giro largo por transicion corta.

## FLUJO INSTANTANEO
Seleccion -> monto -> JUGAR AHORA -> request idempotente -> backend acepta y devuelve resultado -> animacion -> resultado -> countdown de 5 segundos -> comprobante.
Bloquear doble click mientras esta pendiente. Si el modal se cancela por navegacion, la apuesta aceptada sigue existiendo y aparece en Mis Jugadas.

## SEGURIDAD
Aplicar `project-docs/SECURITY_BASELINE.md` sin excepciones. Frontend nunca decide saldo, RNG, premio o aceptacion. Credenciales Kodexa solo server-side. Idempotency-Key obligatorio en apuestas. Usar transacciones DB. Audit log admin. Rate limits. Cookies HttpOnly/Secure.

## MOTOR / PROVIDER
Crear interfaz `GamingProvider` y:
- `MockGamingProvider` para producto completo local/showcase.
- `KodexaGamingProvider` para UAT/PROD.
`PROVIDER_MODE` decide implementacion. Ninguna URL Kodexa dentro de componentes.

## BASE DE DATOS
Partir de `prisma/schema.prisma`. Mantener wallet ledger, idempotencia, auditoria, provider request logs y legal consents. No reemplazar ledger por un saldo editable sin historial.

## UX/UI
Superar visualmente el HTML sin cambiar su identidad.
- Grid 3x3 para 9 Instantaneas en desktop.
- Tablet 2-3 columnas segun espacio.
- Mobile 2 columnas si es legible y 1 si no; nunca cortar texto/CTA.
- Navigation bottom en mobile.
- Skeletons, empty states, toast, estados pending/success/error.
- Comprobante digital limpio con logo.
- Microanimaciones 120-300ms salvo rodillos.
- Sonido opt-in despues de interaccion del usuario; recordar preferencia local.
- Tema recordar preferencia.
- Accesibilidad AA: focus-visible, labels, aria-live, teclado, reduced-motion.

## DATOS DE MUESTRA
Crear seed completamente ficticio. No usar nombres, documentos, telefonos o correos reales. Modo MOCK debe permitir login, saldo, apuestas, resultados, premios, comprobantes y admin.

## GITHUB
- Mantener commits pequenos por fase.
- No commit de `.env`.
- CI debe pasar lint, typecheck, tests y build.
- Main siempre desplegable.

## HOSTINGER
Seguir `project-docs/HOSTINGER_DEPLOY.md`. El proyecto final debe poder desplegarse como una sola Node.js Web App Next.js desde GitHub. Node 22. MySQL. `npm ci`, `npm run build`, `npm start`.

## FASES
Ejecutar solo 3 fases y respetar sus prompts. No saltar la Definition of Done de una fase.

## REGLA DE NO REGRESION
No elimines funcionalidades para simplificar. Si una funcionalidad del HTML v25 todavia no tiene backend real, implementala con MOCK y marca solo en codigo/configuracion que es MOCK, nunca en la UI publica.

## ENTREGA FINAL
Antes de finalizar:
1. Ejecutar lint.
2. Ejecutar typecheck.
3. Ejecutar unit tests.
4. Ejecutar build.
5. Ejecutar Playwright smoke.
6. Revisar dark/light en viewports de QA.
7. Revisar consola sin errores.
8. Actualizar README con setup local y Hostinger.
9. Entregar una lista corta de pendientes exclusivamente si requieren informacion externa de Kodexa o validacion legal.
