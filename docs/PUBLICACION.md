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

## Aplicación instalable e imagen al compartir

UFCinfo se puede **instalar en el móvil o el ordenador** como una aplicación: icono en la pantalla de inicio y apertura a pantalla completa, sin pasar por las tiendas. En Android y en Chrome aparece la opción «Instalar» o «Añadir a pantalla de inicio»; en iPhone, Compartir › «Añadir a pantalla de inicio». La configuración está en `assets/manifest.webmanifest`, con accesos directos a Carteleras, Pick’em y Luchadores.

Al compartir la portada (o cualquier página sin foto propia), la vista previa muestra la tarjeta `assets/images/brand/ufcinfo-share.jpg` (1200×630). Las fichas y las veladas siguen usando su propia foto.

Los iconos y la tarjeta se generan con las tipografías de la web: `node scripts/build-brand-images.mjs` (requiere Playwright). Estas imágenes no se convierten a WebP, porque el manifiesto y las vistas previas declaran su formato.

## Fotos alojadas en la web

Todas las fotos oficiales de los luchadores se sirven desde la propia web: la web no carga nada de otros dominios, así que es más rápida, funciona sin conexión, no depende de que UFC cambie sus direcciones y el navegador no recibe cookies de terceros. `scripts/localize-photos.py` descarga cada foto que todavía apunte a UFC.com y la guarda como WebP (máximo 700 px de alto) en `assets/images/fighters/<id>.webp`; la dirección original se conserva en `photoSource`. La actualización automática lo ejecuta antes de publicar, así que la foto de un luchador recién incorporado solo se carga desde UFC.com hasta la siguiente actualización. Si una descarga falla, se mantiene la foto de UFC.com y se avisa en el registro.

El 26 de noviembre de 2026 se guardaron 526 fotos (19 MB); la nota de buenas prácticas de Lighthouse en móvil pasa de 93 a 96.

## Uso sin conexión

El service worker (`assets/sw.js`) guarda en el dispositivo una copia de la web y de los últimos datos: en la primera visita, la interfaz, los estilos, las tipografías, el paquete de código, los archivos de datos y los JSON de veladas, rankings, récords y rumores (lista `PRECACHE`), y después cada archivo y foto de la web que se va consultando (hasta 250 fotos).

- **Con conexión** todo se pide a la red como siempre, así que los datos están al día; la copia solo se actualiza.
- **Sin conexión** la web (o la aplicación instalada) se abre desde esa copia: portada, carteleras, fichas, rankings y Fight Lab, incluidos los enlaces `/luchadores/...` y `/carteleras/...`. Un aviso indica que se están viendo los últimos datos guardados. Cuentas, Pick’em y rumores nuevos necesitan conexión.
- **Durante un despliegue** (Render responde 502/503/504) se sigue mostrando la pantalla «Estamos actualizando la web», que se recarga sola al volver el servidor.

`tests/test-offline.mjs` comprueba que existen todos los archivos de `PRECACHE` y que se guardan todos los estilos, tipografías y módulos que pide la portada: si se añade o renombra uno, hay que añadirlo a la lista.

## Paquete de la interfaz

El navegador carga `assets/js/app.bundle.js`: todo el código de la interfaz en un solo archivo minificado, en lugar de una cadena de unos 45 módulos. Los archivos de datos (`fighter-directory-data.js`, `official-events.js` y los demás `*-data.js`) quedan fuera del paquete y se descargan en paralelo, así que las actualizaciones automáticas de datos no necesitan regenerarlo.

**Después de cambiar cualquier archivo de `assets/js`**, hay que regenerar el paquete:

```bash
npm install --no-save --no-package-lock esbuild@0.25.5
node scripts/build-bundle.mjs
```

Las traducciones al inglés y al catalán (`assets/js/i18n/dictionaries.js` y sus módulos) tampoco van en el paquete: solo se descargan si el visitante elige esos idiomas, y mientras llegan la página espera oculta (2 s como máximo) para no mostrar un destello en español. El paquete pasó así de 458 KB a 190 KB.

La validación de GitHub (`--check`) falla si el paquete no coincide con el código, y Render solo publica cuando la validación pasa. Además, la portada precarga el póster del próximo evento, las secciones ocultas se dibujan cuando el navegador queda libre y las fotos se reutilizan durante una hora sin volver a descargarse.

**Resultado (26 de noviembre de 2026, móvil con la CPU ralentizada ×4):** portada completa en 4G de 2,6 s a 1,7 s y en 4G lenta de 7,7 s a 7,0 s; peticiones de 85 a 55; tiempo de bloqueo de 760 ms a unos 420 ms. En 4G lenta el límite es ya el peso de las fotos y los datos.

