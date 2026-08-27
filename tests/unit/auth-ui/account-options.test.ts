import { describe, expect, it } from "vitest";
import { ACCOUNT_WHATSAPP_MESSAGE, accountWhatsAppUrl, validateAccountLimits } from "@/features/product/account-options";

describe("accountWhatsAppUrl", () => {
  it.each(["595981123456", "+595981123456", " +595 (981) 123-456 "])("normalizes the configured international number: %s", (number) => {
    const url = new URL(accountWhatsAppUrl(number)!);
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/595981123456");
    expect(url.searchParams.get("text")).toBe(ACCOUNT_WHATSAPP_MESSAGE);
    expect(url.searchParams.size).toBe(1);
  });

  it.each([undefined, "", "   ", "123", "0981123456", "5951234567890123", "https://wa.me/595981123456", "javascript:alert(1)", "595981123456?text=secret", "595981123456#other", "595+981123456", "595981123456 ext 2", "+", "５９５９８１１２３４５６"])("rejects an absent or unsafe destination: %s", (number) => {
    expect(accountWhatsAppUrl(number)).toBeNull();
  });
});

describe("validateAccountLimits", () => {
  const valid = { daily: "50000", weekly: "200000", minutes: "60" };

  it("accepts whole positive amounts and the available durations", () => {
    for (const minutes of ["15", "30", "60", "120"]) {
      expect(validateAccountLimits({ ...valid, minutes })).toEqual({});
    }
  });

  it.each(["", " ", "0", "-1000", "12.5", "1e5", "50000Gs", "NaN", "Infinity", "9007199254740992"])("rejects invalid daily and weekly amounts: %s", (amount) => {
    expect(validateAccountLimits({ ...valid, daily: amount }).daily).toBeTruthy();
    expect(validateAccountLimits({ ...valid, weekly: amount }).weekly).toBeTruthy();
  });

  it("rejects a weekly amount below its daily amount", () => {
    expect(validateAccountLimits({ ...valid, daily: "250000" }).weekly).toContain("menor al diario");
    expect(validateAccountLimits({ ...valid, weekly: "50000" })).toEqual({});
  });

  it.each(["0", "-30", "45", "60.5", "forever"])("rejects an unsupported duration: %s", (minutes) => {
    expect(validateAccountLimits({ ...valid, minutes }).minutes).toBeTruthy();
  });
});
