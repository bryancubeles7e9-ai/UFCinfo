# Publicidad en UFCinfo

La integración está preparada, pero desactivada: no se incluyen identificadores de ejemplo en producción, no se muestran huecos vacíos y no se conecta con Google. No se han creado una cuenta ni una solicitud de aprobación de AdSense.

## Activación por el titular

1. Añadir `ufcinfo.onrender.com` en la cuenta de AdSense. Obtener el identificador público `ca-pub-` seguido de 16 cifras y ponerlo en `client` de `assets/data/adsense.json`. No es una contraseña: nunca facilitar claves de acceso ni credenciales.
2. Publicar esa configuración. El servidor añade la etiqueta `google-adsense-account` y sirve `/ads.txt` con el editor real. Sin identificador válido, la etiqueta no aparece y `/ads.txt` devuelve 404. La verificación de propiedad no implica aprobación para mostrar anuncios.
3. Crear dos bloques adaptables de display y copiar sus `data-ad-slot` de 10 cifras en `slots.home` y `slots.events`. Están situados después del resumen de Inicio y al final de Carteleras. No se insertan anuncios en los diálogos, las fichas ni Pick’em. Desactivar los anuncios automáticos desde AdSense si se quieren mantener únicamente estas dos ubicaciones.
4. Configurar una CMP certificada por Google compatible con TCF v2 en la cuenta. Instalar el fragmento oficial de la CMP antes del módulo `adsense-init.js`, incluidos sus controles para modificar o retirar el consentimiento. El módulo no sustituye a una CMP y no fabrica decisiones de consentimiento. Marcar `certifiedCmpReady: true` solo tras verificar esa instalación.
5. Publicar la información de privacidad/cookies con los datos reales del responsable, los usos publicitarios y el mecanismo de gestión de consentimiento. Indicar su ruta local en `privacyUrl`, por ejemplo `/privacidad.html`; debe existir y el servidor debe autorizar expresamente esa ruta si se añade fuera de `/assets/`. Revisar los permisos de uso de imágenes y contenido al monetizar. La integración técnica no acredita el cumplimiento de políticas ni garantiza la aprobación de Google.
6. Tras aprobación, comprobar el consentimiento y activar `enabled: true`. Son necesarios el editor, ambos bloques, CMP y ruta de privacidad. Sin la configuración completa, la publicidad permanece oculta. Consultar las condiciones vigentes en la cuenta antes de activar: no se han podido recuperar sus documentos actuales durante esta implementación.

## Comportamiento

- Solo se descarga inicialmente la configuración local. Sin CMP o con consentimiento desconocido/denegado no se carga AdSense, ni siquiera para anuncios no personalizados.
- Cuando aplica GDPR, el módulo espera una decisión TCF cargada, cadena de consentimiento, autorización del proveedor Google (755) y consentimiento para las finalidades 1, 3 y 4. Es un filtro conservador; Google sigue interpretando la señal completa de la CMP. Si la CMP declara que GDPR no aplica, permite solicitar anuncios.
- Los bloques se solicitan al aproximarse a la zona visible, con espacio reservado para el creativo adaptable. No se repiten al navegar entre secciones. No se modifican contenidos publicitarios ni se anima su entrada. No se debe clicar en anuncios propios durante las comprobaciones.
- Si el usuario retira un permiso necesario tras cargar Google, se ocultan los bloques y se recarga la página para eliminar el script ejecutado. Esta recarga puede interrumpir cambios todavía no guardados: los controles de la CMP deben comunicarlo.
- Un fallo de red o un bloqueador de anuncios oculta los espacios publicitarios sin bloquear la web. Para detener nuevas solicitudes, poner `enabled: false`; las visitas ya abiertas necesitan recargarse para aplicar la configuración.
- Los cambios visuales/código por `push` ya no consultan Cito. Las ejecuciones manuales/programadas conservan su comportamiento.

## Pruebas sin publicidad real

`node tests/test-adsense.mjs` y `python3 -m unittest discover -s tests -p 'test_adsense.py'` usan dobles locales, nunca llaman a Google ni a proveedores de pago.
