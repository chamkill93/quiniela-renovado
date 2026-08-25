import { z } from "zod";

import { HUNDRED_RANGE_OPTIONS, PROTOTYPE_AMOUNTS } from "./catalog";

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
    selection: paritySchema,
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

export const traditionalPlayRequestSchema = z.discriminatedUnion("gameId", [
  z.object({
    gameId: z.literal("head"),
    amount: prototypeAmountSchema,
    drawId: drawIdSchema,
    selection: z.object({ number: threeDigitSchema }),
  }),
  z.object({
    gameId: z.literal("prizes"),
    amount: prototypeAmountSchema,
    drawId: drawIdSchema,
    selection: z.object({
      number: threeDigitSchema,
      position: z.number().int().min(2).max(14),
    }),
  }),
  z.object({
    gameId: z.literal("invert"),
    amount: prototypeAmountSchema,
    drawId: drawIdSchema,
    selection: z.object({
      number: threeDigitSchema,
      position: z.number().int().min(1).max(14),
    }),
  }),
  z.object({
    gameId: z.literal("redoblona"),
    amount: prototypeAmountSchema,
    drawId: drawIdSchema,
    selection: z.object({
      head: threeDigitSchema,
      redoblona: twoDigitSchema,
      position: z.number().int().min(2).max(14),
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

export const walletTopupRequestSchema = z.object({
  amount: z.union([
    z.literal(20_000),
    z.literal(50_000),
    z.literal(100_000),
    z.literal(200_000),
  ]),
  method: z.enum(["CARD", "BANK_TRANSFER", "CASH_POINT", "PUNTO_RECARGA"]),
});

export type InstantPlayRequest = z.infer<typeof instantPlayRequestSchema>;
export type TraditionalPlayRequest = z.infer<typeof traditionalPlayRequestSchema>;
export type MockLoginRequest = z.infer<typeof mockLoginRequestSchema>;
export type WalletTopupRequest = z.infer<typeof walletTopupRequestSchema>;
