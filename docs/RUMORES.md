# Rumores y confirmaciones oficiales

El criterio actual de publicación automática se describe en [Filtro de rumores](RUMOR_FILTER.md). Ese documento sustituye las descripciones históricas del filtro que aparecen más abajo.

## Estado: publicación automática y tarea horaria preparadas

La integración se retomó a petición del usuario el 7 de octubre de 2026. El usuario pidió publicación automática, sin introducir ni aprobar reportes uno por uno, y autorizó GitHub Actions cada hora. `scripts/sync-rumors.mjs` implementa ese flujo. `.github/workflows/rumor-sync.yml` se ejecuta al minuto 17 de cada hora; necesita el secreto de API para consultar y una conexión de despliegue para actualizar un alojamiento independiente.

## Activar en GitHub

1. En el repositorio `bryancubeles7e9-ai/UFCinfo`, abrir **Settings → Secrets and variables → Actions → New repository secret** y crear `TWITTERAPI_IO_KEY` con la clave privada de TwitterAPI.io. No subir `.ufcinfo-data` ni la clave a Git.
2. En **Actions → Publicar rumores automaticamente → Run workflow**, lanzar una ejecución y revisar que guarda el catálogo. Sin la clave, el flujo falla antes de consultar o consumir créditos.
3. El bot necesita permiso **Contents: write** para actualizar el catálogo y la rama de contabilidad `ufcinfo-rumor-state`. Las reglas de protección de ramas pueden requerir configuración adicional.
4. Si la web está en Render, conectar su despliegue automático a `main` o añadir `RENDER_DEPLOY_HOOK_URL` como secreto. La URL del hook se obtiene del servicio Render existente; no crear otro alojamiento ni contratar otro plan como parte de esta integración. Para otro proveedor, adaptar este último paso a su despliegue.

La rama `ufcinfo-rumor-state` conserva solo contadores y progreso de paginación, sin credenciales ni textos originales. Cada reserva se confirma en GitHub **antes** de consultar la API. Si GitHub rechaza ese guardado, no se realiza la consulta de pago. No borrar ni reiniciar esta rama para evitar reiniciar el límite acumulativo. El historial privado de posts no se persiste en esta rama; entre ejecuciones se deduplican las publicaciones contra el catálogo público y se conserva el cursor. GitHub puede retrasar tareas programadas; no garantiza tiempo real.

## Flujo automático

`node scripts/sync-rumors.mjs` consulta las ocho fuentes por el servidor, filtra boxeo, respuestas y retuits, conserva un historial privado y agrupa peleas. Genera resúmenes estructurados en español e inglés y actualiza `assets/data/ufc-rumor-groups.json`; la web consulta ese archivo cada minuto. No requiere importar, escribir ni aprobar reportes en el navegador. Los resúmenes usan los nombres y la fecha detectados, sin recurrir a otra API de pago ni copiar los posts íntegros.

Para procesar los candidatos ya guardados sin otra consulta: `node scripts/sync-rumors.mjs --from-file .ufcinfo-data/twitterapi-candidates.json`. Para mantener un proceso local: `node scripts/sync-rumors.mjs --watch`. La recopilación requiere activar `enabled` en `scripts/rumor-sync.config.json` o establecer `UFCINFO_RUMORS_ENABLED=true`; los valores de frecuencia y créditos deben revisarse antes de activar consultas. En un alojamiento, el proceso debe ejecutarse allí o sus archivos deben llegar al despliegue. Ejecutarlo solo en un PC no actualiza un servidor independiente.

Solo se publican automáticamente grupos que identifican dos nombres, una fecha válida futura, una referencia UFC y lenguaje de programación o negociaciones. Opiniones y anuncios que se presentan como oficiales se excluyen. El detector es heurístico y puede omitir reportes ambiguos o clasificar incorrectamente un texto: cada tarjeta indica **recopilado automáticamente**, **sin confirmar** y conserva los enlaces y atribuciones (incluida una fuente como ABC MMA). No se afirma revisión humana ni confirmación UFC. La bandeja de revisión es opcional.

La paginación guarda el cursor cuando se alcanza el límite de páginas por ejecución, para continuar desde ahí. Los ID de posts evitan duplicados y una clave de luchadores más fecha mantiene una tarjeta por pelea entre ejecuciones. La fecha del evento inferida del mes/día se marca como inferida; no se inventa un evento UFC numerado. Los errores de API conservan el último catálogo público válido.

