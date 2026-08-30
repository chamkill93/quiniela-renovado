// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  vi.unstubAllGlobals();
});

describe("AppShell navigation", () => {
  it("shows only the emphasized balance amount and places support beside sound", () => {
    render(<AppShell balance={123_456}><main>Inicio</main></AppShell>);
    const header = screen.getByRole("banner");
    const topbar = within(header);
    const balance = topbar.getByRole("link", { name: "Saldo: ₲ 123.456" });
    const balanceIcon = balance.querySelector(".q-balance__icon");
    const balanceValue = balance.querySelector(".q-balance__value");

    expect(balance.getAttribute("href")).toBe("/saldos");
    expect(balance.textContent).toBe("₲ 123.456");
    expect(balance.querySelector(".q-balance__label")).toBeNull();
    expect(balanceIcon?.getAttribute("aria-hidden")).toBe("true");
    expect(balanceIcon?.querySelector(".q-icon")?.getAttribute("aria-hidden")).toBe("true");
    expect(balanceValue?.textContent).toBe("₲ 123.456");

    const sound = topbar.getByTestId("sound-toggle");
    const support = topbar.getByTestId("support-button");
    const preferenceControls = sound.closest(".q-preference-controls");
    const utilities = support.closest(".q-topbar__utilities");
    expect(support.tagName).toBe("A");
    expect(support.getAttribute("href")).toBe("/ayuda");
    expect(support.getAttribute("aria-label")).toBe("Abrir soporte");
    expect(support.getAttribute("title")).toBe("Soporte");
    expect(preferenceControls).not.toBeNull();
    expect(utilities).not.toBeNull();
    expect(balance.nextElementSibling).toBe(utilities);
    expect(preferenceControls!.lastElementChild).toBe(sound);
    expect(preferenceControls!.nextElementSibling).toBe(support);
  });

  it("renders the mobile navigation as a floating capsule with Jugar as its third destination", () => {
    render(<AppShell><main>Inicio</main></AppShell>);
    expect(useProductMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("draw-live-indicator")).toBeNull();
    const navigationElement = screen.getByRole("navigation", { name: "Navegación móvil" });
    const navigation = within(navigationElement);
    const capsule = screen.getByTestId("mobile-navigation-capsule");
    const links = navigation.getAllByRole("link");

    expect(navigationElement.getAttribute("data-variant")).toBe("floating-pill");
    expect(capsule.classList.contains("mobileNavInner")).toBe(true);
    expect(capsule.parentElement).toBe(navigationElement);
    expect(links.map((link) => link.textContent)).toEqual([
      "Inicio", "Reglas", "Jugar", "Resultados", "Cuenta",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/", "/reglas", "/quinielas", "/resultados", "/cuenta",
    ]);
    expect(Array.from(capsule.children)).toEqual(links);

    const play = links[2];
    expect(play).toBe(navigation.getByRole("link", { name: /^Jugar$/ }));
    expect(play.classList.contains("mobileNavAction")).toBe(true);
    expect(play.querySelector("a, button, input, select, textarea, [tabindex]")).toBeNull();
    expect(within(play).getByText("Jugar").getAttribute("aria-hidden")).toBe("true");

    for (const link of links) {
      const icon = link.querySelector(".mobileNavIcon");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      expect(icon?.querySelector("svg")?.getAttribute("focusable")).toBe("false");
    }
    expect(navigation.queryByRole("link", { name: /Quiniela/i })).toBeNull();
  });

  it.each([
    { currentPath: "/", activeLabel: "Inicio" },
    { currentPath: "/reglas", activeLabel: "Reglas" },
    { currentPath: "/quinielas/redoblona", activeLabel: "Jugar" },
    { currentPath: "/jugar", activeLabel: "Jugar" },
    { currentPath: "/instantaneas", activeLabel: "Jugar" },
    { currentPath: "/resultados", activeLabel: "Resultados" },
    { currentPath: "/cuenta", activeLabel: "Cuenta" },
  ])("marks only $activeLabel as current at $currentPath", ({ currentPath, activeLabel }) => {
    render(<AppShell currentPath={currentPath}><main>{activeLabel}</main></AppShell>);
    const navigation = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
    const active = navigation.getByRole("link", { name: activeLabel, current: "page" });
    expect(navigation.getAllByRole("link", { current: "page" })).toEqual([active]);
    expect(active.getAttribute("aria-current")).toBe("page");

    const play = navigation.getByRole("link", { name: /^Jugar$/ });
    const playIsActive = activeLabel === "Jugar";
    expect(play.getAttribute("href")).toBe("/quinielas");
    expect(play.getAttribute("data-active")).toBe(String(playIsActive));
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
    expect(footer.getByRole("button", { name: "Volver al inicio" })).toBeTruthy();
    expect(footer.queryByText("Volver al inicio")).toBeNull();
    expect(footer.queryByText("Quiniela online · Paraguay")).toBeNull();
    expect(footer.getAllByRole("link")).toHaveLength(5);
    expect(footer.getByRole("link", { name: "Juego responsable" }).getAttribute("href"))
      .toBe("/legal/juego-responsable");
    expect(within(screen.getByRole("main")).getByText("Quiniela online · Paraguay")).toBeTruthy();
  });
});

