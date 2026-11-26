# Récords y estadísticas de luchadores

Las fichas de `assets/js/data.js` y `assets/js/fighter-directory-data.js` son la copia inicial. Las consultas verificadas se guardan en `assets/data/fighter-records.json`, con fuente y fecha; el navegador aplica este archivo sobre el directorio.

## Sincronización con las carteleras

Desde el 11 de octubre de 2026, `ufc-events.yml` consulta las fichas después de sincronizar las carteleras. Cron-job.org activa ese workflow a las **08:00 y 14:00 Europe/Madrid**; también se ejecuta con sus disparadores de código. No existe la espera anterior de 24 horas. Solo se consultan participantes registrados de peleas con resultado, en eventos terminados.

Los eventos de los últimos 14 días se vuelven a revisar aunque figuren como procesados. Esto permite recoger estadísticas que UFC publique después del récord y corrige el caso de UFC 332, incluido prematuramente en el listado histórico procesado. Los eventos antiguos no procesados también son elegibles. Máximo 40 perfiles por ejecución, priorizando los menos recientemente consultados; una misma persona solo se descarga una vez por ejecución.

Un récord sin cambios ya no impide guardar estadísticas. Una consulta correcta no demuestra que UFC haya incorporado la última pelea: las fechas visibles indican consulta, no una garantía de actualización de la fuente. Las revisiones de eventos recientes continúan durante 14 días; las correcciones posteriores requieren la consulta global manual.

## Actualización global

El workflow usa `--ensure-full`: en la primera ejecución consulta todo el catálogo. `fullRefreshAttemptedAt` registra ese intento; los perfiles fallidos se guardan en `pendingProfileIds` y se reintentan junto con los participantes de eventos, sin volver a descargar todo el catálogo. `fullRefreshCompletedAt` solo se guarda cuando no quedan pendientes.

`python3 scripts/sync-ufc-fighter-records.py --all` consulta todo el directorio sin depender del estado de las carteleras. También se puede ejecutar `fighter-records.yml` manualmente marcando `full_refresh`. Los antiguos dispatches vacíos de las 11:47 omiten el trabajo, evitando una tercera actualización diaria.

Se valida la identidad, récord y cuatro estadísticas básicas de cada perfil. Si falla, se conserva su última copia. Las estadísticas opcionales ausentes conservan sus valores anteriores. Se guardan los éxitos individualmente y `lastSync` registra fecha, modo, intentos, éxitos e IDs fallidos. Un fallo se registra como advertencia de Actions para no perder el resto del progreso.

La fuente activa es UFC.com, sin clave y sin consumir puntos de Cito o API-Sports. La actualización global cubre todo el directorio; la actualización habitual depende de las peleas presentes en el feed, actualmente cartelera principal. No se calculan récords sumando resultados ni se inventan estadísticas.

Las métricas incluyen golpeo conectado/recibido, precisión y defensa, derribos, sumisiones, knockdowns y finalizaciones cuando están disponibles. Los datos biográficos mantienen su fecha original; récords y estadísticas muestran su fecha propia de consulta.

Las etiquetas y el filtro de campeones se sincronizan con el feed validado de rankings. Los títulos absolutos anteriores se conservan como históricos y el BMF se mantiene separado. Las fichas adicionales también muestran los cinturones y la fecha de consulta del ranking.

Las fotografías de campeones y excampeones también se revisan en `ufc-events.yml`, a las 08:00 y 14:00. No usan Cito. `fighter-photos.json` conserva variantes de campeón y retrato neutral, seleccionadas según el ranking vigente; el navegador refresca este feed cada cinco minutos. Las URLs e identidad se verifican antes de guardar. Si UFC mantiene una foto explícita con cinturón después de perder el título, se utiliza una variante neutral ya disponible; si no existe, se muestra una silueta hasta que se publique. Para Valentina se ha comprobado un retrato neutral de ESPN, acreditado como tal, mientras su perfil UFC siga mostrando el cinturón anterior. Un fallo conserva la última imagen verificada. La foto depende de lo que publique la fuente; el ranking no genera nuevas fotos.

