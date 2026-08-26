# Checklist de predespliegue — pendiente

El despliegue no forma parte de Fase 2. Esta lista reemplaza el checklist
full-stack heredado.

- [ ] Contrato del backoffice aprobado y versionado.
- [ ] `NEXT_PUBLIC_PRODUCT_GATEWAY_MODE=backoffice`.
- [ ] URL base y todos los endpoints obligatorios configurados.
- [ ] CORS, CSRF, cookies y CSP verificados en UAT.
- [ ] Flujos de login, registro, catálogo, jugadas y resultados aprobados.
- [ ] Billetera y comprobantes habilitados solo si existen sus contratos.
- [ ] `npm ci && npm run verify && npm run test:e2e` en verde.
- [ ] Aprobación de Negocio, Seguridad y Legal.

No usar `DATABASE_URL`, `SESSION_SECRET`, `PROVIDER_MODE` ni secretos del
proveedor en este frontend.
