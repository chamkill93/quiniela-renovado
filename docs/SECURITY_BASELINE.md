# Security baseline

## Frontend
- Ningun secreto en `NEXT_PUBLIC_*`.
- No calcular saldo, premio o RNG autoritativo en React.
- CSP, X-Content-Type-Options, Referrer-Policy y permisos restrictivos.
- Sanitizar cualquier HTML legal/admin antes de renderizar.

## Auth
- Password: Argon2id.
- Session token aleatorio, guardar solo hash server-side.
- Cookie HttpOnly + Secure + SameSite=Lax/Strict segun flujo.
- Rotacion y expiracion.
- Rate limit login y endpoints transaccionales.

## Apuestas
- Idempotency-Key obligatorio.
- Transaccion DB para stake/registro/liquidacion.
- Validacion server-side con Zod.
- Juego, monto, sorteo y seleccion se validan contra configuracion server-side.
- Nunca confiar en multiplicadores enviados por cliente.

## Kodexa
- Credenciales solo server-side.
- Timeout por request.
- Retry solo cuando sea seguro e idempotente.
- Correlation ID.
- Logs sin secretos ni PII en claro.

## Admin
- RBAC.
- Audit log obligatorio para cambios de juegos, montos, flags y reglas.

## Produccion
- HTTPS.
- Backups.
- Dependabot/audit.
- Health checks.
- Alertas por errores de provider y diferencias de saldo.
