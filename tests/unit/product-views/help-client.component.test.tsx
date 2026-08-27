// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { HelpClient } from "@/features/product/help-client";
import { HELP_CATEGORIES, HELP_QUESTIONS, filterHelpQuestions, type HelpCategory } from "@/features/product/help-data";

afterEach(cleanup);

const categories = [
  { category: "Cómo jugar", ids: ["jugar", "modalidades", "invertida", "redoblona", "numeros", "sapyaite"] },
  { category: "Sorteos y resultados", ids: ["sorteos", "resultados"] },
  { category: "Mis jugadas", ids: ["comprobante", "pendiente", "rechazo"] },
  { category: "Saldo y cuenta", ids: ["saldo", "autolimites"] },
] as const;

const destinations: Record<string, string> = {
  jugar: "/quinielas", modalidades: "/reglas", invertida: "/quinielas/invert",
  redoblona: "/quinielas/redoblona", numeros: "/reglas", sapyaite: "/quinielas/sapyaite",
  sorteos: "/", resultados: "/resultados", comprobante: "/mis-jugadas",
  pendiente: "/mis-jugadas", rechazo: "/mis-jugadas", saldo: "/saldos", autolimites: "/cuenta",
};

function region() {
  return screen.getByRole("region", { name: "Preguntas frecuentes" });
}
function details() {
  return Array.from(region().querySelectorAll("details"));
}
function summary(id: string) {
  const item = HELP_QUESTIONS.find((question) => question.id === id)!;
  return within(region()).getByText(item.question).closest("summary")!;
}
function labels(ids: readonly string[]) {
  return ids.map((id) => HELP_QUESTIONS.find((item) => item.id === id)!.question);
}
function visibleQuestions() {
  return details().map((item) => item.querySelector("summary")?.textContent);
}

describe("quiniela help data", () => {
  it("defines 13 unique, complete questions with known categories and relevant destinations", () => {
    expect(HELP_QUESTIONS).toHaveLength(13);
    expect(new Set(HELP_QUESTIONS.map((item) => item.id)).size).toBe(13);
    expect(new Set(HELP_QUESTIONS.map((item) => item.question)).size).toBe(13);
    expect(HELP_CATEGORIES).toEqual(["Todas", "Cómo jugar", "Sorteos y resultados", "Mis jugadas", "Saldo y cuenta"]);
    expect(HELP_QUESTIONS.map((item) => item.id)).toEqual(Object.keys(destinations));
    for (const item of HELP_QUESTIONS) {
      expect(HELP_CATEGORIES.slice(1)).toContain(item.category);
      expect(item.question.trim()).not.toBe("");
      expect(item.answer.trim()).not.toBe("");
      expect(item.linkLabel.trim()).not.toBe("");
      expect(item.href).toBe(destinations[item.id]);
    }
    expect(JSON.stringify(HELP_QUESTIONS)).not.toMatch(/cuenta de prueba|\bdemo\b|\bmock\b/i);
  });

  it("retains all questions for an empty or whitespace query", () => {
    expect(filterHelpQuestions("", "Todas")).toEqual(HELP_QUESTIONS);
    expect(filterHelpQuestions(" \t\n ", "Todas")).toEqual(HELP_QUESTIONS);
  });

  it.each(categories)("returns only questions in $category", ({ category, ids }) => {
    expect(filterHelpQuestions("", category).map((item) => item.id)).toEqual(ids);
  });

  it.each([
    { query: "  INVERTÍDA  ", category: "Todas", ids: ["invertida"] },
    { query: "COMBINAS TERMINACIÓN", category: "Cómo jugar", ids: ["redoblona"] },
    { query: "ceros   izquierda", category: "Todas", ids: ["numeros"] },
    { query: "saldo cuenta", category: "Todas", ids: ["saldo", "autolimites"] },
    { query: "COMPROBANTE código", category: "Mis jugadas", ids: ["comprobante", "pendiente"] },
    { query: "recargas", category: "Mis jugadas", ids: [] },
  ] satisfies { query: string; category: HelpCategory; ids: string[] }[])(
    "matches every normalized term in '$query' within $category",
    ({ query, category, ids }) => {
      expect(filterHelpQuestions(query, category).map((item) => item.id)).toEqual(ids);
    },
  );
});

