# Rumores y confirmaciones oficiales

## Estado: incompleta · pendiente de retomar

Trabajo aplazado por decisión del usuario el 6 de octubre de 2026. No activar la automatización como parte de otras tareas.

Pendiente para retomar:

- Implementar la consulta automática de X y configurar credenciales y presupuesto.
- Revisar las cuentas elegidas y el criterio para identificar rumores con su fuente original.
- Validar la comprobación con carteleras oficiales reales y activar su ejecución periódica.
- Verificar el despliegue y las actualizaciones de principio a fin.

La interfaz está preparada, el catálogo no contiene rumores y la automatización permanece desactivada.

La vista `#rumores` carga `assets/data/ufc-rumors.json`. Cada reporte identifica al periodista, su cuenta de X, el enlace al post original y la fecha. Los resúmenes en español e inglés son paráfrasis revisadas; el cambio de idioma no modifica las fuentes. Las tarjetas enlazan a las fichas de los luchadores. Los textos que pueden revelar resultados quedan ocultos con el modo sin spoilers.

## Estado inicial y fuentes

El catálogo incluye las fuentes seleccionadas por el usuario: Carlos Contreras Legaspi, Álvaro Colmenero, Eric Alexander, MMA Sin Límites, MMA Latinoamérica, UPFRONT MMA y Pelunaton. El idioma efectivo de cada post se guarda por separado. Las cuentas se pueden editar en `sources` después de revisar su identidad. El respaldo de los nombres y cuentas procede de:

- Carlos Contreras Legaspi: https://www.milenio.com/opinion/carlos-contreras-legaspi/asi-lo-vivimos/el-ufc-junto-a-la-nfl-nba-o-mlb y https://www.sherdog.com/news/news/Former-topranked-womens-bantamweight-UFC-title-challenger-retires-from-MMA-201959
- Álvaro Colmenero: https://www.linkedin.com/company/kolmenero y https://x.com/KOlmeneroMMA (la cuenta aparece también en resultados indexados; debe revisarse antes de importar un post).
- Eric Alexander: https://podcasts.apple.com/es/podcast/conexi%C3%B3n-mma/id1500775085 (su podcast enlaza a `ericaiexander`, con una «i» en lugar de la «l»).
- MMA Sin Límites: https://x.com/MMASINLIMITES y https://linktr.ee/mmasinlimites.
- MMA Latinoamérica: https://x.com/ClubDeLasMMA (cuenta con ese nombre; distinta de `MMALatinAmerica`).
- UPFRONT MMA: https://x.com/upfrontmma y https://upfrontmma.com.
- Pelunaton: https://x.com/pelunaton (perfil confirmado por el usuario).

La lista identifica fuentes propuestas; no afirma que la web ya esté leyendo sus cuentas. No se incluye ningún rumor de ejemplo en producción: hacen falta posts reales revisados. No hay publicaciones ni confirmaciones inventadas.

## Publicar un reporte revisado

Leer el post original y comprobar autor, contexto, fecha y luchadores. Distinguir una información sobre negociaciones de una opinión, un deseo de un luchador o una noticia ya oficial. Después ejecutar:

```bash
python3 scripts/add-rumor.py --help
```

El comando requiere `--source` (ID de la fuente), `--post` (enlace al post original), `--fighters` (dos IDs del catálogo), `--summary-es` y `--summary-en` (paráfrasis breves). `--language` indica el idioma efectivo si difiere del habitual del periodista; `--event` identifica el evento UFC cuando el periodista lo menciona.

La fecha se calcula a partir del ID de X. Se rechazan URL de otros autores, fuentes desconocidas, duplicados y luchadores inválidos. El comando no obtiene ni verifica el texto del post: esa revisión corresponde a quien lo publica. `--no-spoilers` se utiliza solo después de comprobar que ambos resúmenes no contienen resultados. Sin esa opción, los resúmenes quedan ocultos por defecto.

La publicación es compartida cuando se sube el JSON a GitHub y se despliega el sitio; no se guardan los reportes en las cuentas personales.

## Confirmación automática

```bash
python3 scripts/sync-rumor-confirmations.py
```

El proceso usa los eventos disponibles como candidatos, pero **no confirma una pelea por una noticia de terceros**. Descarga la página exacta de `https://www.ufc.com/event/ufc-N`, comprueba que los dos nombres aparecen como esquinas del mismo combate y lee la fecha del evento de la página oficial. Si el reporte especifica un evento, solo se comprueba ese. Un combate anterior al post no confirma una posible revancha futura.

