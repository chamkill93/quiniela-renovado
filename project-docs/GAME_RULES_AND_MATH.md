# Reglas de producto y matriz matematica

## Quiniela tradicional
1. A la Cabeza: 3 cifras 001-999, postura 1.
2. A los Premios: 3 cifras 001-999, postura 2-14.
3. Invertida: 3 cifras, visualizacion por puntos y postura parametrizada.
4. Redoblona: numero de Cabeza de 3 cifras + numero Redoblona de 2 cifras; postura Redoblona 2-14.
5. Sapy'aite tradicional: Quiniela rapida de 3 cifras.
6. Megaloto: 6 numeros unicos del 1 al 45, manual o al azar.

## Instantaneas - total 9
Todas usan resultados de 001 a 999 y el servidor es autoritativo. La animacion nunca decide el resultado.

### 1. Sapy'aite - Par / Impar
El jugador elige PAR o IMPAR. El servidor genera 001-999 y evalua la paridad. En 001-999 hay 499 pares y 500 impares.

### 2. Po'a - Centena
El jugador elige la centena y se evalua el rango del resultado. La primera centena tiene 99 resultados si se usa 001-099; el motor debe contemplar esta asimetria en la tabla de pagos si se usa dinero real.

### 3. Pya'e - Mayor / Menor de 500
MENOR: 001-499. MAYOR: 501-999. El 500 es neutral y la regla de reembolso/perdida debe ser parametrizable.

### 4. Petei - Ultima cifra
El jugador elige 0-9 y se evalua la ultima cifra del resultado.

### 5. Mokoi - Ultimas 2 cifras
El jugador elige 00-99 y se comparan las dos ultimas cifras.

### 6. Mbohapy - Exacto 3 cifras
El jugador elige un numero 001-999. Probabilidad exacta: 1/999.

### 7. Po'a 5 - 5 rodillos / 3 numeros elegidos
El jugador elige 3 numeros distintos 001-999. Se generan 5 resultados independientes.
Probabilidades aproximadas:
- 0 aciertos: 98.507489%
- 1 acierto: 1.483547%
- 2 aciertos: 0.008937%
- 3 aciertos: 0.0000269%
- al menos 1: 1.492511%
Ejemplo de multiplicadores para prototipo, NO definitivos: 1 acierto x60, 2 x500, 3 x5000. RTP aproximado del ejemplo: 93.6%.

### 8. Po'a 10 - 10 rodillos / 3 numeros elegidos
El jugador elige 3 numeros distintos 001-999. Se generan 10 resultados independientes.
Probabilidades aproximadas:
- 0 aciertos: 97.037255%
- 1 acierto: 2.922809%
- 2 aciertos: 0.039616%
- 3 aciertos: 0.0003182%
- 4 aciertos: 0.000001677%
- al menos 1: 2.962745%
Ejemplo para prototipo, NO definitivo: 1 acierto x25, 2 x400, 3 x12500, 4+ jackpot/configuracion. RTP del ejemplo sin 4+: ~92.9%.

### 9. Racha 5 - Par / Impar en 5 rodillos
El jugador elige PAR o IMPAR. Se generan 5 resultados independientes 001-999. Premio por 4 o 5 coincidencias. Con aproximacion 50/50: exactamente 4 = 15.625%, 5 = 3.125%, al menos 4 = 18.75%. Ejemplo de prototipo: 4 x3, 5 x15, RTP ~93.75%. Ajustar por la asimetria real 499/500 de paridad.

## Regla de produccion
Los multiplicadores, RTP, apuesta minima/maxima, premio maximo, manejo del 500 y jackpot deben ser parametrizables y aprobados por Negocio/Kodexa/Legal antes de produccion. No hardcodear valores de prototipo como definitivos.
