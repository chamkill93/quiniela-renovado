# Hostinger — diferido hasta la fase de despliegue

## Estado

Fase 2 entrega únicamente el frontend integrable. No autoriza ni configura un
despliegue productivo. El runbook full-stack anterior (MySQL, Prisma,
`SESSION_SECRET`, `PROVIDER_MODE` o credenciales Kodexa) no corresponde a la
arquitectura vigente y no debe utilizarse.

## Base técnica preparada

- Node.js 22.x.
- Instalación reproducible con `npm ci`.
- Verificación con `npm run verify` y `npm run test:e2e`.
- Build Next.js con `npm run build` y arranque con `npm start`.
- Modo productivo obligatorio:
  `NEXT_PUBLIC_PRODUCT_GATEWAY_MODE=backoffice`.
- URL y endpoints externos configurados mediante
  `NEXT_PUBLIC_BACKOFFICE_BASE_URL` y
  `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_*`.

## Antes de desplegar

La fase de despliegue deberá confirmar con el proveedor real:

- contrato HTTP y ambiente UAT;
- dominio, CORS, CSRF y cookies de sesión;
- orígenes CSP definitivos;
- capacidades opcionales de billetera y comprobantes;
- aprobación de Negocio, Seguridad y Legal.

No se requiere una base de datos ni secretos de identidad en este repositorio
frontend. Las credenciales y reglas de negocio pertenecen al backoffice
externo.
