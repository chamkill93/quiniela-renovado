# Archivo de la revisión documental (no utilizado por la página de reglas)

Actualización: la página pública describe brevemente la selección actual y muestra
los pagos que trae el catálogo. No importa esta transcripción ni muestra artículos,
páginas o diferencias con el documento. Sapy’aite muestra su multiplicador
configurado (700× en el catálogo local). Las modalidades tradicionales no tienen
tabla de pagos en su contrato actual. A pedido del usuario, la presentación ofrece
referencias y una calculadora, sin cambiar ese contrato: Cabeza = base de tres
cifras (700); Premios = base / postura; Invertida = base / órdenes distintos /
postura; Redoblona = base de tres cifras × base de dos cifras (80) / postura.
Las bases parten de las tasas actuales de Sapy’aite y Mokõi; si esos juegos no
están en el catálogo se usan 700 y 80 solo para la referencia. La estimación
supone un acierto, o ambas etapas en Redoblona, y descarta fracciones de guaraní.
Ganancia neta = premio total estimado menos importe; no se agrega el importe al total.
No se modificó el motor ni se implementó una liquidación tradicional.

Documento aportado por el usuario: **REGLAMENTO DE JUEGO QUINIELA  (1).pdf**, escaneado, 14 páginas.
SHA-256: `B59DCF44A40B93782056EEC29656237298FC2DFECCD74B44213B31E5E4EAE775`.
Se revisaron visualmente las 14 páginas. No se presupone una fecha de vigencia a partir de la fecha del escáner.

La transcripción de pagos vive en `src/features/product/regulation-payouts.ts`.
No configura el motor, no liquida apuestas ni reemplaza una tabla operativa confirmada.

| Modalidad | Referencia del PDF | Lectura aplicada |
| --- | --- | --- |
| Cabeza | 3.1.1, p. 4 | Al menos 400 veces por tres cifras; 60 por dos; 6 por una. El documento también contempla lo dispuesto por el concesionario. No se rotulan como pagos fijos incondicionales. |
| Premios | 3.2.1–3.2.4, p. 4 | Dividir el importe entre la postura y multiplicar por la base de cifras. La repetición tiene un tope de 600 sobre la base importe/postura, pagadero una vez. No equivale a 600 veces para cada acierto. |
| Invertida | 3.3.1–3.3.9, pp. 4–5 | Tres cifras distintas generan seis combinaciones de igual importe/postura. 450 veces el importe de la combinación ganadora a la cabeza; dividir esa base por postura a los premios. Tope acumulado por repeticiones: 800 veces según el art. 3.3.8. |
| Redoblona | 3.4.1–3.4.11, pp. 5–7 | Modalidad base de dos números de dos cifras; el premio inicial alimenta la segunda etapa. Segunda postura entre 7 y 14 e igual o mayor a la inicial, salvo modificaciones contempladas en el documento. No se inventa un multiplicador único. Tope por repeticiones: 900 veces el importe inicial, al menos tres aciertos, pagadero una vez. |
| Sapy’aite | 3.5–3.5.1, p. 7 | Describe el sorteo inmediato, no fija una tarifa propia. El 700 de la vista previa se identifica como configuración de prueba y no como valor establecido por este PDF. No se cambia el motor. |

## Diferencias detectadas en la revisión anterior

- Invertida: la vista previa no desglosa todavía seis importes por combinación. No se implementó una nueva liquidación.
- Redoblona: el formulario actual permite inicial de tres cifras y segunda postura desde 2. No coincide con la modalidad base del documento. Requiere confirmar esa variante o una tarea separada de adaptación funcional.
- El PDF contiene referencias internas que no se corrigen mediante suposiciones (por ejemplo, la remisión al art. 8 en 3.2.4). Esta transcripción no introduce un liquidador automático derivado de esas remisiones.
- Las reglas de una y dos cifras quedaron archivadas en la transcripción, sin habilitar opciones de apuesta nuevas.

Estas observaciones son únicamente internas; ya no forman parte del contenido público.
