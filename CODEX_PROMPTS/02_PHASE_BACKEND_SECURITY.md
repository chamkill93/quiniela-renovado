# FASE 2 - Frontend integrable con backoffice

## Misión

Partiendo de la Fase 1 validada, desacoplar la UI de las implementaciones temporales y dejar quinie.LA lista para conectarse a un backoffice externo. Implementar únicamente integración frontend, contratos tipados y los flujos de inicio de sesión y registro de usuario.

## Restricciones obligatorias

- No implementar backend local, base de datos, Prisma, migraciones, seeds ni persistencia de negocio.
- No implementar RNG, reglas de juego, payouts, jackpots, liquidación, ledger, auditoría o modificación autoritativa de saldo.
- No inventar endpoints ni campos como hechos definitivos. Encapsular cualquier supuesto pendiente en el contrato y documentarlo para validación con el backoffice.
- No almacenar contraseñas, tokens o datos personales reales en el repositorio, `localStorage`, logs o fixtures públicos.
- No iniciar Kodexa, despliegue, infraestructura ni panel de backoffice.

## Implementación requerida

1. Crear contratos TypeScript explícitos para sesión, usuario, catálogo, saldo, jugada, resultado, comprobante, paginación y errores.
2. Exponer capacidades mediante `AuthGateway` y `GamingGateway`, compuestas en un `BackofficeGateway` inyectable.
3. Crear un adaptador HTTP con URL base configurable, serialización, timeout, cancelación, encabezados y errores normalizados.
4. Crear un adaptador mock de transporte con fixtures deterministas y escenarios de éxito/error. El mock no debe calcular resultados, premios ni saldos.
5. Permitir cambiar entre adaptador HTTP y mock sin modificar páginas ni componentes.
6. Implementar la UI y los conectores de login, registro, consulta de sesión y logout.
7. Preferir cookies de sesión `HttpOnly`, `Secure` y `SameSite` administradas por el backoffice. Si el contrato definitivo exige otro mecanismo, mantenerlo encapsulado en el adaptador y nunca persistir secretos de forma insegura.
8. Conectar catálogo, saldo, jugadas, resultados y comprobantes al gateway. Mantener las 6 quinielas tradicionales y exactamente 9 Instantáneas de Fase 1.
9. Recibir el resultado autoritativo antes de iniciar la animación de rodillos. El frontend solo representa la respuesta recibida.
10. Diseñar estados `loading`, `empty`, `error`, `unauthorized` y `success`, con reintento seguro cuando corresponda.
11. Mantener responsive, dark/light, sonido, reduced motion, accesibilidad y estética del último mockup aprobado.

## Autenticación frontend

- Login y registro deben incluir validación de UX, estados de envío, prevención de doble submit y mensajes de error accesibles.
- Cubrir credenciales rechazadas, usuario existente, rate limit, backoffice indisponible, sesión expirada y error inesperado.
- La validación del navegador no sustituye la validación ni las políticas de seguridad del backoffice.
- La sesión externa controla navegación, rutas protegidas y disponibilidad de acciones; el frontend no concede roles o permisos.

## Pruebas requeridas

- Unitarias para mappers, validación de respuestas y normalización de errores.
- Pruebas de contrato compartidas que ejecuten los mismos casos sobre los adaptadores HTTP y mock.
- Pruebas de componentes para login, registro y todos los estados de red.
- E2E para login, registro, sesión expirada, fallo de red y un recorrido de juego alimentado por fixtures.
- Verificación de que ningún componente genera números, calcula premios, altera saldos o persiste credenciales.
- Lint, typecheck, suite de pruebas y build verdes.

## Definition of Done

- Todos los datos remotos usados por la UI tienen contratos tipados y validados en la frontera; no hay `any`.
- Los adaptadores HTTP y mock son intercambiables por configuración/inyección.
- El mock es determinista y no contiene lógica de negocio.
- Login, registro, sesión y logout funcionan con ambos adaptadores.
- Todas las vistas dependientes del backoffice manejan carga, vacío, error, no autorizado y éxito.
- Saldo, jugadas, resultados, comprobantes y rodillos provienen exclusivamente del gateway.
- No existen secretos ni datos personales reales en código, logs o fixtures.
- La experiencia de Fase 1 no presenta regresiones visuales, responsive o de accesibilidad.
- Tests y build están verdes.
- No se implementó backend local, Kodexa ni despliegue.

Al terminar, detenerse. No avanzar a otra fase.
