# Filtro de publicación automática de rumores

Actualizado el 8 de octubre de 2026.

## Recopilación

Se consultan las cuentas configuradas en `assets/data/ufc-rumors.json`. La búsqueda incluye términos de peleas, negociaciones, retos, respuestas y acuerdos en español e inglés. Se excluyen retuits y respuestas de X; una publicación independiente que informa de una respuesta entre luchadores sí puede admitirse.

La frecuencia, el límite de páginas y el presupuesto de créditos no cambian. El filtro local no reduce los resultados que factura la API.

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

Los grupos ya publicados se conservan; este cambio aplica el nuevo criterio a los candidatos procesados en las siguientes ejecuciones. No vuelve a verificar ni elimina retrospectivamente todos los grupos anteriores.

El detector sigue siendo un sistema de reglas de texto, no una verificación semántica de cada noticia. Puede perder publicaciones con formatos no reconocidos o confundir contextos; las fuentes y sus enlaces permiten revisar los casos dudosos.

## Pruebas sin consultas de pago

```bash
node tests/test-rumor-filter.mjs
node tests/test-rumor-auto-sync.mjs
node tests/test-rumor-candidate-groups.mjs
node tests/test-rumor-review.mjs
python3 tests/test_rumor_confirmations.py
```
