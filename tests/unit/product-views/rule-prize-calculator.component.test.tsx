// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RulePrizeCalculator } from "@/features/product/rule-prize-calculator";
import { selectEnabledGameRules } from "@/features/product/rules-page-data";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const enabled = selectEnabledGameRules(buildGamingCatalog("REFUND", new Date("2026-08-27T12:00:00Z"), ["sapyaite"]));
const rules = [...enabled.traditional, ...enabled.instant];
afterEach(cleanup);
const choose = (id: string) => fireEvent.change(screen.getByLabelText("Juego"), { target: { value: id } });
const amount = (value: string) => fireEvent.change(screen.getByLabelText("Importe (Gs.)"), { target: { value } });

describe("RulePrizeCalculator", () => {
  it("shows total, net, and a reference disclaimer without registering a play", () => {
    render(<RulePrizeCalculator rules={rules} />);
    expect(screen.getByTestId("estimate-total").textContent).toBe("Gs. 350.000");
    expect(screen.getByTestId("estimate-net").textContent).toBe("Gs. 349.500");
    expect(screen.getByText(/no es una tarifa confirmada/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    amount("1000");
    expect(screen.getByTestId("estimate-total").textContent).toBe("Gs. 700.000");
    choose("prizes");
    expect((screen.getByLabelText("Importe (Gs.)") as HTMLInputElement).value).toBe("1000");
    expect(screen.getByTestId("estimate-total").textContent).toBe("Gs. 350.000");
  });
  it("updates posture and distinct permutations and resets game-specific inputs", () => {
    render(<RulePrizeCalculator rules={rules} />);
    choose("invert");
    expect(screen.getByText(/6 combinaciones/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tus tres cifras"), { target: { value: "111" } });
    expect(screen.getByText(/1 combinación/)).toBeTruthy();
    expect(screen.getByTestId("estimate-total").textContent).toBe("Gs. 350.000");
    choose("redoblona");
    fireEvent.change(screen.getByLabelText("Postura"), { target: { value: "10" } });
    expect(screen.getByTestId("estimate-total").textContent).toBe("Gs. 2.800.000");
    choose("sapyaite");
    expect(screen.queryByLabelText("Postura")).toBeNull();
    expect(screen.getByText(/multiplicador actual/)).toBeTruthy();
    expect(screen.getByTestId("estimate-total").textContent).toBe("Gs. 350.000");
  });
  it.each(["", "-500", "1.5", "1e3", "abc", "0", "1000000001"])("does not silently turn %s into a valid stake", (value) => {
    render(<RulePrizeCalculator rules={rules} />);
    amount(value);
    expect(screen.getByRole("status").textContent).toContain("Revisá el importe");
    expect(screen.queryByTestId("estimate-total")).toBeNull();
    amount("500");
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("removes a disabled selected game from the calculator", () => {
    const { rerender } = render(<RulePrizeCalculator rules={rules} />);
    choose("sapyaite");
    rerender(<RulePrizeCalculator rules={enabled.traditional} />);
    expect(screen.queryByRole("option", { name: "Sapy’aite" })).toBeNull();
    expect((screen.getByLabelText("Juego") as HTMLSelectElement).value).toBe("head");
    rerender(<RulePrizeCalculator rules={[]} />);
    expect(screen.queryByTestId("prize-calculator")).toBeNull();
  });
});
