# Filtro de publicación automática de rumores

Actualizado el 8 de octubre de 2026.

## Recopilación

Se consultan las cuentas configuradas en `assets/data/ufc-rumors.json`. La búsqueda incluye términos de peleas, negociaciones, retos, respuestas y acuerdos en español e inglés. Se excluyen retuits y respuestas de X; una publicación independiente que informa de una respuesta entre luchadores sí puede admitirse.

La búsqueda se programa cada hora en punto (`0 * * * *`) en GitHub Actions. GitHub puede retrasar el inicio; el control de frecuencia permite una búsqueda en la siguiente hora aunque la anterior haya arrancado tarde. El límite de páginas y el presupuesto de créditos no cambian. El filtro local no reduce los resultados que factura la API.

El apartado Rumores muestra la fecha y hora local de la última búsqueda correcta mediante `lastSearchedAt`, también cuando no se encuentran publicaciones nuevas. Los errores, las importaciones locales y las ejecuciones sin consultas no adelantan esa hora. Hasta la primera búsqueda correcta tras esta actualización se indica que todavía no está disponible. El texto está traducido al español, inglés y catalán.

## Identificación de enfrentamientos

- Se reconocen nombres, alias y apellidos del catálogo de UFCinfo, sin depender de mayúsculas o acentos. Solo se usan apellidos si identifican a un único luchador; no se adivina una identidad a partir de un nombre de pila.
- Los nombres reconocidos se normalizan al nombre de la ficha para agrupar variantes de una misma pareja.
- Debe existir una relación explícita entre los dos nombres: enfrentamiento, reto, respuesta o declaración de haber aceptado una pelea. La simple mención de dos luchadores no basta.
- Si se detectan varias parejas del catálogo en una publicación, no se publica automáticamente un resumen que mezcle enfrentamientos.
- Para parejas que incluyen nombres todavía fuera del catálogo se requieren dos nombres completos, una referencia explícita a UFC y lenguaje de pelea futura o negociación. Esto permite incorporar prospectos sin afirmar que sus identidades estén verificadas. Las expresiones con aspecto de titulares como «Breaking News» no se aceptan como luchadores.

## Exclusiones

- Deseos y predicciones explícitos, como «ojalá», «me gustaría», «I wish» o «who wins».
- Resultados antiguos y recopilaciones sin una nueva negociación o pelea prevista.
- Noticias de otras promotoras sin contexto UFC.
- Boxeo explícito. Una mención del boxeo como habilidad en un reporte de UFC no basta para descartar todo el post.
- Anuncios oficiales explícitos. Una declaración de un luchador de haber aceptado una pelea se conserva como declaración atribuida, sin convertirla en confirmación de UFC.
- Parejas idénticas, nombres no identificados y fechas inválidas, pasadas o a más de 183 días de la publicación, según las comprobaciones del generador.

Los reportes sin fecha siguen admitiéndose cuando cumplen los demás criterios. No se inventa una fecha.

## Publicación y límites

Se conservan autor, enlaces originales, cuentas citadas, resúmenes bilingües y protección contra espóilers. Se agrupan duplicados manteniendo fechas distintas para posibles revanchas. El proceso oficial de comprobación contra carteleras de UFC sigue separado.

Los filtros de texto se aplican a los candidatos de las siguientes ejecuciones. Además, el cruce de carteleras retira grupos anteriores cuando los dos luchadores aparecen en el mismo combate anunciado y coinciden las fechas.

El detector sigue siendo un sistema de reglas de texto, no una verificación semántica de cada noticia. Puede perder publicaciones con formatos no reconocidos o confundir contextos; las fuentes y sus enlaces permiten revisar los casos dudosos.

## Pruebas sin consultas de pago

```bash
node tests/test-rumor-search-time.mjs
node tests/test-rumor-filter.mjs
node tests/test-rumor-auto-sync.mjs
node tests/test-rumor-candidate-groups.mjs
node tests/test-rumor-review.mjs
python3 tests/test_rumor_confirmations.py
```

## Cruce con la API de carteleras

Antes de guardar los rumores se consulta `assets/data/ufc-events.json`, la copia sincronizada de UFCalendar que también consume la web. No se hace una consulta de pago adicional por cada rumor ni se cambia la frecuencia de sincronización de las carteleras. Los logs indican la fecha de la copia usada; esta comprobación depende de que la sincronización de eventos esté al día.

Se comparan ambos rivales en un único combate, normalizando alias y acentos. No basta con que aparezcan en combates distintos del mismo evento. El evento no puede ser anterior a la publicación del rumor y, cuando el rumor tiene fecha, debe coincidir con un margen de un día por la zona horaria. Las cancelaciones explícitas no cuentan como confirmación.

Las coincidencias impiden publicar nuevos grupos y retiran los ya publicados. Los rumores sin coincidencia se mantienen: la ausencia en esta copia no demuestra que una pelea esté sin anunciar, y actualmente solo cubre las carteleras principales sincronizadas. Después sigue ejecutándose la comprobación existente contra páginas oficiales de UFC.com.

Una pelea finalizada se excluye aunque la última publicación del grupo sea posterior al evento. Si una publicación posterior propone explícitamente un segundo encuentro (`vs 2`, `vs II`, «revancha», «rematch», «segunda pelea»), se trata como un rumor distinto y no se confunde con el combate anterior. Un «2» aislado, como en `UFC 2` o «en 2 días», no basta. Una revancha que ya figure en una cartelera futura también se excluye como pelea anunciada. Si una posible revancha no aporta ni fecha futura ni indicación explícita de segundo combate, se descarta para evitar republicar un enfrentamiento ya disputado.

Si la copia está ausente o no supera las validaciones, los logs lo indican y se conserva el catálogo de rumores sin inferir confirmaciones. El estado y presupuesto de TwitterAPI.io siguen separados.

Prueba adicional: `node tests/test-rumor-calendar.mjs`.
