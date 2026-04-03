import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/contexts/wagmi-provider";
import { Nav } from "@/components/nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VaultMind — AI Investment Agent",
  description:
    "Your AI agent hires specialist sub-agents via nanopayments, debates adversarially inside TEE enclaves, and logs every decision to Hedera immutably.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-gray-50 text-gray-900">
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
