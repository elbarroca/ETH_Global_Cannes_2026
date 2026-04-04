"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { WalletConnectButton } from "./wallet-connect";
import { LiveBadge } from "./ui/badge";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Pack" },
  { href: "/history", label: "History" },
  { href: "/deposit", label: "Deposit" },
  { href: "/verify", label: "Verify" },
];

function WolfLogo() {
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
      <rect x="4" y="4" width="112" height="112" rx="28" fill="#0C0A09"/>
      <path d="M28 92 L42 28 L60 48 L78 28 L92 92 Z" fill="#7F1D1D"/>
      <path d="M34 92 L46 36 L60 52 L74 36 L86 92 Z" fill="#DC2626"/>
      <circle cx="50" cy="54" r="4.5" fill="#FBBF24"/>
      <circle cx="70" cy="54" r="4.5" fill="#FBBF24"/>
      <circle cx="50" cy="54" r="2" fill="#0C0A09"/>
      <circle cx="70" cy="54" r="2" fill="#0C0A09"/>
      <path d="M55 69 L60 73 L65 69" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const shortAddr = mounted && address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <header className="sticky top-0 z-50 bg-void-900 border-b border-void-800">
      <div className="max-w-7xl mx-auto px-5 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <WolfLogo />
          <span className="font-bold text-void-100 text-base tracking-tight">
            AlphaDawg
          </span>
          <LiveBadge />
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5 flex-1">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-void-800 text-void-100 font-medium"
                    : "text-void-500 hover:text-void-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono bg-void-800/60 text-void-400 border border-void-700/40">
            iNFT #0846
          </span>
          {shortAddr && (
            <span className="hidden md:inline text-xs font-mono text-void-500">
              {shortAddr}
            </span>
          )}
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
