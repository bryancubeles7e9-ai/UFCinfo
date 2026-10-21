# Cambios de cartelera

La sincronización habitual de las 08:00 y 14:00 (Europe/Madrid) aplica estos controles sin aumentar las consultas a Cito: dos listas y hasta tres carteleras por ejecución. Los participantes de una cartelera lejana se revisan cuando entra en esa selección; no se garantiza detectar inmediatamente todos los cambios del calendario.

## Reglas

- Una cancelación explícita de combate retira la pelea, salvo que ya tenga un resultado verificado, que se conserva.
- Un nuevo emparejamiento que comparte un participante con una pelea retirada se registra como sustitución. Se normalizan mayúsculas, espacios y acentos al comparar nombres.
- La simple ausencia de una pelea no equivale a cancelación. Se conserva y se registra en `pendingBoutRemovals`. Se retira si dos respuestas con los mismos emparejamientos, separadas por al menos una hora, siguen omitiéndola. Ambas deben contener al menos la mitad de las peleas guardadas. Una respuesta vacía o demasiado reducida no confirma una retirada. Esto es una protección frente a respuestas parciales, no una garantía de que el proveedor sea infalible.
- Si una pelea reaparece, desaparece su comprobación pendiente. Si cambia la lista recibida, empieza de nuevo el plazo de confirmación.
- Solo después de confirmar la retirada de una pelea se puede identificar su traslado: debe aparecer en un único evento futuro distinto. Encontrar la misma pareja en otro evento, por sí solo, no elimina el enfrentamiento anterior ni confunde una revancha con un traslado.
- Los cambios de fecha de eventos ya conocidos se leen de las listas, incluso si ese día no se descargan sus combates. `citoSlug` enlaza la identidad del proveedor con el identificador local; un Fight Night que conserva ese slug mantiene sus enlaces y favoritos aunque cambie de fecha. Esta vinculación se establece en la primera sincronización con el parche. Si el proveedor cambia a la vez el slug y la fecha de un Fight Night, requiere revisión: no se fusionan eventos por similitud del título.
- Si Cito comunica explícitamente un evento `cancelled`, `canceled` o `postponed`, queda archivado como cancelado o aplazado. No aparece en las carteleras activas, Fight Lab ni seguimiento, ni confirma rumores. Para reactivarlo, Cito debe indicar `scheduled` o `announced`; una respuesta sin estado no basta. Un evento finalizado nunca se cancela automáticamente.
- La ausencia de un evento en una lista no lo cancela: las listas pueden estar limitadas o incompletas.
- La comprobación de resultados de UFC conserva resultados ya verificados, pero no vuelve a insertar peleas antiguas sin resultado que ya no figuren en la cartelera final. Una caída de más de la mitad de los combates se considera una respuesta truncada y conserva la copia anterior.

## Registro y revisión

Cada evento guarda hasta 100 entradas en `cardChanges`, con fecha de consulta, fuente y detalles: `added`, `cancelled`, `replaced`, `removed-from-card`, `moved`, `rescheduled`, `postponed` o `reinstated`. La fecha indica cuándo se detectó el cambio, no cuándo ocurrió ni cuándo lo anunció UFC. Los datos se guardan en `assets/data/ufc-events.json`.

Los fallos de red o validación de Cito conservan el archivo anterior. No se necesitan claves nuevas ni cambios en cron-job.org. La primera ejecución vincula los slugs de los eventos existentes; los cambios reales posteriores todavía deben contrastarse con la fuente durante el seguimiento del proyecto.
