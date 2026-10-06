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

El catálogo propone Carlos Contreras Legaspi y Álvaro Colmenero en español; Damon Martin, Mike Heck y Guilherme Cruz para publicaciones en inglés. El idioma efectivo de cada post se guarda por separado. Las cuentas se pueden editar en `sources` después de revisar su identidad. El respaldo de los nombres y cuentas procede de:

- Carlos Contreras Legaspi: https://www.milenio.com/opinion/carlos-contreras-legaspi/asi-lo-vivimos/el-ufc-junto-a-la-nfl-nba-o-mlb y https://www.sherdog.com/news/news/Former-topranked-womens-bantamweight-UFC-title-challenger-retires-from-MMA-201959
- Álvaro Colmenero: https://www.linkedin.com/company/kolmenero y https://x.com/KOlmeneroMMA (la cuenta aparece también en resultados indexados; debe revisarse antes de importar un post).
- Damon Martin: https://www.mmafighting.com/authors/damon-martin
- Mike Heck: https://www.mmafighting.com/authors/mike-heck
- Guilherme Cruz: https://www.mmafighting.com/authors/guilherme-cruz

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
