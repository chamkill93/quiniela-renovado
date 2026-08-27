# quinie.LA

Frontend web de Quiniela para Paraguay, construido con Next.js App Router y preparado para consumir un backoffice externo. La FASE 1 conserva los flujos del HTML v25 y los conectores de nueve Instantáneas; la FASE 2 desacopla toda la experiencia detrás de conectores tipados e incorpora login y registro. El proveedor actual habilita únicamente Sapy’aite.

## Estado

- FASE 1: producto visual y proveedor local completados.
- FASE 2: frontend integrable, contratos/gateways HTTP, login, registro y estados de red completados.
- FASE 3: adaptación al contrato real del backoffice, validación UAT y despliegue pendientes.

El proveedor de FASE 1 existe solo para poder recorrer la interfaz sin depender de servicios externos. Sus datos ficticios viven en memoria y se reinician junto con el proceso de desarrollo; no representa la arquitectura productiva ni reemplaza al backoffice.

## Stack

- Node.js 22
- Next.js 16, React 19 y TypeScript strict
- Tailwind CSS 4 y design tokens CSS
- Cliente HTTP de backoffice desacoplado y contratos TypeScript
- Zod en el proveedor temporal de desarrollo
- Vitest y Playwright

## Instalación local

Requisitos: Node.js 22 y npm. La vista previa frontend no requiere base de datos ni Docker.

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
npm run build           # build de producción del frontend
npm run test:e2e        # matriz Playwright
npm run verify          # lint + tipos + unitarias + build
```

## Producto cubierto

Quiniela tradicional:

- A la Cabeza
- A los Premios
- Invertida
- Redoblona

El catálogo reúne además Sapy’aite bajo **Instantáneas** y la tarjeta verde de
**Mega Loto** bajo **Lotos**. Mega Loto enlaza al sitio oficial externo: elegí
seis números del 1 al 40. Los contratos tradicionales heredados de Sapy’aite y
Megaloto se conservan para compatibilidad, pero no se ofrecen como juegos
tradicionales en la interfaz.

Los formularios de Cabeza, Premios, Invertida y Redoblona comparten tres pasos:
sorteo, números e importe. Incluyen selección aleatoria sin consumir saldo,
validación antes del envío y una revisión explícita antes de pagar. El resumen
permanece al costado en escritorio y el botón de pago queda sobre la navegación
en celular. El sorteo inicial es el próximo abierto por fecha y hora; una jugada
en revisión no cambia silenciosamente de sorteo al llegar al cierre.

El importe se descuenta sólo al aceptar la jugada en el servicio. El saldo
estimado es informativo; el saldo disponible siempre proviene del servicio.
Los reintentos conservan su idempotencia y, si la respuesta es una repetición,
se consulta el saldo actual para no restaurar un saldo histórico.

Instantáneas:

- Sapy’aite es el único juego publicado por el proveedor actual.
- Los conectores de Po’a, Pya’e, Peteĩ, Mokõi, Mbohapy, Po’a 5, Po’a 10 y Racha 5 se conservan deshabilitados para una futura activación desde el catálogo.
- Rodillos numéricos de 001 a 999; cinco y diez rodillos responsive
- Resultado definido en servidor antes de la animación
- Rodillo activo antes de jugar, fichas limitadas a Gs. 10.000 y formulario compacto
- Comprobante digital disponible únicamente desde Mis Jugadas

Los importes, resultados y premios que aparecen en la vista previa son fixtures
de QA y no forman parte del contrato productivo. En modo `backoffice` la UI
presenta únicamente la aceptación, el resultado y el saldo autoritativos que
recibe del sistema externo.

## Inicio y salas de sorteo

En preview, la programación compartida en `src/lib/gaming/daily-draw-schedule.ts`
usa 10:30, 13:00, 16:30 y 20:30 en `America/Asuncion`. Inicio destaca el próximo
sorteo y permite desplegar el streaming debajo de las tarjetas sin cambiar de página.
La misma tarjeta lo contrae y otra cambia el sorteo mostrado; solo se monta un reproductor.
La selección conserva la fecha y hora al llegar a cero, sin saltar al día siguiente.
Las salas con enlaces directos siguen aceptando `?fecha=YYYY-MM-DD`.

Las salas preview reproducen en bucle `public/assets/video/quinie-streaming-simulado.mp4`,
con controles e inicio silenciado. La sala muestra únicamente el nombre, el video
y un contador compacto debajo, que desaparece al llegar a cero sin interrumpir el video.
El video no publica resultados. En modo backoffice se conservan la programación
recibida y las fuentes de transmisión configuradas, sin recurrir al video de muestra.

## Arquitectura de FASE 2

```text
React UI
   │
   ├── ProductGateway
   │      ├── BackofficeProductGateway ── HTTP validado ── backoffice externo
   │      └── PreviewProductGateway ───── rutas heredadas de preview/QA
   │
   └── AppShell / login / registro / catálogos / rodillos / historiales
