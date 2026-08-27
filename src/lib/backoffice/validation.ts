import { z } from "zod";

import { DRAW_POSTURE_COUNT, WALLET_METHODS, type WithdrawalResponse } from "@/lib/gaming/types";
import type {
  AuthenticationResponse,
  BootstrapResponse,
  CatalogResponse,
  PlacePlayResult,
  PlaysResponse,
  ResultsResponse,
  SessionResponse,
  TicketResponse,
  WalletMovementsResponse,
  WalletTopUpResponse,
} from "./contracts";

const currencySchema = z.literal("PYG");
const roleSchema = z.enum(["PLAYER", "ADMIN"]);
const playFamilySchema = z.enum(["TRADITIONAL", "INSTANT"]);
const playStatusSchema = z.enum(["PENDING", "WON", "LOST", "REFUNDED"]);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const positiveMoneySchema = z.number().int().positive();
const balanceSchema = z.number().int().nonnegative();
const prizeSchema = z.number().int().nonnegative();
const signedMoneySchema = z.number().int().refine((value) => value !== 0, {
  message: "El movimiento monetario no puede ser cero.",
});
const multiplierSchema = z.number().finite().nonnegative();

const traditionalGameIdSchema = z.enum([
  "head",
  "prizes",
  "invert",
  "redoblona",
  "sapyaite-traditional",
  "megaloto",
]);

const instantGameIdSchema = z.enum([
  "sapyaite",
  "poa",
  "pyae",
  "petei",
  "mokoi",
  "mbohapy",
  "poa5",
  "poa10",
  "racha5",
]);

const gameIdSchema = z.union([traditionalGameIdSchema, instantGameIdSchema]);

const backofficeSessionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: roleSchema,
  balance: balanceSchema,
  currency: currencySchema,
});

const drawSchema = z.object({
  id: z.string(),
  label: z.string(),
  family: z.enum(["QUINIELA", "MEGALOTO"]),
  closesAt: isoDateTimeSchema,
  drawsAt: isoDateTimeSchema,
  status: z.literal("OPEN"),
});

const positionSchema = z.object({
  min: z.number().int(),
  max: z.number().int(),
});

const traditionalSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("THREE_DIGIT"),
    position: positionSchema.nullable(),
  }),
  z.object({
    kind: z.literal("REDOBLONA"),
    headDigits: z.literal(3),
    redoblonaDigits: z.literal(2),
    position: z.object({ min: z.literal(2), max: z.literal(14) }),
  }),
  z.object({
    kind: z.literal("MEGALOTO"),
    count: z.literal(6),
    min: z.literal(1),
    max: z.literal(45),
    unique: z.literal(true),
    modalities: z.tuple([z.literal("MEGA_FULL"), z.literal("MEGA_POZO")]),
  }),
]);

const traditionalGameSchema = z
  .object({
    id: traditionalGameIdSchema,
    name: z.string(),
    description: z.string(),
    iconKey: z.string(),
    drawIds: z.array(z.string()),
    selection: traditionalSelectionSchema,
  })
  .superRefine((game, context) => {
    const issue = (message: string) => context.addIssue({
      code: "custom",
      message,
      path: ["selection"],
    });

    if (game.id === "redoblona") {
      if (game.selection.kind !== "REDOBLONA") issue("Redoblona requiere su selección canónica.");
      return;
    }
    if (game.id === "megaloto") {
      if (game.selection.kind !== "MEGALOTO") issue("Megaloto requiere su selección canónica.");
      return;
    }
    if (game.selection.kind !== "THREE_DIGIT") {
      issue("La Quiniela requiere una selección de tres cifras.");
      return;
    }

    const expectedPosition = {
      head: { min: 1, max: 1 },
      prizes: { min: 2, max: 14 },
      invert: { min: 1, max: 14 },
      "sapyaite-traditional": null,
    }[game.id];
    const received = game.selection.position;
    const matches = expectedPosition === null
      ? received === null
      : received !== null &&
        received.min === expectedPosition.min &&
        received.max === expectedPosition.max;
    if (!matches) issue("La postura no coincide con la pantalla canónica del juego.");
  });

