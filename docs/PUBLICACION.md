# Publicación de UFCinfo y Google

## Estado

Preparación local para Render con cuentas persistentes. Todavía falta crear la cuenta de alojamiento, aprobar su coste, desplegar y verificar la dirección pública. No se ha enviado la web a Google.

## Publicar con las cuentas actuales

El servicio se llama `ufcinfo`. Si ya se creó como `octagon`, renombrar primero ese servicio existente en Render antes de sincronizar este Blueprint: Render identifica los recursos por su nombre y un nombre nuevo puede crear otro servicio. Conservar el disco de cuentas existente.

1. Crear una cuenta en https://dashboard.render.com/ y conectar GitHub.
2. Crear un Blueprint y elegir `bryancubeles7e9-ai/pruebaCodex`, rama `main`. Usa el archivo `render.yaml` del repositorio.
3. Revisar el importe antes de crear el servicio: el archivo solicita Starter y un disco persistente de 1 GB. Consultar https://render.com/pricing. No usar un disco temporal para SQLite.
4. Confirmar la creación cuando se haya aceptado el presupuesto. Esperar a que el servicio esté disponible y copiar su dirección HTTPS.
5. Abrir la dirección y `/api/health`. Probar registro, inicio de sesión y recuperación del seguimiento desde otro navegador. Comprobar que las cuentas se conservan después de un despliegue.

Render proporciona `RENDER_EXTERNAL_URL`. El servidor usa ese origen para las cookies, el enlace canónico, `robots.txt` y `sitemap.xml`. Si se conecta un dominio propio, establecer `OCTAGON_PUBLIC_ORIGIN` con el origen HTTPS exacto y volver a desplegar. Las cuentas locales no se trasladan automáticamente a Render.

## Solicitar indexación

1. Abrir https://search.google.com/search-console y añadir una propiedad de prefijo de URL con la dirección HTTPS publicada.
2. Elegir verificación mediante etiqueta HTML. Copiar solamente el valor de `content` a la variable de entorno `GOOGLE_SITE_VERIFICATION` en Render. Volver a desplegar y completar la verificación en Search Console.
3. En Sitemaps, enviar `sitemap.xml`.
4. En Inspección de URLs, comprobar la página de inicio y solicitar indexación.

El servidor incluye la verificación en el HTML, sin depender de JavaScript. El mapa contiene únicamente la página de inicio: las secciones actuales con `#` no son páginas independientes. Crear páginas públicas para cada luchador y evento sigue pendiente para ampliar su presencia en búsquedas. Rumores permanece incompleta y su automatización no se activa al publicar.

La indexación y la posición en búsquedas dependen de Google. Un sitemap no garantiza indexación. Documentación: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap y https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl.

## Fiabilidad en producción

- **Despliegue tras las pruebas:** Render publica un commit solo cuando pasan las comprobaciones de GitHub (*Auto-Deploy: After CI Checks Pass*). Los commits de datos del bot no lanzan pruebas y se publican directamente.
- **Reinicios por despliegue:** el servicio usa un disco, así que cada despliegue reinicia el servidor unos segundos. Las peticiones de cuentas y Pick'em se reintentan solas durante unos 30 segundos ante respuestas 502–504; una lectura también se reintenta si se pierde la conexión, pero un guardado no, para no aplicarlo dos veces.
- **Salud:** `/api/health` solo indica que el proceso responde (lo usa Render). `/api/health/full` comprueba además que la base de datos se puede leer y escribir y que quedan al menos 50 MB libres; responde 503 si algo falla y lo vigila cron-job.org cada 15 minutos.
- **Errores de visitantes:** los errores de los scripts propios de la web se envían a `/api/client-errors` y aparecen en los registros de Render como líneas `client_error` (mensaje, archivo, línea, sección y navegador, sin cookies ni IP). Hay un máximo de 5 por visita, 20 por dirección y 500 en total por hora.
