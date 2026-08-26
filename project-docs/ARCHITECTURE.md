# Arquitectura de integración frontend

## Decisión

quinie.LA es un frontend Next.js que consume un backoffice externo mediante
gateways tipados e intercambiables. El backoffice es la única fuente de verdad
para sesión, catálogo operativo, saldo, jugadas, resultados y comprobantes.

```text
Browser / Mobile Web
        |
        v
Next.js React UI
        |
        v
BackofficeGateway
   |-- AuthGateway
   |-- GamingGateway
   +-- capacidades opcionales (por ejemplo, billetera)
        |
        +--> Adaptador HTTP configurable --> Backoffice externo
        +--> Transporte preview/fixtures  --> Desarrollo y QA visual
```

## Reglas de frontera

- El browser no persiste contraseñas, tokens ni secretos.
- El frontend no decide saldo, aceptación, RNG, premio o liquidación.
- Las respuestas externas se validan y normalizan antes de llegar a la UI.
- Las rutas y capacidades se configuran; no se asume un contrato definitivo
  hasta recibirlo del proveedor del backoffice.
- El transporte preview es solo una ayuda de desarrollo y no sustituye al
  backoffice productivo.
- Producción exige un modo explícito y falla de forma cerrada ante configuración
  incompleta; la política CSP habilita únicamente el origen externo configurado.

## Módulos

- UI shell y design system
- formularios de login y registro
- composición de gateways
- adaptador HTTP y normalización de errores
- catálogo, jugadas, rodillos, resultados y comprobantes como vistas
- legales y consentimiento

## Fuera de alcance de Fase 2

Backend local, base de datos, Prisma, RNG, payouts, ledger, panel de gestión,
Kodexa y despliegue productivo. Las rutas mock heredadas de Fase 1 se conservan
únicamente para la vista previa local mientras se valida el contrato externo.
