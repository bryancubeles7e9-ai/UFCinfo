# UFCinfo — Inside the fight

**Una web para seguir UFC y reunir en un mismo lugar sus eventos, luchadores, rankings y posibles próximos combates.**

UFCinfo nace de la perspectiva de un aficionado: consultar una cartelera, conocer mejor a sus protagonistas y seguir a los luchadores favoritos sin tener que buscar cada dato por separado. Es un proyecto personal e independiente, sin afiliación oficial con UFC.

**[Entrar en UFCinfo](https://ufcinfo.onrender.com)**

## Qué puedes hacer

| Sección | Qué encontrarás |
| --- | --- |
| **Inicio** | El próximo evento disponible y accesos a las principales secciones. |
| **Carteleras** | Eventos numerados, Fight Night y especiales, con próximos combates, resultados disponibles, cuenta atrás y descarga de calendario `.ics`. |
| **Luchadores** | Un catálogo con fotografías, récords, datos físicos, guardia, formación marcial y estadísticas disponibles. Puedes buscar y filtrar, consultar las fuentes y abrir la ficha de cada atleta. |
| **Rankings** | El top 15 de las 11 divisiones y las dos listas libra por libra, con el campeón separado cuando corresponde y acceso a los perfiles. |
| **Fight Lab** | Comparación de dos luchadores: perfil, trayectoria y estadísticas de golpeo, derribos y finalizaciones. |
| **Rumores** | Publicaciones de fuentes seleccionadas sobre posibles combates, agrupadas por pelea y con atribución a su origen. |
| **Mi esquina** | Tus luchadores seguidos, sus próximos combates anunciados, posiciones en los rankings y resultados recientes disponibles. |

La interfaz está disponible en **español, inglés y catalán**, tiene tema claro y oscuro y se adapta a móvil y ordenador.

## Cómo empezar

1. Entra en **Carteleras** para consultar la próxima velada o un evento finalizado.
2. Abre **Luchadores**, busca a tus favoritos y pulsa el corazón o **Seguir luchador**.
3. Visita **Mi esquina** para reunir sus próximos combates y resultados. Si sigues a ambos rivales, la pelea aparece una sola vez.
4. Usa **Fight Lab** cuando quieras comparar las cifras disponibles de dos atletas.

No necesitas una cuenta para explorar la web. Como invitado, tu seguimiento se guarda en ese navegador. Con una cuenta, la lista de luchadores seguidos se guarda en el servidor y puedes recuperarla desde otros dispositivos. También puedes exportar e importar una copia del seguimiento.

El **modo sin spoilers** está activo al entrar y se reactiva al recargar. Oculta los resultados de combates en Carteleras y Mi esquina; puedes revelarlos individualmente o desactivar el modo. Las fichas, los récords y los rankings mantienen sus datos publicados, por lo que pueden reflejar el desenlace de un evento.

## De dónde salen los datos

La web combina un catálogo de perfiles con copias de datos que actualizan tareas automáticas. Cada visita consulta esas copias: **abrir una ficha no lanza una nueva consulta de pago al proveedor**.

| Información | Fuente y funcionamiento |
| --- | --- |
| **Eventos y resultados** | Cito actualiza las carteleras cercanas y conserva el historial disponible. Incluye cartelera principal, preliminares y preliminares previas cuando están publicadas. |
| **Rankings** | Se consultan las clasificaciones publicadas en UFC.com. |
| **Récords y estadísticas** | Se consultan los perfiles oficiales de UFC de los luchadores registrados que participan en los combates seleccionados. |
| **Campeones y fotografías** | Los títulos absolutos actuales se sincronizan con los rankings válidos. Se revisan las fotografías y se conservan variantes para campeón y no campeón cuando están disponibles. El BMF tiene una gestión separada. |
| **Guardias y bases marciales** | Datos documentados de UFC, UFC Stats y otras fuentes enlazadas. Su cobertura depende de la información disponible y no todos estos campos se revisan automáticamente. |
| **Rumores** | TwitterAPI.io busca publicaciones de una lista de cuentas seleccionadas. Después se aplican filtros y comprobaciones con las carteleras oficiales. |

Las fichas y los feeds incluyen fuentes y fechas de consulta cuando están disponibles. **La fecha de consulta indica cuándo se revisó la fuente, no cuándo esta modificó sus datos.**

## Cuándo se actualiza

Los horarios se interpretan en **Europe/Madrid**, con el cambio de hora de verano e invierno.

| Proceso | Programación habitual |
| --- | --- |
| Carteleras, resultados, rankings, fotografías, récords y estadísticas | Cada día a las **08:00 y 14:00**. |
| Búsqueda de rumores y comprobación de confirmaciones oficiales | **Cada hora en punto**. |
| Lectura de las copias publicadas desde la web | Al abrir la página y periódicamente, aproximadamente cada **cinco minutos** para los principales feeds. |

cron-job.org solicita las ejecuciones y GitHub Actions realiza el trabajo. Los cambios de datos se guardan en el repositorio y Render publica la web. También existen ejecuciones manuales y disparadores por determinados cambios de código; los rumores cuentan con comprobaciones de respaldo que evitan repetir la búsqueda de pago dentro de la misma hora.

Después de actualizar las carteleras, el proceso revisa récords y estadísticas de los luchadores seleccionados con resultados en eventos completados de los últimos 14 días. Repite las comprobaciones aunque el récord no haya cambiado para poder recoger estadísticas publicadas más tarde. **No se consulta todo el catálogo en cada ejecución.**

Los horarios son de inicio previsto: la ejecución, la publicación y la disponibilidad de los datos en la fuente pueden introducir retrasos. Puedes consultar el detalle técnico en [Horarios de automatización](docs/AUTOMATION_SCHEDULE.md).

## Cómo se tratan los rumores

La búsqueda revisa una ventana solapada de las últimas 24 horas para recuperar publicaciones que aparezcan tarde en el buscador. El sistema evita duplicados, agrupa referencias a un mismo posible combate y filtra contenido ajeno a UFC o que no identifica una pelea válida. También contrasta las propuestas con las carteleras oficiales disponibles para evitar presentar peleas ya anunciadas como nuevas especulaciones.

Una búsqueda puede completarse sin añadir nada: puede no haber publicaciones nuevas válidas o pueden descartarse por los filtros. **Un rumor no equivale a un combate confirmado.** Las comprobaciones dependen de la cobertura y actualización de las fuentes.

Más información: [Funcionamiento de rumores](docs/RUMORES.md) y [criterios del filtro](docs/RUMOR_FILTER.md).

## Alcance actual

- Los resultados y las estadísticas son copias actualizadas periódicamente; no hay seguimiento en directo golpe a golpe.
- Las carteleras incluyen **preliminares y preliminares previas disponibles**. Las veladas futuras pueden estar incompletas y algunos participantes todavía no tienen ficha en el catálogo.
- Algunos perfiles tienen campos pendientes porque no hay información suficientemente documentada. Los datos ausentes no se inventan.
- Una fuente puede tardar en actualizar un récord, una estadística o una fotografía después del combate.
- Fight Lab compara datos publicados; no calcula probabilidades de victoria ni predicciones.

El proyecto busca ser útil para otros seguidores, sostenible y una muestra de desarrollo personal. La evolución prevista incluye ampliar la cobertura de luchadores y preliminares, seguir mejorando la experiencia móvil y explorar una aplicación y otras promotoras de MMA. Consulta la [hoja de ruta](docs/ROADMAP.md).

## Ejecutar el proyecto en local

La interfaz utiliza **HTML, CSS y JavaScript**, sin proceso de compilación. El servidor de cuentas utiliza **Python y SQLite**.

Con Python 3.10 o posterior y soporte para `hashlib.scrypt`, desde la raíz del repositorio:

```bash
python3 server.py
```

Abre **http://127.0.0.1:8780**. No se necesitan paquetes adicionales para el servidor. La base de datos local se crea en `.ufcinfo-data/accounts.sqlite3` y no debe añadirse al repositorio.

Un servidor estático como Live Server permite explorar el modo invitado, pero no ejecuta las cuentas. Abrir `index.html` directamente con doble clic no basta para cargar los módulos JavaScript.

Las claves de los proveedores se configuran en el entorno de las automatizaciones y nunca deben incluirse en el código ni enviarse al navegador. Para usar la copia de datos existente en local no necesitas contratar esas APIs.

## Organización del repositorio

| Ruta | Contenido |
| --- | --- |
| `index.html` | Estructura de la interfaz. |
| `assets/css/` y `assets/js/` | Estilos, navegación, vistas e interacciones. |
| `assets/data/` | Copias publicadas de eventos, rankings, rumores y datos de luchadores. |
| `assets/images/` | Recursos gráficos y fotografías. |
| `server.py` | Servidor web y API de cuentas y seguimiento. |
| `scripts/` | Importadores y tareas de sincronización. |
| `.github/workflows/` | Ejecución de las automatizaciones y sus comprobaciones. |
| `tests/` | Pruebas de datos, interfaz y servidor. |
| `docs/` | Fuentes, decisiones y guías técnicas. |
| `render.yaml` | Configuración de alojamiento en Render. |

Para profundizar: [datos y procedencia](docs/DATOS.md), [APIs y eventos](docs/API.md), [récords y estadísticas](docs/FIGHTER_RECORDS.md), [cuentas](docs/CUENTAS.md) y [publicación](docs/PUBLICACION.md).

Si detectas un dato incorrecto o un fallo, puedes [abrir una incidencia](https://github.com/bryancubeles7e9-ai/UFCinfo/issues) indicando la sección, el luchador o evento afectado y, si es posible, una fuente o los pasos para reproducirlo.
