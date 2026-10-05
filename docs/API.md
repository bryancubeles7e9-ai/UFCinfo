# Activar la API de eventos de OCTAGON

El proveedor es [UFCalendar](https://api.ufcalendar.com/docs), independiente de UFC. La integración está preparada; necesita una cuenta con prueba o plan activo y una clave. No pongas la clave en JavaScript, archivos del repositorio, URLs ni mensajes públicos.

## Activación en GitHub

1. Obtén la clave desde https://www.ufcalendar.com/account/api.
2. En `pruebaCodex`, abre **Settings → Secrets and variables → Actions → New repository secret**.
3. Nombre: `UFCAL_KEY`. Valor: la clave del proveedor.
4. El workflow debe estar en `main`. En **Actions → Actualizar eventos UFC → Run workflow**, ejecuta una sincronización manual.
5. Comprueba que `assets/data/ufc-events.json` tiene `source: UFCalendar` y `synchronizedAt` con la hora de ejecución.

El workflow requiere Actions habilitado y permisos para que `GITHUB_TOKEN` escriba en `main`. Una protección de rama que impida commits del bot requiere adaptar ese permiso o el flujo de publicación; no se elude la protección.

## Cómo se actualiza

GitHub Actions ejecuta `scripts/sync-ufc-events.py` a las 00:17, 06:17, 12:17 y 18:17 UTC, y también permite ejecución manual. GitHub puede retrasar tareas programadas. El script pagina `/v1/events`, filtra `org=ufc`, `status=completed` y fechas del año UTC actual, y reconoce eventos por `numbering = UFC N` o `N`. Cuando el campo falta, reconoce `UFC N` en el título, incluyendo prefijos de patrocinadores como Crypto.com. No filtra por PPV: ese campo no equivale a evento numerado.

Para cada evento consulta `/v1/events/{id}` y conserva `card_section=main`, eliminando combates cancelados. Ordena el estelar primero y el resto por `ordering`. Mapea ganadores por identificador; muestra empates y No contest sin inventar ganador. No importa cuotas, imágenes ni perfiles de la API. Conserva únicamente los campos que la web muestra.

Todas las respuestas deben validar antes de sustituir el JSON. Fallos de autenticación, cuota, red, respuesta inválida o pérdida de eventos ya existentes abortan la actualización. El archivo anterior permanece intacto. Se reintentan fallos temporales hasta tres veces, respetando `Retry-After` de hasta 30 segundos. La siguiente ejecución vuelve a intentarlo.

La web solicita el JSON sin caché del navegador al cargar, cada cinco minutos y al regresar a la pestaña. Si el archivo no está disponible o es inválido, mantiene los últimos datos de la sesión o la copia inicial de UFC. Muestra fuente y última fecha disponible. La cadencia de seis horas afecta a la consulta de API; los cinco minutos solo comprueban el archivo publicado. No es un feed de resultados en directo.

## Publicación

La sincronización hace un commit solo del JSON en `main`. Para una web publicada, el servidor debe desplegar esa revisión. Abrir una copia local no descarga automáticamente commits de GitHub: actualiza el repositorio para verlos.

El mismo workflow incluye publicación opcional con GitHub Pages. Para activarla:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**: `OCTAGON_PAGES_ENABLED` con valor `true`.
3. Ejecuta de nuevo el workflow. Publicará únicamente `index.html` y `assets/`, sin scripts, tests, archivos Git ni secretos.

La publicación está desactivada hasta configurar esa variable. GitHub Pages en repositorios privados requiere un plan compatible; no cambies la visibilidad del repositorio para sortear ese requisito. Si alojas OCTAGON en otro proveedor, deja la variable sin configurar y conecta su despliegue a los commits de `main`.

## Ejecutar y verificar localmente

Con `UFCAL_KEY` ya presente como variable de entorno, ejecuta `python3 scripts/sync-ufc-events.py`. No hace falta instalar dependencias Python. Los tests no usan claves ni red: `python3 -m unittest discover -s tests -p 'test_*.py'`.

Documentación: [API y campos](https://api.ufcalendar.com/docs), [planes](https://www.ufcalendar.com/developers), [condiciones](https://www.ufcalendar.com/developers/terms), [tareas programadas](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
