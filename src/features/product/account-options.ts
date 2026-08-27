export const ACCOUNT_WHATSAPP_MESSAGE = "Hola, necesito ayuda con mi cuenta de quinie.LA.";

/** Only an explicitly configured international number may become a contact link. */
export function accountWhatsAppUrl(value: string | undefined): string | null {
  const input = value?.trim();
  if (!input || !/^\+?[\d ()-]+$/.test(input)) return null;
  const number = input.replace(/[+ ()-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(number)) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(ACCOUNT_WHATSAPP_MESSAGE)}`;
}

export interface AccountLimitFields {
  daily: string;
  weekly: string;
  minutes: string;
}

export function validateAccountLimits(fields: AccountLimitFields) {
  const errors: Partial<Record<keyof AccountLimitFields, string>> = {};
  const isAmount = (value: string) => /^\d+$/.test(value.trim())
    && Number.isSafeInteger(Number(value)) && Number(value) > 0;

  if (!isAmount(fields.daily)) errors.daily = "Ingresá un importe entero mayor a cero.";
  if (!isAmount(fields.weekly)) errors.weekly = "Ingresá un importe entero mayor a cero.";
  if (!errors.daily && !errors.weekly && Number(fields.weekly) < Number(fields.daily)) {
    errors.weekly = "El importe semanal no puede ser menor al diario.";
  }
  if (!["15", "30", "60", "120"].includes(fields.minutes)) {
    errors.minutes = "Elegí uno de los tiempos disponibles.";
  }
  return errors;
}
