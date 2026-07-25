"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  CaretDownIcon,
  ChartPieSliceIcon,
  ClockCounterClockwiseIcon,
  CoinsIcon,
  HardDrivesIcon,
  ListIcon,
  RobotIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  WalletIcon,
  XIcon,
} from "@phosphor-icons/react";
import { WalletConnectButton } from "./wallet-connect";
import { DawgLogo } from "./dawg-logo";
import { useUser } from "@/contexts/user-context";
import { arcAddressUrl, inftTokenUrl } from "@/lib/links";

const PRIMARY = [
  { href: "/dashboard", label: "Workspace", icon: SquaresFourIcon },
  { href: "/marketplace", label: "Agents", icon: RobotIcon },
  { href: "/verify", label: "Proof", icon: ShieldCheckIcon },
] as const;

const ACCOUNT = [
  { href: "/portfolio", label: "Portfolio", icon: ChartPieSliceIcon },
  { href: "/history", label: "History", icon: ClockCounterClockwiseIcon },
  { href: "/deposit", label: "Deposit", icon: CoinsIcon },
  { href: "/infrastructure", label: "Infrastructure", icon: HardDrivesIcon },
] as const;

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function shorten(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatUsdc(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value === 0) return "$0.00";
  return `$${value.toFixed(4)}`;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const [mobileMenu, setMobileMenu] = useState({ open: false, pathname });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const { user, walletAddress, agentBalance } = useUser();
  const mounted = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const mobileOpen = mobileMenu.open && mobileMenu.pathname === pathname;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setMobileMenu({ open: false, pathname });
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, pathname]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
      <header className="sticky top-0 z-50 border-b border-void-800 bg-void-950/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5" aria-label="AlphaDawg home">
            <DawgLogo animated className="h-9 w-9" />
            <span className="hidden text-base font-bold tracking-[-0.02em] text-void-100 sm:inline">AlphaDawg</span>
          </Link>

          <nav aria-label="Primary" className="mx-auto hidden h-full items-center gap-1 md:flex">
            {PRIMARY.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm transition-colors ${active ? "font-semibold text-dawg-300" : "text-void-500 hover:text-void-200"}`}
                >
                  <Icon size={17} weight="regular" aria-hidden />
                  {label}
                  {active && (
                    <motion.span
                      layoutId="primary-nav-active"
                      className="brand-hairline absolute inset-x-3 bottom-0 h-0.5 rounded-full"
                      transition={reduceMotion ? { duration: 0 } : undefined}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {mounted && (
              <details className="group relative hidden md:block" onKeyDown={(event) => {
                if (event.key === "Escape") event.currentTarget.removeAttribute("open");
              }}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-void-700 bg-void-900 px-3 marker:content-none hover:border-dawg-700">
                  <WalletIcon size={17} className="text-dawg-400" aria-hidden />
                  <span className="hidden max-w-32 text-left xl:block">
                    <span className="block text-[10px] font-medium text-void-500">Account</span>
                    <span className="block truncate font-mono text-[11px] text-void-200">
                      {walletAddress ? shorten(walletAddress) : "Not connected"}
                    </span>
                  </span>
                  <CaretDownIcon size={14} className="text-void-500 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-void-700 bg-void-950 p-3 shadow-2xl">
                  <div className="space-y-2 border-b border-void-800 pb-3">
                    <IdentityRow label="Connected wallet" value={walletAddress ? shorten(walletAddress) : "Unavailable"} href={walletAddress ? arcAddressUrl(walletAddress) : undefined} />
                    <IdentityRow label="Agent wallet" value={user?.proxyWallet?.address ? `${formatUsdc(agentBalance)} · ${shorten(user.proxyWallet.address)}` : "Unavailable"} href={user?.proxyWallet?.address ? arcAddressUrl(user.proxyWallet.address) : undefined} />
                    <IdentityRow label="Agent identity" value={user?.inftTokenId != null ? `iNFT #${String(user.inftTokenId).padStart(4, "0")}` : "Unavailable"} href={user?.inftTokenId != null ? inftTokenUrl(user.inftTokenId) : undefined} />
                  </div>
                  <nav aria-label="Account" className="mt-2 grid gap-1">
                    {ACCOUNT.map(({ href, label, icon: Icon }) => (
                      <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-void-300 hover:bg-void-900 hover:text-void-100">
                        <Icon size={18} aria-hidden />
                        {label}
                      </Link>
                    ))}
                  </nav>
                </div>
              </details>
            )}

            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenu({ open: !mobileOpen, pathname })}
              aria-expanded={mobileOpen}
              aria-controls="mobile-primary-nav"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              className="grid h-11 w-11 place-items-center rounded-lg border border-void-700 text-void-300 hover:bg-void-900 md:hidden"
            >
              {mobileOpen ? <XIcon size={20} aria-hidden /> : <ListIcon size={20} aria-hidden />}
            </button>
            {mounted && <WalletConnectButton />}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.nav
              id="mobile-primary-nav"
              aria-label="Mobile primary"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              className="border-t border-void-800 bg-void-950 px-4 py-4 md:hidden"
            >
              <MobileGroup label="Primary" items={PRIMARY} pathname={pathname} onNavigate={() => setMobileMenu({ open: false, pathname })} />
              <MobileGroup label="Account" items={ACCOUNT} pathname={pathname} onNavigate={() => setMobileMenu({ open: false, pathname })} className="mt-4 border-t border-void-800 pt-4" />
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </MotionConfig>
  );
}

function IdentityRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-void-600">{label}</span>
      <span className="mt-1 block truncate font-mono text-xs text-void-200">{value}</span>
    </>
  );
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-2 py-2 hover:bg-void-900">{content}</a> : <div className="px-2 py-2">{content}</div>;
}

function MobileGroup({ label, items, pathname, onNavigate, className = "" }: { label: string; items: readonly { href: string; label: string; icon: typeof SquaresFourIcon }[]; pathname: string; onNavigate: () => void; className?: string }) {
  return (
    <div className={className}>
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-void-600">{label}</p>
      <div className="grid gap-1">
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${active ? "bg-dawg-500/10 font-semibold text-dawg-300" : "text-void-300 hover:bg-void-900"}`}>
              <Icon size={19} aria-hidden />
              {itemLabel}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