Una verificación positiva añade `official` al reporte con URL, evento, fecha y hora de comprobación. La tarjeta pasa a «Confirmado por UFC» conservando el periodista y el post original. Si hay un bloqueo HTTP, error de conexión, cambio en el HTML o datos ambiguos, se conserva la confirmación anterior sin inventar una nueva. No se usa la mera presencia de ambos nombres en cualquier lugar de la página.

Las confirmaciones guardadas documentan que se verificó un anuncio; no garantizan que la pelea siga programada ni detectan por sí solas cancelaciones posteriores. La UI muestra la fecha de la comprobación. El catálogo actual de eventos limita el alcance a las carteleras disponibles; anuncios en redes de UFC o eventos que no estén en ese catálogo requieren revisión o una ampliación de fuentes.

La tarea `.github/workflows/rumor-confirmations.yml` está preparada para ejecutarse aproximadamente cada 15 minutos cuando se active la variable del repositorio `UFCINFO_RUMORS_AUTO_ENABLED=true`. Por defecto está desactivada. Se puede lanzar manualmente con `workflow_dispatch`. GitHub Actions puede retrasar ejecuciones; **no garantiza actualización instantánea**. La web consulta el JSON cada minuto mientras está visible, al entrar en Rumores y al volver a la pestaña. Actualizar GitHub no garantiza actualizar un alojamiento independiente: su despliegue también debe estar conectado.

## Lectura automática desde X

No está activa ni implementada en esta primera versión. La API oficial permite filtrar por autor e idioma, pero requiere acceso y créditos de pago. Antes de activarla hay que definir las cuentas, la frecuencia, el presupuesto y el proceso de revisión. Las credenciales deben quedarse en secretos del servidor o de GitHub Actions, nunca en JavaScript ni en el JSON público.

Documentación: https://docs.x.com/x-api/posts/search/introduction y https://docs.x.com/x-api/getting-started/pricing.

## Pruebas

```bash
node tests/test-rumors.mjs
python3 -m unittest discover -s tests -p 'test_rumor*.py'
```

## Prueba limitada con TwitterAPI.io

Se ha preparado `scripts/test-twitterapi.py`. No activa tareas periódicas ni modifica el catálogo público. Por defecto muestra la consulta sin contactar con el proveedor.

1. Crear una cuenta en https://twitterapi.io/ y obtener la API key desde su panel. Comprobar el saldo y las tarifas antes de ejecutar.
2. Guardar únicamente la clave en `.octagon-data/twitterapi.key` (carpeta excluida de Git y no servida por la web), con permisos privados. También se acepta la variable de entorno `TWITTERAPI_IO_KEY`. No añadir la clave al código ni enviarla por chat.
3. Previsualizar: `python3 scripts/test-twitterapi.py`.
4. Ejecutar una consulta: `python3 scripts/test-twitterapi.py --fetch`.

Se consulta a todas las fuentes seleccionadas del catálogo durante las últimas 24 horas, filtrando términos de negociaciones o combates y excluyendo respuestas y retuits. Se puede limitar la prueba a algunas fuentes con `--source kolmenero --source mma-sin-limites` y una ventana de 1 a 168 horas con `--hours`.

La búsqueda usa el endpoint Advanced Search, `queryType=Latest`, `since_time` y `until_time`. Solo pide la primera página, documentada con hasta 20 publicaciones. No solicita páginas siguientes ni reintenta errores. El coste depende de los resultados devueltos y de las tarifas del proveedor, no solo de los candidatos retenidos; un resultado vacío también puede tener cargo mínimo. La prueba no garantiza encontrar todos los rumores.

Los candidatos se guardan en `.octagon-data/twitterapi-candidates.json`; cada ejecución reemplaza el informe de prueba anterior. No se publican automáticamente ni se afirma que sean reportes revisados. Para publicar un candidato, leer la fuente, identificar los luchadores y redactar los resúmenes con `scripts/add-rumor.py`. La lectura automática periódica, la clasificación y los feeds de medios quedan pendientes de esta prueba real.

Documentación del proveedor: https://docs.twitterapi.io/api-reference/endpoint/tweet_advanced_search
