import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/contexts/wagmi-provider";
import { Nav } from "@/components/nav";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlphaDawg",
  description: "Your AI pack hunts alpha. Provable investment decisions with adversarial debate, sealed inference, and on-chain verification.",
};

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
      <body className="min-h-full flex flex-col bg-void-950 text-void-300">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
