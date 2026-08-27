# Entrega 0.2.0 — frontend para revisión

## Alcance

Esta entrega agrupa los cambios de interfaz, navegación, formularios y
conectores para revisarlos antes de publicar. Subir la rama `release/0.2.0`
a GitHub no implica autorizar su integración en `main` ni un despliegue.

- Inicio con el texto «Tu jugada empieza acá.», un único botón de juego y sin
  el bloque «Próximo sorteo» dentro del Hero.
- Sorteos con transmisión desplegable, programación compartida y resultados
  por fecha, conservando la información recibida del proveedor.
- Menú móvil con Reglas; catálogo con las categorías Instantáneas y Lotos,
  Sapy’aite y enlace externo a Mega Loto.
- Formularios de Quiniela con validación, revisión antes del pago y saldo
  confirmado por el servicio.
- Pantallas de cuenta, saldo, movimientos y ayuda, con sus estados de error,
  permisos y capacidades de integración.
- Ajustes de tamaños pequeños y verificaciones contra regresiones de sesión
  e idempotencia de operaciones.

## Verificación de la entrega

El workflow `quinie-ci` se ejecuta para cada push, también en ramas `release/*`:

1. Instalación reproducible con `npm ci` en Node.js 22.
2. ESLint y TypeScript.
3. Suite unitaria, con dos procesos y sin ampliar los límites de tiempo.
4. Compilación de producción con `npm run build`.
5. Pruebas E2E sobre el servidor compilado: nueve tamaños, temas claro y oscuro
   y los flujos funcionales en escritorio y móvil.

Consultar el resultado correspondiente al SHA exacto antes de integrar la rama.
Una compilación correcta por sí sola no reemplaza la validación E2E.

## Vista previa y operación real

La validación de interfaz usa `NEXT_PUBLIC_PRODUCT_GATEWAY_MODE=preview`.
Las sesiones, saldos, retiros, depósitos y resultados de este modo son de
demostración, viven en memoria y no representan operaciones con dinero real.
El video de transmisión incluido también es de muestra.

Para una operación real se requiere configurar `backoffice` y sus endpoints,
completar las pruebas de integración con el proveedor y validar sus capacidades
de autenticación, cuenta, pagos, retiros y resultados. Los conectores no
sustituyen esos servicios. No se deben guardar secretos en variables
`NEXT_PUBLIC_*` ni subir archivos `.env` a GitHub.

## Publicación posterior

- Confirmar el modo de la publicación: demostración o integración real.
- Revisar el resultado verde de GitHub Actions para el commit aprobado.
- Autorizar la actualización de `main` y el despliegue de Hostinger.
- Configurar las variables públicas durante la compilación y el arranque.
- Comprobar `/api/health`, Inicio, Quinielas, Reglas, Resultados y Cuenta después
  del despliegue. Limpiar caché sólo si se detectan recursos de otra versión.

No se modifica la configuración de producción ni se elimina caché del sitio
al preparar esta rama.
