# Predeploy checklist

- [ ] `npm ci` limpio
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] DATABASE_URL de produccion configurada
- [ ] SESSION_SECRET distinto de dev
- [ ] secrets Kodexa solo en hPanel
- [ ] PROVIDER_MODE correcto
- [ ] migraciones aplicadas
- [ ] seed de demo NO ejecutado en prod
- [ ] SSL activo
- [ ] /api/health responde 200
- [ ] smoke de login, saldo, apuesta y comprobante
- [ ] footer/legal aprobado
- [ ] backups activos
