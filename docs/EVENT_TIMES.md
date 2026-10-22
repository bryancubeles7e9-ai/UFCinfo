# Horarios de las carteleras

La sincronización de eventos consulta las páginas públicas de UFC de las próximas
tres veladas y guarda `sectionSchedule` con los inicios oficiales de principal,
preliminares y previas que estén publicados. Se ejecuta junto a las actualizaciones
habituales de las 08:00 y 14:00, sin llamadas adicionales a Cito.

La fecha de la principal debe coincidir con la cartelera guardada. Se rechazan
horas contradictorias o bloques fuera de orden; se conserva la última información
válida y se registra la incidencia en `scheduleVerification.failedIds`.
Si cambia la fecha del evento, el navegador ignora el horario antiguo.

Cada combate sigue mostrando «Hora aproximada». El inicio oficial del bloque sirve
de referencia, pero no garantiza la hora individual. Los intervalos se ajustan a
la duración disponible antes del siguiente bloque, hasta 30 minutos por combate.
Cuando faltan horas oficiales se conserva la estimación de 2/4 horas antes de la
principal. Si falta el orden de la cartelera se muestra «Horario por confirmar».

Las horas se almacenan con zona UTC y se muestran en la zona del dispositivo,
incluidos los cambios de día y de horario de verano/invierno.
