# Récords y estadísticas de luchadores

Las fichas de `assets/js/data.js` y `assets/js/fighter-directory-data.js` son la copia inicial. Las consultas verificadas se guardan en `assets/data/fighter-records.json`, con fuente y fecha; el navegador aplica este archivo sobre el directorio.

## Sincronización con las carteleras

Desde el 11 de octubre de 2026, `ufc-events.yml` consulta las fichas después de sincronizar las carteleras. Cron-job.org activa ese workflow a las **08:00 y 14:17 Europe/Madrid**; también se ejecuta con sus disparadores de código. No existe la espera anterior de 24 horas. Solo se consultan participantes registrados de peleas con resultado, en eventos terminados.

Los eventos de los últimos 14 días se vuelven a revisar aunque figuren como procesados. Esto permite recoger estadísticas que UFC publique después del récord y corrige el caso de UFC 332, incluido prematuramente en el listado histórico procesado. Los eventos antiguos no procesados también son elegibles. Máximo 40 perfiles por ejecución, priorizando los menos recientemente consultados; una misma persona solo se descarga una vez por ejecución.

Un récord sin cambios ya no impide guardar estadísticas. Una consulta correcta no demuestra que UFC haya incorporado la última pelea: las fechas visibles indican consulta, no una garantía de actualización de la fuente. Las revisiones de eventos recientes continúan durante 14 días; las correcciones posteriores requieren la consulta global manual.

## Actualización global

El workflow usa `--ensure-full`: en la primera ejecución consulta todo el catálogo. `fullRefreshAttemptedAt` registra ese intento; los perfiles fallidos se guardan en `pendingProfileIds` y se reintentan junto con los participantes de eventos, sin volver a descargar todo el catálogo. `fullRefreshCompletedAt` solo se guarda cuando no quedan pendientes.

`python3 scripts/sync-ufc-fighter-records.py --all` consulta todo el directorio sin depender del estado de las carteleras. También se puede ejecutar `fighter-records.yml` manualmente marcando `full_refresh`. Los antiguos dispatches vacíos de las 11:47 omiten el trabajo, evitando una tercera actualización diaria.

Se valida la identidad, récord y cuatro estadísticas básicas de cada perfil. Si falla, se conserva su última copia. Las estadísticas opcionales ausentes conservan sus valores anteriores. Se guardan los éxitos individualmente y `lastSync` registra fecha, modo, intentos, éxitos e IDs fallidos. Un fallo se registra como advertencia de Actions para no perder el resto del progreso.

La fuente activa es UFC.com, sin clave y sin consumir puntos de Cito o API-Sports. La actualización global cubre todo el directorio; la actualización habitual depende de las peleas presentes en el feed, actualmente cartelera principal. No se calculan récords sumando resultados ni se inventan estadísticas.

Las métricas incluyen golpeo conectado/recibido, precisión y defensa, derribos, sumisiones, knockdowns y finalizaciones cuando están disponibles. Los datos biográficos mantienen su fecha original; récords y estadísticas muestran su fecha propia de consulta.

Las etiquetas y el filtro de campeones se sincronizan con el feed validado de rankings. Los títulos absolutos anteriores se conservan como históricos y el BMF se mantiene separado. Las fichas adicionales también muestran los cinturones y la fecha de consulta del ranking.

Las fotografías de campeones y excampeones también se revisan en `ufc-events.yml`, a las 08:00 y 14:17. No usan Cito. `fighter-photos.json` conserva variantes de campeón y retrato neutral, seleccionadas según el ranking vigente; el navegador refresca este feed cada cinco minutos. Las URLs e identidad se verifican antes de guardar. Si UFC mantiene una foto explícita con cinturón después de perder el título, se utiliza una variante neutral ya disponible; si no existe, se muestra una silueta hasta que se publique. Para Valentina se ha comprobado un retrato neutral de ESPN, acreditado como tal, mientras su perfil UFC siga mostrando el cinturón anterior. Un fallo conserva la última imagen verificada. La foto depende de lo que publique la fuente; el ranking no genera nuevas fotos.
