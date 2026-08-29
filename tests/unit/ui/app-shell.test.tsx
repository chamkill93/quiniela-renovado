// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { ProductFrame } from "@/features/product/product-frame";
import { buildGamingCatalog } from "@/lib/gaming/catalog";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/providers/product-provider", () => ({ useProduct: useProductMock }));

beforeEach(() => {
  useProductMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AppShell navigation", () => {
  it("replaces mobile Quiniela with Reglas and keeps Jugar in the center", () => {
    render(<AppShell><main>Inicio</main></AppShell>);
    expect(useProductMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("draw-live-indicator")).toBeNull();
    const navigation = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
    const links = navigation.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "Inicio", "Reglas", "Jugar", "Resultados", "Cuenta",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/", "/reglas", "/quinielas", "/resultados", "/cuenta",
    ]);
    expect(navigation.getByRole("link", { name: "Reglas" }).querySelector("svg path")).not.toBeNull();
    expect(navigation.queryByRole("link", { name: /Quiniela/i })).toBeNull();
  });

  it("marks Reglas as active only on the rules page", () => {
    const { rerender } = render(<AppShell currentPath="/reglas"><main>Reglas</main></AppShell>);
    const navigation = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
    expect(navigation.getAllByRole("link", { current: "page" })).toEqual([
      navigation.getByRole("link", { name: "Reglas" }),
    ]);

    rerender(<AppShell currentPath="/quinielas"><main>Quinielas</main></AppShell>);
    expect(navigation.getByRole("link", { name: "Reglas" }).getAttribute("aria-current")).toBeNull();
    expect(navigation.getByRole("link", { name: "Jugar" }).getAttribute("href")).toBe("/quinielas");
  });

  it("preserves both Quinielas and Reglas in the desktop sidebar", () => {
    render(<AppShell currentPath="/quinielas/sapyaite"><main>Sapy’aite</main></AppShell>);
    const navigation = within(screen.getByRole("navigation", { name: "Navegación principal" }));
    const quinielas = navigation.getByRole("link", { name: "Quinielas" });
    expect(quinielas.getAttribute("href")).toBe("/quinielas");
    expect(quinielas.getAttribute("aria-current")).toBe("page");
    expect(navigation.getByRole("link", { name: "Reglas" }).getAttribute("href")).toBe("/reglas");
  });

  it("keeps the footer logo and links without repeating the Paraguay tagline", () => {
    render(<AppShell><main>Quiniela online · Paraguay</main></AppShell>);
    const footer = within(screen.getByRole("navigation", { name: "Información y ayuda" }).closest("footer")!);

    expect(footer.getByRole("img", { name: "quinie.LA" })).toBeTruthy();
    expect(footer.queryByText("Quiniela online · Paraguay")).toBeNull();
    expect(footer.getAllByRole("link")).toHaveLength(5);
    expect(within(screen.getByRole("main")).getByText("Quiniela online · Paraguay")).toBeTruthy();
  });
});