const multiplierPayoutSchema = z.object({
  prototype: z.literal(true),
  kind: z.literal("MULTIPLIER"),
  winMultiplier: multiplierSchema,
});

const matchTierPayoutSchema = z.object({
  prototype: z.literal(true),
  kind: z.literal("MATCH_TIERS"),
  tiers: z.array(
    z.object({
      exactMatches: z.number().int(),
      multiplier: multiplierSchema,
    }),
  ),
  pendingFromMatches: z.number().int().optional(),
});

const instantSelectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ENUM"), values: z.array(z.string()) }),
  z.object({
    kind: z.literal("HUNDRED_RANGE"),
    values: z.array(z.object({ value: z.string(), label: z.string() })),
  }),
  z.object({
    kind: z.literal("PADDED_INTEGER"),
    min: z.number().int(),
    max: z.number().int(),
    width: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({
    kind: z.literal("UNIQUE_THREE_DIGIT_NUMBERS"),
    count: z.literal(3),
    min: z.literal(1),
    max: z.literal(999),
  }),
]);

const instantGameSchema = z
  .object({
    id: instantGameIdSchema,
    name: z.string(),
    description: z.string(),
    iconKey: z.string(),
    engine: z.enum([
      "PARITY",
      "HUNDRED_RANGE",
      "OVER_UNDER_500",
      "LAST_DIGIT",
      "LAST_TWO_DIGITS",
      "EXACT_THREE_DIGITS",
      "MULTI_EXACT",
      "MULTI_PARITY",
    ]),
    reels: z.union([z.literal(1), z.literal(5), z.literal(10)]),
    rng: z.object({
      min: z.union([z.literal(0), z.literal(1)]),
      max: z.literal(999),
    }),
    selection: instantSelectionSchema,
    payout: z.discriminatedUnion("kind", [
      multiplierPayoutSchema,
      matchTierPayoutSchema,
    ]),
    neutral500Policy: z.enum(["REFUND", "LOSS"]).optional(),
  })
  .superRefine((game, context) => {
    const expected = {
      sapyaite: { engine: "EXACT_THREE_DIGITS", reels: 1 },
      poa: { engine: "HUNDRED_RANGE", reels: 1 },
      pyae: { engine: "OVER_UNDER_500", reels: 1 },
      petei: { engine: "LAST_DIGIT", reels: 1 },
      mokoi: { engine: "LAST_TWO_DIGITS", reels: 1 },
      mbohapy: { engine: "EXACT_THREE_DIGITS", reels: 1 },
      poa5: { engine: "MULTI_EXACT", reels: 5 },
      poa10: { engine: "MULTI_EXACT", reels: 10 },
      racha5: { engine: "MULTI_PARITY", reels: 5 },
    } as const;
    const contract = expected[game.id];
    if (game.engine !== contract.engine) {
      context.addIssue({ code: "custom", message: "Motor incompatible con la pantalla del juego.", path: ["engine"] });
    }
    if (game.reels !== contract.reels) {
      context.addIssue({ code: "custom", message: "Cantidad de rodillos incompatible con la pantalla del juego.", path: ["reels"] });
    }
    const expectedMinimum = game.id === "sapyaite" ? 0 : 1;
    if (game.rng.min !== expectedMinimum || game.rng.max !== 999) {
      context.addIssue({ code: "custom", message: "Rango incompatible con la pantalla del juego.", path: ["rng"] });
    }

    const issueSelection = () => context.addIssue({
      code: "custom",
      message: "Selección incompatible con la pantalla canónica del juego.",
      path: ["selection"],
    });
    const selection = game.selection;
    if (game.id === "racha5" || game.id === "pyae") {
      const expectedValues = game.id === "pyae"
        ? ["MENOR", "MAYOR"]
        : ["PAR", "IMPAR"];
      if (
        selection.kind !== "ENUM" ||
        selection.values.length !== expectedValues.length ||
        !expectedValues.every((value) => selection.values.includes(value))
      ) issueSelection();
      return;
    }
    if (game.id === "poa") {
      const expectedValues = [
        "001-099", "100-199", "200-299", "300-399", "400-499",
        "500-599", "600-699", "700-799", "800-899", "900-999",
      ];
      if (
        selection.kind !== "HUNDRED_RANGE" ||
        selection.values.length !== expectedValues.length ||
        !expectedValues.every((value) =>
          selection.values.some((option) => option.value === value),
        )
      ) issueSelection();
      return;
    }
    if (game.id === "poa5" || game.id === "poa10") {
      if (selection.kind !== "UNIQUE_THREE_DIGIT_NUMBERS") issueSelection();
      return;
    }
    const padded = {
      sapyaite: { min: 0, max: 999, width: 3 },
      petei: { min: 0, max: 9, width: 1 },
      mokoi: { min: 0, max: 99, width: 2 },
      mbohapy: { min: 1, max: 999, width: 3 },
    } as const;
    const expectedPadded = padded[game.id];
    if (
      selection.kind !== "PADDED_INTEGER" ||
      selection.min !== expectedPadded.min ||
      selection.max !== expectedPadded.max ||
      selection.width !== expectedPadded.width
    ) issueSelection();
  });

