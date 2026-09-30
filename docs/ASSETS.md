# Recursos visuales

`resources/welcome.png` fue generado mediante la herramienta integrada de generación de imágenes de ChatGPT. La herramienta no ofrece un selector que permita confirmar la denominación “Images 2.5”. La imagen es una ilustración conceptual de paisaje, no cartografía ni fotografía de un sitio identificado. Se utiliza en la bienvenida mediante CSS, con texto HTML accesible encima.

Prompt utilizado:

> Use case: stylized-concept. Asset type: full-bleed welcome illustration for a professional mobile conservation geoportal for Bolivia. Create a refined, premium editorial aerial landscape illustration showing a winding pale turquoise river through emerald Amazonian forest transitioning toward distant layered Andean mountains. Subtle cartographic contour lines delicately woven into terrain, geographical exploration feeling. Portrait 1024x1536 composition. Upper half luminous soft mist and distant hills, lower half deep forest greens with low visual noise so white app typography can be overlaid in HTML. Sophisticated natural palette, deep forest green, sage, muted warm ivory, small turquoise accents. Beautiful tactile paper/grain and precise fine terrain detail, elegant environmental atlas aesthetic. No text, no letters, no logos, no phone frame, no UI, no invented borders or country outlines. This is a decorative conceptual illustration, not a scientific map.

`resources/icon.svg` es un icono vectorial original de mapa y río. `scripts/icons.mjs` genera sus versiones PNG para Android, iOS y PWA. Los controles de interfaz son vectores definidos en `src/mobile.js`, lo que permite tamaños accesibles y bordes nítidos.

La tipografía Inter se distribuye localmente mediante `@fontsource/inter`; conserva su licencia en la dependencia instalada. Las bibliotecas y los datos conservan las fuentes y atribuciones del geoportal original. Los mapas base muestran sus atribuciones sobre el mapa.
