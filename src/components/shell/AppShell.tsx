"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Icon,
  Logo,
  PreferencesProvider,
  ThemeSoundControls,
  ToastProvider,
  usePreferences,
  type IconName,
} from "@/components/ui";

export type ShellRole = "player" | "admin";
export type ShellNavSection = "play" | "account" | "admin";

export interface ShellNavItem {
  href: string;
  label: string;
  icon: IconName;
  section?: ShellNavSection;
  match?: string[];
  mobile?: boolean;
  badge?: string | number;
  adminOnly?: boolean;
}

export interface AppShellProps {
  children: ReactNode;
  balance?: string | number;
  balanceLabel?: string;
  userName?: string;
  role?: ShellRole;
  title?: string;
  eyebrow?: string;
  currentPath?: string;
  navItems?: ShellNavItem[];
  topbarActions?: ReactNode;
  sidebarFooter?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export const defaultShellNavItems: ShellNavItem[] = [
  { href: "/", label: "Inicio", icon: "home", section: "play", mobile: true },
  {
    href: "/quinielas",
    label: "Quinielas",
    icon: "head",
    section: "play",
    match: ["/quinielas", "/jugar"],
    mobile: true,
  },
  {
    href: "/instantaneas",
    label: "Instantáneas",
    icon: "bolt",
    section: "play",
    match: ["/instantaneas"],
    mobile: true,
  },
  { href: "/reglas", label: "Reglas", icon: "rules", section: "play" },
  {
    href: "/mis-jugadas",
    label: "Mis Jugadas",
    icon: "ticket",
    section: "account",
    match: ["/mis-jugadas", "/saldos/apuestas"],
  },
  {
    href: "/resultados",
    label: "Resultados",
    icon: "prize",
    section: "account",
    match: ["/resultados"],
    mobile: true,
  },
  {
    href: "/cuenta",
    label: "Cuenta",
    icon: "user",
    section: "account",
    match: ["/cuenta", "/profile", "/saldos"],
    mobile: true,
  },
  {
    href: "/gestion",
    label: "Gestión",
    icon: "settings",
    section: "admin",
    match: ["/gestion", "/admin"],
    adminOnly: true,
  },
];

const sectionLabels: Record<ShellNavSection, string> = {
  play: "Jugar",
  account: "Mi cuenta",
  admin: "Administración",
};

function isPathActive(pathname: string, item: ShellNavItem) {
  if (item.href === "/") return pathname === "/";
  const candidates = item.match?.length ? item.match : [item.href];
  return candidates.some((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
}

function formatBalance(balance: string | number) {
  if (typeof balance === "number") {
    return `₲ ${new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(balance)}`;
  }
  return balance.trim().startsWith("₲") ? balance : `₲ ${balance}`;
}

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "QL";
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

interface ShellLinkProps {
  item: ShellNavItem;
  active: boolean;
  mobile?: boolean;
}

function ShellLink({ item, active, mobile = false }: ShellLinkProps) {
  const { playSound } = usePreferences();
  return (
    <Link
      href={item.href}
      className={mobile ? "q-bottom-nav__link" : "q-nav-link"}
      aria-current={active ? "page" : undefined}
      onClick={() => playSound("nav")}
    >
      <Icon name={item.icon} size={mobile ? 21 : 20} />
      <span className={mobile ? "q-bottom-nav__label" : "q-nav-link__label"}>{item.label}</span>
      {!mobile && item.badge !== undefined ? <span className="q-nav-link__badge">{item.badge}</span> : null}
    </Link>
  );
}

function AppShellFrame({
  children,
  balance = 0,
  balanceLabel = "Saldo disponible",
  userName = "Mi cuenta",
  role = "player",
  title,
  eyebrow = "quinie.LA",
  currentPath,
  navItems = defaultShellNavItems,
  topbarActions,
  sidebarFooter,
  className = "",
  contentClassName = "",
}: AppShellProps) {
  const routerPath = usePathname();
  const pathname = currentPath ?? routerPath ?? "/";
  const visibleItems = navItems.filter((item) => !item.adminOnly || role === "admin");
  const mobileItems = visibleItems.filter((item) => item.mobile).slice(0, 5);
  const activeItem = visibleItems.find((item) => isPathActive(pathname, item));
  const pageTitle = title ?? activeItem?.label ?? "quinie.LA";

  return (
    <div className={`q-app-shell ${className}`.trim()} data-testid="app-shell">
      <a href="#main-content" className="q-skip-link">Saltar al contenido</a>

      <aside className="q-sidebar" aria-label="Barra lateral">
        <div className="q-sidebar__brand">
          <Link href="/" aria-label="Ir al inicio de quinie.LA">
            <Logo size="md" />
          </Link>
        </div>
        <div className="q-sidebar__divider" />

        <nav className="q-sidebar__navigation" aria-label="Navegación principal" data-testid="primary-navigation">
          {(["play", "account", "admin"] as const).map((section) => {
            const sectionItems = visibleItems.filter((item) => (item.section ?? "play") === section);
            if (sectionItems.length === 0) return null;
            return (
              <div className="q-nav-section" key={section}>
                <p className="q-nav-section__label">{sectionLabels[section]}</p>
                {sectionItems.map((item) => (
                  <ShellLink key={item.href} item={item} active={isPathActive(pathname, item)} />
                ))}
              </div>
            );
          })}
        </nav>

        <footer className="q-sidebar__footer">
          {sidebarFooter}
          <div className="q-sidebar__responsible">
            <span className="q-age-mark" aria-label="Solo mayores de 18 años">18+</span>
            <span>Jugá con responsabilidad.</span>
          </div>
        </footer>
      </aside>

      <div className="q-shell-main">
        <header className="q-topbar">
          <div className="q-topbar__mobile-brand">
            <Link href="/" aria-label="Ir al inicio de quinie.LA">
              <Logo size="sm" />
            </Link>
          </div>
          <div className="q-topbar__context">
            <p className="q-topbar__eyebrow">{eyebrow}</p>
            <p className="q-topbar__title">{pageTitle}</p>
          </div>

          <div className="q-topbar__actions">
            <Link className="q-balance" href="/saldos" aria-label={`${balanceLabel}: ${formatBalance(balance)}`}>
              <span className="q-balance__label">{balanceLabel}</span>
              <span className="q-balance__value">{formatBalance(balance)}</span>
            </Link>
            {topbarActions}
            <ThemeSoundControls />
            <Link className="q-user-chip" href="/cuenta" aria-label={`Abrir cuenta de ${userName}`}>
              <span className="q-user-chip__avatar" aria-hidden="true">{initialsFor(userName)}</span>
              <span className="q-user-chip__name">{userName}</span>
            </Link>
          </div>
        </header>

        <div id="main-content" className={`q-shell-content ${contentClassName}`.trim()} tabIndex={-1}>
          {children}
        </div>

        <footer className="q-site-footer">
          <div className="q-site-footer__brand">
            <Logo size="sm" />
            <span>Quiniela online · Paraguay</span>
          </div>
          <nav className="q-site-footer__links" aria-label="Información y ayuda">
            <Link href="/ayuda">Centro de ayuda</Link>
            <Link href="/reglas">Reglas</Link>
            <Link href="/legal/juego-responsable">Juego responsable</Link>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/privacidad">Privacidad</Link>
          </nav>
          <span className="q-age-mark" aria-label="Solo mayores de 18 años">18+</span>
        </footer>
      </div>

      <nav className="q-bottom-nav" aria-label="Navegación móvil">
        {mobileItems.map((item) => (
          <ShellLink key={item.href} item={item} active={isPathActive(pathname, item)} mobile />
        ))}
      </nav>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <PreferencesProvider>
      <ToastProvider>
        <AppShellFrame {...props} />
      </ToastProvider>
    </PreferencesProvider>
  );
}
