# Récords de luchadores

Los récords actuales en `assets/js/data.js` y `assets/js/fighter-directory-data.js` son la copia de partida. `assets/data/fighter-records.json` solo contiene cambios posteriores y los IDs de eventos ya procesados. Sin API o ante una respuesta inválida, se mantiene el récord de la copia anterior.

## Activación

1. Crea una clave de API-MMA en [API-Sports](https://api-sports.io/sports/mma).
2. En GitHub, Settings → Secrets and variables → Actions → New repository secret, crea `API_SPORTS_MMA_KEY`. Nunca pongas la clave en un commit.
3. Ejecuta manualmente **Actualizar récords de luchadores** una vez para verificar la conexión y el formato real de la API. La tarea después corre a las 09:47 UTC cada día, tras la actualización de carteleras. Comprueba los logs antes de considerarla activa.

Se consulta únicamente a los luchadores que aparecen en eventos recién terminados. Se busca el ID en `/fighters` una vez y se guarda; después se consulta `/fighters/records` para obtener el récord completo. Hay un límite de 80 llamadas por ejecución. Los luchadores no presentes en el directorio de UFCinfo se omiten hasta que se añadan sus fichas. Las peleas sin resultado completo quedan pendientes. Los eventos anteriores a esta copia inicial ya están marcados como procesados para evitar una primera descarga masiva.

La integración necesita una prueba con clave para verificar la cobertura y la estructura de las respuestas de API-Sports. Si el servicio no devuelve el trío de victorias, derrotas y empates con el formato validado, el script conserva la copia y escribe el motivo en los logs. No se debe afirmar que los récords estén actualizándose hasta completar esa prueba real.
