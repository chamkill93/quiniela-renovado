// Public widget identifier from the installation snippet, not an API secret.
// An explicitly empty environment value disables Zendesk.
export const zendeskWidgetKey = (
  process.env.NEXT_PUBLIC_ZENDESK_WIDGET_KEY ?? "915f7219-4f3f-4fbf-81b0-f08221ccfa7e"
).trim();
