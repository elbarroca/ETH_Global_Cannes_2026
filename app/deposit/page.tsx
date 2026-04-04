"use client";

import { useState } from "react";
import { useUser } from "@/contexts/user-context";
import { deposit, withdraw } from "@/lib/api";
import { useConnection, useWalletClient } from "wagmi";
import { parseUnits, createPublicClient, http } from "viem";
import { arcTestnet } from "@/contexts/wagmi-provider";
import {
  arcAddressUrl,
  arcTxUrl,
  inftTokenUrl,
} from "@/lib/links";

type Tab = "deposit" | "withdraw";
const QUICK_AMOUNTS = [1, 5, 10, 50, 100];

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

export default function DepositPage() {
  const { user, userId, refetch, agentBalance, refreshAgentBalance } = useUser();
  const { isConnected } = useConnection();
  const { data: walletClient } = useWalletClient();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    txHash: string;
    amount: string;
    kind: Tab;
    at: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "wallet" | "confirming" | "recording">("idle");

  // Live on-chain balance from UserContext — same source nav + hero read.
  // Fall back to the DB accounting number only while the first Arc RPC read
  // is still in flight.
  const deposited = agentBalance ?? user?.fund?.depositedUsdc ?? 0;
  const nav = user?.fund?.currentNav ?? 0;
  const shares = user?.fund?.htsShareBalance ?? 0;
  const proxyAddress = user?.proxyWallet?.address;
  const inftTokenId = user?.inftTokenId ?? null;

  const pnl = nav - deposited;
  const pnlPct = deposited > 0 ? (pnl / deposited) * 100 : 0;

  async function handleDeposit() {
    if (!amount || parseFloat(amount) <= 0 || !userId || !proxyAddress || !walletClient) return;
    setError(null);
    const parsedAmount = parseFloat(amount);
    const usdcUnits = parseUnits(parsedAmount.toString(), 18);

    try {
      setStep("wallet");
      const txHash = await walletClient.sendTransaction({
        to: proxyAddress as `0x${string}`,
        value: usdcUnits,
        gas: 21000n,
        chain: arcTestnet,
      });
      setStep("confirming");
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStep("recording");
      await deposit(userId, parsedAmount, txHash);
      setLastReceipt({ txHash, amount: parsedAmount.toFixed(2), kind: "deposit", at: Date.now() });
      setAmount("");
      // Refetch the user record AND force-refresh the live balance so every
      // UI surface (nav chip, hero DEPOSITED, this page, dashboard card)
      // flips to the new number on the same render pass.
      await Promise.all([refetch(), refreshAgentBalance()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message)
        : "Transaction failed";
      if (!msg.includes("User denied") && !msg.includes("user rejected")) {
        setError(msg);
      }
    } finally {
      setStep("idle");
    }
  }

  async function handleWithdraw() {
    if (!amount || parseFloat(amount) <= 0 || !userId) return;
    setLoading(true);
    setError(null);
    try {
      await withdraw(userId, parseFloat(amount));
      setLastReceipt({ txHash: "", amount: parseFloat(amount).toFixed(2), kind: "withdraw", at: Date.now() });
      setAmount("");
      await Promise.all([refetch(), refreshAgentBalance()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (tab === "deposit") await handleDeposit();
    else await handleWithdraw();
  }

  const isProcessing = loading || step !== "idle";

  const statusText = step === "wallet"
    ? "Confirm in wallet..."
    : step === "confirming"
      ? "Waiting for on-chain confirmation..."
      : step === "recording"
        ? "Recording deposit..."
        : loading ? "Processing..." : null;

  return (
    <main className="max-w-screen-2xl mx-auto px-5 py-5">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Hero — Nasdaq LED balance display */}
        <div className="nasdaq-led nasdaq-scanlines nasdaq-dot-matrix rounded-2xl px-6 py-8 border border-dawg-500/20 glow-card text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-void-600 mb-2">Agent Wallet Balance</p>
          <p className="font-pixel text-[56px] leading-none tabular-nums glow-dawg-strong text-[#FFE066]">
            ${deposited.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="font-pixel text-[16px] text-void-500 mt-2">USDC on Arc Testnet</p>

          {/* Stats strip */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-dawg-500/10">
            <div className="text-center">
              <p className="font-pixel text-[13px] text-void-600 uppercase tracking-wider">NAV</p>
              <p className="font-pixel text-[22px] tabular-nums text-[#FFCC00] glow-dawg">
                ${nav.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-px h-8 bg-dawg-500/20" />
            <div className="text-center">
              <p className="font-pixel text-[13px] text-void-600 uppercase tracking-wider">P&L</p>
              <p className={`font-pixel text-[22px] tabular-nums ${pnl >= 0 ? "text-[#39FF7A] glow-green" : "text-[#FF5A5A] glow-red"}`}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </p>
            </div>
            <div className="w-px h-8 bg-dawg-500/20" />
            <div className="text-center">
              <p className="font-pixel text-[13px] text-void-600 uppercase tracking-wider">Shares</p>
              <p className="font-pixel text-[22px] tabular-nums text-[#FFCC00] glow-dawg">
                {shares.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Agent identity strip */}
        {(inftTokenId != null || proxyAddress) && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-void-900 border border-void-800 rounded-xl flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dawg-500/10 border border-dawg-500/30 flex items-center justify-center">
                <span className="text-lg">🐺</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-void-200">Lead Dawg</p>
                {proxyAddress && (
                  <a
                    href={arcAddressUrl(proxyAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-void-500 hover:text-dawg-400 transition-colors"
                  >
                    {proxyAddress.slice(0, 8)}...{proxyAddress.slice(-6)} ↗
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {inftTokenId != null && (
                <a
                  href={inftTokenUrl(inftTokenId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-gold-400/30 bg-gold-400/10 px-2.5 py-1 font-mono text-[10px] text-gold-400 hover:border-gold-400/50 transition-colors"
                >
                  iNFT #{inftTokenId} ↗
                </a>
              )}
              <span className="text-[9px] px-2 py-1 bg-void-800 text-void-500 rounded-lg border border-void-700">Circle MPC</span>
            </div>
          </div>
        )}

        {/* Deposit / Withdraw card */}
        <div className="bg-void-900 border border-void-800 rounded-2xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-void-800">
            {(["deposit", "withdraw"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
                  tab === t
                    ? t === "deposit"
                      ? "bg-dawg-500/10 text-dawg-400 border-b-2 border-dawg-500"
                      : "bg-blood-500/10 text-blood-300 border-b-2 border-blood-500"
                    : "text-void-600 hover:text-void-400 hover:bg-void-850"
                }`}
              >
                {t === "deposit" ? "Fund Agent" : "Withdraw"}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-5">
            {/* Where funds go */}
            {tab === "deposit" && proxyAddress && (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-void-950 border border-void-800 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-void-400">Funds go to your <span className="text-emerald-400 font-semibold">Circle MPC</span> agent wallet</p>
                  <p className="text-[10px] font-mono text-void-600 truncate">{proxyAddress}</p>
                </div>
              </div>
            )}

            {/* Amount input */}
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-pixel text-[24px] text-void-600">$</div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  className="w-full bg-void-950 border border-void-800 focus:border-dawg-500/50 rounded-xl pl-10 pr-20 py-4 font-pixel text-[32px] text-void-100 placeholder:text-void-800 focus:outline-none focus:glow-card transition-all tabular-nums"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-pixel text-[16px] text-void-600">
                  USDC
                </span>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                      amount === q.toString()
                        ? "bg-dawg-500/15 text-dawg-400 border-dawg-500/40"
                        : "bg-void-950 text-void-500 border-void-800 hover:border-void-700 hover:text-void-300"
                    }`}
                  >
                    ${q}
                  </button>
                ))}
                {deposited > 0 && tab === "withdraw" && (
                  <button
                    onClick={() => setAmount(deposited.toString())}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-void-950 text-blood-400 border border-blood-500/30 hover:bg-blood-500/10 transition-all"
                  >
                    Max
                  </button>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !amount || !isConnected}
              className={`shine-sweep w-full py-4 disabled:opacity-40 font-bold text-sm uppercase tracking-wider rounded-xl transition-all ${
                tab === "deposit"
                  ? "bg-dawg-500 hover:bg-dawg-400 text-void-950"
                  : "bg-blood-600 hover:bg-blood-500 text-white"
              } ${isProcessing ? "hunting" : ""}`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {statusText}
                </span>
              ) : tab === "deposit" ? (
                `Deposit $${amount || "0"} USDC`
              ) : (
                `Withdraw $${amount || "0"} USDC`
              )}
            </button>

            {!isConnected && tab === "deposit" && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 bg-dawg-500/10 border border-dawg-500/20 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-dawg-400 animate-pulse" />
                <p className="text-xs text-dawg-400 font-semibold">Connect your wallet to deposit</p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 py-2 px-3 bg-blood-500/10 border border-blood-500/20 rounded-xl">
                <span className="text-blood-400 text-sm">!</span>
                <p className="text-xs text-blood-300">{error}</p>
              </div>
            )}

            {/* Success receipt */}
            {lastReceipt && !isProcessing && (
              <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-bold text-emerald-300">
                      {lastReceipt.kind === "deposit" ? "Deposit confirmed" : "Withdrawal confirmed"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastReceipt(null)}
                    className="text-xs text-void-500 hover:text-void-300"
                  >
                    ✕
                  </button>
                </div>
                <p className="font-pixel text-[20px] text-emerald-400 glow-green">
                  ${lastReceipt.amount} USDC
                </p>
                {lastReceipt.txHash && (
                  <a
                    href={arcTxUrl(lastReceipt.txHash) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
                  >
                    {lastReceipt.txHash.slice(0, 10)}…{lastReceipt.txHash.slice(-8)}
                    <span className="text-[10px]">↗ ArcScan</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Agent Status — compact card */}
        <div className="bg-void-900 border border-void-800 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${user?.agent.active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-void-600"}`} />
            <h3 className="text-sm font-semibold text-void-300 uppercase tracking-wider">Agent Status</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCell label="Status" value={user?.agent.active ? "Active" : "Paused"} accent={user?.agent.active ? "emerald" : "void"} />
            <StatCell label="Risk" value={user?.agent.riskProfile ?? "—"} accent="dawg" />
            <StatCell label="Hunts" value={String(user?.agent.lastCycleId ?? 0)} accent="dawg" />
            <StatCell label="P&L %" value={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`} accent={pnl >= 0 ? "green" : "red"} />
          </div>
        </div>

        {/* How it works — quick info */}
        <div className="grid grid-cols-3 gap-3">
          <InfoCard step="1" title="Fund" description="Deposit USDC to your Circle MPC agent wallet on Arc" />
          <InfoCard step="2" title="Hunt" description="Your agent hires specialists, debates, and decides" />
          <InfoCard step="3" title="Prove" description="Every decision logged to Hedera HCS + 0G Storage" />
        </div>
      </div>
    </main>
  );
}

function StatCell({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-400",
    dawg: "text-[#FFCC00]",
    green: "text-[#39FF7A]",
    red: "text-[#FF5A5A]",
    void: "text-void-500",
  };
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-void-600 mb-0.5">{label}</p>
      <p className={`font-pixel text-[18px] leading-none ${colors[accent] ?? "text-void-300"}`}>{value}</p>
    </div>
  );
}

function InfoCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="bg-void-900 border border-void-800 rounded-xl px-3 py-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-md bg-dawg-500/15 border border-dawg-500/30 flex items-center justify-center font-pixel text-[12px] text-dawg-400">{step}</span>
        <span className="text-xs font-bold text-void-200 uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-[10px] text-void-500 leading-relaxed">{description}</p>
    </div>
  );
}
