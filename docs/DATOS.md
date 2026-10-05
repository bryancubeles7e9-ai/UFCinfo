# Datos y fuentes

Los nombres e identidades enlazan a las páginas oficiales de UFC:

- [Ilia Topuria](https://www.ufc.com/athlete/ilia-topuria)
- [Alex Pereira](https://www.ufc.com/athlete/alex-pereira)
- [Islam Makhachev](https://www.ufc.com/athlete/islam-makhachev)
- [Max Holloway](https://www.ufc.com/athlete/max-holloway)
- [Weili Zhang](https://www.ufc.com/athlete/zhang-weili)
- [Valentina Shevchenko](https://www.ufc.com/athlete/valentina-shevchenko)

Los textos de presentación son originales. Las puntuaciones, categorías de estilo y enfrentamientos son ejemplos editoriales ficticios, no estadísticas oficiales. Las fechas iniciales se generan respecto al primer arranque y quedan guardadas en el navegador; no son fechas anunciadas por UFC. Las fichas muestran fotografías descargadas de los perfiles oficiales UFC. Los archivos originales se conservan sin modificaciones en assets/images/fighters/.

Octagon es un proyecto independiente de aficionados, sin afiliación con UFC. Para rankings, récords, divisiones y eventos reales, consulta [UFC.com](https://www.ufc.com).

## Rankings

La sección Rankings muestra el top 10 de las 11 divisiones de peso y las dos listas libra por libra de [All Rankings de UFC](https://www.ufc.com/rankings): mosca, gallo, pluma, ligero, wélter, medio, semipesado y pesado masculinos; paja, mosca y gallo femeninos; libra por libra masculino y femenino. Se utiliza All Rankings, no All Meta Rankings. `scripts/sync-ufc-rankings.py` consulta la página oficial cada 12 horas mediante GitHub Actions y guarda `assets/data/ufc-rankings.json`. La web comprueba ese archivo al abrirse, cada cinco minutos y al volver a la pestaña. Los campeones se presentan separados de las posiciones 1–10; los empates conservan su posición oficial. Si falla la consulta o la validación, se conservan los últimos datos válidos. La copia incluida en JavaScript sirve de respaldo si el archivo no está disponible. Consulta siempre la fuente para la lista completa.

## Catálogo ampliado y fotografías

El catálogo incluye 24 atletas. Se consultaron sus páginas oficiales el 2 de octubre de 2026. `fighter-sources.json` registra para cada atleta el perfil consultado, la URL exacta de su fotografía y los campos de origen. Las fotografías se sirven desde archivos locales; los derechos corresponden a sus titulares originales y se atribuye UFC en las fichas.

División, récord, apodo, estilo, altura, alcance y lugar de nacimiento proceden de esas fichas. Altura y alcance se convierten de pulgadas a centímetros y se redondean al entero más próximo. Si UFC no indica un campo, aparece «No indicado». Son copias fechadas y pueden cambiar en la web oficial. El lugar de nacimiento no implica nacionalidad deportiva. Los textos editoriales y las puntuaciones de Fight Lab siguen siendo ficticios.

## Cinturones, guardia y formación

Los detalles de los 24 perfiles figuran en `fighter-details-sources.json`. La consulta corresponde al 2 de octubre de 2026. El palmarés incluye todos los cinturones UFC absolutos de división y el especial BMF documentados para cada atleta del catálogo; excluye interinos y títulos de otras organizaciones. Cada división se cuenta una vez aunque haya varios reinados. «Actual» significa que conserva ese cinturón en la fecha de consulta; «Anterior» indica que fue campeón y ya no lo conserva. Se priorizan las biografías y el historial de combates del atleta sobre listas de rankings que puedan ir atrasadas. Por ejemplo, UFC identifica a Aspinall como excampeón tras dejar el cinturón absoluto en septiembre de 2026; su antiguo título interino no se suma.

La guardia procede del campo Stance del directorio de UFC Stats. Orthodox se muestra como «Diestro / ortodoxa», Southpaw como «Zurdo / southpaw» y Switch como «Alterna ambas». Es una postura de combate registrada, no una comprobación de la mano dominante ni una exclusión de cambios ocasionales. Cuando la fuente dice Switch, no se inventa una guardia principal.

La base marcial resume la formación documentada en las biografías y entrevistas de UFC; puede incluir varias disciplinas. No equivale necesariamente al campo Fighting style ni implica que el atleta sólo practique esa disciplina. En Strickland se conserva «MMA / Jiu-jitsu brasileño» porque no se acredita una única base tradicional. Las notas de cada ficha explican el fundamento. Los perfiles de Aspinall y Grasso enlazan también a entrevistas o artículos de UFC sobre su formación.

## Eventos numerados de 2026

La vista Carteleras incluye UFC 324–332, celebrados hasta el 5 de octubre de 2026, con los cinco combates de la cartelera principal de cada evento. Fuente: https://www.ufc.com/event/ufc-324 (y sucesivamente hasta ufc-332). No incluye Fight Nights, preliminares ni Freedom 250, que no es un evento numerado. Las fechas provienen del timestamp de inicio de la cartelera principal y se muestran en la zona del navegador; pueden caer al día siguiente respecto a la fecha local del recinto.

`assets/js/official-events.js` contiene la copia independiente de los datos personales del navegador. Los resultados ausentes en UFC se muestran pendientes, nunca se deducen de cuotas ni de perfiles. UFC 332 todavía no mostraba resultados en su página de evento al descargarla. No se permiten pronósticos retrospectivos sobre este historial. Los eventos imaginarios siguen accesibles mediante sus filtros.

Actualización: descargar las páginas oficiales como `/tmp/ufc324.html` hasta `/tmp/ufc332.html`, ejecutar `python3 scripts/import-ufc-events.py /tmp` y revisar la copia antes de publicarla. El importador usa solo la biblioteca estándar. La copia HTML se conserva como respaldo. La sincronización automática usa el importador de API descrito en `API.md`.

La API configurada es UFCalendar, un proveedor independiente. La fecha y fuente mostradas en Carteleras proceden del último archivo válido. La clave `UFCAL_KEY` activa la tarea de sincronización; hasta su primera ejecución se muestra la copia inicial de UFC. `API.md` describe la activación, frecuencia y publicación.

## Próximos eventos y pósteres

Añadidos con UFCalendar: UFC 333, 334 y 335. Consulta: 5 de octubre de 2026. La API enumera cinco combates principales para UFC 333, cinco para UFC 334 y tres para UFC 335; no se rellenan los restantes con combates inventados. Las carteleras anunciadas pueden cambiar. UFC 335 sigue titulado TBD en la API, pero sus combates permiten mostrar Oliveira vs Lopes sin inventar una cartelera completa.

Imágenes promocionales descargadas de los bloques principales de UFC.com para UFC 324–334. UFC 334 usa el arte provisional oficial TEMP-HERO; UFC 335 solo tiene un fondo genérico en su página, que se descarta. La URL de origen y el texto alternativo se guardan con cada evento. Se acredita UFC; la consulta automática de imágenes es complementaria a la API y no utiliza su clave.