const gamingCatalogSchema = z.object({
  amounts: z.array(positiveMoneySchema),
  draws: z.array(drawSchema),
  traditional: z.array(traditionalGameSchema),
  instant: z.array(instantGameSchema),
});

const gamingPlaySchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  family: playFamilySchema,
  gameId: gameIdSchema,
  gameName: z.string(),
  selection: z.unknown(),
  drawId: z.string().nullable(),
  amount: positiveMoneySchema,
  currency: currencySchema,
  status: playStatusSchema,
  result: z.string().nullable(),
  resultNumbers: z.array(z.string()).nullable(),
  ruleResult: z.string().nullable(),
  matches: z.number().int().nullable(),
  payoutMultiplier: multiplierSchema,
  prize: prizeSchema,
  createdAt: isoDateTimeSchema,
});

const gamingTicketSchema = z.object({
  id: z.string(),
  code: z.string(),
  playId: z.string(),
  gameId: gameIdSchema,
  gameName: z.string(),
  family: playFamilySchema,
  selection: z.unknown(),
  drawId: z.string().nullable(),
  amount: positiveMoneySchema,
  currency: currencySchema,
  status: playStatusSchema,
  result: z.string().nullable(),
  resultNumbers: z.array(z.string()).nullable(),
  ruleResult: z.string().nullable(),
  prize: prizeSchema,
  issuedAt: isoDateTimeSchema,
});

const positionedDrawNumbersSchema = z.array(z.object({
  position: z.number().int().min(1).max(DRAW_POSTURE_COUNT),
  value: z.string().trim().regex(/^\d{1,3}$/),
})).refine(
  (numbers) => new Set(numbers.map((number) => number.position)).size === numbers.length,
  { message: "Las posturas publicadas no pueden repetirse." },
);

const gamingResultSchema = z.object({
  id: z.string(),
  source: z.enum(["DRAW", "INSTANT"]),
  gameId: gameIdSchema,
  gameName: z.string(),
  drawId: z.string().nullable(),
  result: z.string(),
  resultNumbers: z.array(z.string()),
  drawNumbers: positionedDrawNumbersSchema.optional(),
  occurredAt: isoDateTimeSchema,
});

const walletMethodSchema = z.enum(WALLET_METHODS);

