# Datos y fuentes

Los nombres e identidades enlazan a las páginas oficiales de UFC:

- [Ilia Topuria](https://www.ufc.com/athlete/ilia-topuria)
- [Alex Pereira](https://www.ufc.com/athlete/alex-pereira)
- [Islam Makhachev](https://www.ufc.com/athlete/islam-makhachev)
- [Max Holloway](https://www.ufc.com/athlete/max-holloway)
- [Weili Zhang](https://www.ufc.com/athlete/zhang-weili)
- [Valentina Shevchenko](https://www.ufc.com/athlete/valentina-shevchenko)

Los textos de presentación son originales. Las categorías editoriales de estilo y los enfrentamientos de demostración son ejemplos ficticios, no estadísticas oficiales. Las fechas iniciales se generan respecto al primer arranque y quedan guardadas en el navegador; no son fechas anunciadas por UFC. Las fichas muestran fotografías descargadas de los perfiles oficiales UFC. Los archivos originales se conservan sin modificaciones en assets/images/fighters/.

UFCinfo es un proyecto independiente de aficionados, sin afiliación con UFC. Para rankings, récords, divisiones y eventos reales, consulta [UFC.com](https://www.ufc.com).

## Rankings

La sección Rankings muestra el top 10 de las 11 divisiones de peso y las dos listas libra por libra de [All Rankings de UFC](https://www.ufc.com/rankings): mosca, gallo, pluma, ligero, wélter, medio, semipesado y pesado masculinos; paja, mosca y gallo femeninos; libra por libra masculino y femenino. Se utiliza All Rankings, no All Meta Rankings. `scripts/sync-ufc-rankings.py` consulta la página oficial cada 12 horas mediante GitHub Actions y guarda `assets/data/ufc-rankings.json`. La web comprueba ese archivo al abrirse, cada cinco minutos y al volver a la pestaña. Los campeones se presentan separados de las posiciones 1–10; los empates conservan su posición oficial. Si falla la consulta o la validación, se conservan los últimos datos válidos. La copia incluida en JavaScript sirve de respaldo si el archivo no está disponible. Consulta siempre la fuente para la lista completa.

## Catálogo ampliado y fotografías

El catálogo incluye 24 atletas. Se consultaron sus páginas oficiales el 2 de octubre de 2026. `fighter-sources.json` registra para cada atleta el perfil consultado, la URL exacta de su fotografía y los campos de origen. Las fotografías se sirven desde archivos locales; los derechos corresponden a sus titulares originales y se atribuye UFC en las fichas.

División, récord, apodo, estilo, altura, alcance y lugar de nacimiento proceden de esas fichas. Altura y alcance se convierten de pulgadas a centímetros y se redondean al entero más próximo. Si UFC no indica un campo, aparece «No indicado». Son copias fechadas y pueden cambiar en la web oficial. El lugar de nacimiento no implica nacionalidad deportiva. Los textos editoriales son originales; Fight Lab usa las estadísticas oficiales de las fichas.

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

## Información ampliada de luchadores

Los 24 perfiles incorporan una copia adicional consultada el 6 de octubre de 2026, guardada en `assets/js/fighter-info-data.js`. Cada entrada conserva su URL oficial y fecha de consulta. Incluye edad publicada, equipo o gimnasio, peso del perfil, alcance de pierna, debut en UFC, golpes significativos conectados y recibidos por minuto, precisión y defensa de golpeo, medias de derribos, intentos de sumisión y knockdowns por 15 minutos, precisión y defensa de derribos, victorias por KO/TKO y sumisión, y finalizaciones en el primer asalto.

Los campos ausentes se muestran como «No indicado»; los ceros publicados se conservan. El peso se convierte de libras a kilogramos y el alcance de pierna de pulgadas a centímetros, con un decimal. La edad no se recalcula: es la indicada al consultar el perfil. Los totales de finalizaciones son los publicados por UFC y pueden incluir combates de otras organizaciones; no se deducen victorias por decisión ni porcentajes a partir del récord. Esta ampliación no actualiza los campos anteriores del catálogo.

Para renovar la copia, descarga cada URL del catálogo como `/tmp/octagon-ID.html`, crea un manifiesto JSON con los campos `id` y `source`, y ejecuta `python3 scripts/import-fighter-info.py /tmp /ruta/manifiesto.json AAAA-MM-DD assets/js/fighter-info-data.js`. Revisa el resultado antes de publicarlo. El importador no accede a la red.

## Fichas asociadas a rankings y carteleras

El catálogo se amplía a 165 atletas: los 24 perfiles iniciales y 141 perfiles adicionales consultados el 6 de octubre de 2026. `fighter-directory-sources.json` conserva el manifiesto de nombres, alias y URLs. `assets/js/fighter-directory-data.js` guarda el nombre oficial, división, récord, apodo, estilo, altura, alcance, lugar de nacimiento y las estadísticas ampliadas con fecha y fuente. Las fotografías se descargan del perfil oficial y se sirven localmente.

Todos los nombres de la copia actual de rankings y carteleras abren una ficha dentro de UFCinfo. La resolución admite tildes y variantes tipográficas de apóstrofos, y conserva «Zhang Weili» como alias de «Weili Zhang». Las fichas adicionales aparecen en Luchadores y se pueden buscar por nombre, apodo, división, lugar de nacimiento, estilo oficial y gimnasio, y filtrar por división. Los filtros de estilo editorial, guardia y cinturones se aplican a las fichas iniciales que tienen esa información documentada; no se asignan esos campos por deducción a los nuevos atletas. El seguimiento y Fight Lab admiten los 165 perfiles.

Cuando el perfil oficial omite una estadística, se muestra «No indicado». Esto ocurre, por ejemplo, con las medias de golpeo de Jack Della Maddalena y Roberto Soldić. No se calculan datos sustitutos. Si una actualización futura incorpora un nombre todavía desconocido, se ofrece un enlace al directorio oficial de UFC.

Renovación: descargar las URLs del manifiesto como `/tmp/octagon-ID.html` y ejecutar `python3 scripts/import-fighter-directory.py /tmp docs/fighter-directory-sources.json AAAA-MM-DD assets/js/fighter-directory-data.js`; revisar y descargar las fotografías de las URLs `photoSource`. Comprobación: `node tests/test-fighter-directory.mjs`.

## Fight Lab: comparación oficial

Fight Lab compara dos atletas distintos entre los 165 del directorio. Muestra 27 filas en cinco grupos: perfil y datos físicos, formación y trayectoria, golpeo, derribos y sumisiones, y finalizaciones. Combina la copia original de los 24 atletas con sus estadísticas ampliadas y las 141 fichas adicionales. Las tarjetas muestran las fechas de cada bloque y enlaces a UFC y, donde existe guardia documentada, UFC Stats. Los cinturones conservan la fecha de consulta de su ficha.

Los campos ausentes no se sustituyen por ceros. Los cinturones sin documentar se distinguen de un palmarés registrado vacío. Las barras representan exclusivamente porcentajes publicados de precisión y defensa, con una escala común 0–100; no se genera un índice, pronóstico o puntuación de victoria. El comparador no crea análisis ni notas. Los análisis históricos se conservan en las copias por compatibilidad, aunque la nueva Mi esquina ya no los muestra.

## Mi esquina: seguimiento y agenda

Mi esquina permite seguir a los 165 atletas y relaciona sus identificadores con los nombres normalizados y alias de las carteleras oficiales. Los favoritos anteriores se conservan con la misma clave de almacenamiento; la validación de copias acepta ahora también los identificadores de las fichas adicionales y rechaza duplicados o atletas desconocidos. Los datos anteriores de pronósticos y análisis siguen guardados y exportables, pero no forman parte de la nueva interfaz.

La agenda muestra eventos anunciados o programados con fecha futura y eventos identificados como en curso. La actividad reciente utiliza eventos finalizados con fecha pasada, ordenados del más reciente al más antiguo, hasta seis combates. No se incluyen carteleras imaginarias, no se infieren resultados y no se muestran anuncios antiguos como próximos. Un combate entre dos atletas seguidos no se duplica. Cada tarjeta de atleta muestra su próxima participación disponible y sus posiciones en la copia de rankings; un campeón de ranking no sustituye el historial documentado de cinturones de la ficha.

El alcance está limitado a las carteleras principales de los eventos numerados disponibles. La ausencia de un próximo combate significa únicamente que no está anunciado en esta copia. Los eventos y los rankings conservan sus propias fuentes y fechas; la sección se redibuja al refrescar ambas fuentes. Los archivos `.ics` usan la fecha y hora de inicio de la cartelera principal, sin inventar una hora de fin para eventos oficiales, e incluyen su URL de origen.

Verificación: `node tests/test-following.mjs`.

## Seguimiento por cuenta

El modo invitado conserva el almacenamiento anterior. Con sesión iniciada, la lista de identificadores de atletas seguidos se guarda en la base de datos de `server.py`, separada por cuenta. Las estadísticas y las carteleras mantienen sus fuentes originales. El tema y otros datos personales históricos son locales a cada navegador; solo el seguimiento se sincroniza. Consulta `CUENTAS.md` para funcionamiento, publicación, alcance y verificación.

## UFC Freedom 250

Evento especial oficial incluido junto a los eventos numerados, con identificador `ufc-freedom-250` y sin número de serie. Cartelera de siete combates y resultados consultados el 6 de octubre de 2026 en https://www.ufc.com/news/ufc-freedom-250-official-scorecards-judges y https://www.ufc.com/news/ufc-freedom-250-results-highlights-interviews . Horario de cartelera principal: 14 de junio, 20:00 EDT (15 de junio, 00:00 UTC), según https://www.ufc.com/events?fa=news.detail&gid=17041&page=2 .
