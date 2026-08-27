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
    match: ["/quinielas", "/jugar", "/instantaneas"],
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
}

function ShellLink({ item, active }: ShellLinkProps) {
  const { playSound } = usePreferences();
  return (
    <Link
      href={item.href}
      className="q-nav-link"
      aria-current={active ? "page" : undefined}
      onClick={() => playSound("nav")}
    >
      <Icon name={item.icon} size={20} />
      <span className="q-nav-link__label">{item.label}</span>
      {item.badge !== undefined ? <span className="q-nav-link__badge">{item.badge}</span> : null}
    </Link>
  );
}

type MobileNavIconName =
  | "home"
  | "quiniela"
  | "play"
  | "results"
  | "account";

function MobileNavIcon({ name }: { name: MobileNavIconName }) {
  const paths: Record<MobileNavIconName, ReactNode> = {
    home: (
      <>
        <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z" />
        <path d="M2.8 11.2 12 4l9.2 7.2" />
      </>
    ),
    quiniela: (
      <>
        <path d="m12 3.5 7.4 4.3v8.4L12 20.5l-7.4-4.3V7.8Z" />
        <circle cx="12" cy="12" r="2.1" />
        <path d="m4.9 8 3.2 1.9M19.1 8l-3.2 1.9M12 16.4v4" />
      </>
    ),
    play: <path d="m9 6 9 6-9 6Z" />,
    results: (
      <>
        <path d="M12 3.5c1.8 2.2 4.8 3 7 3.1v5.2c0 4.2-2.7 7-7 8.7-4.3-1.7-7-4.5-7-8.7V6.6c2.2-.1 5.2-.9 7-3.1Z" />
        <path d="m8.8 12.2 2.1 2.1 4.5-4.6" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
  };

  return (
    <span className="mobileNavIcon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {paths[name]}
      </svg>
    </span>
  );
}

function mobileNavPresentation(item: ShellNavItem): {
  icon: MobileNavIconName;
  label: string;
} {
  if (item.href === "/") return { icon: "home", label: "Inicio" };
  if (item.href.startsWith("/quinielas")) {
    return { icon: "quiniela", label: "Quiniela" };
  }
  if (item.href.startsWith("/resultados")) {
    return { icon: "results", label: "Resultados" };
  }
  if (
    item.href.startsWith("/cuenta") ||
    item.href.startsWith("/profile") ||
    item.href.startsWith("/saldos")
  ) {
    return { icon: "account", label: "Cuenta" };
  }
  return { icon: "quiniela", label: item.label };
}

function MobileShellLink({ item, active }: ShellLinkProps) {
  const { playSound } = usePreferences();
  const presentation = mobileNavPresentation(item);

  return (
    <Link
      href={item.href}
      className="mobileNavLink"
      aria-current={active ? "page" : undefined}
      onClick={() => playSound("nav")}
    >
      <MobileNavIcon name={presentation.icon} />
      <span className="mobileNavLabel">{presentation.label}</span>
    </Link>
  );
}

function MobilePlayAction() {
  const { playSound } = usePreferences();

  return (
    <Link
      href="/quinielas"
      className="mobileNavAction"
      aria-label="Jugar"
      onClick={() => playSound("nav")}
    >
      <span className="mobileNavActionDisc">
        <MobileNavIcon name="play" />
      </span>
      <span className="mobileNavLabel" aria-hidden="true">Jugar</span>
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
  const mobileItems = visibleItems.filter((item) => item.mobile).slice(0, 4);
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
            <Link href="/ayuda" aria-label="Centro de ayuda"><span className="q-site-footer__help-prefix">Centro de&nbsp;</span>Ayuda</Link>
            <Link href="/reglas">Reglas</Link>
            <Link href="/legal/juego-responsable">Juego responsable</Link>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/privacidad">Privacidad</Link>
          </nav>
          <span className="q-age-mark" aria-label="Solo mayores de 18 años">18+</span>
        </footer>
      </div>

      <nav className="mobileNav" aria-label="Navegación móvil">
        <div className="mobileNavInner">
          {mobileItems.slice(0, 2).map((item) => (
            <MobileShellLink key={item.href} item={item} active={isPathActive(pathname, item)} />
          ))}
          <MobilePlayAction />
          {mobileItems.slice(2, 4).map((item) => (
            <MobileShellLink key={item.href} item={item} active={isPathActive(pathname, item)} />
          ))}
        </div>
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