```

Los componentes no llaman rutas mock ni modifican el saldo autoritativo, los premios o los resultados. La estimación del saldo posterior al pago es sólo informativa. El modo `backoffice` falla de forma explícita si falta configuración; nunca cae silenciosamente al proveedor de preview. En un build de producción el modo es obligatorio: omitir `NEXT_PUBLIC_PRODUCT_GATEWAY_MODE` también detiene la composición. En producción, identidad, catálogo, saldo, jugadas, comprobantes y resultados llegan exclusivamente del backoffice externo.

## Conectores de backoffice

`src/lib/backoffice` expone `AuthGateway`, `GamingGateway`, `WalletGateway` y `BackofficeGateway`, además de un cliente HTTP configurable. El transporte valida respuestas con Zod e incluye cookies, timeout, cancelación, idempotencia y errores normalizados; no contiene reglas de juego ni lógica de negocio.

```ts
const client = createBackofficeClient({ baseUrl, endpoints });
await client.login({ documentOrPhone, password });
await client.register({ displayName, documentOrPhone, password, acceptedTerms: true });
```

La composición se configura con `NEXT_PUBLIC_PRODUCT_GATEWAY_MODE=preview|backoffice`, `NEXT_PUBLIC_BACKOFFICE_BASE_URL` y rutas públicas `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_*`. `preview` es exclusivamente local/QA. Las rutas de billetera, comprobante y bootstrap monolítico son opcionales; la hidratación normal compone sesión, catálogo, jugadas y resultados desde sus capacidades separadas. Las URLs y formas definitivas deben venir del contrato del backoffice; no se hardcodean en páginas o componentes ni se incluyen secretos en variables públicas.

El detalle de DTO, transporte, errores y checklist de UAT está en `docs/BACKOFFICE_INTEGRATION.md`.

## QA

La matriz visual cubre dark y light en:

`320×568`, `360×800`, `390×844`, `430×932`, `768×1024`, `1024×768`, `1366×768`, `1440×900` y `1920×1080`.

Los flujos E2E validan los seis conectores tradicionales, Sapy’aite como única Instantánea habilitada, el rechazo de juegos omitidos por el catálogo, comprobantes consultados desde Mis Jugadas, saldo autoritativo, recarga, idempotencia, historiales, login/logout, registro preview no persistente, sesión expirada y error de red con reintento.

Playwright instala Chromium en CI. En una estación nueva, ejecutá una vez `npx playwright install chromium`; también podés usar Chrome con `PLAYWRIGHT_CHANNEL=chrome`.

## Fuentes y recursos

- Fuente funcional: `reference/original-v25/quinie_v25_SOURCE_OF_TRUTH.html`
- Reglas y arquitectura: `project-docs/`
- Assets de producto: `public/assets/`
- Capturas internas no publicables: `reference/reference-screens/`
- Referencia secundaria: `reference/fernando-secondary/`

Las capturas internas se mantienen fuera de `public/` para no exponer datos personales aparentes ni elementos del navegador.

## Git y despliegue

El repositorio usa la rama `main`. Las entregas para revisión se suben a una rama
`release/*`, sin actualizar `main` ni activar su despliegue. No se versionan
`.env`, `node_modules`, `.next`, reportes ni resultados temporales. Antes de
cualquier push ejecutá:

```bash
npm run verify
npm run test:e2e
```

La entrega `0.2.0` y sus condiciones de publicación se describen en
[`docs/RELEASE_0.2.0.md`](docs/RELEASE_0.2.0.md). Las pruebas unitarias limitan
la concurrencia a dos procesos para mantener estable la ejecución local y en CI.

El despliegue queda diferido. `project-docs/HOSTINGER_DEPLOY.md` registra únicamente los prerrequisitos del frontend; ya no exige base de datos, secretos de sesión ni un proveedor local. Producción requiere el contrato y credenciales del backoffice, validación UAT y aprobación de Negocio/Legal.
