# quinie.LA — Frontend

Frontend de la quiniela: sorteos tradicionales, juegos instantáneos, Mega Loto, resultados,
saldos y perfil. Mobile-first (el foco es el celular), tema oscuro rojo/negro.

**Estado actual:** interfaz completa y funcional con datos de ejemplo. Falta conectar la API.

---

## Arranque

```bash
npm install
npm run dev          # http://localhost:3000
```

Producción:

```bash
npm run build
npm start                        # localhost
npm start -- -H 0.0.0.0 -p 3000  # accesible desde la red / celular
```

Stack: **Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS v4** · **shadcn/ui** (Base UI).

---

## Estructura

```
app/
  page.tsx                 home: saldos, sorteos del día, instantáneos, Mega Loto
  jugar/[gameId]/page.tsx  entrada única a todos los juegos
  megaloto/page.tsx        cartilla de 40 números
  resultados/page.tsx      resultados por fecha y por sorteo (?sorteo=nocturno)
  saldos/                  menú, recargar, retirar, movimientos, apuestas, premios
  profile/ soporte/ puntos-recarga/
  auth/                    sign-in, sign-up (3 pasos), reset-password
components/
  BetBuilder.tsx           apuesta de los sorteos tradicionales (4 posturas)
  InstantGamePlay.tsx      motores de los 5 juegos instantáneos
  SlotReels.tsx            rodillos animados del sorteo
  Navbar / Footer / ...    layout y piezas de UI
  ui/                      componentes shadcn
lib/
  data.ts                  DATOS DE EJEMPLO + tablas de pago
  format.ts                formato de guaraníes
```

---

## Qué hay que conectar

Todo lo que hoy es ejemplo está en **`lib/data.ts`**. Reemplazando esas constantes por llamadas
a la API, el resto de la interfaz funciona sin cambios (los componentes ya reciben los datos tipados).

| En `lib/data.ts` | Qué es | Reemplazar por |
|---|---|---|
| `mockUser` | nombre, cédula, teléfono | usuario de la sesión |
| `balances` | saldo cargado y ganado | saldos del usuario |
| `draws` | los 4 sorteos y sus horarios | catálogo de sorteos |
| `instants` | los 5 juegos instantáneos | catálogo de instantáneos |
| `resultDays` | resultados por fecha | resultados oficiales |
| `movimientos`, `apuestas`, `premios` | historiales | endpoints de historial |
| `puntos` | puntos de recarga del mapa | agencias con lat/long |
| `paymentMethods` | medios de pago | pasarela de pago |
| `megaloto` | pozo, precio, fecha | datos del Mega Loto |
| `betTypes` + `payoutFor()` | posturas y multiplicadores | tabla oficial de pagos |

### Puntos importantes

1. **Los sorteos se resuelven en el cliente.** Los juegos instantáneos sortean el número con
   `Math.random()` dentro de `InstantGamePlay.tsx`. **Esto tiene que pasar al backend**: el
   servidor debe devolver el resultado y el frontend solo animarlo. Buscar `rand(` en ese archivo.

2. **Los saldos son estado local.** `useSaldos()` en `InstantGamePlay.tsx` mantiene el saldo en
   memoria durante la partida. Hay que reemplazarlo por el saldo real y persistir cada jugada.

3. **Tablas de pago pendientes de confirmar.** Están cargadas las de *a la cabeza*
   (1/2/3 cifras: x6.5 · x65 · x450 con saldo cargado, x7 · x70 · x500 con ganado), par/impar
   (x1.3 / x1.4) y las escaleras de las rachas. Faltan las oficiales de **a los premios**,
   **redoblona** e **invertida** — hoy se calculan con una fórmula provisoria en `payoutFor()`
   (ver el comentario `PENDIENTE`).

4. **Autenticación:** las pantallas de `auth/` validan formato y navegan, pero no llaman a ningún
   endpoint. Falta sesión, verificación por SMS y recuperación real.

5. **Mapa de puntos de recarga:** hoy es un mapa estilizado con posiciones en porcentaje
   (`puntos[].x/y`). Para producción conviene un mapa real (Leaflet / Google Maps) con
   coordenadas.

---

## Diseño

Tokens y estilos en `app/globals.css`:

- Fondo `#060507`, rojo primario `#ee1c2c`, blanco `#fff6f6`
- Tipografías: **Unbounded** (títulos) y **Onest** (texto)
- Clases propias: `.btn-cta`, `.panel`, `.panel-glow`, `.glass`, `.ball`, `.chip`,
  `.slot-machine`, `.field`, `.field-amount`
- El logo es `public/logo.svg`

Todo está pensado para que cada pantalla entre en un celular sin scroll: el dock inferior es
fijo y el `body` reserva el espacio necesario.
