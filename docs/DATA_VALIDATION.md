# Comprobaciones de automatizaciones

## Validación sin consultas a proveedores

El workflow **Validar automatizaciones sin consultar APIs** ejecuta las pruebas de Python, filtros de rumores, carga de carteleras, seguimiento y estado de los datos al cambiar código o abrir una propuesta de cambios. No necesita claves ni consulta Cito, TwitterAPI.io o UFC.com. No modifica ni publica datos de producción.

`tests/test_post_event_pipeline.py` conecta las funciones reales de importación y sincronización con respuestas de ejemplo y archivos temporales. Simula el anuncio de una cartelera, la importación de un perfil nuevo sin duplicarlo, una caída de Cito, resultados oficiales incompletos, su recuperación, un récord regresivo y estadísticas pendientes. Después comprueba que el siguiente intento recupera ambos perfiles y libera los pendientes. También comprueba que el evento sigue visible mientras llegan sus resultados y que los reintentos oficiales no añaden consultas a Cito.

La simulación comprueba la lógica entre componentes. La ejecución real en GitHub Actions, el despliegue en Render y los tiempos de publicación de los proveedores se siguen validando con la próxima velada.

## Intentos y sincronizaciones correctas

`scripts/run-data-sync.py` ejecuta los importadores existentes de carteleras, resultados oficiales, rankings, récords y fotografías. No cambia sus peticiones ni sus límites. Registra en `assets/data/sync-health.json` el inicio, final, resultado y número de pendientes. Conserva `lastSuccessAt` cuando un intento falla o queda parcial. El registro público no guarda claves, argumentos ni textos de excepciones.

El workflow de eventos y la actualización global manual de récords publican este estado incluso si falla una consulta. El panel **Estado de los datos** distingue el último intento conocido, la última sincronización sin incidencias y los elementos pendientes. Carteleras y resultados oficiales tienen indicadores separados: Cito puede fallar mientras UFC.com confirma los resultados.

Las fechas antiguas solo sirven de respaldo cuando los feeds permiten verificar que no había pendientes; no se inventan sincronizaciones anteriores. Hasta que se registre una ejecución correcta completa, la fecha correspondiente puede aparecer como «—». Un reintento posterior de las 10:00 que deje un feed más reciente puede superar el resultado antiguo registrado. Para rumores se mantiene la fecha de búsqueda real del feed; los intentos que fallaron antes de consultar no se reconstruyen a partir de esa fecha.

Una consulta correcta no garantiza que la fuente haya incorporado el último combate. Los registros y estadísticas individuales conservan sus propias fechas. Los cambios de cartelera que requieren segunda observación siguen pendientes hasta reunirla.

## Nombres ambiguos en rumores

El catálogo incluye a Ilia y Aleksandre Topuria. El apellido «Topuria» por sí solo no identifica a uno de ellos. Los nombres completos se reconocen y los apellidos inequívocos siguen funcionando. Las pruebas reflejan esta ambigüedad para que añadir luchadores al catálogo no bloquee la búsqueda por asumir una identidad incorrecta.
