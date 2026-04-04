import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/contexts/wagmi-provider";
import { Nav } from "@/components/nav";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlphaDawg",
  description:
    "Your AI pack hunts alpha. Provable investment decisions with adversarial debate, sealed inference, and on-chain verification.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "AlphaDawg",
    description: "Your AI pack hunts alpha. Provable, on-chain, verifiable.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AlphaDawg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AlphaDawg",
    description: "Your AI pack hunts alpha.",
    images: ["/og-image.png"],
  },
};

/**
 * Completely remove Phantom wallet integration at the browser level.
 *
 * AlphaDawg is EVM-only (Arc Testnet). Phantom is a Solana-first wallet that
 * injects an EVM shim via EIP-6963 — causing Dynamic's picker to show it four
 * times (`phantom`, `phantomevm`, `phantombtc`, `phantomledger`). A JS-level
 * `walletsFilter` alone is not enough because Dynamic also auto-discovers
 * Phantom through its EIP-6963 listener and its hardcoded `PhantomEvm`
 * connector, so we neutralize Phantom at the source — before any Dynamic code
 * runs — by:
 *   1. Locking `window.phantom` to `undefined` so injected detection fails.
 *   2. Wrapping `window.addEventListener('eip6963:announceProvider')` so
 *      Dynamic's listeners never receive Phantom announcements.
 *   3. Wrapping `window.dispatchEvent` to drop Phantom announcements at
 *      dispatch time, catching early events that fire before listeners mount.
 *
 * Injected as an inline <script> in <head> so it executes synchronously
 * before Providers loads.
 */
const phantomBlockScript = `
(function() {
  if (typeof window === 'undefined') return;

  var isPhantomInfo = function(info) {
    if (!info) return false;
    var rdns = (info.rdns || '').toLowerCase();
    var name = (info.name || '').toLowerCase();
    return rdns.indexOf('phantom') !== -1 || name.indexOf('phantom') !== -1;
  };

  try {
    Object.defineProperty(window, 'phantom', {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch (e) {}

  var origAdd = window.addEventListener.bind(window);
  window.addEventListener = function(type, listener, options) {
    if (type === 'eip6963:announceProvider' && typeof listener === 'function') {
      var wrapped = function(event) {
        try {
          if (event && event.detail && isPhantomInfo(event.detail.info)) return;
        } catch (e) {}
        return listener(event);
      };
      return origAdd(type, wrapped, options);
    }
    return origAdd(type, listener, options);
  };

  var origDispatch = window.dispatchEvent.bind(window);
  window.dispatchEvent = function(event) {
    try {
      if (event && event.type === 'eip6963:announceProvider' && event.detail && isPhantomInfo(event.detail.info)) {
        return true;
      }
    } catch (e) {}
    return origDispatch(event);
  };
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: phantomBlockScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-void-950 text-void-300">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