describe("ProductFrame LIVE launcher", () => {
  const drawsAt = Date.parse("2026-08-28T13:30:00.000Z");
  const catalog = buildGamingCatalog("REFUND", new Date(drawsAt - 60 * 60_000));
  const product = { catalog, gatewayMode: "preview", session: null };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(drawsAt - 10 * 60_000 - 1_000);
    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => window.clearTimeout(handle));
    useProductMock.mockReturnValue(product);
  });

  function mountFrame() {
    return render(<ProductFrame><main>Inicio</main></ProductFrame>);
  }

  function expectLiveState(active: boolean) {
    const launcher = screen.getByTestId("draw-live-indicator");
    expect(launcher.getAttribute("role")).toBeNull();
    expect(launcher.tagName).toBe("BUTTON");
    expect(launcher.getAttribute("type")).toBe("button");
    expect(launcher.getAttribute("aria-haspopup")).toBe("dialog");
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(launcher.getAttribute("data-active")).toBe(String(active));
    expect(launcher.getAttribute("data-draw-id")).toBe(active ? "early" : null);
    expect(launcher.getAttribute("aria-label")).toBe(active
      ? "Abrir transmisión LIVE de Tempranero"
      : "Abrir canal LIVE de Quiniela");
    const message = active ? "Sorteo en horario LIVE: Tempranero" : "Fuera del horario LIVE";
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(message);
    expect(status.classList.contains("q-sr-only")).toBe(true);
    expect(status).not.toBe(launcher);
    expect(launcher.contains(status)).toBe(false);
    expect(status.contains(launcher)).toBe(false);
    return { launcher, status };
  }

  it("keeps an accessible status separate from the LIVE dialog launcher beside the heading", () => {
    vi.setSystemTime(drawsAt - 5 * 60_000);
    mountFrame();
    const { launcher, status } = expectLiveState(false);
    expect(within(launcher).getByText("LIVE").getAttribute("aria-hidden")).toBe("true");
    expect(status.getAttribute("aria-live")).toBe("polite");
    const titleRow = launcher.closest(".q-topbar__title-row");
    const statusWrapper = launcher.closest(".q-topbar__status");
    expect(titleRow).not.toBeNull();
    expect(statusWrapper).not.toBeNull();
    expect(titleRow!.querySelector(".q-topbar__title")?.textContent).toBe("Inicio");
    expect(titleRow!.querySelector(".q-topbar__title")?.nextElementSibling).toBe(statusWrapper);
    expect(statusWrapper!.contains(status)).toBe(true);
    const heading = titleRow!.closest(".q-topbar__heading");
    expect(heading).not.toBeNull();
    expect(heading!.contains(status)).toBe(true);
    const actions = heading!.closest("header")!.querySelector(".q-topbar__actions")!;
    expect(actions.contains(launcher)).toBe(false);
    expect(heading!.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => { vi.advanceTimersByTime(0); });
    expectLiveState(true);
  });

  it("opens the LIVE dialog with both YouTube advertisements outside the draw window", () => {
    mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    const { launcher } = expectLiveState(false);

    fireEvent.click(launcher);

    const dialog = screen.getByRole("dialog", { name: "LIVE de Quiniela" });
    const popout = within(dialog).getByTestId("draw-live-popout");
    const frame = within(popout).getByTestId("draw-stream-frame");
    const advertisingPlayer = within(frame).getByTestId("draw-advertising-player");
    const source = advertisingPlayer.getAttribute("src") ?? "";
    expect(launcher.getAttribute("aria-expanded")).toBe("true");
    expect(popout.getAttribute("data-mode")).toBe("advertising");
    expect(frame.getAttribute("data-stream-mode")).toBe("advertising");
    expect(advertisingPlayer.tagName).toBe("IFRAME");
    expect(advertisingPlayer.getAttribute("title")).toBe("Publicidad de Quiniela");
    expect(source).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    expect(source).toContain("Z3eXyAIz65I");
    expect(source).toContain("JV9ajM_6Rsc");
    expect(within(dialog).queryByTestId("draw-preview-video")).toBeNull();
  });

  it("opens the LIVE dialog with the local preview stream inside the draw window", () => {
    vi.setSystemTime(drawsAt - 10 * 60_000);
    mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    const { launcher } = expectLiveState(true);

    fireEvent.click(launcher);

    const dialog = screen.getByRole("dialog", { name: "LIVE de Quiniela" });
    const popout = within(dialog).getByTestId("draw-live-popout");
    const video = within(popout).getByTestId("draw-preview-video") as HTMLVideoElement;
    expect(launcher.getAttribute("aria-expanded")).toBe("true");
    expect(popout.getAttribute("data-mode")).toBe("live");
    expect(video.getAttribute("src")).toBe("/assets/video/quinie-streaming-simulado.mp4");
    expect(video.getAttribute("aria-label")).toBe("Streaming de Tempranero");
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(within(dialog).queryByTestId("draw-advertising-player")).toBeNull();
  });

  it("switches an open popout from advertising to the local stream at the LIVE boundary", () => {
    mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    const launcher = screen.getByTestId("draw-live-indicator");
    fireEvent.click(launcher);
    const dialog = screen.getByRole("dialog", { name: "LIVE de Quiniela" });
    expect(within(dialog).getByTestId("draw-advertising-player")).toBeTruthy();
    expect(within(dialog).queryByTestId("draw-preview-video")).toBeNull();

    act(() => { vi.advanceTimersByTime(1_000); });

    expect(launcher.getAttribute("data-active")).toBe("true");
    expect(within(dialog).queryByTestId("draw-advertising-player")).toBeNull();
    expect(within(dialog).getByTestId("draw-preview-video").getAttribute("src"))
      .toBe("/assets/video/quinie-streaming-simulado.mp4");
  });

  it("closes the LIVE dialog with Escape or its close button and restores launcher focus", () => {
    mountFrame();
    act(() => { vi.advanceTimersByTime(0); });
    const launcher = screen.getByTestId("draw-live-indicator");
    launcher.focus();
    fireEvent.click(launcher);
    act(() => { vi.advanceTimersByTime(0); });
    let dialog = screen.getByRole("dialog", { name: "LIVE de Quiniela" });

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "LIVE de Quiniela" })).toBeNull();
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(launcher);

    fireEvent.click(launcher);
    act(() => { vi.advanceTimersByTime(0); });
    dialog = screen.getByRole("dialog", { name: "LIVE de Quiniela" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar transmisión LIVE" }));

    expect(screen.queryByRole("dialog", { name: "LIVE de Quiniela" })).toBeNull();
    expect(screen.queryByTestId("draw-advertising-player")).toBeNull();
    expect(launcher.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(launcher);
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
