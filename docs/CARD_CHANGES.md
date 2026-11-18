# Cambios de cartelera

La sincronización de las 08:00 y 14:00 (Europe/Madrid) lee el listado público de próximas veladas y sus fichas oficiales de UFC. No utiliza Cito. Estos criterios protegen la última copia válida mientras la fuente esté incompleta.

## Reglas

- Un nuevo emparejamiento que comparte un participante con una pelea retirada se registra como sustitución. Se normalizan mayúsculas, espacios y acentos al comparar nombres.
- La simple ausencia de una pelea no equivale a cancelación. Se conserva y se registra en `pendingBoutRemovals`. Se retira si dos respuestas con los mismos emparejamientos, separadas por al menos una hora, siguen omitiéndola. Ambas deben contener al menos la mitad de las peleas guardadas. Una respuesta vacía o demasiado reducida no confirma una retirada. Esto es una protección frente a respuestas parciales, no una garantía de que el proveedor sea infalible.
- Si una pelea reaparece, desaparece su comprobación pendiente. Si cambia la lista recibida, empieza de nuevo el plazo de confirmación.
- Encontrar la misma pareja en otro evento, por sí solo, no elimina el enfrentamiento anterior ni confunde una revancha con un traslado.
- Los cambios de fecha se verifican en la ficha oficial. Si UFC cambia el identificador de la URL, se requiere revisión para vincularlo al original; no se fusionan eventos solo por similitud del título.
- Los estados explícitos de cancelación y aplazamiento que ya estén guardados se conservan. Tales eventos no aparecen en las carteleras activas, Fight Lab ni seguimiento ni confirman rumores.
- La ausencia de un evento en una lista no lo cancela: las listas pueden estar limitadas o incompletas.
- La comprobación de resultados de UFC conserva resultados ya verificados, pero no vuelve a insertar peleas antiguas sin resultado que ya no figuren en la cartelera final. Una caída de más de la mitad de los combates se considera una respuesta truncada y conserva la copia anterior.

## Registro y revisión

Cada evento guarda hasta 100 entradas en `cardChanges`, con fecha de consulta, fuente y detalles: `added`, `cancelled`, `replaced`, `removed-from-card`, `moved`, `rescheduled`, `schedule-corrected`, `postponed` o `reinstated`. La fecha indica cuándo se detectó el cambio, no cuándo ocurrió ni cuándo lo anunció UFC. Los datos se guardan en `assets/data/ufc-events.json`.

La programación nativa consulta las fichas públicas de UFC, sin Cito. Los fallos de red o validación conservan la última copia válida de cada velada. Ante una desaparición sin sustituto, las dos observaciones deben proceder de la misma fuente.
