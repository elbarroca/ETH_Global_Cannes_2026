"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  ListIcon,
  RobotIcon,
  ShieldCheckIcon,
  SquaresFourIcon,
  XIcon,
} from "@phosphor-icons/react";
import { WalletConnectButton } from "./wallet-connect";
import { DawgLogo } from "./dawg-logo";
import { useUser } from "@/contexts/user-context";

const PRIMARY = [
  { href: "/dashboard", label: "Workspace", icon: SquaresFourIcon },
  { href: "/marketplace", label: "Agents", icon: RobotIcon },
  { href: "/verify", label: "Proof", icon: ShieldCheckIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function compactWallet(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function Nav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { walletAddress, authState } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.18 }}>
      <header className="sticky top-0 z-50 border-b border-void-800 bg-void-950/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2 text-sm font-bold tracking-[0.08em] text-dawg-400" aria-label="AlphaDawg home">
            <DawgLogo animated className="h-8 w-8" />
            <span className="hidden sm:inline">AlphaDawg</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {PRIMARY.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`relative inline-flex min-h-11 items-center gap-2 rounded-[10px] px-4 text-sm ${active ? "text-dawg-300" : "text-void-400 hover:text-void-100"}`}>
                  <Icon size={17} aria-hidden />
                  {label}
                  {active && <motion.span layoutId="primary-nav" className="absolute inset-x-3 bottom-0 h-px bg-dawg-500" transition={reduceMotion ? { duration: 0 } : undefined} />}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {walletAddress && authState === "ready" && (
              <span className="hidden rounded-[10px] border border-void-700 px-3 py-2 font-mono text-xs text-void-300 sm:block" title={walletAddress}>
                {compactWallet(walletAddress)}
              </span>
            )}
            <WalletConnectButton />
            <button ref={menuButtonRef} type="button" onClick={() => setMobileOpen((open) => !open)} aria-expanded={mobileOpen} aria-controls="mobile-primary" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} className="grid h-11 w-11 place-items-center rounded-[10px] border border-void-700 text-void-300 md:hidden">
              {mobileOpen ? <XIcon size={20} aria-hidden /> : <ListIcon size={20} aria-hidden />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.nav id="mobile-primary" aria-label="Mobile primary" initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="border-t border-void-800 bg-void-950 px-4 py-3 md:hidden">
              {PRIMARY.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm ${active ? "bg-dawg-500/10 text-dawg-300" : "text-void-300"}`}><Icon size={19} aria-hidden />{label}</Link>;
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </MotionConfig>
  );
}
