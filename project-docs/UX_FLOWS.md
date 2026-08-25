# Flujos UX obligatorios

## Tradicional
Inicio -> familia Quiniela -> elegir juego -> ingreso compacto -> monto -> sorteo -> resumen -> confirmar -> respuesta backend -> comprobante -> Mis Jugadas.

No mostrar una grilla 001-999. El usuario escribe el numero o usa seleccion aleatoria cuando corresponda.

## Instantanea simple
Inicio -> Instantaneas -> juego -> seleccion -> monto -> JUGAR AHORA -> backend confirma jugada y resultado -> rodillo anima hasta el valor autoritativo -> resultado -> esperar 5 segundos -> comprobante digital.

## Po'a 5 / Po'a 10
Elegir 3 numeros distintos -> monto -> confirmar -> generar/recibir 5 o 10 resultados -> animar todos -> frenar progresivamente -> resaltar coincidencias -> mostrar cantidad de aciertos y premio -> 5 segundos -> comprobante.

## Racha 5
Elegir PAR/IMPAR -> monto -> 5 resultados -> clasificar cada uno -> marcar aciertos -> mostrar 0-5 aciertos -> premio si regla configurada -> comprobante.

## Comportamiento
- Bloquear doble click mientras una jugada esta pendiente.
- Idempotency-Key obligatorio.
- Nunca fabricar un resultado ganador desde el frontend.
- Sonido puede apagarse. Respetar reduced-motion.
- Si el usuario navega durante countdown, cancelar solo la apertura visual del modal; no cancelar una apuesta ya aceptada.
