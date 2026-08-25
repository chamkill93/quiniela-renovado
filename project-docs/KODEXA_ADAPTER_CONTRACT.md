# KodexaAdapter

La integracion real debe quedar detras de una interfaz. No dispersar endpoints Kodexa en componentes o rutas.

Operaciones minimas esperadas:
- getSession / validateSession
- getBalance
- listGames
- listDraws
- placeTraditionalBet
- placeInstantBet / requestInstantResult si el proveedor soporta la modalidad
- getResults
- getTicket
- getPlayHistory

Cada llamada debe registrar correlationId, tiempo, status y metadata no sensible en ProviderRequest. Timeouts, retries e idempotencia se configuran por operacion.