describe("HelpClient", () => {
  it("labels search, topics and the FAQ and starts with 13 collapsed answers", () => {
    const { container } = render(<HelpClient />);
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Centro de ayuda", level: 1 })).toBeTruthy();
    const searchRegion = screen.getByRole("region", { name: "Buscar ayuda sobre la quiniela" });
    expect(within(searchRegion).getByRole("searchbox", { name: "¿Sobre qué tenés dudas?" })).toBeTruthy();
    const topics = within(screen.getByRole("group", { name: "Temas de ayuda" }));
    expect(topics.getAllByRole("button").map((button) => button.textContent)).toEqual(HELP_CATEGORIES);
    expect(topics.getByRole("button", { pressed: true }).textContent).toBe("Todas");
    expect(visibleQuestions()).toEqual(HELP_QUESTIONS.map((item) => item.question));
    expect(details().every((item) => !item.open)).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("13 respuestas");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).toBeNull();
    expect(container.textContent).not.toMatch(/cuenta de prueba|\bdemo\b|\bmock\b/i);
  });

  it.each(categories)("filters $category and restores all questions with Todas", ({ category, ids }) => {
    render(<HelpClient />);
    const topics = within(screen.getByRole("group", { name: "Temas de ayuda" }));
    fireEvent.click(topics.getByRole("button", { name: category }));
    expect(topics.getByRole("button", { pressed: true }).textContent).toBe(category);
    expect(visibleQuestions()).toEqual(labels(ids));
    expect(screen.getByRole("status").textContent).toBe(`${ids.length} respuestas`);
    fireEvent.click(topics.getByRole("button", { name: "Todas" }));
    expect(topics.getByRole("button", { pressed: true }).textContent).toBe("Todas");
    expect(details()).toHaveLength(13);
  });

  it("searches uppercase and accented words, retaining input focus and a singular count", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const input = screen.getByRole("searchbox", { name: "¿Sobre qué tenés dudas?" });
    await user.type(input, "  NÚMEROS   ELEGIR ");
    expect(visibleQuestions()).toEqual(labels(["numeros"]));
    expect(screen.getByRole("status").textContent).toBe("1 respuesta");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "Limpiar búsqueda" })).toBeTruthy();
  });

  it("combines query and topic, and clears only the query with the search clear button", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.click(screen.getByRole("button", { name: "Mis jugadas" }));
    await user.type(input, "CÓDIGO");
    expect(visibleQuestions()).toEqual(labels(["comprobante", "pendiente"]));
    await user.click(screen.getByRole("button", { name: "Cómo jugar" }));
    expect(screen.getByRole("status").textContent).toBe("0 respuestas");
    expect(details()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(input.value).toBe("");
    expect(screen.getByRole("button", { pressed: true }).textContent).toBe("Cómo jugar");
    expect(visibleQuestions()).toEqual(labels(categories[0].ids));
    expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).toBeNull();
  });

  it("shows an empty state and resets both the query and topic from Ver todas las preguntas", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    await user.click(screen.getByRole("button", { name: "Saldo y cuenta" }));
    await user.type(input, "consulta-inexistente");
    expect(screen.getByRole("heading", { name: "No encontramos esa consulta", level: 3 })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("0 respuestas");
    expect(details()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Ver todas las preguntas" }));
    expect(input.value).toBe("");
    expect(screen.getByRole("button", { pressed: true }).textContent).toBe("Todas");
    expect(details()).toHaveLength(13);
    expect(screen.getByRole("status").textContent).toBe("13 respuestas");
    expect(screen.queryByRole("heading", { name: "No encontramos esa consulta" })).toBeNull();
  });

  it("opens the answer and relevant route for every question and retains support and legal links", () => {
    render(<HelpClient />);
    for (const item of HELP_QUESTIONS) {
      const trigger = summary(item.id);
      const disclosure = trigger.closest("details")!;
      fireEvent.click(trigger);
      expect(disclosure.open).toBe(true);
      expect(within(disclosure).getByText(item.answer)).toBeTruthy();
      expect(within(disclosure).getByRole("link", { name: item.linkLabel }).getAttribute("href"))
        .toBe(destinations[item.id]);
    }
    const support = within(screen.getByRole("complementary"));
    expect(support.getByRole("link", { name: "Ir a mi cuenta" }).getAttribute("href")).toBe("/cuenta");
    expect(screen.getByRole("link", { name: "Reglas de la quiniela" }).getAttribute("href")).toBe("/reglas");
    expect(screen.getByRole("link", { name: "Juego responsable" }).getAttribute("href")).toBe("/legal/juego-responsable");
  });

  it("keeps answers independent when opening and closing more than one question", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const first = summary("jugar");
    const second = summary("modalidades");
    await user.click(first);
    await user.click(second);
    expect(first.closest("details")!.open).toBe(true);
    expect(second.closest("details")!.open).toBe(true);
    await user.click(first);
    expect(first.closest("details")!.open).toBe(false);
    expect(second.closest("details")!.open).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it("provides keyboard tab navigation through search, topics, summaries and expanded answer links", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    for (const category of HELP_CATEGORIES) {
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole("button", { name: category }));
    }
    await user.tab();
    const first = summary("jugar");
    expect(document.activeElement).toBe(first);
    // user-event 14 does not synthesize native summary activation from Enter/Space.
    // Change the disclosure state with a native click, then verify its tab order.
    fireEvent.click(first);
    expect(first.closest("details")!.open).toBe(true);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Elegir una modalidad" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    expect(first.closest("details")!.open).toBe(false);
    // JSDOM/user-event checks CSS visibility but does not hide descendants of a
    // closed native details element. Its closed-state tab order needs a browser.
  });
});
