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

## Copias de seguridad de cuentas y Pick’em

El workflow **Copia de seguridad de cuentas y Pick'em** (`backup.yml`) se ejecuta cada semana. Descarga una copia coherente de la base de datos desde `/api/admin/backup` sin detener la web, comprueba su integridad y las tablas principales, la cifra con AES-256, verifica que se puede descifrar y la guarda como artefacto privado de GitHub Actions durante 90 días.

Necesita tres valores que solo conoce el propietario (nunca se escriben en el código ni en el chat):

| Dónde | Nombre | Valor |
| --- | --- | --- |
| Render → servicio `ufcinfo` → *Environment* | `OCTAGON_BACKUP_TOKEN` | Clave aleatoria de 32 caracteres o más. Sin ella, la ruta de copia responde 404. |
| GitHub → *Settings* → *Secrets and variables* → *Actions* | `UFCINFO_BACKUP_TOKEN` | La misma clave que en Render. |
| GitHub → *Settings* → *Secrets and variables* → *Actions* | `UFCINFO_BACKUP_PASSPHRASE` | Contraseña de cifrado de 20 caracteres o más. **Guárdala también en un gestor de contraseñas: sin ella las copias no se pueden abrir.** |

### Restaurar una copia

1. En GitHub → *Actions* → *Copia de seguridad de cuentas y Pick'em*, abre la ejecución deseada y descarga el artefacto `ufcinfo-AAAA-MM-DD.sqlite3.enc`.
2. Descífralo en tu ordenador: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in ufcinfo-AAAA-MM-DD.sqlite3.enc -out accounts.sqlite3` (pide la contraseña de cifrado).
3. Comprueba la copia: `sqlite3 accounts.sqlite3 "PRAGMA integrity_check;"` debe responder `ok`.
4. Activa el modo de mantenimiento en Render, sustituye `/var/data/accounts.sqlite3` por la copia (desde la *Shell* del servicio) y vuelve a desactivarlo.

## Pantalla de actualización durante los despliegues

Mientras Render reinicia el servidor tras un despliegue, su proxy responde 502–504 con una página propia que no se puede personalizar. Para que el visitante entienda qué pasa:

- **Service worker** (`assets/sw.js`, servido con `Service-Worker-Allowed: /`): guarda solo `assets/updating.html` y, cuando al abrir o recargar la web Render responde 502, 503 o 504 (o el servidor no contesta y el dispositivo sí tiene conexión), muestra esa página en lugar del error. No guarda ni sirve ningún otro archivo, así que nunca muestra versiones antiguas de la web.
- **`assets/updating.html`**: explica en español, inglés o catalán (según el idioma elegido en la web o el del navegador) que la web se está actualizando y que los datos están a salvo; comprueba `/api/health` con intervalos crecientes y recarga sola cuando el servidor vuelve.
- **Aviso dentro de la web:** si el reinicio ocurre mientras alguien la usa, aparece un mensaje discreto mientras las peticiones se reintentan y desaparece al volver el servidor.

Límite: un visitante que entra por primera vez justo durante el reinicio aún no tiene el service worker instalado y ve la página de Render; desde su primera visita ya ve la pantalla propia.

## Rendimiento

Medido con Lighthouse el 26 de noviembre de 2026 en la portada: en ordenador, 97 de rendimiento y 100 en accesibilidad, buenas prácticas y SEO; en móvil con 4G lenta simulada, alrededor de 65 de rendimiento (antes 34), 100 de accesibilidad y desplazamiento visual casi nulo (0,005, antes 0,88). El peso de la portada bajó de 3,7 MB a unos 1,3 MB gracias a la compresión gzip, las copias WebP de las fotos y las tipografías propias. El siguiente paso, si hace falta, es agrupar los módulos JavaScript para reducir la cadena de descargas en móvil.

## Prueba de navegador antes de publicar

El workflow **Probar la web en un navegador** (`web-check.yml`) se ejecuta con cada cambio de la interfaz o del servidor. Arranca la web y, con Chromium, recorre las ocho secciones en ordenador y en móvil, abre una ficha de luchador y una cartelera y cambia el idioma (`tests/browser-smoke.mjs`). Falla ante errores de JavaScript, respuestas 4xx/5xx de la propia web, secciones vacías o desbordes horizontales. Como Render publica solo cuando pasan las comprobaciones, una página rota no llega a los visitantes. Para ejecutarla en local: arranca `python3 server.py` y luego `node tests/browser-smoke.mjs http://127.0.0.1:8780`.
