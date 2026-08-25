# quinie.LA

Frontend web de Quiniela para Paraguay, construido con Next.js App Router y preparado para consumir un backoffice externo. La FASE 1 conserva los flujos del HTML v25, incorpora las nueve Instantáneas y mantiene un proveedor temporal únicamente para previsualización y QA local.

## Estado

- FASE 1: producto visual y proveedor local completados.
- FASE 2: frontend integrable con backoffice, contratos HTTP y flujos de login/registro en preparación.
- FASE 3: conexión al contrato real, validación UAT y despliegue pendientes.

El proveedor de FASE 1 existe solo para poder recorrer la interfaz sin depender de servicios externos. Sus datos ficticios viven en memoria y se reinician junto con el proceso de desarrollo; no representa la arquitectura productiva ni reemplaza al backoffice.

## Stack

- Node.js 22
- Next.js 16, React 19 y TypeScript strict
- Tailwind CSS 4 y design tokens CSS
- Cliente HTTP de backoffice desacoplado y contratos TypeScript
- Zod en el proveedor temporal de desarrollo
- Vitest y Playwright

## Instalación local

Requisitos: Node.js 22 y npm. Docker es opcional durante FASE 1.

```bash
npm ci
copy .env.example .env
npm run dev
```

Abrí `http://localhost:3000`.

En PowerShell también podés crear el archivo de entorno así:

```powershell
Copy-Item .env.example .env
```

El acceso inicial crea una sesión ficticia para la previsualización. Ninguna credencial real debe utilizarse mientras la aplicación esté conectada al proveedor temporal.

## Scripts

```bash
npm run dev             # servidor de desarrollo
npm run lint            # ESLint sin warnings
npm run typecheck       # TypeScript strict
npm test                # pruebas unitarias
npm run build           # Prisma Client + build de producción
npm run test:e2e        # matriz Playwright
npm run verify          # lint + tipos + unitarias + build
```

## Producto cubierto

Quiniela tradicional:

- A la Cabeza
- A los Premios
- Invertida
- Redoblona
- Sapy’aite tradicional
- Megaloto, seis números únicos del 1 al 45

Instantáneas:

- Sapy’aite, Po’a, Pya’e, Peteĩ, Mokõi y Mbohapy
- Po’a 5, Po’a 10 y Racha 5
- Rodillos numéricos de 001 a 999; cinco y diez rodillos responsive
- Resultado definido en servidor antes de la animación
- Countdown de cinco segundos y comprobante digital

Los pagos todavía no aprobados no se inventan. Po’a 5 con cuatro o más coincidencias y Po’a 10 con cuatro o más quedan pendientes de configuración comercial. El resultado 500 de Pya’e usa reintegro por defecto y puede probarse como pérdida mediante `MOCK_PYAE_500_POLICY=LOSS`.

## Arquitectura de FASE 1

```text
React UI
   │
   ├── /api/mock/* ── Zod ── MockGamingProvider server-only
   │                              ├── crypto.randomInt
   │                              ├── saldo y ledger en memoria
   │                              ├── idempotencia por sesión/operación
   │                              └── jugadas, resultados y tickets
   │
   └── AppShell / design system / preferencias locales
```

La cookie del proveedor temporal es `HttpOnly`, `SameSite=Lax` y usa `Secure` cuando `APP_URL` es HTTPS (o `SESSION_COOKIE_SECURE=true`). En producción, identidad, saldo, jugadas y resultados llegan exclusivamente del backoffice externo.

## Conectores de backoffice

`src/lib/backoffice` expone un cliente HTTP configurable y contratos tipados para sesión, login, registro, logout, catálogo, jugadas y resultados. El transporte incluye cookies, cancelación, idempotencia y errores normalizados, pero no contiene reglas de juego ni lógica de negocio.

```ts
const client = createBackofficeClient({ baseUrl, endpoints });
await client.login({ documentOrPhone, password });
await client.register({ displayName, documentOrPhone, password, acceptedTerms: true });
```

Las URLs y formas definitivas de los endpoints deben venir del contrato del backoffice; no se hardcodean en páginas o componentes.

## QA

La matriz visual cubre dark y light en:

`360×800`, `390×844`, `430×932`, `768×1024`, `1024×768`, `1366×768`, `1440×900` y `1920×1080`.

Los flujos E2E validan los seis juegos tradicionales, las nueve Instantáneas, rodillos 5/10, countdown, comprobante, saldo server-side, recarga, idempotencia, historiales, login/logout y RBAC.

Playwright instala Chromium en CI. En una estación nueva, ejecutá una vez `npx playwright install chromium`; también podés usar Chrome con `PLAYWRIGHT_CHANNEL=chrome`.

## Fuentes y recursos

- Fuente funcional: `reference/original-v25/quinie_v25_SOURCE_OF_TRUTH.html`
- Reglas y arquitectura: `project-docs/`
- Assets de producto: `public/assets/`
- Capturas internas no publicables: `reference/reference-screens/`
- Referencia secundaria: `reference/fernando-secondary/`

Las capturas internas se mantienen fuera de `public/` para no exponer datos personales aparentes ni elementos del navegador.

## Git y despliegue

El repositorio usa la rama `main`. No se versionan `.env`, `node_modules`, `.next`, reportes ni resultados temporales. Antes de cualquier push ejecutá:

```bash
npm run verify
npm run test:e2e
```

La guía de Hostinger está en `project-docs/HOSTINGER_DEPLOY.md`. El despliegue productivo requiere el contrato y credenciales del backoffice, validación UAT y aprobación de Negocio/Legal.