describe("ProductFrame LIVE status", () => {
  const drawsAt = Date.parse("2026-08-28T13:30:00.000Z");
  const catalog = buildGamingCatalog("REFUND", new Date(drawsAt - 60 * 60_000));
  const product = { catalog, gatewayMode: "preview", session: null };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(drawsAt - 10 * 60_000 - 1_000);
    useProductMock.mockReturnValue(product);
  });

  function mountFrame() {
    return render(<ProductFrame><main>Inicio</main></ProductFrame>);
  }

  function expectLiveState(active: boolean) {
    const indicator = screen.getByRole("status", { name: "Estado LIVE del sorteo" });
    expect(indicator.getAttribute("data-active")).toBe(String(active));
    expect(indicator.getAttribute("data-draw-id")).toBe(active ? "early" : null);
    const message = active ? "Sorteo en horario LIVE: Tempranero" : "Fuera del horario LIVE";
    expect(within(indicator).getByText(message).classList.contains("q-sr-only")).toBe(true);
    return indicator;
  }

  it("starts inactive and places a noninteractive LIVE status beside the heading before account actions", () => {
    vi.setSystemTime(drawsAt - 5 * 60_000);
    mountFrame();
    const indicator = expectLiveState(false);
    expect(indicator).toBe(screen.getByTestId("draw-live-indicator"));
    expect(within(indicator).getByText("LIVE")).toBeTruthy();
    expect(indicator.closest("a, button")).toBeNull();
    expect(within(indicator).queryByRole("link")).toBeNull();
    expect(within(indicator).queryByRole("button")).toBeNull();
    const heading = indicator.closest(".q-topbar__heading");
    expect(heading).not.toBeNull();
    const actions = heading!.closest("header")!.querySelector(".q-topbar__actions")!;
    expect(actions.contains(indicator)).toBe(false);
    expect(heading!.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => { vi.advanceTimersByTime(0); });
    expectLiveState(true);
  });

  it("turns active at T-10 minutes, remains active through T+29:59 and turns inactive exactly at T+30", () => {
    mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    expectLiveState(false);
    act(() => { vi.advanceTimersByTime(1_000); });
    expectLiveState(true);
    act(() => { vi.advanceTimersByTime(10 * 60_000); });
    expectLiveState(true);
    act(() => { vi.advanceTimersByTime(29 * 60_000 + 59_000); });
    expectLiveState(true);
    act(() => { vi.advanceTimersByTime(1_000); });
    expectLiveState(false);
  });

  it.each(["focus", "visibilitychange"])("resynchronizes the LIVE state on %s without waiting for an interval", (event) => {
    if (event === "visibilitychange") vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    expectLiveState(false);
    const target = event === "focus" ? window : document;
    vi.setSystemTime(drawsAt - 5 * 60_000);
    expectLiveState(false);
    act(() => { target.dispatchEvent(new Event(event)); });
    expectLiveState(true);
    vi.setSystemTime(drawsAt + 30 * 60_000);
    act(() => { target.dispatchEvent(new Event(event)); });
    expectLiveState(false);
  });

  it.each([
    { phase: "before the initial tick", initialize: false },
    { phase: "after the initial tick", initialize: true },
  ])("removes clock timers and resume listeners on unmount $phase", ({ initialize }) => {
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const timersBefore = vi.getTimerCount();
    const { unmount } = mountFrame();
    if (initialize) act(() => { vi.advanceTimersByTime(0); });
    expect(vi.getTimerCount()).toBeGreaterThan(timersBefore);
    const focus = addWindow.mock.calls.find(([event]) => event === "focus")![1];
    const visibility = addDocument.mock.calls.find(([event]) => event === "visibilitychange")![1];
    unmount();
    expect(vi.getTimerCount()).toBe(timersBefore);
    expect(removeWindow).toHaveBeenCalledWith("focus", focus);
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", visibility);
  });

  it.each([
    { state: "unavailable", remoteCatalog: null },
    { state: "empty", remoteCatalog: { ...catalog, draws: [] } },
  ])("does not invent a LIVE draw for an $state remote schedule", ({ remoteCatalog }) => {
    vi.setSystemTime(drawsAt - 5 * 60_000);
    useProductMock.mockReturnValue({ ...product, catalog: remoteCatalog, gatewayMode: "backoffice" });
    mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    expectLiveState(false);
  });

  it("follows an authoritative remote time change and clears the status when that schedule is removed", () => {
    const early = catalog.draws.find((draw) => draw.id === "early")!;
    const remote = { ...product, gatewayMode: "backoffice", catalog: { ...catalog, draws: [early] } };
    vi.setSystemTime(drawsAt - 5 * 60_000);
    useProductMock.mockReturnValue(remote);
    const { rerender } = mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    expectLiveState(true);

    const rescheduled = {
      ...early,
      label: "Tempranero · 11:30",
      drawsAt: new Date(drawsAt + 60 * 60_000).toISOString(),
      closesAt: new Date(drawsAt + 45 * 60_000).toISOString(),
    };
    useProductMock.mockReturnValue({ ...remote, catalog: { ...catalog, draws: [rescheduled] } });
    rerender(<ProductFrame><main>Inicio</main></ProductFrame>);
    expectLiveState(false);
    vi.setSystemTime(drawsAt + 50 * 60_000 - 1_000);
    act(() => { vi.advanceTimersByTime(1_000); });
    expectLiveState(true);

    useProductMock.mockReturnValue({ ...remote, catalog: { ...catalog, draws: [] } });
    rerender(<ProductFrame><main>Inicio</main></ProductFrame>);
    expectLiveState(false);
  });
});
