// Public widget identifier from the installation snippet, not an API secret.
// An explicitly empty environment value disables Zendesk.
export const zendeskWidgetKey = (
  process.env.NEXT_PUBLIC_ZENDESK_WIDGET_KEY ?? "b75542d1-8b17-41ff-991e-9a2fb54da55b"
).trim();
