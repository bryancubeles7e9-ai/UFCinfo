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

La sección Rankings muestra una selección del top 10 de cinco categorías de [All Rankings de UFC](https://www.ufc.com/rankings): libra por libra masculino y femenino, ligero, wélter y paja femenino. Se consultó el 2 de octubre de 2026 mediante la versión indexada de la página oficial, cuya actualización figura como 29 de septiembre. Se utiliza All Rankings, no All Meta Rankings. Es una copia estática: no se actualiza al recargar. Los campeones se presentan separados de las posiciones 1–10. Consulta siempre la fuente para la lista completa y los cambios posteriores.

## Catálogo ampliado y fotografías

El catálogo incluye 24 atletas. Se consultaron sus páginas oficiales el 2 de octubre de 2026. `fighter-sources.json` registra para cada atleta el perfil consultado, la URL exacta de su fotografía y los campos de origen. Las fotografías se sirven desde archivos locales; los derechos corresponden a sus titulares originales y se atribuye UFC en las fichas.

División, récord, apodo, estilo, altura, alcance y lugar de nacimiento proceden de esas fichas. Altura y alcance se convierten de pulgadas a centímetros y se redondean al entero más próximo. Si UFC no indica un campo, aparece «No indicado». Son copias fechadas y pueden cambiar en la web oficial. El lugar de nacimiento no implica nacionalidad deportiva. Los textos editoriales y las puntuaciones de Fight Lab siguen siendo ficticios.

## Cinturones, guardia y formación

Los detalles de los 24 perfiles figuran en `fighter-details-sources.json`. La consulta corresponde al 2 de octubre de 2026. El palmarés incluye todos los cinturones UFC absolutos de división y el especial BMF documentados para cada atleta del catálogo; excluye interinos y títulos de otras organizaciones. Cada división se cuenta una vez aunque haya varios reinados. «Actual» significa que conserva ese cinturón en la fecha de consulta; «Anterior» indica que fue campeón y ya no lo conserva. Se priorizan las biografías y el historial de combates del atleta sobre listas de rankings que puedan ir atrasadas. Por ejemplo, UFC identifica a Aspinall como excampeón tras dejar el cinturón absoluto en septiembre de 2026; su antiguo título interino no se suma.

La guardia procede del campo Stance del directorio de UFC Stats. Orthodox se muestra como «Diestro / ortodoxa», Southpaw como «Zurdo / southpaw» y Switch como «Alterna ambas». Es una postura de combate registrada, no una comprobación de la mano dominante ni una exclusión de cambios ocasionales. Cuando la fuente dice Switch, no se inventa una guardia principal.

La base marcial resume la formación documentada en las biografías y entrevistas de UFC; puede incluir varias disciplinas. No equivale necesariamente al campo Fighting style ni implica que el atleta sólo practique esa disciplina. En Strickland se conserva «MMA / Jiu-jitsu brasileño» porque no se acredita una única base tradicional. Las notas de cada ficha explican el fundamento. Los perfiles de Aspinall y Grasso enlazan también a entrevistas o artículos de UFC sobre su formación.
