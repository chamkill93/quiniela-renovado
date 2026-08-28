// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { RuleCard } from "@/features/product/rule-card";
import {
  ALL_GAME_RULES, INSTANT_RULES, MEGA_LOTO_RULE, TRADITIONAL_RULES,
} from "@/features/product/rules-page-data";
import { MEGA_LOTO_LOGO, MEGA_LOTO_URL } from "@/features/product/product-links";

afterEach(cleanup);

function detailsFor(button: HTMLElement) {
  const id = button.getAttribute("aria-controls");
  expect(id).toBeTruthy();
  const detail = document.getElementById(id!);
  expect(detail).not.toBeNull();
  return detail!;
}

describe("RuleCard", () => {
  it("starts collapsed with two selection facts and the canonical Jugar link, without payout content", () => {
    const rule = TRADITIONAL_RULES[0];
    const { container } = render(<RuleCard rule={rule} />);
    const card = screen.getByRole("article", { name: rule.title });
    const button = within(card).getByRole("button", { name: "Ver reglas de A la Cabeza" });
    const detail = detailsFor(button);

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toBe("Ver reglas");
    expect(detail.hidden).toBe(true);
    expect(Array.from(card.querySelectorAll("dt"), (element) => element.textContent))
      .toEqual(rule.facts.map((fact) => fact.label));
    expect(Array.from(card.querySelectorAll("dd"), (element) => element.textContent))
      .toEqual(rule.facts.map((fact) => fact.value));
    for (const fact of rule.facts) expect(within(card).getByText(fact.value, { exact: true })).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Jugar A la Cabeza" }).getAttribute("href"))
      .toBe("/quinielas/head");
    expect(within(card).queryByRole("heading", { name: "Paso a paso" })).toBeNull();
    expect(container.textContent).not.toMatch(/×|multiplicador|cuánto paga|premio total|tabla de pagos|\bGs\./i);

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.textContent).toBe("Ver menos");
    expect(detail.hidden).toBe(false);
    for (const name of ["Paso a paso", "Condiciones del acierto", "Ejemplo"]) {
      expect(within(card).getByRole("heading", { name, level: 3 })).toBeTruthy();
    }
    expect(within(card).queryByRole("heading", { name: "Premio" })).toBeNull();

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.textContent).toBe("Ver reglas");
    expect(detail.hidden).toBe(true);
    expect(within(card).queryByRole("heading", { name: "Paso a paso" })).toBeNull();
  });

  it.each(ALL_GAME_RULES.map((rule) => [rule.title, rule] as const))(
    "renders all steps, conditions and exactly one example for %s after expansion",
    (_title, rule) => {
      render(<RuleCard rule={rule} />);
      const card = screen.getByTestId("rule-card-" + rule.id);
      const button = within(card).getByRole("button", { name: "Ver reglas de " + rule.title });
      fireEvent.click(button);
      const detail = detailsFor(button);
      const instructions = within(detail).getByRole("heading", { name: "Paso a paso" })
        .closest("section")!;
      const conditions = within(detail).getByRole("heading", { name: "Condiciones del acierto" })
        .closest("section")!;
      const example = within(detail).getByRole("heading", { name: "Ejemplo" })
        .closest("section")!;

      expect(within(instructions).getAllByRole("listitem").map((item) => item.textContent))
        .toEqual(rule.instructions);
      expect(within(conditions).getAllByRole("listitem").map((item) => item.textContent))
        .toEqual(rule.conditions);
      expect(instructions.querySelector("ol")).not.toBeNull();
      expect(conditions.querySelector("ul")).not.toBeNull();
      expect(rule.instructions.length).toBeGreaterThanOrEqual(4);
      expect(rule.conditions.length).toBeGreaterThanOrEqual(3);
      expect(within(example).getAllByText(rule.example, { exact: true })).toHaveLength(1);
      expect(detail.querySelector("table, input, select, textarea")).toBeNull();
    },
  );

  it("opens and closes with Enter and Space without navigating away or losing focus", async () => {
    const user = userEvent.setup();
    render(<RuleCard rule={TRADITIONAL_RULES[2]} />);
    const button = screen.getByRole("button", { name: "Ver reglas de Invertida" });
    const initialUrl = window.location.href;
    button.focus();

    await user.keyboard("{Enter}");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(detailsFor(button).hidden).toBe(false);
    await user.keyboard(" ");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(detailsFor(button).hidden).toBe(true);
    expect(document.activeElement).toBe(button);
    expect(window.location.href).toBe(initialUrl);
  });

  it("keeps different card expansions independent with unique controls and non-nested game links", () => {
    render(<><RuleCard rule={TRADITIONAL_RULES[0]} /><RuleCard rule={TRADITIONAL_RULES[3]} /></>);
    const head = screen.getByRole("button", { name: "Ver reglas de A la Cabeza" });
    const double = screen.getByRole("button", { name: "Ver reglas de Redoblona" });
    fireEvent.click(double);

    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(double.getAttribute("aria-expanded")).toBe("true");
    expect(detailsFor(head).hidden).toBe(true);
    expect(detailsFor(double).hidden).toBe(false);
    expect(head.getAttribute("aria-controls")).not.toBe(double.getAttribute("aria-controls"));
    expect(screen.getAllByRole("listitem")).toHaveLength(
      TRADITIONAL_RULES[3].instructions.length + TRADITIONAL_RULES[3].conditions.length,
    );
    const link = screen.getByRole("link", { name: "Jugar Redoblona" });
    expect(link.getAttribute("href")).toBe("/quinielas/redoblona");
    expect(link.closest("button")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("explains Sapy’aite without comparing it to another game or presenting financial examples", () => {
    render(<RuleCard rule={INSTANT_RULES[0]} />);
    const card = screen.getByTestId("rule-card-sapyaite");
    expect(within(card).getByText("000 a 999", { exact: true })).toBeTruthy();
    expect(card.textContent).not.toMatch(/A la Cabeza|×|multiplicador|premio total|\bGs\./i);
    fireEvent.click(within(card).getByRole("button", { name: "Ver reglas de Sapy’aite" }));
    expect(within(card).getAllByText(INSTANT_RULES[0].example, { exact: true })).toHaveLength(1);
    expect(within(card).getByRole("link", { name: "Jugar Sapy’aite" }).getAttribute("href"))
      .toBe("/quinielas/sapyaite");
  });

  it("uses the real Mega Loto logo and a safe official external link instead of a local Jugar action", () => {
    render(<RuleCard rule={MEGA_LOTO_RULE} />);
    const card = screen.getByTestId("rule-card-megaloto");
    const logo = card.querySelector("img");
    expect(logo).not.toBeNull();
    expect(decodeURIComponent(logo!.getAttribute("src")!)).toContain(MEGA_LOTO_LOGO);
    const link = within(card).getByRole("link", { name: /^Sitio oficial de Mega Loto/ });
    expect(link.textContent).toContain("Sitio oficial");
    expect(link.getAttribute("href")).toBe(MEGA_LOTO_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")?.split(/\s+/)).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    expect(link.closest("button")).toBeNull();
    expect(within(card).queryByRole("link", { name: /Jugar/i })).toBeNull();
    expect(card.querySelector('a[href="/quinielas/megaloto"]')).toBeNull();
    expect(card.textContent).toMatch(/(?:6|seis) números distintos/i);
    expect(card.textContent).toMatch(/1 al 40/);
  });

  it("contains no payout or implementation content and no cross-game comparisons, including collapsed details", () => {
    const { container } = render(<>{ALL_GAME_RULES.map((rule) => <RuleCard key={rule.id} rule={rule} />)}</>);
    expect(container.textContent).not.toMatch(/×|multiplicador|cuánto paga|calculadora|premio total|tabla de pagos|\bGs\./i);
    expect(container.textContent).not.toMatch(/pdf|art[ií]culo|reglamento|vista previa|formulario actual|backoffice|proveedor|codexa/i);
    for (const rule of ALL_GAME_RULES) {
      const text = screen.getByTestId("rule-card-" + rule.id).textContent;
      if (rule.id !== "head") expect(text).not.toMatch(/A la Cabeza/i);
      if (rule.id !== "sapyaite") expect(text).not.toMatch(/Sapy[’']?aite/i);
    }
  });
});
