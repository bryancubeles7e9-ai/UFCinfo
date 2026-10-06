# Activar la API de eventos de UFCinfo

El proveedor es [UFCalendar](https://api.ufcalendar.com/docs), independiente de UFC. La integración está preparada; necesita una cuenta con prueba o plan activo y una clave. No pongas la clave en JavaScript, archivos del repositorio, URLs ni mensajes públicos.

## Activación en GitHub

1. Obtén la clave desde https://www.ufcalendar.com/account/api.
2. En `pruebaCodex`, abre **Settings → Secrets and variables → Actions → New repository secret**.
3. Nombre: `UFCAL_KEY`. Valor: la clave del proveedor.
4. El workflow debe estar en `main`. En **Actions → Actualizar eventos UFC → Run workflow**, ejecuta una sincronización manual.
5. Comprueba que `assets/data/ufc-events.json` tiene `source: UFCalendar` y `synchronizedAt` con la hora de ejecución.

El workflow requiere Actions habilitado y permisos para que `GITHUB_TOKEN` escriba en `main`. Una protección de rama que impida commits del bot requiere adaptar ese permiso o el flujo de publicación; no se elude la protección.

## Cómo se actualiza

GitHub Actions ejecuta `scripts/sync-ufc-events.py` cada 12 horas, a las 00:17 y 12:17 UTC, y también permite ejecución manual. GitHub puede retrasar tareas programadas. El script pagina `/v1/events`, consulta los finalizados del año UTC actual (`org=ufc`, `status=completed`) y los próximos anunciados (`status=upcoming`, incluyendo el siguiente año cuando estén anunciados), y reconoce eventos por `numbering = UFC N` o `N`. Cuando el campo falta, reconoce `UFC N` en el título, incluyendo prefijos de patrocinadores como Crypto.com. No filtra por PPV: ese campo no equivale a evento numerado.

Para cada evento consulta `/v1/events/{id}` y conserva `card_section=main`, eliminando combates cancelados. Ordena el estelar primero y el resto por `ordering`. Mapea ganadores por identificador; muestra empates y No contest sin inventar ganador. No importa cuotas, imágenes ni perfiles de la API. Conserva únicamente los campos que la web muestra.

Los próximos conservan `announced`, `scheduled` o `live`; una cartelera todavía vacía muestra «pendiente de anuncio». Solo las bajas de eventos finalizados bloquean la sustitución; un próximo cancelado o pospuesto desaparece al dejar de figurar como próximo.

UFCalendar no proporciona pósteres. El importador consulta por separado la página oficial de cada evento (sin enviar la clave de API), extrae su imagen promocional del bloque principal y la descarga a `assets/images/events/`. Guarda la URL original y su texto alternativo en el JSON y acredita UFC en la tarjeta. Descarta fondos genéricos. Si la imagen falla, conserva la anterior; si no existe, muestra el marcador de póster pendiente. El workflow guarda también esas imágenes.

Todas las respuestas deben validar antes de sustituir el JSON. Fallos de autenticación, cuota, red, respuesta inválida o pérdida de eventos ya existentes abortan la actualización. El JSON anterior permanece intacto. Se reintentan fallos temporales hasta tres veces, respetando `Retry-After` de hasta 30 segundos. La siguiente ejecución vuelve a intentarlo.

La web solicita el JSON sin caché del navegador al cargar, cada cinco minutos y al regresar a la pestaña. Si el archivo no está disponible o es inválido, mantiene los últimos datos de la sesión o la copia inicial de UFC. Muestra fuente y última fecha disponible. La cadencia de 12 horas afecta a la consulta de API; los cinco minutos solo comprueban el archivo publicado. No es un feed de resultados en directo.

## Publicación

La sincronización guarda el JSON y las imágenes de eventos actualizadas en `main`. Para una web publicada, el servidor debe desplegar esa revisión. Abrir una copia local no descarga automáticamente commits de GitHub: actualiza el repositorio para verlos.

El mismo workflow incluye publicación opcional con GitHub Pages. Para activarla:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**: `OCTAGON_PAGES_ENABLED` con valor `true`.
3. Ejecuta de nuevo el workflow. Publicará únicamente `index.html` y `assets/`, sin scripts, tests, archivos Git ni secretos.

La publicación está desactivada hasta configurar esa variable. GitHub Pages en repositorios privados requiere un plan compatible; no cambies la visibilidad del repositorio para sortear ese requisito. Si alojas UFCinfo en otro proveedor, deja la variable sin configurar y conecta su despliegue a los commits de `main`.

## Ejecutar y verificar localmente

Con `UFCAL_KEY` ya presente como variable de entorno, ejecuta `python3 scripts/sync-ufc-events.py`. No hace falta instalar dependencias Python. Los tests no usan claves ni red: `python3 -m unittest discover -s tests -p 'test_*.py'`.

Documentación: [API y campos](https://api.ufcalendar.com/docs), [planes](https://www.ufcalendar.com/developers), [condiciones](https://www.ufcalendar.com/developers/terms), [tareas programadas](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Rankings automáticos cada 12 horas

El mismo workflow ejecuta `scripts/sync-ufc-rankings.py` a las 00:17 y 12:17 UTC, sin clave ni suscripción de UFCalendar. También se ejecuta manualmente y al subir cambios incluidos en los filtros del workflow. Descarga https://www.ufc.com/rankings y extrae únicamente la sección All Rankings (no All Meta Rankings): las ocho divisiones masculinas (mosca, gallo, pluma, ligero, wélter, medio, semipesado y pesado), las tres femeninas (paja, mosca y gallo) y las dos listas libra por libra. Conserva el campeón de cada división y las posiciones oficiales 1–10, incluidos empates.

Valida las 13 categorías completas antes de sustituir `assets/data/ufc-rankings.json`. Si UFC bloquea la petición, cambia el formato o la respuesta es incompleta, el paso aparece como fallido en Actions pero mantiene el archivo anterior y permite continuar la actualización de eventos. Cada consulta correcta guarda su fecha, aunque UFC no haya cambiado el orden. La fecha de publicación se toma del pie correspondiente a All Rankings; no se inventa un año ausente en la fuente.

La web carga el archivo al abrirse, cada cinco minutos y al volver a la pestaña; conserva los datos anteriores ante un fallo y muestra la última consulta válida. La publicación requiere subir el workflow y estos archivos a `main`, tener Actions con permisos de escritura y desplegar los commits resultantes. La sincronización funciona sin `UFCAL_KEY`.

Ejecución local: `python3 scripts/sync-ufc-rankings.py`. Pruebas sin red: `python3 -m unittest discover -s tests -p 'test_*.py'` y `node tests/test-rankings-feed.mjs`.
