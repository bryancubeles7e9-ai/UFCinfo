# Actualización de eventos y perfiles

Las actualizaciones completas siguen siendo a las 08:00 y 14:00 de Europe/Madrid.

A las 10:00 se añade un reintento condicional de las veladas de las últimas 48 horas: resultados incompletos o cuya verificación falló, participantes ausentes y perfiles pendientes/no consultados desde el evento. No consulta Cito, rankings ni fotografías. Si todo está al día, no consulta fuentes. Conserva el límite de 40 perfiles y un registro diario para evitar duplicados.

Se activa al terminar la ejecución horaria existente de rumores, independientemente de su resultado, con respaldo de GitHub a las 08:07/09:07 UTC. La comprobación `Europe/Madrid` selecciona la hora correcta en verano/invierno. Se ejecuta dentro de la franja de las 10:00, sujeto a la cola de GitHub; no garantiza el minuto exacto. No modifica la lógica ni las fuentes de rumores.

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
