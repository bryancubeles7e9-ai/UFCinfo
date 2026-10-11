# Guardias del directorio

Los 24 perfiles originales conservan sus fuentes individuales. Los 148 perfiles
añadidos reciben su guardia desde `assets/js/fighter-stance-data.js`, tanto para
las tarjetas y fichas como para el filtro de guardia.

143 guardias proceden del campo `stance` de la copia pública de UFCStats publicada
en TidyTuesday (semana 2026-07-07), fijada al commit
`107ff6c70de02dd807169e13aee7dc9d86ff88b6`. Se consultó la copia el 2026-10-11;
esa fecha no significa que UFCStats haya actualizado la guardia ese día.
Las fichas muestran el nombre de la copia y enlazan a ella.

Cinco fuentes individuales completan la cobertura: UFC Stats para Bilal Hasan,
Gable Steveson y Jean Silva (Lord, no su homónimo); CBS Sports para Salahdine
Parnasse; artículo oficial UFC para Roberto Soldic. Sus enlaces están en el
registro y aparecen en cada ficha.

Reproducción: descargar el CSV del enlace fijado en
`scripts/import-fighter-stances.py` y ejecutar ese script pasando su ruta local.
Solo se aceptan Orthodox, Southpaw y Switch y coincidencias únicas de nombre
completo o alias. No se infiere guardia de nacionalidad, estilo o mano dominante.
Una guardia registrada tampoco impide que el atleta cambie de postura al combatir.

Este registro fechado se conserva aparte de las actualizaciones de récords y
estadísticas. No añade consultas de pago ni afirma actualizarse automáticamente.
Los nuevos perfiles sin dato no reciben una guardia por defecto.
