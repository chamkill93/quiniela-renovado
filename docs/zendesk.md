# Call center de Zendesk

El botón de auriculares de la barra superior abre un panel de atención con la identidad de quinie.LA. No hay botón flotante adicional. El panel se adapta a pantalla completa en móviles, permite cerrar con Escape o el botón de cierre y devuelve el foco al acceso superior.

Zendesk Messaging se carga al primer clic y se monta usando su API oficial `render` en modo `embedded`. La conversación permanece montada al cerrar para conservar su estado. La cabecera nativa se oculta mediante `customization`; la cabecera de Quiniela usa el logo del proyecto. El contenido y los mensajes de agentes siguen viniendo de Zendesk: el saludo y el nombre del agente se administran en el canal de Quiniela.

`src/lib/zendesk-config.ts` contiene la clave pública del snippet facilitado por el propietario. `NEXT_PUBLIC_ZENDESK_WIDGET_KEY` permite reemplazarla; un valor vacío la deshabilita. No es un secreto de API. La CSP usa la misma configuración y permite los recursos del widget. Los cambios requieren un build nuevo en producción.

Si la carga falla, el panel ofrece reintento y enlace a `/ayuda`. No se simulan agentes ni mensajes.

Referencias: [API y modo embedded](https://developer.zendesk.com/api-reference/widget-messaging/web/core/), [CSP](https://developer.zendesk.com/documentation/zendesk-web-widget-sdks/sdks/web/csp/).
