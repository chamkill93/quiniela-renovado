// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HelpClient } from "@/features/product/help-client";
import { HELP_QUESTIONS, filterHelpQuestions } from "@/features/product/help-data";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const expectedDestinations: Record<string, string> = {
  jugar: "/quinielas",
  modalidades: "/reglas",
  cabeza: "/quinielas/head",
  premios: "/quinielas/prizes",
  invertida: "/quinielas/invert",
  redoblona: "/quinielas/redoblona",
  sapyaite: "/quinielas/sapyaite",
  numeros: "/reglas",
  postura: "/reglas",
  sorteos: "/",
  resultados: "/resultados",
  comprobante: "/mis-jugadas",
  "premio-plazo": "/mis-jugadas",
};

const forbiddenPublicReferences =
  /\bpdf\b|\barchivos?\b|\bdocumentos?\b|\bfuentes?\b|\breglamento\b|\binteligencia artificial\b|\bia\b|\bart[ií]culos?\b|\bp[aá]ginas?\b|\bdemo(?:straci[oó]n)?\b|\bmock\b|cuenta de prueba/i;

function question(id: string) {
  return HELP_QUESTIONS.find((item) => item.id === id)!;
}

function faqRegion() {
  return screen.getByRole("region", { name: "Preguntas frecuentes" });
}

function faqDetails() {
  return Array.from(faqRegion().querySelectorAll("details"));
}

function summaryFor(id: string) {
  return within(faqRegion()).getByText(question(id).question).closest("summary")!;
}

function renderedQuestions() {
  return faqDetails().map((detail) => detail.querySelector("summary")?.textContent);
}

describe("quiniela help data", () => {
  it("defines 13 unique and complete questions with relevant internal destinations", () => {
    expect(HELP_QUESTIONS).toHaveLength(13);
    expect(new Set(HELP_QUESTIONS.map((item) => item.id)).size).toBe(13);
    expect(new Set(HELP_QUESTIONS.map((item) => item.question)).size).toBe(13);
    expect(HELP_QUESTIONS.map((item) => item.id)).toEqual(Object.keys(expectedDestinations));
    expect(HELP_QUESTIONS.every((item) => !Object.hasOwn(item, "category"))).toBe(true);

    for (const item of HELP_QUESTIONS) {
      expect(item.question.trim()).not.toBe("");
      expect(item.answer.trim()).not.toBe("");
      expect(item.linkLabel.trim()).not.toBe("");
      expect(item.href).toBe(expectedDestinations[item.id]);
    }
  });

  it("keeps all questions for an empty or whitespace-only search", () => {
    expect(filterHelpQuestions("")).toEqual(HELP_QUESTIONS);
    expect(filterHelpQuestions(" \t\n ")).toEqual(HELP_QUESTIONS);
  });

  it.each([
    { query: "  PERMUTACIÓN  ", ids: ["invertida"] },
    { query: "COMBINÁ DOS NÚMEROS", ids: ["redoblona"] },
    { query: "ceros   izquierda", ids: ["numeros"] },
    { query: "CÓDIGO seguridad", ids: ["comprobante"] },
    { query: "sesenta HÁBILES", ids: ["premio-plazo"] },
    { query: "primera exacta", ids: ["cabeza"] },
  ])("normalizes accents, case and spacing for '$query'", ({ query: search, ids }) => {
    expect(filterHelpQuestions(search).map((item) => item.id)).toEqual(ids);
  });

  it("requires every search term to match the same question", () => {
    expect(filterHelpQuestions("seguridad sesenta")).toEqual([]);
    expect(filterHelpQuestions("dos números inicial").map((item) => item.id)).toEqual(["redoblona"]);
  });

  it("describes the five available Quiniela modalities", () => {
    expect(question("modalidades").answer).toMatch(/A la Cabeza/);
    expect(question("modalidades").answer).toMatch(/A los Premios/);
    expect(question("modalidades").answer).toMatch(/Invertida/);
    expect(question("modalidades").answer).toMatch(/Redoblona/);
    expect(question("modalidades").answer).toMatch(/Sapy’aite/);
  });

  it("documents the traditional ranges and postures without confusing 000 rules", () => {
    expect(question("cabeza").answer).toMatch(/001 y 999/);
    expect(question("cabeza").answer).toMatch(/primera posición/);
    expect(question("cabeza").answer).toMatch(/El 000 no es válido/);
    expect(question("premios").answer).toMatch(/001 y 999/);
    expect(question("premios").answer).toMatch(/postura de 2 a 14/);
    expect(question("postura").answer).toMatch(/posición 1 es A la Cabeza/);
    expect(question("postura").answer).toMatch(/A los Premios permite elegir de la 2 a la 14/);
    expect(question("postura").answer).toMatch(/Invertida de la 1 a la 14/);
    expect(question("sapyaite").answer).toMatch(/000 y 999/);
  });

  it("requires three different digits and exactly six unique orders for Invertida", () => {
    expect(question("invertida").answer).toMatch(/tres cifras distintas/);
    expect(question("invertida").answer).toMatch(/seis órdenes/);
    expect(question("invertida").answer).not.toMatch(/repet|tres órdenes|un orden|iguales/i);
  });

  it("defines both Redoblona ranges and the relation between them", () => {
    expect(question("redoblona").answer).toMatch(/dos números de dos cifras, de 00 a 99/);
    expect(question("redoblona").answer).toMatch(/alcance inicial va de Cabeza a 14/);
    expect(question("redoblona").answer).toMatch(/segundo alcance va de 7 a 14/);
    expect(question("redoblona").answer).toMatch(/igual o mayor al inicial/);
  });

  it("requires a receipt and security code and states the 60-business-day claim period", () => {
    expect(question("comprobante").answer).toMatch(/comprobante respalda la jugada registrada/);
    expect(question("comprobante").answer).toMatch(/código de seguridad/);
    expect(question("comprobante").answer).toMatch(/debés conservarlo/);
    expect(question("premio-plazo").answer).toMatch(/hasta 60 días hábiles después del sorteo/);
    expect(question("premio-plazo").answer).toMatch(/Conservá el comprobante/);
  });

  it("does not expose document, AI or preview vocabulary", () => {
    expect(JSON.stringify(HELP_QUESTIONS)).not.toMatch(forbiddenPublicReferences);
  });
});

