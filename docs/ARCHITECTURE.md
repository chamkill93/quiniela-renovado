# Arquitectura objetivo

## Decision
Usar Next.js full-stack sobre Node.js para mantener un solo despliegue en Hostinger y separar claramente UI de logica server-side.

```text
Browser / Mobile Web
        |
        v
Next.js React UI
        | server actions / route handlers
        v
Application Services / BFF
   |          |           |
   |          |           +--> Audit / Logs
   |          +--------------> MySQL / Prisma
   +-------------------------> KodexaAdapter
                               |-- Mock
                               |-- UAT HTTP
                               +-- PROD HTTP
```

## Regla de seguridad
El browser nunca contiene secretos Kodexa ni decide saldo, aceptacion, RNG, premio o liquidacion.

## Modulos
- UI shell y design system
- auth
- wallet
- games catalog
- traditional bets
- instant engine
- draws/results
- tickets
- legal/consents
- admin/configuration
- kodexa adapter
- audit

## Provider adapter
El frontend y los servicios internos usan una interfaz `GamingProvider`. La implementacion MOCK permite showcase completo. La implementacion Kodexa se activa por variables de entorno sin reescribir la UI.