## Enlaces para compartir e indexar

Cada luchador, cada velada y cada ranking tienen su propia dirección: **/luchadores/ilia-topuria**, **/carteleras/ufc-335** o **/rankings/peso-ligero** (las categorías femeninas terminan en `-femenino`). El servidor responde con la web normal, pero con el título, la descripción, la foto y la dirección canónica de esa página, así que al compartirla en WhatsApp o en redes se ve su vista previa, y Google puede indexarla. Al abrirla, la web muestra la sección y abre la ficha o la cartelera. Mientras una ficha o una cartelera está abierta, la barra de direcciones muestra su enlace; al cerrarla, vuelve a la portada.

- Los botones **Compartir ficha**, **Compartir cartelera** y **Compartir ranking** usan el menú de compartir del móvil o copian el enlace. La vista previa de un ranking muestra la foto del campeón (o del número uno libra por libra) y el podio.
- Los datos de cada dirección están en `assets/data/share-index.json`, que genera `node scripts/build-share-index.mjs`. Las actualizaciones automáticas de datos lo regeneran en el mismo commit, y la validación (`--check`) falla si queda desactualizado.
- El mapa del sitio (`/sitemap.xml`) incluye todas las fichas, veladas y rankings.
- Una dirección que no existe muestra la página 404 de UFCinfo.

## Privacidad y aviso legal

La página **/privacidad** (también /privacy) explica en español, inglés y catalán qué datos se guardan, para qué, durante cuánto tiempo, quién interviene (Render y GitHub), la única cookie técnica y cómo ejercer los derechos. La plantilla es `privacy.html`. El responsable y el correo de contacto **no están en el repositorio**: los toma de las variables `PRIVACY_OWNER` y `PRIVACY_CONTACT` de Render; si faltan, la página muestra «Pendiente de indicar».

Desde **Mi cuenta › Tus datos**, cada usuario puede descargar sus datos en JSON (`GET /api/me/export`) y eliminar su cuenta confirmando la contraseña (`POST /api/me/delete`). El borrado elimina al momento la cuenta, el seguimiento, el nombre y los pronósticos de Pick’em y las sesiones; de las copias de seguridad desaparece cuando caducan, a los 90 días. El pie de página y el formulario de registro enlazan a la política.

Como solo existe una cookie estrictamente necesaria y no hay analítica ni publicidad, no hace falta aviso de cookies. **Antes de activar AdSense** habrá que añadir un gestor de consentimiento y actualizar la política.

## Rendimiento

Medido con Lighthouse el 26 de noviembre de 2026 en la portada: en ordenador, 97 de rendimiento y 100 en accesibilidad, buenas prácticas y SEO; en móvil con 4G lenta simulada, alrededor de 65 de rendimiento (antes 34), 100 de accesibilidad y desplazamiento visual casi nulo (0,005, antes 0,88). El peso de la portada bajó de 3,7 MB a unos 1,3 MB gracias a la compresión gzip, las copias WebP de las fotos y las tipografías propias. El siguiente paso, si hace falta, es agrupar los módulos JavaScript para reducir la cadena de descargas en móvil.

## Accesibilidad

`tests/accessibility.mjs` revisa con axe-core (el motor de accesibilidad de Lighthouse; reglas WCAG 2.1 A/AA y buenas prácticas) doce pantallas: portada, Salón de leyendas en móvil y ordenador, ficha de leyenda (también en tema claro), ficha de luchador, cartelera, ranking, rumores, privacidad, 404 y el modo sin conexión. Se ejecuta en la prueba de navegador de GitHub junto a la de recorrido, así que Render no publica una versión con problemas de accesibilidad. Resultado del 26 de noviembre de 2026: ningún problema.

## Prueba de navegador antes de publicar

El workflow **Probar la web en un navegador** (`web-check.yml`) se ejecuta con cada cambio de la interfaz o del servidor. Arranca la web y, con Chromium, recorre las ocho secciones en ordenador y en móvil, abre una ficha de luchador y una cartelera y cambia el idioma (`tests/browser-smoke.mjs`). Falla ante errores de JavaScript, respuestas 4xx/5xx de la propia web, secciones vacías o desbordes horizontales. Como Render publica solo cuando pasan las comprobaciones, una página rota no llega a los visitantes. Para ejecutarla en local: arranca `python3 server.py` y luego `node tests/browser-smoke.mjs http://127.0.0.1:8780`.
