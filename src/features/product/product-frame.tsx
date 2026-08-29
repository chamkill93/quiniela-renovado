"use client";

import { AppShell } from "@/components/shell";
import { useProduct } from "@/providers/product-provider";
import { DrawLiveIndicator } from "./draw-live-indicator";

export function ProductFrame({ children }: { children: React.ReactNode }) {
  const { session } = useProduct();
  return (
    <AppShell
      balance={session?.balance ?? 0}
      userName={session?.displayName ?? "Mi cuenta"}
      role={session?.role === "ADMIN" ? "admin" : "player"}
      contextStatus={<DrawLiveIndicator />}
    >
      {children}
    </AppShell>
  );
}
