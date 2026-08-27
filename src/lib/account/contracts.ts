import { z } from "zod";
import type { MockSession } from "@/lib/product/api-types";

export const accountLimitsSchema = z.object({
  daily: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  weekly: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  minutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]),
}).refine((limits) => limits.weekly >= limits.daily, {
  message: "El importe semanal no puede ser menor al diario.", path: ["weekly"],
});

export const accountProfileSchema = z.object({ displayName: z.string().trim().min(2).max(80) });
export const accountPauseSchema = z.object({ durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]) });
export const accountSettingsSchema = z.object({
  sessionId: z.string().min(1),
  scope: z.literal("session"),
  sessionStartedAt: z.string().datetime(),
  limits: accountLimitsSchema.nullable(),
  pausedUntil: z.string().datetime().nullable(),
  usage: z.object({
    daily: z.number().nonnegative().finite(),
    weekly: z.number().nonnegative().finite(),
    minutes: z.number().nonnegative().finite(),
  }),
});
export const accountSettingsResponseSchema = z.object({ settings: accountSettingsSchema });

export type AccountLimits = z.infer<typeof accountLimitsSchema>;
export type AccountProfileInput = z.infer<typeof accountProfileSchema>;
export type AccountPauseInput = z.infer<typeof accountPauseSchema>;
export type AccountSettings = z.infer<typeof accountSettingsSchema>;

export interface AccountRequestOptions { signal?: AbortSignal; idempotencyKey?: string; expectedSessionId?: string }

/** Optional account capability. External services must explicitly implement it. */
export interface AccountGateway {
  getSettings(options?: AccountRequestOptions): Promise<AccountSettings>;
  saveLimits(input: AccountLimits, options?: AccountRequestOptions): Promise<AccountSettings>;
  pause(input: AccountPauseInput, options?: AccountRequestOptions): Promise<AccountSettings>;
  updateProfile(input: AccountProfileInput, options?: AccountRequestOptions): Promise<MockSession>;
}
