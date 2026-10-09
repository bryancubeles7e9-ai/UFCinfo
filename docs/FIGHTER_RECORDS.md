# Récords de luchadores

Las fichas de `assets/js/data.js` y `assets/js/fighter-directory-data.js` son la copia inicial. Las actualizaciones posteriores se guardan en `assets/data/fighter-records.json`, con fuente y fecha. Se mantienen los eventos históricos como procesados para evitar una descarga masiva inicial.

El workflow **Actualizar récords de luchadores** se ejecuta cada día a las 09:47 UTC y se puede lanzar manualmente. No necesita claves ni consume llamadas de Cito o API-Sports. Lee directamente las fichas oficiales enlazadas por el directorio de UFCinfo.

Solo consulta a luchadores del directorio que aparezcan en carteleras recién terminadas, al menos 24 horas después de la hora de inicio del evento. Máximo 40 fichas por ejecución. Si el récord aún no ha cambiado, una descarga falla o la identidad no coincide, conserva el anterior y lo deja pendiente para la siguiente ejecución. Los éxitos se guardan individualmente para no repetir las descargas. Si el HTML oficial cambia, será necesario adaptar el extractor. La cobertura depende de las peleas presentes en el feed: hoy solo carteleras principales; preliminares cuando se incorporen.

API-Sports queda sin uso tras comprobar el 9 de octubre de 2026 que devuelve récords vacíos para Joshua Van, Ilia Topuria, Deiveson Figueiredo y Natalia Silva. Su script anterior permanece como referencia, pero no se ejecuta en este workflow. `API_SPORTS_MMA_KEY` ya no es necesario para la actualización activa.

## Estadísticas después de combates

Desde el mismo HTML se actualizan también golpes significativos conectados y recibidos por minuto, precisión y defensa de golpeo, derribos por 15 minutos, precisión y defensa de derribos, intentos de sumisión, knockdowns y victorias por KO/sumisión y finalizaciones en primer asalto. Los valores opcionales ausentes conservan su dato anterior; una ficha sin las cuatro medias básicas se rechaza completa. Los datos biográficos conservan su fecha original y las estadísticas llevan una fecha propia. Una descarga por ficha actualiza récord y estadísticas conjuntamente. La actualización empieza con los próximos eventos pendientes, sin volver a descargar el archivo histórico.
