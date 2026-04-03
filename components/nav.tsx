"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { WalletConnectButton } from "./wallet-connect";
import { Badge } from "./ui/badge";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/history", label: "History" },
  { href: "/deposit", label: "Deposit" },
  { href: "/verify", label: "Verify" },
];

export function Nav() {
  const pathname = usePathname();
  const { address } = useAccount();

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="font-bold text-gray-900 text-sm">
            VaultMind
          </span>
          <Badge variant="green">live</Badge>
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
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-purple-50 text-purple-700">
            iNFT #0846
          </span>
          <WalletConnectButton />
        </div>
      </div>
    </header>
  );
}
