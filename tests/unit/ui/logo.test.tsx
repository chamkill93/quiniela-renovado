// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Logo } from "@/components/ui/Logo";

afterEach(cleanup);

describe("original quinie.LA logo", () => {
  it("exposes one accessible brand and no duplicate decorative images", () => {
    const { container } = render(<Logo />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "quinie.LA" })).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 1919 820");
    expect(container.querySelector("text")).toBeNull();
  });

  it("uses the same high-resolution artwork for the lettering and the red ring", () => {
    const { container } = render(<Logo />);
    const images = [...container.querySelectorAll("image")];
    expect(images).toHaveLength(2);
    expect(new Set(images.map((image) => image.getAttribute("href")))).toEqual(
      new Set(["/assets/brand/quinie-la-original-hd.png"]),
    );
    expect(container.querySelector(".q-logo__ring")?.getAttribute("fill")).toBe("#e6243c");
    expect(container.querySelectorAll("mask")).toHaveLength(2);
    const png = readFileSync(resolve(process.cwd(), "public/assets/brand/quinie-la-original-hd.png"));
    expect(png.readUInt32BE(16)).toBe(1919);
    expect(png.readUInt32BE(20)).toBe(820);
  });

  it("does not share SVG IDs between the sidebar, mobile header and receipt", () => {
    const { container } = render(<><Logo /><Logo size="sm" /><Logo surface="light" /></>);
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(ids.length);
    for (const element of container.querySelectorAll("[filter], [mask]")) {
      const reference = element.getAttribute("filter") ?? element.getAttribute("mask");
      expect(ids).toContain(reference!.slice(5, -1));
    }
  });

  it.each(["auto", "dark", "light"] as const)("retains the %s surface override and consumer props", (surface) => {
    render(<Logo surface={surface} size="lg" className="receipt-logo" aria-label="Logo de comprobante" data-testid="logo" />);
    const logo = screen.getByRole("img", { name: "Logo de comprobante" });
    expect(logo.className).toContain(`q-logo--surface-${surface}`);
    expect(logo.className).toContain("q-logo--lg");
    expect(logo.className).toContain("receipt-logo");
  });
});
