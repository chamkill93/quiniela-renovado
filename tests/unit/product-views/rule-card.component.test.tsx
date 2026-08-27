// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { RuleCard } from "@/features/product/rule-card";
import { selectEnabledGameRules } from "@/features/product/rules-page-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

afterEach(cleanup);
const rules = selectEnabledGameRules(buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"), ["sapyaite"]));

describe("RuleCard", () => {
  it("empieza contraída y mantiene el premio resumido y Jugar visibles", () => {
    render(<RuleCard rule={rules.traditional[0]} />);
    const button = screen.getByRole("button", { name: "Ver reglas de A la Cabeza" });
    const detail = document.getElementById(button.getAttribute("aria-controls")!)!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(detail.hidden).toBe(true);
    expect(screen.getByText("700× el importe")).toBeTruthy();
    expect(screen.getByText("Multiplicador de referencia")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Jugar A la Cabeza" }).getAttribute("href")).toBe("/quinielas/head");
    expect(screen.queryByRole("heading", { name: "Premio" })).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(detail.hidden).toBe(false);
    expect(screen.getByRole("heading", { name: "Premio" })).toBeTruthy();
    fireEvent.click(button);
    expect(detail.hidden).toBe(true);
  });

  it("permite abrir y cerrar con teclado sin navegar al juego", async () => {
    const user = userEvent.setup();
    render(<RuleCard rule={rules.traditional[2]} />);
    const button = screen.getByRole("button", { name: "Ver reglas de Invertida" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await user.keyboard(" ");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("mantiene aperturas independientes y describe la selección actual sin avisos largos", () => {
    render(<><RuleCard rule={rules.traditional[0]} /><RuleCard rule={rules.traditional[3]} /></>);
    const head = screen.getByRole("button", { name: "Ver reglas de A la Cabeza" });
    const double = screen.getByRole("button", { name: "Ver reglas de Redoblona" });
    fireEvent.click(double);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(double.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Elegí el número de cabeza y la terminación de dos cifras.")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(head.getAttribute("aria-controls")).not.toBe(double.getAttribute("aria-controls"));
    expect(screen.getByRole("link", { name: "Jugar Redoblona" }).closest("button")).toBeNull();
  });

  it("muestra el multiplicador de Sapy’aite y un único ejemplo al expandir", () => {
    render(<RuleCard rule={rules.instant[0]} />);
    expect(screen.getByText("700× el importe")).toBeTruthy();
    expect(screen.getByText(/Como A la Cabeza, pero instantáneo/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver reglas de Sapy’aite" }));
    expect(screen.getByText("Si acertás con Gs. 500, el premio total es Gs. 350.000.")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Jugar Sapy’aite" }).getAttribute("href")).toBe("/quinielas/sapyaite");
  });

  it("no conserva citas ni advertencias documentales, tampoco en detalles ocultos", () => {
    const { container } = render(<>{[...rules.traditional, ...rules.instant].map((rule) => <RuleCard key={rule.id} rule={rule} />)}</>);
    expect(container.textContent).not.toMatch(/pdf|art[ií]culo|reglamento|vista previa|formulario actual|backoffice|proveedor|codexa/i);
  });
});
