# Horarios aproximados por combate

Las fichas de eventos próximos, la selección de combates de inicio y Mi esquina muestran una estimación en la zona horaria del navegador, con día y mes. No añade consultas a proveedores.

El feed actual guarda el inicio de la cartelera principal, no horarios oficiales por pelea. Se utiliza como ancla; las preliminares se sitúan aproximadamente dos horas antes y las previas cuatro horas antes. Dentro de cada sección, el orden del feed se invierte para recorrer del primer combate al estelar y se asignan intervalos de 30 minutos. Con más de cuatro peleas en una sección preliminar, los intervalos se reparten dentro del bloque estimado de dos horas. Las cifras se redondean a cinco minutos.

Estas hipótesis pueden diferir del programa oficial de emisión. Cada hora se marca como aproximada y el detalle de la cartelera explica el cálculo. No es seguimiento en directo: no desplaza horarios según los combates terminados ni interpreta el campo `bout.time` de resultados como hora de inicio.

Si faltan la fecha válida o las secciones de los combates, se muestra «Horario por confirmar» en lugar de inferir un orden de una lista parcialmente anunciada. Los eventos finalizados no reciben horarios históricos estimados. Al actualizarse la cartelera, las estimaciones se recalculan con el orden disponible.

Pruebas: `node tests/test-bout-schedule.mjs`.