Gestión de variantes: se conservan `regular`, `champion` y `bmf` por separado. El BMF sigue el registro de títulos especiales, no los rankings de división. Los retratos neutrales existentes se guardan antes de futuros cambios de campeón. Las nuevas imágenes verificadas se archivan en `assets/images/fighter-variants` con una huella de su contenido; las versiones antiguas se conservan. Si falta la variante de campeón se utiliza la neutral disponible. Todavía depende de que las fuentes publiquen una imagen nueva: no se genera ni se añade un cinturón artificial.

## Revisión manual de perfiles

`python3 scripts/probe-ufc-profiles.py jake-matthews tagir-ulanbekov` muestra el récord, la división y las estadísticas que publica UFC.com para cada luchador, sin modificar archivos. Sirve para resolver a mano los perfiles en `profileReview` (por ejemplo, una corrección oficial que reduce un total) y para crear fichas de luchadores clasificados que aún no estén en el catálogo. Tras comprobar los datos, se actualiza `assets/js/fighter-directory-data.js` y la siguiente sincronización retira el perfil de la lista de pendientes.

El 25 de noviembre de 2026 se resolvió así la revisión de Jake Matthews (23-9-0, con la corrección oficial de sus finalizaciones), se completaron Lucia Szabova, John Mitchell y Shoaib Yousaf y se añadieron Tagir Ulanbekov, David Onama, Amanda Ribas y Mizuki desde los rankings. Jack Della Maddalena quedaba pendiente porque UFC.com no publica sus estadísticas de combate; de ahí el respaldo de UFC Stats descrito a continuación.

## Respaldo de UFC Stats

Si la ficha de UFC.com publica el récord pero le faltan estadísticas principales (golpes por minuto, derribos o sumisiones por 15 minutos), la sincronización busca al luchador en UFC Stats y usa sus cifras solo si el nombre y el récord coinciden exactamente con UFC.com. Las cifras que UFC.com sí publica, como las finalizaciones, tienen prioridad. La ficha indica entonces «Fuente: UFC Stats» con el enlace al perfil consultado. Si UFC Stats no responde o no coincide, se conserva el comportamiento anterior: récord actualizado y estadísticas pendientes de reintento. UFC Stats solo responde por HTTP, así que el respaldo funciona desde GitHub Actions.

## Correcciones oficiales confirmadas

Si UFC.com rebaja un total (por ejemplo, las finalizaciones) o ajusta ligeramente el récord, el perfil queda en `profileReview` con la fecha en que se vio por primera vez. Si la ficha oficial sigue mostrando **exactamente los mismos datos durante 72 horas**, la sincronización acepta la corrección sola, la guarda en `fighter-records.json` con `acceptedCorrection` (fecha, motivo y récord anterior) y desde entonces compara con ese perfil en lugar del catálogo. Un cambio en esas 72 horas reinicia el plazo. Nunca se aceptan solos los datos no válidos, las estadísticas puestas a cero ni una caída del récord de más de dos combates: esos casos siguen esperando una revisión con `scripts/probe-ufc-profiles.py`.

## Completar huecos de las fichas

`python3 scripts/fill-profile-gaps.py` revisa los perfiles con altura, alcance, estadísticas o país vacíos y los rellena desde fuentes oficiales, **sin sobrescribir nunca un dato existente**: altura, alcance y estadísticas salen del perfil del luchador en UFC.com; el país representado, solo de la bandera que aparece junto a él en una cartelera oficial enlazada desde ese perfil (nunca del lugar de nacimiento). Con `--dry-run` solo informa.

Ejecución del 26 de noviembre de 2026: 12 países (entre ellos Jon Jones, Anderson Silva, Michael Bisping, Dominick Cruz y Robbie Lawler), 7 alcances y 2 alturas. Quedan 70 perfiles con algún hueco porque UFC.com no publica el dato: sobre todo alcance de debutantes y de pioneros, y el país de leyendas cuyas carteleras antiguas no muestran banderas. El récord de Maurice Smith, Bas Rutten y Tito Ortiz figura como «No indicado» porque su perfil oficial muestra 0-0-0. La web muestra «—» o «No indicado» en esos casos, sin inventar valores.
