# FASE 2 - Backend, DB y seguridad

Partiendo de Fase 1 estable, implementar MySQL/Prisma, auth, session, wallet ledger, bets, instant engine, tickets, results, history, admin RBAC, idempotencia, audit y MockGamingProvider persistente.

Definition of Done:
- Login y session server-side.
- Saldo autoritativo DB.
- Todas las apuestas registran stake y estado transaccional.
- 9 Instantaneas calculan regla server-side.
- Payouts de prototipo vienen de configuracion, nunca del cliente.
- Doble submit no duplica apuestas.
- Ticket recuperable por URL/API.
- Mis Jugadas y resultados desde DB.
- Admin con RBAC y audit.
- Security baseline aplicada.
- Seed ficticio.
- Tests unit/integration y E2E verdes.
