# quinie.LA

Aplicación web de Quiniela para Paraguay, reconstruida con Next.js App Router y un proveedor local server-side. La FASE 1 conserva los flujos del HTML v25, suma las nueve Instantáneas documentadas y deja una base reproducible para persistencia y Kodexa en las fases siguientes.

## Estado

- FASE 1: producto visual y proveedor local completados.
- FASE 2: persistencia MySQL, autenticación definitiva y seguridad transaccional pendiente.
- FASE 3: adaptador Kodexa y despliegue Hostinger pendiente.

El proveedor de FASE 1 mantiene la autoridad del saldo, resultados, premios, tickets e idempotencia en el servidor. Sus datos viven en memoria y se reinician junto con el proceso de desarrollo.

## Stack

- Node.js 22
- Next.js 16, React 19 y TypeScript strict
- Tailwind CSS 4 y design tokens CSS
- Prisma 6 con esquema MySQL preparado
- Zod para validación server-side
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

El acceso inicial crea una sesión de jugador ficticia. Para revisar RBAC, cerrá la sesión desde Cuenta e ingresá con identificador `admin` y cualquier contraseña ficticia de al menos ocho caracteres. Ninguna credencial real debe utilizarse en este entorno.

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

La cookie de sesión es `HttpOnly`, `SameSite=Lax` y usa `Secure` cuando `APP_URL` es HTTPS (o `SESSION_COOKIE_SECURE=true`). El navegador no calcula resultados ni modifica el saldo.

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

La guía de Hostinger está en `project-docs/HOSTINGER_DEPLOY.md`. El despliegue productivo requiere completar FASE 2 y FASE 3, migraciones MySQL, secretos reales y validaciones de Negocio/Kodexa/Legal.