const walletMovementBaseSchema = z.object({
  id: z.string(),
  type: z.enum(["TOPUP", "WITHDRAWAL", "STAKE", "PRIZE", "REFUND"]),
  amount: signedMoneySchema,
  currency: currencySchema,
  balanceAfter: balanceSchema,
  referenceId: z.string().nullable(),
  method: walletMethodSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

const walletMovementSchema = walletMovementBaseSchema.superRefine((movement, context) => {
  const debit = movement.type === "WITHDRAWAL" || movement.type === "STAKE";
  if (debit !== (movement.amount < 0)) {
    context.addIssue({
      code: "custom",
      message: "El importe no corresponde al tipo de movimiento.",
      path: ["amount"],
    });
  }
  if ((movement.type === "TOPUP" || movement.type === "WITHDRAWAL") && movement.method === null) {
    context.addIssue({
      code: "custom",
      message: "La operación debe indicar su canal.",
      path: ["method"],
    });
  }
});

const sessionResponseSchema = z.object({
  session: backofficeSessionSchema.nullable(),
});

const authenticationResponseSchema = z.object({
  session: backofficeSessionSchema,
});

const bootstrapResponseSchema = z.object({
  session: backofficeSessionSchema.nullable(),
  catalog: gamingCatalogSchema,
  plays: z.array(gamingPlaySchema),
  results: z.array(gamingResultSchema),
});

const catalogResponseSchema = z.object({ catalog: gamingCatalogSchema });

const playsResponseSchema = z.object({
  plays: z.array(gamingPlaySchema),
  nextCursor: z.string().nullable().optional(),
});

const resultsResponseSchema = z.object({
  results: z.array(gamingResultSchema),
  nextCursor: z.string().nullable().optional(),
});

const placePlayResultSchema = z
  .object({
    play: gamingPlaySchema,
    ticket: gamingTicketSchema,
    session: z.object({
      balance: balanceSchema,
      currency: currencySchema,
    }),
    replayed: z.boolean(),
  })
  .superRefine(({ play, ticket, session }, context) => {
    const coherent =
      ticket.id === play.ticketId &&
      ticket.playId === play.id &&
      ticket.gameId === play.gameId &&
      ticket.gameName === play.gameName &&
      ticket.family === play.family &&
      ticket.drawId === play.drawId &&
      ticket.amount === play.amount &&
      ticket.status === play.status &&
      ticket.result === play.result &&
      ticket.ruleResult === play.ruleResult &&
      ticket.prize === play.prize &&
      JSON.stringify(ticket.resultNumbers) === JSON.stringify(play.resultNumbers) &&
      ticket.currency === play.currency &&
      session.currency === play.currency;
    if (!coherent) {
      context.addIssue({
        code: "custom",
        message: "La jugada, el comprobante y la sesión no son coherentes.",
        path: ["ticket"],
      });
    }
  });

const placeTraditionalPlayResultSchema = placePlayResultSchema.superRefine(
  ({ play }, context) => {
    if (play.family !== "TRADITIONAL") {
      context.addIssue({
        code: "custom",
        message: "El endpoint tradicional devolvió otra familia de juego.",
        path: ["play", "family"],
      });
    }
  },
);

const placeInstantPlayResultSchema = placePlayResultSchema.superRefine(
  ({ play, ticket }, context) => {
    if (play.family !== "INSTANT") {
      context.addIssue({
        code: "custom",
        message: "El endpoint instantáneo devolvió otra familia de juego.",
        path: ["play", "family"],
      });
      return;
    }

    const expectedResults: Partial<Record<string, number>> = {
      sapyaite: 1,
      poa: 1,
      pyae: 1,
      petei: 1,
      mokoi: 1,
      mbohapy: 1,
      poa5: 5,
      poa10: 10,
      racha5: 5,
    };
    const expectedResultCount = expectedResults[play.gameId];
    const playNumbers = play.resultNumbers;
    const ticketNumbers = ticket.resultNumbers;
    const threeDigit = play.gameId === "sapyaite" ? /^\d{3}$/ : /^(?!000)\d{3}$/;
    const valid =
      expectedResultCount !== undefined &&
      play.status !== "PENDING" &&
      Boolean(play.result?.trim()) &&
      playNumbers !== null &&
      playNumbers.length === expectedResultCount &&
      playNumbers.every((value) => threeDigit.test(value)) &&
      ticketNumbers !== null &&
      ticketNumbers.length === expectedResultCount &&
      ticketNumbers.every((value, index) => value === playNumbers[index]);
    if (!valid) {
      context.addIssue({
        code: "custom",
        message: "La Instantánea no incluye un resultado autoritativo completo.",
        path: ["play", "resultNumbers"],
      });
    }
  },
);

const walletMovementsResponseSchema = z.object({
  movements: z.array(walletMovementSchema),
  nextCursor: z.string().nullable().optional(),
});

const walletTopUpResponseSchema = z
  .object({
    session: backofficeSessionSchema,
    balanceEntry: walletMovementBaseSchema.extend({
      type: z.literal("TOPUP"),
      amount: positiveMoneySchema,
      method: walletMethodSchema,
    }),
    replayed: z.boolean(),
  })
  .superRefine(({ session, balanceEntry }, context) => {
    if (
      session.currency !== balanceEntry.currency ||
      session.balance !== balanceEntry.balanceAfter
    ) {
      context.addIssue({
        code: "custom",
        message: "La recarga no coincide con el saldo de sesión devuelto.",
        path: ["balanceEntry"],
      });
    }
  });

const walletWithdrawalResponseSchema = z
  .object({
    session: backofficeSessionSchema,
    balanceEntry: walletMovementBaseSchema.extend({
      type: z.literal("WITHDRAWAL"),
      amount: z.number().int().negative(),
      method: walletMethodSchema,
    }),
    replayed: z.boolean(),
  })
  .superRefine(({ session, balanceEntry }, context) => {
    if (
      session.currency !== balanceEntry.currency ||
      session.balance !== balanceEntry.balanceAfter
    ) {
      context.addIssue({
        code: "custom",
        message: "El retiro no coincide con el saldo de sesión devuelto.",
        path: ["balanceEntry"],
      });
    }
  });

const ticketResponseSchema = z.object({ ticket: gamingTicketSchema });

export type BackofficeResponseParser<T> = (value: unknown) => T;

export const backofficeResponseParsers = {
  session: (value: unknown): SessionResponse => sessionResponseSchema.parse(value),
  authentication: (value: unknown): AuthenticationResponse =>
    authenticationResponseSchema.parse(value),
  bootstrap: (value: unknown): BootstrapResponse =>
    bootstrapResponseSchema.parse(value),
  catalog: (value: unknown): CatalogResponse => catalogResponseSchema.parse(value),
  plays: (value: unknown): PlaysResponse => playsResponseSchema.parse(value),
  results: (value: unknown): ResultsResponse => resultsResponseSchema.parse(value),
  placePlay: (value: unknown): PlacePlayResult => placePlayResultSchema.parse(value),
  placeTraditionalPlay: (value: unknown): PlacePlayResult =>
    placeTraditionalPlayResultSchema.parse(value),
  placeInstantPlay: (value: unknown): PlacePlayResult =>
    placeInstantPlayResultSchema.parse(value),
  walletMovements: (value: unknown): WalletMovementsResponse =>
    walletMovementsResponseSchema.parse(value),
  walletTopUp: (value: unknown): WalletTopUpResponse =>
    walletTopUpResponseSchema.parse(value),
  walletWithdrawal: (value: unknown): WithdrawalResponse =>
    walletWithdrawalResponseSchema.parse(value),
  ticket: (value: unknown): TicketResponse => ticketResponseSchema.parse(value),
} satisfies Record<string, BackofficeResponseParser<unknown>>;
