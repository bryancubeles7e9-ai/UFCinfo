# Actualización de eventos y perfiles

Las ejecuciones siguen siendo a las 08:00 y 14:00 de Europe/Madrid.

1. Consulta rankings oficiales y las tres carteleras seleccionadas de Cito (hasta cinco solicitudes Cito contando las dos listas).
2. Verifica hasta tres eventos de los últimos 14 días directamente en UFC.com. Este paso también se ejecuta si Cito falla. Valida fecha, identidad, participantes y resultados antes de sustituir datos; conserva combates anteriores omitidos y señala los resultados pendientes.
3. Incorpora participantes nuevos de las carteleras recientes mediante enlaces a perfiles oficiales y comprobación de identidad. No deduce nacionalidades a partir del lugar de nacimiento.
4. Actualiza fotografías y récords/estadísticas. Un fallo de consulta de fotografías no bloquea los perfiles. Los participantes desconocidos se señalan y no se considera completo el evento.
5. Si UFC publica el récord antes de las estadísticas, guarda únicamente el récord verificado, conserva las estadísticas anteriores con su fecha real y mantiene el perfil pendiente para reintentar.

La web mantiene visibles los eventos cuya fecha ha pasado aunque todavía no tengan resultados. Los marca como resultados pendientes y permite encontrarlos en el filtro de finalizados, sin inventar resultados ni anunciarlos como el siguiente evento.

## Incidencia del 18 de octubre de 2026

A las 08:00 Cito falló con `Invalid fight corner`. Se conservó el archivo anterior, pero el filtro ocultó la cartelera programada ya pasada. A las 14:00 llegó una cartelera de 12 combates que omitía Nallo–Landwehr. UFC.com también omitía Boser–Diniz de su HTML; se combinaron los resultados verificados de ambas fuentes para conservar los 13 combates.

Se añadieron los 11 perfiles ausentes del directorio. Los datos incompletos de UFC permanecen pendientes: una consulta realizada no significa que la fuente haya incorporado todas las estadísticas del último combate.

Pruebas: conservación y recuperación de combates, identidad/fecha de la fuente, eventos pendientes visibles, cobertura de participantes de la temporada, récord separado de estadísticas incompletas y señalización de actualizaciones parciales.
