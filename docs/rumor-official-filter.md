# Confirmaciones oficiales de rumores

La recopilación automática admite runrún, retos y propuestas sin fecha. Antes de publicar, `sync-rumor-confirmations.py` consulta las páginas de eventos en UFC.com. UFCalendar y `assets/data/ufc-events.json` solo localizan los eventos: por sí solos no confirman un rumor.

Los dos nombres deben aparecer dentro del mismo combate de la página oficial. La hora se obtiene del horario de cartelera principal o del esquema de evento en UFC.com; si aún está por anunciar, se usa la fecha del catálogo únicamente para limitar la cronología. Esa fecha por sí sola nunca confirma los luchadores. El evento debe ser posterior a la publicación; una fecha explícita del rumor debe coincidir con la fecha oficial (tolerancia de un día por zona horaria). Así se evita usar una pelea anterior para confirmar una revancha. Se incluyen eventos numerados y Fight Nights. Los grupos confirmados se retiran del feed de rumores; los antiguos rumores manuales conservan su marca `official`.

Se consultan como máximo 24 páginas oficiales por ejecución, con caché dentro de esa ejecución y un timeout de 10 segundos por página. Si UFC.com no responde o el HTML no permite comprobar el combate, se conserva el grupo sin confirmar. Los registros muestran las páginas comprobadas, las no disponibles y los grupos retirados.

La comprobación se ejecuta tras la recopilación horaria y también al actualizar el catálogo de eventos o el comprobador. El workflow de confirmaciones se puede lanzar manualmente sin consultar TwitterAPI.io. Ambos workflows comparten el bloqueo de concurrencia y solicitan un despliegue en Render cuando modifican los datos publicados.

Pruebas: `python3 tests/test_rumor_confirmations.py`.
