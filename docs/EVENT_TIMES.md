# Horarios de las carteleras

La sincronización de eventos consulta las páginas públicas de UFC de las próximas
tres veladas y guarda `sectionSchedule` con los inicios oficiales de principal,
preliminares y previas que estén publicados. Se ejecuta junto a las actualizaciones
habituales de las 08:00 y 14:00, sin llamadas adicionales a Cito.

La fecha de la principal debe coincidir con la cartelera guardada. Se rechazan
horas contradictorias o bloques fuera de orden; se conserva la última información
válida y se registra la incidencia en `scheduleVerification.failedIds`.
Si cambia la fecha del evento, el navegador ignora el horario antiguo.

Cada combate muestra «Franja estimada», con ambos extremos del intervalo. El
inicio oficial del bloque sirve de referencia, pero no garantiza la hora individual.
El cálculo acumula 30 minutos por combate de tres asaltos y 50 por uno confirmado
a cinco. Sin duración confirmada se reservan 30 minutos; nunca se deduce de
`round` o `time`, que son datos del resultado.

`scheduledRounds` (3 o 5) se conserva desde las respuestas de carteleras ya
consultadas. La consulta pública de horarios también identifica combates de título
a cinco asaltos, cotejando los dos nombres y la fecha oficial. Las excepciones
confirmadas, como coestelares sin título a cinco, llevan `roundsSource`. Esta
información solo se conserva para el mismo emparejamiento y bloque; no se hereda
al cambiar un rival. No se añaden llamadas a Cito.

Las preliminares se ajustan proporcionalmente al tiempo disponible y su franja
no rebasa el inicio del bloque siguiente. En la principal no se comprimen los
combates de cinco asaltos. El primer combate tiene un margen de 0–10 minutos;
los posteriores, ±10 minutos, ampliados a ±15 tras tres combates previos y en
cinco minutos adicionales si hay uno previo confirmado a cinco asaltos.

Cuando faltan horas oficiales se conserva la estimación de 2/4 horas antes de la
principal. Si falta el orden se muestra «Horario por confirmar». Las pausas y la
duración real pueden sacar el combate de la franja: no es una actualización en directo.

Las horas se almacenan con zona UTC y se muestran en la zona del dispositivo,
incluidos los cambios de día y de horario de verano/invierno.
