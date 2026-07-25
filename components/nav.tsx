"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WalletConnectButton } from "./wallet-connect";
import { DawgLogo } from "./dawg-logo";
import { useUser } from "@/contexts/user-context";
import { arcAddressUrl, inftTokenUrl } from "@/lib/links";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Pack" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/history", label: "History" },
  { href: "/deposit", label: "Deposit" },
  { href: "/verify", label: "Verify" },
];

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function shorten(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUsdc(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value === 0) return "$0.00";
  return `$${value.toFixed(4)}`;
}

function IdentityDisclosure({
  walletAddress,
  proxyAddress,
  balance,
  tokenId,
}: {
  walletAddress: string | null;
  proxyAddress: string | null;
  balance: number | null;
  tokenId: number | null;
}) {
  if (!walletAddress && !proxyAddress && tokenId === null) return null;

  return (
    <details
      className="group relative hidden xl:block"
      onKeyDown={(event) => {
        if (event.key === "Escape") event.currentTarget.removeAttribute("open");
      }}
    >
      <summary className="flex min-h-11 max-w-48 cursor-pointer list-none items-center gap-2 rounded-xl border border-void-700 bg-void-900 px-3 text-left marker:content-none hover:border-dawg-500/40 hover:bg-void-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dawg-400">
        <span className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-void-500">Identity</span>
          <span className="block truncate font-mono text-[11px] text-void-200">
            {proxyAddress ? `${formatUsdc(balance)} · ${shorten(proxyAddress)}` : walletAddress ? shorten(walletAddress) : `iNFT #${tokenId}`}
          </span>
        </span>
        <span aria-hidden="true" className="ml-auto text-xs text-gold-400 transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-xl border border-void-700 bg-void-950 p-4 shadow-2xl">
        {walletAddress && <IdentityLink label="Connected wallet" address={walletAddress} href={arcAddressUrl(walletAddress)} />}
        {proxyAddress && <IdentityLink label={`Agent wallet · ${formatUsdc(balance)}`} address={proxyAddress} href={arcAddressUrl(proxyAddress)} />}
        {tokenId !== null && (
          <a className="block rounded-lg px-2 py-2 text-xs text-void-300 hover:bg-void-900 hover:text-gold-300" href={inftTokenUrl(tokenId)} target="_blank" rel="noopener noreferrer">
            <span className="block text-[10px] uppercase tracking-wider text-void-500">Agent identity</span>
            <span className="mt-1 block font-mono">iNFT #{String(tokenId).padStart(4, "0")} ↗</span>
          </a>
        )}
      </div>
    </details>
  );
}

function IdentityLink({ label, address, href }: { label: string; address: string; href: string }) {
  return (
    <a className="block rounded-lg px-2 py-2 hover:bg-void-900" href={href} target="_blank" rel="noopener noreferrer">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-void-500">{label}</span>
      <span className="mt-1 block break-all font-mono text-xs text-void-200">{address} ↗</span>
    </a>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [mobileMenu, setMobileMenu] = useState({ open: false, pathname });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const { user, walletAddress, agentBalance } = useUser();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );

  const proxyAddress = user?.proxyWallet?.address ?? null;
  const inftTokenId = user?.inftTokenId ?? null;
  const mobileOpen = mobileMenu.open && mobileMenu.pathname === pathname;

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setMobileMenu({ open: false, pathname });
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, pathname]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
    <header className="sticky top-0 z-50 border-b border-void-800 bg-void-950/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:px-5">
        {/* Logo */}
        <Link href="/" onClick={() => setMobileMenu({ open: false, pathname })} className="flex min-h-11 items-center gap-2 shrink-0 group">
          <DawgLogo animated className="w-8 h-8" />
          <span className="text-gradient-brand hidden text-base font-bold tracking-tight sm:inline">
            AlphaDawg
          </span>
          <span className="rounded-md border border-void-700 bg-black px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-void-400">
            Testnet
          </span>
        </Link>

        {/* Desktop nav tabs */}
        <nav aria-label="Primary" className="hidden items-center gap-0.5 flex-1 min-w-0 py-1 md:flex">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm transition-colors ${
                  active
                    ? "text-void-100 font-semibold"
                    : "text-void-500 hover:text-void-300"
                }`}
              >
                {tab.label}
                {active && (
                  <motion.span
                    layoutId="primary-nav-active"
                    className="brand-hairline absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                    transition={reduceMotion ? { duration: 0 } : undefined}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right section — wallet identity */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {mounted && (
            <IdentityDisclosure walletAddress={walletAddress} proxyAddress={proxyAddress} balance={agentBalance} tokenId={inftTokenId} />
          )}

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenu({ open: !mobileOpen, pathname })}
            aria-expanded={mobileOpen}
            aria-controls="mobile-primary-nav"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            className="grid h-11 w-11 place-items-center rounded-xl border border-void-700 text-lg text-void-300 hover:bg-void-800 md:hidden"
          >
            {mobileOpen ? "×" : "☰"}
          </button>

          {/* Dynamic widget — handles connect / disconnect / switch */}
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
          className="overflow-hidden border-t border-void-800 bg-void-950 px-4 py-3 md:hidden"
        >
          <div className="grid grid-cols-1 gap-1.5">
            {TABS.map((tab) => {
              const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileMenu({ open: false, pathname })}
                  className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-void-800 text-void-100"
                      : "border border-void-800 text-void-400 hover:bg-void-800 hover:text-void-200"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
      </AnimatePresence>
    </header>
    </MotionConfig>
  );
}
