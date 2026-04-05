"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WalletConnectButton } from "./wallet-connect";
import { LiveBadge } from "./ui/badge";
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

/** User (EOA) wallet pill — links to ArcScan (external, new tab). */
function UserWalletPill({ address }: { address: string }) {
  return (
    <a
      href={arcAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden lg:flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg bg-void-800/70 border border-void-700/60 hover:bg-void-800 hover:border-sky-500/40 transition-colors group"
      title={`Your connected wallet (EOA) — ${address}\nClick to view on ArcScan ↗`}
    >
      <div className="flex items-center justify-center w-5 h-5 rounded-md bg-sky-500/15 border border-sky-500/30">
        <svg viewBox="0 0 24 24" className="w-3 h-3 text-sky-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-wider text-void-500">You · ArcScan ↗</span>
        <span className="text-[11px] font-mono text-void-200 mt-0.5 group-hover:text-sky-300">{shorten(address)}</span>
      </div>
    </a>
  );
}

/** Agent (Circle MPC proxy) wallet pill — links to ArcScan (external, new tab). */
function AgentWalletPill({
  address,
  balance,
}: {
  address: string;
  balance: number | null;
}) {
  return (
    <a
      href={arcAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Agent proxy wallet (Circle MPC) — ${address}\nClick to view on ArcScan ↗`}
      className="hidden md:flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg bg-blood-900/25 border border-blood-700/40 hover:bg-blood-900/40 hover:border-blood-600/60 transition-colors group"
    >
      <div className="flex items-center justify-center w-5 h-5 rounded-md bg-blood-600/20 border border-blood-500/40">
        <svg viewBox="0 0 24 24" className="w-3 h-3 text-blood-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <circle cx="12" cy="5" r="2"/>
          <path d="M12 7v4"/>
          <line x1="8" y1="16" x2="8" y2="16"/>
          <line x1="16" y1="16" x2="16" y2="16"/>
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-wider text-blood-400">Agent · ArcScan ↗</span>
        <span className="text-[11px] font-mono text-void-100 mt-0.5">
          <span className="text-gold-400 font-semibold">{formatUsdc(balance)}</span>
          <span className="text-void-600 mx-1">·</span>
          <span className="text-void-400 group-hover:text-blood-200">{shorten(address)}</span>
        </span>
      </div>
    </a>
  );
}

/** Lead Dawg iNFT pill — links to the specific token on 0G Chainscan. */
function InftPill({ tokenId }: { tokenId: number }) {
  return (
    <a
      href={inftTokenUrl(tokenId)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Your Lead Dawg agent identity — iNFT #${tokenId}\nClick to view on 0G Chainscan ↗`}
      className="hidden xl:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-mono bg-gold-400/10 text-gold-400 border border-gold-400/30 hover:bg-gold-400/15 hover:border-gold-400/50 transition-colors"
    >
      iNFT #{String(tokenId).padStart(4, "0")} ↗
    </a>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user, walletAddress, agentBalance } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const proxyAddress = user?.proxyWallet?.address ?? null;
  const inftTokenId = user?.inftTokenId ?? null;

  return (
    <header className="sticky top-0 z-50 bg-void-900 border-b border-void-800">
      <div className="max-w-7xl mx-auto px-5 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <DawgLogo animated className="w-8 h-8" />
          <span className="font-bold text-void-100 text-base tracking-tight">
            AlphaDawg
          </span>
          <LiveBadge />
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto py-1">
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

        {/* Right section — wallet identity */}
        <div className="flex items-center gap-2 shrink-0">
          {inftTokenId !== null && <InftPill tokenId={inftTokenId} />}

          {/* Agent wallet — always relevant when user is onboarded */}
          {mounted && proxyAddress && (
            <AgentWalletPill address={proxyAddress} balance={agentBalance} />
          )}

          {/* User (EOA) wallet — connected external wallet */}
          {mounted && walletAddress && <UserWalletPill address={walletAddress} />}

          {/* Dynamic widget — handles connect / disconnect / switch */}
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
