# Saldo y movimientos

El módulo está disponible en `/saldos`, desde el saldo de la cabecera y desde Mi cuenta.

## Operaciones

- Carga y retiro con tarjeta, QR, efectivo, Tigo, Claro y Personal.
- Importes enteros entre Gs. 10.000 y Gs. 5.000.000, con importes sugeridos y entrada manual.
- Revisión previa y comprobante con canal, fecha, referencia y saldo resultante.
- Los depósitos se distinguen en verde y los retiros en rojo. El historial también conserva jugadas, premios y reintegros.
- Búsqueda por canal o referencia, filtros de tipo/canal/período, paginación y detalle de cada movimiento.

## Alcance de la simulación

En modo `preview`, las operaciones utilizan el proveedor local de gaming, sin cobros ni transferencias externas y sin solicitar datos bancarios o números de teléfono. No se generan códigos QR de pago ni instrucciones para enviar dinero real.

El servidor calcula el saldo, valida cada importe y evita retiros superiores al disponible. Una operación repetida con la misma clave devuelve su comprobante sin duplicar el movimiento. `ProductProvider` conserva la clave de una operación sin confirmar por sesión, tipo, canal e importe, incluso al cerrar y reabrir el diálogo o navegar dentro de la aplicación. Cambiar sólo el formato del importe no crea otra operación. La clave se libera al confirmar el éxito, de modo que una segunda operación intencional puede usar una referencia nueva. Esta recuperación no persiste tras una recarga completa del navegador.

Las mutaciones de saldo y jugadas en preview exigen `X-Account-Session` y la comparan con la cookie antes de modificar saldos o generar resultados. Si otra pestaña cambió la cuenta, se rechaza la solicitud sin afectar la nueva sesión. Esta cabecera pertenece al contrato de preview; no se añade un contrato supuesto al proveedor externo.

La sesión conserva el saldo inicial existente de Gs. 250.000 y comienza sin movimientos inventados. Los cambios sobreviven a una recarga de página dentro de la misma sesión. El almacenamiento local del servidor es en memoria: no es persistencia bancaria ni conserva el estado ante un reinicio del proceso.

Los retiros permanecen disponibles durante una pausa o un límite de tiempo de juego. Los errores temporales no borran un comprobante confirmado ni convierten una sesión válida en una sesión cerrada.

En modo `backoffice`, el retiro queda deshabilitado hasta disponer de un contrato externo explícito. No se conecta a un endpoint supuesto ni se aplica una simulación sobre un saldo real.

## Verificación

Las pruebas existentes de gaming, gateway y vistas cubren importes, canales, idempotencia, aislamiento entre sesiones, sobregiros, comprobantes y filtros. El recorrido de saldo de `tests/e2e/product-flows.spec.ts` incluye depósito QR, retiro Personal, recarga de página, filtros y detalle.

La vista utiliza los temas claro y oscuro del proyecto, con columnas en escritorio y movimientos apilados en móvil. Los formularios usan los diálogos compartidos con bloqueo de cierre durante el envío.

```sh
npm run lint
npm run typecheck
npm test -- --maxWorkers=2
npm run build
```
