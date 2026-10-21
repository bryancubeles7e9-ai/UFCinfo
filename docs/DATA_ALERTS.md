# Alertas de automatización

`Vigilar automatizaciones UFCinfo` revisa cada tres horas, al minuto 43 UTC,
los archivos publicados y el historial de GitHub Actions. También admite ejecución
manual. GitHub puede retrasar las ejecuciones programadas.

La comprobación falla y deja un resumen con los motivos cuando detecta:

- Rumores sin una búsqueda verificable en más de 3 horas. Cero rumores nuevos es válido.
- Dos fallos consecutivos de una fuente monitorizada o de las últimas ejecuciones
  terminadas de rumores, eventos o actualización global de récords.
- Más de 30 horas sin sincronización verificable de carteleras, resultados,
  rankings, fotos o récords.
- Pendientes continuos durante más de 48 horas. El contador empieza con la primera
  ejecución del nuevo monitor; no reconstruye fechas antiguas ni mide cada perfil
  individualmente. Se reinicia cuando la fuente queda sin pendientes.

El resumen se consulta en Actions. Las notificaciones de fallo dependen de las
preferencias de notificación de Actions de cada usuario; no se envían correos ni
mensajes desde el código. Mientras persista el problema, las comprobaciones
posteriores seguirán fallando. No se crean issues repetidos.

No consulta Cito, UFC ni la API de búsqueda: solo archivos y la API de GitHub
con permisos de lectura. No modifica datos ni intenta corregirlos. Las recuperaciones
de las 10 que ya hayan publicado datos más nuevos se tienen en cuenta.
La edad de los datos detecta también automatizaciones que dejan de ejecutarse.
Un fallo de GitHub que impida ejecutar este propio vigilante requiere supervisión externa.
