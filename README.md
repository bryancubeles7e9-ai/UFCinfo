# UFCinfo — Inside the fight

Portal de aficionados al universo UFC hecho con HTML, CSS y JavaScript, sin compilación. El modo invitado es estático; las cuentas utilizan un servidor Python con SQLite.

## Abrir la web

Para publicar con cuentas y solicitar que Google encuentre la página de inicio, consulta [docs/PUBLICACION.md](docs/PUBLICACION.md). La cuenta de alojamiento y el despliegue público siguen pendientes.

Para usar cuentas: ejecuta `python3 server.py` y abre `http://127.0.0.1:8780`. Registro e inicio de sesión guardan el seguimiento en el servidor. Consulta [docs/CUENTAS.md](docs/CUENTAS.md) para publicarlo y acceder desde otros ordenadores.

Abre esta carpeta en VS Code, pulsa con el botón derecho en `index.html` y selecciona **Open with Live Server**. Los módulos JavaScript necesitan un servidor HTTP: abrir el archivo con doble clic no es suficiente.

## Funciones

- Siete vistas: inicio, carteleras, luchadores, rankings, Fight Lab, Rumores y Mi esquina.
- Rumores **incompleta · pendiente de retomar**: interfaz y fuentes preparadas; búsqueda automática en X sin implementar y comprobación automática de confirmaciones desactivada. Consulta [docs/RUMORES.md](docs/RUMORES.md).
- Catálogo de 165 luchadores con fotografías locales y datos consultados en sus perfiles oficiales UFC; 141 fichas nuevas para cubrir rankings y carteleras.
- Búsqueda por nombre, apodo, país y base marcial; filtros por división, estilo, guardia y cinturones.
- Distintivos de campeón actual/excampeón y palmarés de títulos UFC absolutos y BMF, excluyendo interinos.
- Fichas ampliadas: edad, gimnasio, peso, debut, alcance de pierna y estadísticas oficiales de golpeo, derribos y finalizaciones con fuente y fecha.
- Guardia de UFC Stats y disciplina de formación con notas y enlaces de procedencia.
- Próximos eventos numerados anunciados desde UFCalendar y pestañas Próximos / Finalizados / Todos UFC, con imágenes promocionales oficiales o aviso de póster pendiente.
- Historial UFC 324–332 de 2026: cartelera principal completa, resultados disponibles y enlaces oficiales; sincronización automática preparada con UFCalendar (requiere clave).
- Carteleras imaginarias, creación de eventos, cuenta atrás y descarga de calendario `.ics`.
- Rankings: top 10 de las 11 divisiones de peso y las dos listas libra por libra, campeón separado, búsqueda y acceso a fichas; sincronización oficial cada 12 horas sin clave de API.
- Fight Lab: comparación de dos de los 165 luchadores, con 27 datos y estadísticas oficiales, fotografías, fuentes y fechas de consulta.
- Mi esquina: seguimiento de los 165 luchadores, próximos combates, agenda UFC, rankings y últimos resultados; exportación/importación del seguimiento.
- Registro e inicio de sesión con correo y contraseña, guardado del seguimiento por cuenta y separación del modo invitado.
- Modo sin spoilers activo al entrar: oculta resultados en carteleras y Mi esquina, con revelado por combate o control global. Se reactiva al recargar; las fichas y rankings mantienen sus datos publicados.
- Selector Español / English en la cabecera, con elección guardada en el navegador, traducción de la interfaz y formatos de fechas y cifras según el idioma.
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
│       ├── lab.js     # comparador de datos y estadísticas oficiales
│       ├── rankings.js # copia fechada y vista de rankings
│       ├── store.js   # persistencia y validación de copias
│       └── utils.js   # fechas, cuenta atrás y utilidades
├── archive/nexo/     # copia de la web anterior
└── docs/            # DATOS.md y fighter-sources.json con procedencia
```

La aplicación utiliza la clave `octagon-workspace-v1` en `localStorage`, distinta de la de Nexo. Sus datos pertenecen al navegador y al origen (host/puerto) donde abras la web. Exporta una copia para trasladarlos. Las cuentas y el guardado del seguimiento requieren `server.py`; no hay resultados en directo. Las fuentes tipográficas se descargan de Google Fonts; existen fuentes de respaldo si no hay conexión.

## Fight Lab

Selecciona dos luchadores distintos del catálogo para comparar perfil, datos físicos, formación y trayectoria, golpeo, derribos, sumisiones y finalizaciones. Puedes intercambiar las esquinas y abrir la ficha completa o la fuente oficial. Las barras muestran únicamente porcentajes oficiales de precisión y defensa. Los campos ausentes se indican; la falta de documentación sobre cinturones no se interpreta como ausencia de títulos. No hay puntuaciones ficticias, pesos, índice de victoria ni creación de análisis. Las copias antiguas siguen siendo compatibles; los datos históricos se conservan al exportar, aunque ya no aparecen en Mi esquina.

Las cifras son copias fechadas. Las carteleras muestran únicamente eventos oficiales de UFC. No hay resultados en directo. Consulta `docs/DATOS.md`.

## Mi esquina

Sigue cualquiera de los 165 luchadores desde su ficha, la tarjeta del catálogo o el selector de Mi esquina. La sección reúne los próximos combates anunciados y en curso, una agenda con descarga `.ics`, los últimos seis combates disponibles de los atletas seguidos y tarjetas con récord, posiciones de ranking y próxima cita. Si sigues a ambos rivales, el combate aparece una sola vez.

En modo invitado, el seguimiento se guarda en el navegador; con sesión iniciada, se sincroniza con la cuenta en el servidor. Admite exportación/importación de copias. Los favoritos previos se mantienen. La agenda utiliza exclusivamente carteleras principales de eventos numerados incluidos en la copia disponible, con fuente y fecha; no se deduce un próximo combate cuando no hay anuncio. Se actualiza al seguir/dejar de seguir y al recargar las fuentes de eventos y rankings.

## Actualizaciones automáticas de eventos

Consulta [docs/API.md](docs/API.md) para activar `UFCAL_KEY` y la tarea de GitHub Actions. El navegador carga `assets/data/ufc-events.json` al abrir la web, cada cinco minutos y al volver a la pestaña. La clave nunca se envía al navegador. Sin clave se mantiene la copia inicial. La publicación opcional con GitHub Pages requiere configuración adicional; la sincronización del repositorio funciona de forma independiente.

Verificación: `python3 -m unittest discover -s tests -p 'test_*.py'`.

Los rankings se sincronizan de forma independiente de UFCalendar, cada 12 horas desde UFC.com. Consulta `docs/API.md`. Verificación adicional: `node tests/test-rankings-feed.mjs`.

La agenda incluye eventos numerados y los Fight Night del calendario oficial de UFC de 2026 (celebrados este año y próximos anunciados). El selector de tipo se combina con el estado y la búsqueda. El banner de inicio muestra el próximo evento disponible de ambos tipos. La sincronización de UFCalendar admite Fight Night; necesita UFCAL_KEY como antes. Para actualizar manualmente la copia oficial, descarga las páginas de Fight Night enlazadas en el calendario UFC y ejecuta `python3 scripts/import-fight-nights.py CARPETA`. Solo se muestra la cartelera principal.

UFC Freedom 250 se incluye como evento especial, visible en Todos UFC, Finalizados y en el selector Eventos especiales. La sincronización conserva su identidad oficial sin tratarlo como UFC 250.

Carteleras muestra únicamente eventos oficiales. Los botones Numerados, Fight Night y Especiales están junto a Próximos y Finalizados y se combinan con ellos. Se ha retirado la creación de eventos y las pestañas Demo y Mis eventos.