El estado privado `.ufcinfo-data/rumor-sync-state.json` contabiliza créditos, cursor e historial de siete días al ejecutarse localmente. En Actions, la contabilidad duradera de GitHub es la fuente autoritativa. El límite configurado de 1.000.000 créditos es acumulativo para este proceso, no un presupuesto mensual ni una lectura del saldo real del proveedor. Reserva 300 créditos por página antes de enviar cada petición (20 resultados × 15 créditos), incluso si falla, y deja de consultar cuando alcanzaría el límite. No descuenta lo gastado antes por pruebas u otros procesos; hay que ajustar el límite al saldo disponible y conservar el estado entre ejecuciones. Un archivo de bloqueo y la concurrencia de Actions evitan ejecuciones simultáneas. Tras un fallo local abrupto, revisar el bloqueo antes de eliminarlo. Tarifas verificadas el 7 de octubre de 2026: https://twitterapi.io/pricing.

Pendiente para retomar:

- Implementar la consulta automática de X y configurar credenciales y presupuesto.
- Revisar las cuentas elegidas y el criterio para identificar rumores con su fuente original.
- Validar la comprobación con carteleras oficiales reales y activar su ejecución periódica.
- Verificar el despliegue y las actualizaciones de principio a fin.

La web incorpora la revisión local de candidatos y el catálogo público permanece vacío hasta aprobar reportes. La automatización permanece desactivada.

## Revisión opcional en la web

En `#rumores`, abre **Revisión local de candidatos** e importa `.ufcinfo-data/twitterapi-candidates.json` desde el selector de archivos. La bandeja aparece en localhost; también puede abrirse con `?review=local#rumores`. Los archivos seleccionados no se envían al servidor, no se guardan en cuentas ni se comparten con otros visitantes. La opción de URL solo muestra esta herramienta local; no concede permisos en el servidor.

Cada grupo muestra todos los textos y enlaces originales. Descarta opiniones, boxeo y publicaciones ya oficiales. Para aprobar un reporte, revisa las fuentes, corrige los nombres si hace falta, escribe paráfrasis en español e inglés y marca la revisión. Los caracteres dañados requieren consultar el post original. Las aprobaciones son temporales en este navegador; exporta antes de recargar.

**Exportar grupos aprobados** descarga `ufc-rumor-groups.json`, combinando los grupos ya publicados con las nuevas aprobaciones. El archivo público solo incluye resúmenes revisados, nombres, fechas, enlaces y cuentas citadas; no incluye los textos íntegros ni credenciales. Sustituye `assets/data/ufc-rumor-groups.json` con la descarga y despliega la actualización para publicar. La web lo consulta junto al catálogo de fuentes y conserva las últimas versiones válidas si una actualización falla.

Los grupos funcionan con luchadores que todavía no tienen ficha: se muestran sus nombres sin inventar perfiles. Los filtros de fuente e idioma consideran todas las publicaciones del grupo. El modo sin spoilers oculta los resúmenes marcados. Un grupo permanece **sin confirmar**; el comprobador automático existente solo procesa el catálogo anterior `ufc-rumors.json`. Ampliar la comprobación oficial a grupos queda pendiente y no se simulan confirmaciones.

La vista `#rumores` carga `assets/data/ufc-rumors.json`. Cada reporte identifica al periodista, su cuenta de X, el enlace al post original y la fecha. Los resúmenes en español e inglés son paráfrasis revisadas; el cambio de idioma no modifica las fuentes. Las tarjetas enlazan a las fichas de los luchadores. Los textos que pueden revelar resultados quedan ocultos con el modo sin spoilers.

## Estado inicial y fuentes

El catálogo incluye las fuentes seleccionadas por el usuario: Carlos Contreras Legaspi, Álvaro Colmenero, Eric Alexander, MMA Sin Límites, MMA Latinoamérica, UPFRONT MMA, Pelunaton y Championship Rounds. El idioma efectivo de cada post se guarda por separado. Las cuentas se pueden editar en `sources` después de revisar su identidad. El respaldo de los nombres y cuentas procede de:

