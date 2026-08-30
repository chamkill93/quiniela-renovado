// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackToTopButton } from "@/components/ui/BackToTopButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function installMotionPreference(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: reduced }),
  });
}

describe("BackToTopButton", () => {
  it("renders only an accessible button and a decorative SVG", () => {
    render(<BackToTopButton />);

    const button = screen.getByRole("button", { name: "Volver al inicio" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.textContent).toBe("");
    expect(button.getAttribute("title")).toBeNull();
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(button.querySelector("svg")?.getAttribute("focusable")).toBe("false");
  });

  it("scrolls the window smoothly on click and keyboard activation", async () => {
    installMotionPreference(false);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<BackToTopButton />);
    const button = screen.getByRole("button", { name: "Volver al inicio" });

    await user.click(button);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "smooth" });

    await user.keyboard("{Enter}");
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("uses direct scrolling when reduced motion is requested", () => {
    installMotionPreference(true);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<BackToTopButton />);

    fireEvent.click(screen.getByRole("button", { name: "Volver al inicio" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
