# OCTAGON — Inside the fight

Portal de aficionados al universo UFC hecho con HTML, CSS y JavaScript, sin compilación ni dependencias de ejecución.

## Abrir la web

Abre esta carpeta en VS Code, pulsa con el botón derecho en `index.html` y selecciona **Open with Live Server**. Los módulos JavaScript necesitan un servidor HTTP: abrir el archivo con doble clic no es suficiente.

## Funciones

- Seis vistas: inicio, carteleras, luchadores, rankings, Fight Lab y Mi esquina.
- Catálogo de 24 luchadores con fotografías locales y datos consultados en sus perfiles oficiales UFC.
- Búsqueda por nombre, apodo, país y base marcial; filtros por división, estilo, guardia y cinturones.
- Distintivos de campeón actual/excampeón y palmarés de títulos UFC absolutos y BMF, excluyendo interinos.
- Guardia de UFC Stats y disciplina de formación con notas y enlaces de procedencia.
- Carteleras imaginarias, creación de eventos, cuenta atrás y descarga de calendario `.ics`.
- Rankings: top 10 de cinco categorías, campeón separado, búsqueda y acceso a fichas.
- Pronósticos personales por combate.
- Comparador de cinco atributos con radar SVG y pesos configurables.
- Análisis con notas, guardado local e importación/exportación de copias JSON.
- Tema claro/oscuro, diseño adaptable y navegación con teclado.

## Estructura

```text
mi-web/
├── index.html
├── assets/
│   ├── css/main.css
│   ├── images/       # octágono SVG, favicon y fighters/ con 24 fotografías
│   └── js/
│       ├── app.js     # navegación, renderizado e interacciones
│       ├── fighter-details.js # cinturones, guardia y formación marcial
│       ├── data.js    # perfiles y eventos de demostración
│       ├── lab.js     # comparador, radar y modelo ponderado
│       ├── rankings.js # copia fechada y vista de rankings
│       ├── store.js   # persistencia y validación de copias
│       └── utils.js   # fechas, cuenta atrás y utilidades
├── archive/nexo/     # copia de la web anterior
└── docs/            # DATOS.md y fighter-sources.json con procedencia
```

La aplicación utiliza la clave `octagon-workspace-v1` en `localStorage`, distinta de la de Nexo. Sus datos pertenecen al navegador y al origen (host/puerto) donde abras la web. Exporta una copia para trasladarlos. No hay cuentas, backend ni resultados en directo. Las fuentes tipográficas se descargan de Google Fonts; existen fuentes de respaldo si no hay conexión.

## Modelo de ejemplo

Cada luchador tiene cinco puntuaciones ficticias de 0 a 100. El índice es la media ponderada de las puntuaciones elegidas. La barra muestra la proporción entre ambos índices, no una probabilidad de victoria. Si todos los pesos son cero o se elige el mismo luchador en ambas esquinas, no se permite guardar un análisis.

Los eventos pueden cruzar divisiones: son propuestas imaginarias de aficionados. No son anuncios oficiales. Los nombres corresponden a atletas reales, y la sección Rankings incluye una copia fechada de cinco listas de UFC; las fichas muestran una copia fechada de división, récord, apodo, estilo, altura, alcance y lugar de nacimiento consultados en UFC. No hay resultados en directo. Consulta `docs/DATOS.md`.
