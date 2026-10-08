# Activar la API de carteleras de UFCinfo

La sincronización incremental utiliza [Cito API](https://citoapi.com/ufc-api/), proveedor independiente de UFC. La copia histórica existente procede de UFCalendar y se conserva hasta que sus eventos se actualicen con Cito. El JSON distingue ambas procedencias. Cito ofrece 500 peticiones mensuales y 10 por minuto en su plan gratuito; comprueba sus condiciones para el uso que harás del proyecto.

## Activación en GitHub

1. Crea una clave gratuita desde [Cito](https://citoapi.com/free-ufc-api/).
2. En el repositorio `bryancubeles7e9-ai/UFCinfo`, abre **Settings → Secrets and variables → Actions → New repository secret**.
3. Nombre: `CITO_API_KEY`. Valor: tu clave. No la pegues en el chat ni la guardes en archivos del repositorio.
4. En **Actions → Actualizar eventos UFC → Run workflow**, ejecuta una sincronización manual.
5. Comprueba el resultado en Actions y revisa `assets/data/ufc-events.json`: fecha `synchronizedAt`, fuente `Cito` o `Cito + UFCalendar` y eventos `dataSource: Cito`.

El workflow necesita Actions habilitado y permisos de escritura del `GITHUB_TOKEN` para guardar el JSON en `main`. Una protección de rama que impida los commits del bot requiere adaptar la publicación. Render debe desplegar los nuevos commits de `main`.

## Cuota y actualizaciones

Se ejecuta a las 00:17 y 12:17 UTC, además de la ejecución manual y los cambios de código. Cada ejecución hace dos consultas de lista (`/upcoming`, `/recent`) y hasta tres consultas de combates (`/events/{slug}/bouts`). Por tanto, dos ejecuciones al día gastan como máximo 300 consultas en un mes de 30 días y dejan margen dentro de las 500 gratuitas. Las ejecuciones manuales y por cambios también consumen cuota; vigila el contador de Cito. No hay reintentos automáticos que multipliquen peticiones.

Elige el evento reciente de las dos últimas semanas y los dos próximos más cercanos; si no hay reciente, actualiza hasta tres próximos. Conserva los demás eventos, imágenes y resultados existentes. Un error de API, respuesta incompleta o formato inesperado preserva todo el archivo anterior. Los eventos que no se consultan en cada ejecución pueden quedar desactualizados, incluidos los próximos más lejanos. Cito ofrece también preliminares y preliminares previos; el formato actual de UFCinfo sigue mostrando solo la cartelera principal. Añadir secciones y ajustar la interfaz es una actualización posterior.

Los eventos antiguos que todavía procedan de UFCalendar conservan esa atribución en la fuente conjunta. Los enlaces individuales siguen apuntando a UFC.com para que el visitante pueda contrastar cada cartelera. No se descargan pósteres nuevos en este importador. Evita publicar la clave y revisa los derechos de uso de imágenes y datos según las condiciones del proveedor.

El navegador comprueba el archivo publicado al abrir, cada cinco minutos y al volver a la pestaña. Esas comprobaciones no consumen peticiones de Cito. La actualización depende de que el workflow y el despliegue de Render terminen; no se trata de resultados en directo.

## Verificar localmente

Con `CITO_API_KEY` como variable de entorno, ejecuta `python3 scripts/sync-cito-events.py`. Antes de escribir el archivo público puedes usar `--output` con una copia temporal del JSON. Tests sin credenciales: `python3 -m unittest discover -s tests -p 'test_cito_sync.py'` y `node tests/test-events-feed.mjs`.

La [referencia de eventos](https://citoapi.com/docs/api/ufc/events/) documenta las rutas. La forma concreta de las respuestas y la cobertura de carteleras deben validarse con la primera ejecución autenticada; si fallan las validaciones, se conserva la última copia válida.

## Rankings automáticos cada 12 horas

El mismo workflow ejecuta `scripts/sync-ufc-rankings.py` a las 00:17 y 12:17 UTC, sin clave ni suscripción de Cito. También se ejecuta manualmente y al subir cambios incluidos en los filtros del workflow. Descarga https://www.ufc.com/rankings y extrae únicamente la sección All Rankings (no All Meta Rankings): las ocho divisiones masculinas (mosca, gallo, pluma, ligero, wélter, medio, semipesado y pesado), las tres femeninas (paja, mosca y gallo) y las dos listas libra por libra. Conserva el campeón de cada división y las posiciones oficiales 1–10, incluidos empates.

Valida las 13 categorías completas antes de sustituir `assets/data/ufc-rankings.json`. Si UFC bloquea la petición, cambia el formato o la respuesta es incompleta, el paso aparece como fallido en Actions pero mantiene el archivo anterior y permite continuar la actualización de eventos. Cada consulta correcta guarda su fecha, aunque UFC no haya cambiado el orden. La fecha de publicación se toma del pie correspondiente a All Rankings; no se inventa un año ausente en la fuente.

La web carga el archivo al abrirse, cada cinco minutos y al volver a la pestaña; conserva los datos anteriores ante un fallo y muestra la última consulta válida. La publicación requiere subir el workflow y estos archivos a `main`, tener Actions con permisos de escritura y desplegar los commits resultantes. La sincronización de rankings funciona sin `CITO_API_KEY`.

Ejecución local: `python3 scripts/sync-ufc-rankings.py`. Pruebas sin red: `python3 -m unittest discover -s tests -p 'test_*.py'` y `node tests/test-rankings-feed.mjs`.
