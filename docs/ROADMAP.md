# Hoja de ruta de UFCinfo

Actualizada el 26 de noviembre de 2026. Sustituye a la versión del 13 de octubre.

## Visión

UFCinfo empieza como **proyecto personal y muestra de desarrollo**, crece hasta ser una **comunidad internacional de aficionados a las MMA** y, cuando tenga público, **cubre sus costes** sin renunciar a la calidad de los datos.

**Meta a un año (noviembre de 2027):** una web y una aplicación instalable usadas de forma habitual por aficionados de habla hispana e inglesa, con Pick’em entre amigos, avisos de los combates que interesan a cada usuario y más de una promotora de MMA.

### Principios que no cambian

- **Datos verificados:** fuentes oficiales, fechas de consulta visibles y ningún dato inventado.
- **Automatización fiable:** las actualizaciones no deben depender de trabajo manual; un fallo se detecta y avisa.
- **Privacidad:** se recoge solo lo necesario y nunca se venden datos de los usuarios.
- **Sin apuestas:** Pick’em es un juego de pronósticos sin dinero.

Los plazos son orientativos. Cada fase se da por cerrada al comprobar sus indicadores, no por fecha.

## Fase 1 · Base estable — completada en noviembre de 2026

Web pulida en móvil y ordenador, datos de UFC.com actualizados dos veces al día, perfiles nuevos incorporados solos desde carteleras y rankings, despliegue solo tras pasar las pruebas, comprobación de la web cada 15 minutos y avisos por email ante fallos.

**Pendiente para cerrarla del todo:** comprobar con la próxima velada que resultados, récords y estadísticas se completan solos, y añadir copias de seguridad externas de las cuentas y del Pick’em.

## Fase 2 · Lanzamiento público internacional — diciembre de 2026 a febrero de 2027

Preparar la web para que la encuentren y la usen personas que no conocen el proyecto.

- **Dominio propio** y presentación clara del proyecto.
- **Direcciones indexables:** ✅ hecho el 26 de noviembre de 2026 para luchadores y veladas (`/luchadores/ilia-topuria`, `/carteleras/ufc-335`), con título, descripción e imagen para buscadores y redes sociales, y en el mapa del sitio. Pendiente: rankings y secciones.
- **Inglés al mismo nivel que el español** en textos, fichas y resúmenes; catalán como idioma adicional.
- **Privacidad y cookies:** ✅ política de privacidad, aviso legal, descarga de datos y borrado de cuenta (26 de noviembre de 2026). Pendiente: analítica respetuosa con la privacidad y gestión de consentimiento si se activa la publicidad.
- **Copias de seguridad** cifradas y probadas de la base de datos.
- **Prueba con usuarios reales** de distintos países y corrección de lo que encuentren.

**Indicadores:** dominio activo, fichas y veladas que aparecen en Google en español e inglés, y primeros 100 usuarios registrados.

## Fase 3 · Aplicación instalable y notificaciones — marzo a mayo de 2027

Convertir la web en una **aplicación instalable (PWA)** desde el navegador, sin pasar todavía por las tiendas. ✅ Instalación con icono y pantalla completa disponible desde el 26 de noviembre de 2026; consulta sin conexión de los datos ya descargados desde el mismo día; faltan las notificaciones.

- Icono en la pantalla de inicio, apertura a pantalla completa y consulta sin conexión de los datos ya descargados.
- **Notificaciones** que el usuario elige: próximo combate de un luchador seguido, cierre inminente de Pick’em y resultados disponibles (respetando el modo sin spoilers).
- Funcionamiento verificado en Android y en iPhone (las notificaciones en iPhone requieren instalar la aplicación).

**Indicadores:** la aplicación se instala en Android e iPhone, y una parte significativa de los usuarios activa al menos un aviso.

## Fase 4 · Comunidad y Pick’em con amigos — junio a agosto de 2027

Dar motivos para volver cada semana y para invitar a otros.

- **Ligas privadas** de Pick’em con enlace de invitación y clasificación propia.
- **Perfiles públicos** opcionales con historial de pronósticos y logros.
- **Compartir** pronósticos y resultados como imagen o enlace.
- Medidas contra abusos: límites, informes de usuarios y nombres moderados.
- Revisar si la base de datos actual (SQLite) aguanta el volumen o conviene migrar a PostgreSQL.

**Indicadores:** ligas activas en cada velada y crecimiento de usuarios por invitación.

## Fase 5 · Otras promotoras de MMA — septiembre a noviembre de 2027

- Generalizar el modelo de datos para que eventos, luchadores y rankings indiquen su promotora.
- Incorporar primero una promotora con fuentes oficiales fiables (candidatas: PFL y ONE Championship), con la misma exigencia de verificación que UFC.
- Luchadores que han pasado por varias promotoras con una sola ficha.
- Filtros por promotora en Carteleras, Luchadores y Pick’em.

**Indicadores:** al menos una promotora más con carteleras, resultados y perfiles actualizados solos.

## Sostenibilidad económica — a lo largo de todas las fases

- **Objetivo inicial:** cubrir los costes de alojamiento (Render y su disco) y de las APIs de pago, como la de rumores.
- Activar la **publicidad discreta** ya preparada (Google AdSense) cuando haya tráfico suficiente y la gestión de consentimiento esté lista.
- Valorar **patrocinios** afines y, más adelante, **funciones opcionales de pago** que no limiten lo esencial (por ejemplo, ligas privadas ampliadas o estadísticas avanzadas).
- Reactivar la búsqueda de rumores cuando su coste esté cubierto.

## Más adelante · Aplicación en tiendas

Solo si la PWA demuestra demanda: publicar en **Google Play** empaquetando la propia PWA (bajo coste) y, después, valorar la **App Store**, que exige más trabajo y una cuota anual.

## Mejoras continuas

Durante todas las fases: correcciones, rendimiento, accesibilidad, revisión de datos incompletos y mantenimiento de las automatizaciones y de sus credenciales.
