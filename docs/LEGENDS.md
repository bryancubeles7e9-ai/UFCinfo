# Leyendas retiradas

«Leyenda» es una selección editorial de UFCinfo, independiente de tener un cinturón actual o anterior. Se exige `legend: true` y `careerStatus: "retired"`; la retirada por sí sola no otorga el distintivo. No equivale a un título oficial de UFC.

Primera selección (14 de octubre de 2026): Georges St-Pierre, Khabib Nurmagomedov, Daniel Cormier, Joanna Jędrzejczyk, Frankie Edgar y Maurício «Shogun» Rua. Sus perfiles y reportajes UFC documentan el retiro y su trayectoria. Cada ficha conserva `retirementSource`, `legendSource` y `legendConsulted` en el directorio y manifiesto.

Las fichas incluyen fotos y estadísticas de los perfiles oficiales UFC. El país representado procede de banderas en carteleras oficiales. Las guardias proceden de la copia fechada de UFC Stats/TidyTuesday del 7 de julio de 2026. Las fuentes de formación se conservan por separado.

La insignia de laureles y el borde violeta aparecen en el catálogo, con filtro «Leyendas retiradas». El perfil explica el reconocimiento y enlaza la fuente. Mi esquina y Fight Lab también muestran la insignia. Se mantienen seguimiento, búsqueda y comparación.

Los cinturones son históricos (`former`). La sincronización de rankings no debe promover a un luchador marcado como retirado. Un regreso requiere revisar manualmente su estado y fuentes; no se infiere del ranking. La sincronización habitual de récords solo consulta participantes de eventos recientes, por lo que estas fichas no añaden consultas periódicas. Una actualización completa explícita puede volver a consultar sus perfiles.

Dustin Poirier añadido el 14 de octubre de 2026. La ficha conserva su título interino de peso ligero de 2019 en la nota de trayectoria; no se registra como título absoluto ni BMF. Su retiro está documentado por UFC tras UFC 318.

## Salón de leyendas (26 de noviembre de 2026)

La colección pasa de 7 a 41 leyendas: todos los luchadores retirados del **Salón de la Fama de UFC** (alas moderna y de pioneros), más la selección propia de UFCinfo (Dustin Poirier). Amanda Nunes, también en el Salón de la Fama, queda fuera mientras su perfil de UFC la marque como «Active».

- **Fuente de verdad:** `docs/legends.json`. Cada leyenda tiene su ala, el año de ingreso (solo cuando UFC lo publica de forma explícita), sus cinturones de UFC históricos, una nota en español con su versión en inglés y en catalán, y la página y la foto oficiales del Salón de la Fama.
- **Aplicar cambios:** `python3 scripts/import-legends.py` importa los perfiles que falten desde UFC.com, marca a cada uno como leyenda retirada, guarda la foto del Salón de la Fama en `assets/images/legends/` (se usa también como retrato si UFC no publica uno) y genera las traducciones en `assets/js/i18n/legend-notes.js`. Con `--check` solo comprueba en UFC.com que nadie haya vuelto a competir. Después conviene ejecutar `python3 scripts/optimize-images.py`.
- **Interfaz:** en Luchadores › Leyendas aparece el Salón de leyendas, con cifras, filtros por ala y una galería ordenada por año de ingreso. La ficha muestra la foto, el ala y el año, la nota y el enlace al Salón de la Fama.
- **Nuevos miembros:** cuando UFC anuncie una nueva promoción, se añade su entrada a `docs/legends.json` (con la nota y sus traducciones) y se vuelve a ejecutar el script. `tests/test-legends.mjs` falla si a alguna leyenda le falta la foto, la nota o una traducción.
