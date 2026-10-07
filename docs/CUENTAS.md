# Cuentas y guardado del seguimiento

UFCinfo permite crear una cuenta con nombre de usuario y contraseña e iniciar/cerrar sesión. La lista de luchadores seguidos se guarda en el servidor y se recupera al acceder con la misma cuenta desde otro ordenador. Los eventos oficiales y los perfiles siguen siendo datos compartidos del catálogo; no se guardan copias de ellos por usuario.

## Probar en este ordenador

Desde la raíz del proyecto:

```bash
python3 server.py
```

Abre `http://127.0.0.1:8780`. Python 3.10 o posterior, con soporte para `hashlib.scrypt`, es suficiente; no hay paquetes adicionales. Live Server y `python3 -m http.server` permiten usar la web como invitado pero no ejecutan la API de cuentas.

La base de datos se guarda en `.ufcinfo-data/accounts.sqlite3`, fuera de los archivos publicados y excluida de Git. No borres esa carpeta si quieres conservar las cuentas. Las sesiones duran 30 días y el cierre de sesión invalida la sesión de ese navegador.

Al crear una cuenta puedes añadir los luchadores que sigues como invitado. Al entrar en una cuenta existente se carga su seguimiento; no se mezcla automáticamente con el del invitado. Cada cuenta tiene una caché local separada. Al salir vuelve el seguimiento del invitado. Solo la lista de luchadores seguidos se sincroniza entre ordenadores: el tema, las carteleras imaginarias y los datos históricos permanecen en el navegador y en las copias exportadas.

Los cambios se envían automáticamente después de seguir o dejar de seguir. Si falla la conexión, se conservan en la caché de esa cuenta y el estado indica que están pendientes; puedes reintentarlos. Al iniciar sesión de nuevo se recuperan los cambios pendientes. Los cambios concurrentes en otros dispositivos se combinan por adiciones/eliminaciones respecto a la última copia conocida, sin reemplazar listas enteras sin comprobar su versión. Al volver a la pestaña y cada minuto se comprueba el seguimiento guardado. Las credenciales nunca se guardan en `localStorage`.

## Publicar para acceder desde cualquier ordenador

El servidor web y la base de datos necesitan alojamiento público con HTTPS y almacenamiento persistente. GitHub Pages publica archivos estáticos y no ejecuta `server.py`.

Se incluye `render.yaml` para publicar el proyecto existente en Render como servicio Python con un disco persistente de 1 GB. **Este archivo describe un servicio de pago; no lo despliega ni contrata por sí solo.** Revisa el importe en Render antes de aceptar la creación. Los discos persistentes solo están disponibles para servicios de pago, según [Render](https://render.com/docs/disks). Un servicio gratuito con SQLite local perdería las cuentas al reiniciarse o desplegarse, según [sus limitaciones](https://render.com/docs/free).

Para publicar esta configuración hay que conectar una cuenta de Render y disponer de los cambios del proyecto en el repositorio GitHub. La configuración usa:

- Comando de compilación: `python3 -m py_compile server.py`.
- Inicio: `python3 server.py --host 0.0.0.0 --port $PORT --database /var/data/accounts.sqlite3`.
- Disco montado en `/var/data`.
- Comprobación de estado: `/api/health`.
- Origen HTTPS: `RENDER_EXTERNAL_URL`, que proporciona Render. Con un dominio propio, configura `OCTAGON_PUBLIC_ORIGIN=https://tu-dominio` para que las peticiones y las cookies usen ese origen.

También puede ejecutarse en otro servidor Python detrás de un proxy HTTPS. Configura el origen público exacto con `--public-origin https://tu-dominio`, conserva la cabecera `Host` original y guarda la base de datos en un volumen permanente. El servicio sirve exclusivamente `index.html`, `assets/` y la API; no publica fuentes Python, documentación, archivos ocultos ni la base de datos.

## API

| Método y ruta | Función |
| --- | --- |
| `POST /api/auth/register` | Crea la cuenta; acepta nombre de usuario, contraseña y seguimiento inicial opcional. |
| `POST /api/auth/login` | Inicia una sesión y devuelve el seguimiento. |
| `GET /api/auth/session` | Recupera la sesión actual. |
| `POST /api/auth/logout` | Invalida la sesión actual. |
| `GET /api/me/following` | Recupera el seguimiento y su revisión. |
| `PUT /api/me/following` | Guarda una lista válida con comprobación de revisión. |
| `GET /api/health` | Estado del servidor, sin información de cuentas. |

Las contraseñas requieren al menos 12 caracteres al registrarse y se almacenan derivadas mediante scrypt con sal individual. Las sesiones usan identificadores aleatorios en cookies HttpOnly y SameSite; en el origen público HTTPS también son Secure. Las mutaciones comprueban origen y, para una sesión autenticada, un token CSRF. Los intentos de acceso se limitan por nombre de usuario y dirección de conexión. La actualización exige autenticación y siempre afecta a la cuenta de la sesión; no acepta un identificador de usuario suministrado por el cliente.

Esta primera versión no incluye verificación por correo ni recuperación de contraseña. No se envían emails. No publiques la base de datos ni sus copias.

## Verificación

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/test-account-sync.mjs
node tests/test-following.mjs
```

Las pruebas de API usan una base temporal y un puerto local efímero. Comprueban registro, acceso desde dos clientes, aislamiento, persistencia, conflictos de revisión, origen, CSRF, expiración y cierre de sesión, contraseñas derivadas, límites de intentos y protección de archivos privados.

## Nombres de usuario únicos

Las nuevas cuentas usan nombres de 3 a 24 caracteres: letras ASCII, números, guiones y guiones bajos. Se guardan en minúsculas y un índice único de SQLite impide duplicados, incluso con registros simultáneos. La contraseña sigue requiriendo al menos 12 caracteres y se almacena derivada con scrypt.

Al arrancar, el servidor migra automáticamente las cuentas antiguas: conserva su identificador, contraseña, seguimiento y sesiones. Para esas cuentas, el nombre de usuario inicial es su correo anterior; pueden usarlo en el formulario de inicio de sesión. Las cuentas nuevas no piden correo.

Los usuarios se almacenan en la tabla `users` de `accounts.sqlite3`. En Render, debe existir el disco persistente montado en `/var/data` y el comando de inicio debe usar `--database /var/data/accounts.sqlite3` para conservarlos tras reinicios y despliegues.