- Carlos Contreras Legaspi: https://www.milenio.com/opinion/carlos-contreras-legaspi/asi-lo-vivimos/el-ufc-junto-a-la-nfl-nba-o-mlb y https://www.sherdog.com/news/news/Former-topranked-womens-bantamweight-UFC-title-challenger-retires-from-MMA-201959
- Álvaro Colmenero: https://www.linkedin.com/company/kolmenero y https://x.com/KOlmeneroMMA (la cuenta aparece también en resultados indexados; debe revisarse antes de importar un post).
- Eric Alexander: https://podcasts.apple.com/es/podcast/conexi%C3%B3n-mma/id1500775085 (su podcast enlaza a `ericaiexander`, con una «i» en lugar de la «l»).
- MMA Sin Límites: https://x.com/MMASINLIMITES y https://linktr.ee/mmasinlimites.
- MMA Latinoamérica: https://x.com/ClubDeLasMMA (cuenta con ese nombre; distinta de `MMALatinAmerica`).
- UPFRONT MMA: https://x.com/upfrontmma y https://upfrontmma.com.
- Pelunaton: https://x.com/pelunaton (perfil confirmado por el usuario).
- Championship Rounds: https://x.com/ChampRDS (añadida a petición del usuario como «championRDS»; el perfil identifica la cuenta como `ChampRDS`).

La lista identifica fuentes propuestas; no afirma que la web ya esté leyendo sus cuentas. No se incluye ningún rumor de ejemplo en producción: hacen falta posts reales revisados. No hay publicaciones ni confirmaciones inventadas.

## Publicar un reporte revisado

Leer el post original y comprobar autor, contexto, fecha y luchadores. Distinguir una información sobre negociaciones de una opinión, un deseo de un luchador o una noticia ya oficial. Después ejecutar:

```bash
python3 scripts/add-rumor.py --help
```

El comando requiere `--source` (ID de la fuente), `--post` (enlace al post original), `--fighters` (dos IDs del catálogo), `--summary-es` y `--summary-en` (paráfrasis breves). `--language` indica el idioma efectivo si difiere del habitual del periodista; `--event` identifica el evento UFC cuando el periodista lo menciona.

La fecha se calcula a partir del ID de X. Se rechazan URL de otros autores, fuentes desconocidas, duplicados y luchadores inválidos. El comando no obtiene ni verifica el texto del post: esa revisión corresponde a quien lo publica. `--no-spoilers` se utiliza solo después de comprobar que ambos resúmenes no contienen resultados. Sin esa opción, los resúmenes quedan ocultos por defecto.

La publicación es compartida cuando se sube el JSON a GitHub y se despliega el sitio; no se guardan los reportes en las cuentas personales.

## Confirmación automática

```bash
python3 scripts/sync-rumor-confirmations.py
```

El proceso usa los eventos disponibles como candidatos, pero **no confirma una pelea por una noticia de terceros**. Descarga la página exacta de `https://www.ufc.com/event/ufc-N`, comprueba que los dos nombres aparecen como esquinas del mismo combate y lee la fecha del evento de la página oficial. Si el reporte especifica un evento, solo se comprueba ese. Un combate anterior al post no confirma una posible revancha futura.

Una verificación positiva añade `official` al reporte con URL, evento, fecha y hora de comprobación. La tarjeta pasa a «Confirmado por UFC» conservando el periodista y el post original. Si hay un bloqueo HTTP, error de conexión, cambio en el HTML o datos ambiguos, se conserva la confirmación anterior sin inventar una nueva. No se usa la mera presencia de ambos nombres en cualquier lugar de la página.

Las confirmaciones guardadas documentan que se verificó un anuncio; no garantizan que la pelea siga programada ni detectan por sí solas cancelaciones posteriores. La UI muestra la fecha de la comprobación. El catálogo actual de eventos limita el alcance a las carteleras disponibles; anuncios en redes de UFC o eventos que no estén en ese catálogo requieren revisión o una ampliación de fuentes.

La tarea `.github/workflows/rumor-confirmations.yml` está preparada para ejecutarse aproximadamente cada 15 minutos cuando se active la variable del repositorio `UFCINFO_RUMORS_AUTO_ENABLED=true`. Por defecto está desactivada. Se puede lanzar manualmente con `workflow_dispatch`. GitHub Actions puede retrasar ejecuciones; **no garantiza actualización instantánea**. La web consulta el JSON cada minuto mientras está visible, al entrar en Rumores y al volver a la pestaña. Actualizar GitHub no garantiza actualizar un alojamiento independiente: su despliegue también debe estar conectado.

