# Flujos UX obligatorios

## Tradicional
Inicio -> familia Quiniela -> elegir juego -> ingreso compacto -> monto -> sorteo -> resumen -> confirmar -> respuesta backend -> Mis Jugadas -> Ver mi comprobante.

No mostrar una grilla 001-999. El usuario escribe el numero o usa seleccion aleatoria cuando corresponda.

## Instantanea simple
Inicio -> Instantaneas -> juego -> rodillo activo -> seleccion -> fichas hasta Gs. 10.000 -> resumen compacto -> JUGAR -> backend confirma jugada y resultado -> el mismo rodillo anima hasta el valor autoritativo -> resultado -> Mis Jugadas -> Ver mi comprobante.

## Po'a 5 / Po'a 10
Elegir 3 numeros distintos -> monto -> confirmar -> recibir 5 o 10 resultados -> animar todos -> frenar progresivamente -> resaltar coincidencias -> mostrar cantidad de aciertos y premio -> Mis Jugadas.

## Racha 5
Elegir PAR/IMPAR -> monto -> 5 resultados -> clasificar cada uno -> marcar aciertos -> mostrar 0-5 aciertos -> premio si regla configurada -> Mis Jugadas.

## Comportamiento
- Bloquear doble click mientras una jugada esta pendiente.
- Idempotency-Key obligatorio.
- Nunca fabricar un resultado ganador desde el frontend.
- Sonido puede apagarse. Respetar reduced-motion.
- No abrir comprobantes automáticamente después de apostar. El modal solo se abre por acción explícita desde Mis Jugadas.
