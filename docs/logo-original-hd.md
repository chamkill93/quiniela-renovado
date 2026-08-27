# Logo original de quinie.LA

## Fuente y archivo integrado

- Referencia recibida del usuario: `public/assets/brand/quinie-la-original-reference.png` (237 × 115).
- Restauración de mayor resolución: `public/assets/brand/quinie-la-original-hd.png` (1919 × 820).
- Herramienta utilizada: imagegen integrada, no CLI ni API externa.
- No se sustituyeron ni borraron los archivos anteriores.

La restauración parte de un raster pequeño; no es un archivo vectorial maestro
oficial. Se mantiene la composición de la referencia, sin agregar el eslogan
que aparecía en el logo anterior de la web.

## Presentación en la web

`Logo.tsx` reutiliza una única silueta para ambos temas. Dos máscaras SVG
separan las letras y el aro rojo del fondo blanco del PNG. El fondo no se pinta:
no hay rectángulo blanco, filtro de inversión global ni una tipografía instalada
de la que dependa el logo. El original PNG guardado conserva su fondo blanco.

- Oscuro: letras blancas.
- Claro y comprobantes: letras #17191d.
- Aro invariable: #e6243c.
- Proporciones conservadas mediante viewBox y aspect-ratio.
- IDs independientes por instancia para cabecera, menú, pie y comprobante.

## Prompts utilizados para la versión seleccionada

### Restauración clara

Use case: precise-object-edit. Image 1 is the original logo edit target. Restore faithfully at high resolution for use in a website. Produce the LIGHT-THEME version: change ONLY white logo lettering to solid near-black #17191d, and remove the charcoal rectangular background. Keep the original red circular ring red (#e6243c). Preserve the exact lettering "quinie.LA", original rounded lowercase font and handmade L A shapes, original spacing, proportions, ring shape/interruptions. Do not redraw the logo in a new font, add a tagline, or restyle. Flat pure colors with clean sharp antialiased edges. One single logo, centered, tightly framed with small margins, horizontal aspect ratio approximately 2.5:1. CRITICAL: background must be true alpha transparency, NOT an illustration of a checkerboard. Never draw checkerboard squares. If genuine alpha transparency cannot be produced, use perfectly flat pure white #ffffff background as fallback, without any gradients or shadows. No gray boxes, texture, decoration or extra text. Target 2400 pixels wide high resolution.

### Corrección del fondo

Edit Image 1. Change ONLY the background: replace every gray checkerboard square with one continuous, completely flat, solid pure white #FFFFFF background. Inside every letter hole and inside the red ring must also be pure white. No checkerboard, no transparency representation, no gray anywhere in the background, no shadow, no texture. Keep the existing black quinie.LA lettering and red ring precisely unchanged in position, shape, size and color. Keep the same image dimensions, crop and layout. This is a production logo asset, not a mockup. Output one sharp high resolution PNG.

Las primeras propuestas con cuadriculado se descartaron; no se usan en el sitio.
