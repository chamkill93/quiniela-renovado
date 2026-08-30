import { z } from "zod";

import { HUNDRED_RANGE_OPTIONS, PROTOTYPE_AMOUNTS } from "./catalog";
import { WALLET_MAX_AMOUNT, WALLET_METHODS, WALLET_MIN_AMOUNT } from "./types";
import { isTraditionalStakeAmount } from "./traditional-stake";

const amountValues = new Set<number>(PROTOTYPE_AMOUNTS);
const hundredRangeValues = HUNDRED_RANGE_OPTIONS.map((option) => option.value) as [
  string,
  ...string[],
];

export const prototypeAmountSchema = z
  .number()
  .int()
  .refine((value) => amountValues.has(value), "Monto no habilitado.");

export const threeDigitSchema = z
  .string()
  .regex(/^(?!000)\d{3}$/, "Usá un número entre 001 y 999.");

export const invertNumberSchema = threeDigitSchema.refine(
  (value) => new Set(value).size === 3,
  "Las tres cifras de Invertida deben ser distintas.",
);

export const exactThreeDigitSchema = z
  .string()
  .regex(/^\d{3}$/, "Usá exactamente tres cifras entre 000 y 999.");

export const twoDigitSchema = z
  .string()
  .regex(/^\d{2}$/, "Usá dos cifras entre 00 y 99.");

export const oneDigitSchema = z
  .string()
  .regex(/^\d$/, "Usá una cifra entre 0 y 9.");

export const paritySchema = z.enum(["PAR", "IMPAR"]);
export const pyaeChoiceSchema = z.enum(["MENOR", "MAYOR"]);
export const hundredRangeSchema = z.enum(hundredRangeValues);

const threeUniqueNumbersSchema = z
  .object({ numbers: z.array(threeDigitSchema).length(3) })
  .superRefine(({ numbers }, context) => {
    if (new Set(numbers).size !== numbers.length) {
      context.addIssue({
        code: "custom",
        message: "Los tres números deben ser distintos.",
        path: ["numbers"],
      });
    }
  });

export const instantPlayRequestSchema = z.discriminatedUnion("gameId", [
  z.object({
    gameId: z.literal("sapyaite"),
    amount: prototypeAmountSchema,
    selection: exactThreeDigitSchema,
  }),
  z.object({
    gameId: z.literal("poa"),
    amount: prototypeAmountSchema,
    selection: hundredRangeSchema,
  }),
  z.object({
    gameId: z.literal("pyae"),
    amount: prototypeAmountSchema,
    selection: pyaeChoiceSchema,
  }),
  z.object({
    gameId: z.literal("petei"),
    amount: prototypeAmountSchema,
    selection: oneDigitSchema,
  }),
  z.object({
    gameId: z.literal("mokoi"),
    amount: prototypeAmountSchema,
    selection: twoDigitSchema,
  }),
  z.object({
    gameId: z.literal("mbohapy"),
    amount: prototypeAmountSchema,
    selection: threeDigitSchema,
  }),
  z.object({
    gameId: z.literal("poa5"),
    amount: prototypeAmountSchema,
    selection: threeUniqueNumbersSchema,
  }),
  z.object({
    gameId: z.literal("poa10"),
    amount: prototypeAmountSchema,
    selection: threeUniqueNumbersSchema,
  }),
  z.object({
    gameId: z.literal("racha5"),
    amount: prototypeAmountSchema,
    selection: paritySchema,
  }),
]);

const drawIdSchema = z.string().trim().min(1).max(80);
const traditionalStakeSchema = z.number().refine(
  isTraditionalStakeAmount,
  "El importe por sorteo debe ser múltiplo de Gs. 500 y no superar Gs. 10.000.",
);

export const traditionalPlayRequestSchema = z.discriminatedUnion("gameId", [
  z.object({
    gameId: z.literal("head"),
    amount: traditionalStakeSchema,
    drawId: drawIdSchema,
    selection: z.object({ number: threeDigitSchema }),
  }),
  z.object({
    gameId: z.literal("prizes"),
    amount: traditionalStakeSchema,
    drawId: drawIdSchema,
    selection: z.object({
      number: threeDigitSchema,
      position: z.number().int().min(2).max(14),
    }),
  }),
  z.object({
    gameId: z.literal("invert"),
    amount: traditionalStakeSchema,
    drawId: drawIdSchema,
    selection: z.object({
      number: invertNumberSchema,
      position: z.number().int().min(1).max(14),
    }),
  }),
  z.object({
    gameId: z.literal("redoblona"),
    amount: traditionalStakeSchema,
    drawId: drawIdSchema,
    selection: z.object({
      initialNumber: twoDigitSchema,
      initialUntil: z.number().int().min(1).max(14),
      redoblonaNumber: twoDigitSchema,
      redoblonaUntil: z.number().int().min(7).max(14),
    }).strict().superRefine(({ initialUntil, redoblonaUntil }, context) => {
      if (redoblonaUntil < initialUntil) {
        context.addIssue({
          code: "custom",
          message: "El alcance de Redoblona debe ser igual o mayor al alcance inicial.",
          path: ["redoblonaUntil"],
        });
      }
    }),
  }),
  z.object({
    gameId: z.literal("sapyaite-traditional"),
    amount: prototypeAmountSchema,
    drawId: drawIdSchema,
    selection: z.object({ number: threeDigitSchema }),
  }),
  z.object({
    gameId: z.literal("megaloto"),
    amount: prototypeAmountSchema,
    drawId: drawIdSchema,
    selection: z
      .object({
        numbers: z.array(z.number().int().min(1).max(45)).length(6),
        modality: z.enum(["MEGA_FULL", "MEGA_POZO"]).default("MEGA_FULL"),
      })
      .superRefine(({ numbers }, context) => {
        if (new Set(numbers).size !== numbers.length) {
          context.addIssue({
            code: "custom",
            message: "Los seis números de Megaloto deben ser distintos.",
            path: ["numbers"],
          });
        }
      }),
  }),
]);

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key debe tener al menos 8 caracteres.")
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Idempotency-Key contiene caracteres inválidos.");

export const mockLoginRequestSchema = z.object({
  documentOrPhone: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(128),
});

export const walletAmountSchema = z
  .number({ error: "Ingresá un monto válido." })
  .int("Ingresá un monto entero en guaraníes.")
  .min(WALLET_MIN_AMOUNT, "El monto mínimo es Gs. 10.000.")
  .max(WALLET_MAX_AMOUNT, "El monto máximo por operación es Gs. 5.000.000.");

export const walletMethodSchema = z.enum(WALLET_METHODS, {
  error: "Seleccioná un canal disponible.",
});

// These operations only need an amount and channel; no payment credentials are accepted.
export const walletTopupRequestSchema = z.object({
  amount: walletAmountSchema,
  method: walletMethodSchema,
}).strict();

export const walletWithdrawalRequestSchema = walletTopupRequestSchema;

export type InstantPlayRequest = z.infer<typeof instantPlayRequestSchema>;
export type TraditionalPlayRequest = z.infer<typeof traditionalPlayRequestSchema>;
export type MockLoginRequest = z.infer<typeof mockLoginRequestSchema>;
export type WalletTopupRequest = z.infer<typeof walletTopupRequestSchema>;
export type WalletWithdrawalRequest = z.infer<typeof walletWithdrawalRequestSchema>;
