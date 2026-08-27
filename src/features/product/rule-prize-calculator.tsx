"use client";

import { useState } from "react";
import { formatGs } from "@/lib/product/catalog";
import type { EnabledRuleGameCard } from "./rules-page-data";
import { estimatePrize, formatMultiplier, MAX_ESTIMATE_AMOUNT, uniqueThreeDigitPermutations } from "./prize-estimate";
import styles from "./rules.module.css";

export function RulePrizeCalculator({ rules }: { rules: readonly EnabledRuleGameCard[] }) {
  const [gameId, setGameId] = useState("");
  const [amount, setAmount] = useState("500");
  const rule = rules.find((item) => item.id === gameId) ?? rules[0];
  if (!rule) return null;
  return (
    <section aria-labelledby="prize-calculator-title" className={styles.calculator} data-testid="prize-calculator">
      <header>
        <h2 id="prize-calculator-title">Calculadora rápida</h2>
        <p>Probá un importe y mirá cuánto podrías cobrar si acertás.</p>
      </header>
      <label className={styles.calculatorField} htmlFor="estimate-game">
        Juego
        <select id="estimate-game" onChange={(event) => setGameId(event.target.value)} value={rule.id}>
          {rules.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <CalculatorFields amount={amount} key={rule.id} onAmountChange={setAmount} rule={rule} />
    </section>
  );
}

function CalculatorFields({ rule, amount, onAmountChange }: {
  rule: EnabledRuleGameCard;
  amount: string;
  onAmountChange: (value: string) => void;
}) {
  const calculation = rule.payout.calculation;
  const [position, setPosition] = useState("minPosition" in calculation ? calculation.minPosition : 1);
  const [number, setNumber] = useState("123");
  const [matches, setMatches] = useState(calculation.kind === "TIERS" ? calculation.tiers[0]?.exactMatches ?? 0 : 0);
  const numericAmount = /^\d+$/.test(amount.trim()) ? Number(amount) : NaN;
  const estimate = estimatePrize(calculation, { amount: numericAmount, position, number, matches });
  const hasPosition = "minPosition" in calculation;
  const amountInvalid = !Number.isSafeInteger(numericAmount) || numericAmount < 1 || numericAmount > MAX_ESTIMATE_AMOUNT;
  const numberInvalid = calculation.kind === "PERMUTATIONS" && uniqueThreeDigitPermutations(number) === null;

  return (
    <>
      <div className={styles.calculatorFields}>
        <label className={styles.calculatorField} htmlFor="estimate-amount">
          Importe (Gs.)
          <input
            aria-describedby={amountInvalid ? "estimate-error" : undefined}
            aria-invalid={amountInvalid || undefined}
            id="estimate-amount" inputMode="numeric" maxLength={10}
            onChange={(event) => onAmountChange(event.target.value)} type="text" value={amount}
          />
        </label>
        {hasPosition ? (
          <label className={styles.calculatorField} htmlFor="estimate-position">
            Postura
            <select id="estimate-position" onChange={(event) => setPosition(Number(event.target.value))} value={position}>
              {Array.from({ length: calculation.maxPosition - calculation.minPosition + 1 }, (_, index) => calculation.minPosition + index)
                .map((value) => <option key={value} value={value}>{value === 1 ? "A la cabeza" : `Hasta el ${value}º`}</option>)}
            </select>
          </label>
        ) : null}
        {calculation.kind === "PERMUTATIONS" ? (
          <label className={styles.calculatorField} htmlFor="estimate-number">
            Tus tres cifras
            <input aria-describedby={numberInvalid ? "estimate-error" : undefined} aria-invalid={numberInvalid || undefined} id="estimate-number" inputMode="numeric" maxLength={3} onChange={(event) => setNumber(event.target.value)} type="text" value={number} />
          </label>
        ) : null}
        {calculation.kind === "TIERS" ? (
          <label className={styles.calculatorField} htmlFor="estimate-matches">
            Aciertos
            <select id="estimate-matches" onChange={(event) => setMatches(Number(event.target.value))} value={matches}>
              {calculation.tiers.map((tier) => <option key={tier.exactMatches} value={tier.exactMatches}>{tier.exactMatches}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <div aria-atomic="true" aria-live="polite" className={styles.estimateResult}>
        {estimate ? (
          <>
            <p className={styles.estimateRate}>
              {rule.payout.reference ? "Referencia" : "Multiplicador"}: {formatMultiplier(estimate.multiplier)}×
              {estimate.combinations ? ` · ${estimate.combinations} ${estimate.combinations === 1 ? "combinación" : "combinaciones"}` : ""}
            </p>
            <dl className={styles.estimateAmounts}>
              <div><dt>Premio total estimado</dt><dd data-testid="estimate-total">{formatGs(estimate.total)}</dd></div>
              <div><dt>Ganancia neta estimada</dt><dd data-testid="estimate-net">{formatGs(estimate.net)}</dd></div>
            </dl>
            <p>La ganancia neta es el premio total menos tu importe.</p>
          </>
        ) : (
          <p id="estimate-error" role="status">
            {amountInvalid ? "Revisá el importe (de 1 a 1.000.000.000 Gs.)." : numberInvalid ? "Ingresá tus tres cifras, de 001 a 999." : "No hay una estimación para esta selección."}
          </p>
        )}
      </div>
      <p className={styles.estimateDisclaimer}>
        {rule.payout.reference ? "Cálculo orientativo por un acierto; no es una tarifa confirmada." : "Estimación si acertás, con el multiplicador actual."}
        {" "}No registra jugadas ni garantiza ganancias. Importes sin fracciones de guaraní.
      </p>
    </>
  );
}