describe("HelpClient", () => {
  it("renders the back arrow, labeled search and 13 collapsed FAQs without topic controls", () => {
    const { container } = render(<HelpClient />);

    expect(screen.getByRole("heading", { name: "Centro de ayuda", level: 1 })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver atrás" }).getAttribute("href")).toBe("/");
    const searchRegion = screen.getByRole("region", { name: "Buscar ayuda sobre la quiniela" });
    expect(within(searchRegion).getByRole("searchbox", { name: "¿Sobre qué tenés dudas?" })).toBeTruthy();
    expect(renderedQuestions()).toEqual(HELP_QUESTIONS.map((item) => item.question));
    expect(faqDetails()).toHaveLength(13);
    expect(faqDetails().every((detail) => !detail.open)).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("13 respuestas");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).toBeNull();

    expect(screen.queryByRole("group", { name: "Temas de ayuda" })).toBeNull();
    for (const oldTopic of ["Todas", "Cómo jugar", "Sorteos y resultados", "Mis jugadas", "Saldo y cuenta"]) {
      expect(screen.queryByRole("button", { name: oldTopic })).toBeNull();
    }
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("link", { name: "Reglas de la quiniela" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Juego responsable" })).toBeNull();

    for (const detail of faqDetails()) {
      const answer = detail.querySelector("summary + div")!;
      expect(Array.from(answer.children).map((child) => child.tagName)).toEqual(["P", "A"]);
    }
    expect(container.textContent).not.toMatch(forbiddenPublicReferences);
  });

  it("returns to the previous screen when browser history is available", async () => {
    const user = userEvent.setup();
    const browserBack = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    window.history.pushState({}, "", "/ayuda");
    render(<HelpClient />);

    await user.click(screen.getByRole("link", { name: "Volver atrás" }));

    expect(browserBack).toHaveBeenCalledOnce();
  });

  it("searches uppercase accented terms, updates the count and keeps input focus", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const input = screen.getByRole("searchbox", { name: "¿Sobre qué tenés dudas?" });

    await user.type(input, "  PERMUTACIÓN  ");

    expect(renderedQuestions()).toEqual([question("invertida").question]);
    expect(screen.getByRole("status").textContent).toBe("1 respuesta");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "Limpiar búsqueda" })).toBeTruthy();
  });

  it("clears a search and restores every question", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;

    await user.type(input, "código seguridad");
    expect(renderedQuestions()).toEqual([question("comprobante").question]);
    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));

    expect(input.value).toBe("");
    expect(faqDetails()).toHaveLength(13);
    expect(screen.getByRole("status").textContent).toBe("13 respuestas");
    expect(screen.queryByRole("button", { name: "Limpiar búsqueda" })).toBeNull();
  });

  it("shows the empty state and resets the search from Ver todas las preguntas", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;

    await user.type(input, "consulta-inexistente");
    expect(screen.getByRole("heading", { name: "No encontramos esa consulta", level: 3 })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("0 respuestas");
    expect(faqDetails()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Ver todas las preguntas" }));

    expect(input.value).toBe("");
    expect(faqDetails()).toHaveLength(13);
    expect(screen.getByRole("status").textContent).toBe("13 respuestas");
    expect(screen.queryByRole("heading", { name: "No encontramos esa consulta" })).toBeNull();
  });

  it("opens every answer with its relevant destination", () => {
    render(<HelpClient />);

    for (const item of HELP_QUESTIONS) {
      const trigger = summaryFor(item.id);
      const disclosure = trigger.closest("details")!;
      fireEvent.click(trigger);
      expect(disclosure.open).toBe(true);
      expect(within(disclosure).getByText(item.answer)).toBeTruthy();
      expect(within(disclosure).getByRole("link", { name: item.linkLabel }).getAttribute("href"))
        .toBe(expectedDestinations[item.id]);
    }
  });

  it("keeps multiple answers independent when they are opened and closed", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const first = summaryFor("jugar");
    const second = summaryFor("modalidades");

    await user.click(first);
    await user.click(second);
    expect(first.closest("details")!.open).toBe(true);
    expect(second.closest("details")!.open).toBe(true);
    await user.click(first);
    expect(first.closest("details")!.open).toBe(false);
    expect(second.closest("details")!.open).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it("tabs from Volver atrás to search, the first summary and its expanded link", async () => {
    const user = userEvent.setup();
    render(<HelpClient />);
    const back = screen.getByRole("link", { name: "Volver atrás" });
    const search = screen.getByRole("searchbox");
    const first = summaryFor("jugar");

    await user.tab();
    expect(document.activeElement).toBe(back);
    await user.tab();
    expect(document.activeElement).toBe(search);
    await user.tab();
    expect(document.activeElement).toBe(first);

    // user-event does not synthesize the browser's native summary activation.
    fireEvent.click(first);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Elegir una modalidad" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(first);
  });
});
