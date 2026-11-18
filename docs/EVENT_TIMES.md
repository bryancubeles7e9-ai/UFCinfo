# Horarios de las carteleras

A las 08:00 y 14:00 (Europe/Madrid), GitHub Actions consulta el calendario
público de UFC y las fichas de las veladas próximas que aparecen en él. El inicio
oficial de la principal se guarda en `date`; las horas de cada bloque se guardan
en `sectionSchedule`. No hacen falta claves ni llamadas a Cito.

Se rechazan fichas con identidad incorrecta, horas contradictorias o bloques
fuera de orden. Se conserva la última información válida y se registra la
incidencia en `scheduleVerification.failedIds`. Si cambia la fecha del evento,
el navegador ignora el horario antiguo.

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