## Lectura automática desde X

No está activa ni implementada en esta primera versión. La API oficial permite filtrar por autor e idioma, pero requiere acceso y créditos de pago. Antes de activarla hay que definir las cuentas, la frecuencia, el presupuesto y el proceso de revisión. Las credenciales deben quedarse en secretos del servidor o de GitHub Actions, nunca en JavaScript ni en el JSON público.

Documentación: https://docs.x.com/x-api/posts/search/introduction y https://docs.x.com/x-api/getting-started/pricing.

## Pruebas

```bash
node tests/test-rumors.mjs
python3 -m unittest discover -s tests -p 'test_rumor*.py'
```

## Prueba limitada con TwitterAPI.io

Se ha preparado `scripts/test-twitterapi.py`. No activa tareas periódicas ni modifica el catálogo público. Por defecto muestra la consulta sin contactar con el proveedor.

1. Crear una cuenta en https://twitterapi.io/ y obtener la API key desde su panel. Comprobar el saldo y las tarifas antes de ejecutar.
2. Guardar únicamente la clave en `.ufcinfo-data/twitterapi.key` (carpeta excluida de Git y no servida por la web), con permisos privados. También se acepta la variable de entorno `TWITTERAPI_IO_KEY`. No añadir la clave al código ni enviarla por chat.
3. Previsualizar: `python3 scripts/test-twitterapi.py`.
4. Ejecutar una consulta: `python3 scripts/test-twitterapi.py --fetch`.

Se consulta a todas las fuentes seleccionadas del catálogo durante las últimas 24 horas, filtrando términos de negociaciones o combates y excluyendo respuestas y retuits. Se puede limitar la prueba a algunas fuentes con `--source kolmenero --source mma-sin-limites` y una ventana de 1 a 168 horas con `--hours`.

La búsqueda usa el endpoint Advanced Search, `queryType=Latest`, `since_time` y `until_time`. Solo pide la primera página, documentada con hasta 20 publicaciones. No solicita páginas siguientes ni reintenta errores. El coste depende de los resultados devueltos y de las tarifas del proveedor, no solo de los candidatos retenidos; un resultado vacío también puede tener cargo mínimo. La prueba no garantiza encontrar todos los rumores.

Los candidatos se guardan en `.ufcinfo-data/twitterapi-candidates.json`; cada ejecución reemplaza el informe de prueba anterior. No se publican automáticamente ni se afirma que sean reportes revisados. Para publicar un candidato, leer la fuente, identificar los luchadores y redactar los resúmenes con `scripts/add-rumor.py`. La lectura automática periódica, la clasificación y los feeds de medios quedan pendientes de esta prueba real.

Antes de guardar candidatos, las pruebas Python y PowerShell excluyen textos con términos explícitos de boxeo (`boxing`, `boxeo`, `boxeador`, `boxeadora`, `pugilismo`) o referencias a Tyson Fury, Anthony Joshua, Fury vs Joshua y AJ-Fury. Es un filtro de texto: no identifica todos los posibles reportes de boxeo y requiere revisión posterior. No cambia los candidatos guardados en pruebas anteriores ni reduce los resultados facturados por el proveedor.

Ambas pruebas usan Node.js y `scripts/group-rumor-candidates.mjs` para añadir `groups` al informe privado. Los reportes con dos nombres completos y la misma fecha mencionada se agrupan dentro de una consulta; los que no tienen una pareja o fecha identificable se conservan por separado. `candidates` conserva las publicaciones y cada grupo incluye sus enlaces, textos y cuentas citadas. La agrupación es provisional y no supone confirmación ni fuentes independientes. Las fechas o nombres que no reconozca el detector requieren revisión manual.

La prueba de PowerShell decodifica los bytes de respuesta como UTF-8 antes de leer el JSON. Para reprocesar el archivo ya guardado sin consultar la API: `powershell -NoProfile -ExecutionPolicy Bypass -File ".ufcinfo-data/test-twitterapi.ps1" -ReprocessExisting`. El procesador repara secuencias reversibles de acentos dañados y conserva `originalText` si cambia el texto; marca los posibles daños restantes con `encodingWarning`. Los emojis que hayan perdido bytes no se reconstruyen por conjetura. El comando reemplaza el informe privado; no publica rumores.

Documentación del proveedor: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search
