"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
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
const QUICK_AMOUNTS = [1, 10, 50, 100];

// Our own public client — bypasses Dynamic/DRPC entirely
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

export default function DepositPage() {
  const { user, userId, refetch } = useUser();
  const { isConnected } = useConnection();
  const { data: walletClient } = useWalletClient();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  // `lastReceipt` is kept after the flow completes so we can show the user a
  // persistent success banner with a clickable ArcScan link — the previous
  // "Done!" state only lived on the disabled button for 3s and looked
  // identical to a loading state because `disabled:opacity-50` kicked in
  // once amount was cleared.
  const [lastReceipt, setLastReceipt] = useState<{
    txHash: string;
    amount: string;
    kind: Tab;
    at: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "wallet" | "confirming" | "recording">("idle");

  const deposited = user?.fund?.depositedUsdc ?? 0;
  const nav = user?.fund?.currentNav ?? 0;
  const shares = user?.fund?.htsShareBalance ?? 0;
  const proxyAddress = user?.proxyWallet?.address;
  const inftTokenId = user?.inftTokenId ?? null;

  async function handleDeposit() {
    if (!amount || parseFloat(amount) <= 0 || !userId || !proxyAddress || !walletClient) return;
    setError(null);

    const parsedAmount = parseFloat(amount);
    const usdcUnits = parseUnits(parsedAmount.toString(), 18);

    try {
      setStep("wallet");

      // Send via wagmi wallet client (Zerion/MetaMask/any) — bypasses Dynamic preview
      const txHash = await walletClient.sendTransaction({
        to: proxyAddress as `0x${string}`,
        value: usdcUnits,
        gas: 21000n,
        chain: arcTestnet,
      });

      setStep("confirming");

      // Wait for confirmation using our own RPC (not DRPC)
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setStep("recording");
      await deposit(userId, parsedAmount, txHash);
      setLastReceipt({
        txHash,
        amount: parsedAmount.toFixed(2),
        kind: "deposit",
        at: Date.now(),
      });
      setAmount("");
      await refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message)
        : "Transaction failed";
      // Don't show error if user just rejected
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
      setLastReceipt({
        txHash: "",
        amount: parseFloat(amount).toFixed(2),
        kind: "withdraw",
        at: Date.now(),
      });
      setAmount("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (tab === "deposit") {
      await handleDeposit();
    } else {
      await handleWithdraw();
    }
  }

  const isProcessing = loading || step !== "idle";

  const pnl = nav - deposited;
  const pnlPct = deposited > 0 ? (pnl / deposited) * 100 : 0;

  const statusText = step === "wallet"
    ? "Confirm in wallet..."
    : step === "confirming"
      ? "Waiting for on-chain confirmation..."
      : step === "recording"
        ? "Recording deposit..."
        : loading
          ? "Processing..."
          : null;

  return (
    <main className="max-w-7xl mx-auto px-5 py-5">
      <div className="max-w-md mx-auto space-y-3">
        {/* Lead Dawg identity header — who you're funding, all three on-chain
            anchors visible as single-click links. */}
        {(inftTokenId != null || proxyAddress) && (
          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-void-500">
                  Funding your Lead Dawg
                </span>
                {inftTokenId != null && (
                  <a
                    href={inftTokenUrl(inftTokenId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-gold-400/30 bg-gold-400/10 px-2 py-0.5 font-mono text-[10px] text-gold-400 hover:border-gold-400/50 hover:bg-gold-400/15 transition-colors"
                    title={`VaultMindAgent iNFT #${inftTokenId} on 0G Chain`}
                  >
                    iNFT #{inftTokenId} ↗ 0G Chainscan
                  </a>
                )}
              </div>
              {proxyAddress && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-void-600">
                    Agent wallet (Circle MPC on Arc)
                  </p>
                  <a
                    href={arcAddressUrl(proxyAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block font-mono text-xs text-void-300 hover:text-dawg-300 underline decoration-dotted truncate"
                    title={`${proxyAddress}\nClick to view on ArcScan`}
                  >
                    {proxyAddress} ↗
                  </a>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Deposit / Withdraw form */}
        <Card>
          <CardBody className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-void-800 rounded-xl">
              {(["deposit", "withdraw"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    tab === t
                      ? "bg-dawg-500 text-void-950"
                      : "text-void-500 hover:text-void-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Agent wallet info */}
            {tab === "deposit" && proxyAddress && (
              <div className="bg-void-900 border border-void-800 rounded-lg px-3 py-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-void-600">
                  Funds sent to your Agent Wallet
                </p>
                <p className="text-xs font-mono text-void-400 break-all">
                  {proxyAddress}
                </p>
                <p className="text-[10px] text-void-600">
                  Native USDC on Arc Testnet | Managed by Circle MPC
                </p>
              </div>
            )}

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-void-600">
                Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  className="w-full bg-void-950 border border-void-800 rounded-xl px-4 py-3 text-xl font-mono font-bold text-void-100 placeholder:text-void-700 focus:outline-none focus:ring-2 focus:ring-blood-600 focus:border-transparent pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono text-void-500">
                  USDC
                </span>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className="flex-1 py-1.5 bg-void-800 hover:bg-void-700 rounded-lg text-xs font-medium text-void-300 transition-colors"
                  >
                    ${q}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit button — yellow for deposit (primary), red for withdraw (destructive) */}
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !amount || !isConnected}
              className={`shine-sweep w-full py-3 disabled:opacity-50 font-semibold rounded-xl transition-colors ${
                tab === "deposit"
                  ? "bg-dawg-500 hover:bg-dawg-400 text-void-950"
                  : "bg-blood-600 hover:bg-blood-700 text-white"
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {statusText ?? "Processing..."}
                </span>
              ) : tab === "deposit" ? (
                "Deposit from Wallet"
              ) : (
                "Withdraw to wallet"
              )}
            </button>

            {!isConnected && tab === "deposit" && (
              <p className="text-center text-xs text-gold-400">
                Connect your wallet to deposit
              </p>
            )}

            {error && (
              <p className="text-center text-xs text-blood-300">{error}</p>
            )}

            {/* Success receipt — persists after the flow completes so the user
                has a clear confirmation with a clickable on-chain verification
                link. Previously the only signal was a dim "Done!" on the
                button, which looked identical to the loading state. */}
            {lastReceipt && !isProcessing && (
              <div className="border border-emerald-700/40 bg-emerald-950/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
                      {lastReceipt.kind === "deposit" ? "Deposit confirmed" : "Withdrawal confirmed"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLastReceipt(null)}
                    className="text-xs text-void-500 hover:text-void-300"
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-void-300">
                  ${lastReceipt.amount} USDC{" "}
                  {lastReceipt.kind === "deposit" ? "sent to agent wallet" : "returned to your wallet"}
                </p>
                {lastReceipt.txHash && (
                  <a
                    href={arcTxUrl(lastReceipt.txHash) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
                    title={lastReceipt.txHash}
                  >
                    {lastReceipt.txHash.slice(0, 10)}…{lastReceipt.txHash.slice(-8)}
                    <span className="text-[10px]">↗ ArcScan</span>
                  </a>
                )}
              </div>
            )}

            <p className="text-center text-xs text-void-600">
              {tab === "deposit"
                ? "Sends native USDC from your wallet to your agent wallet on Arc Testnet"
                : "Withdraws USDC from your agent wallet back to you"}
            </p>
          </CardBody>
        </Card>

        {/* Your Position */}
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-void-200 mb-3">
              Your Position
            </h3>
            <div className="space-y-2">
              <Row
                label="Deposited"
                value={`$${deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              />
              <Row
                label="Current value"
                value={`$${nav.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                valueClass="text-green-400"
              />
              <Row
                label="P&L"
                value={`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`}
                valueClass={pnl >= 0 ? "text-green-400" : "text-blood-300"}
              />
              <Row
                label="Fund shares (HTS)"
                value={`${shares.toLocaleString("en-US", { minimumFractionDigits: 2 })} DAWG`}
                valueClass="font-mono text-void-200"
              />
            </div>
          </CardBody>
        </Card>

        {/* Agent Status */}
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-void-200 mb-3">
              Agent Status
            </h3>
            <div className="space-y-2">
              <Row
                label="Status"
                value={user?.agent.active ? "Active" : "Inactive"}
                valueClass={user?.agent.active ? "text-green-400" : "text-void-500"}
              />
              <Row
                label="Risk profile"
                value={user?.agent.riskProfile ?? "---"}
              />
              <Row
                label="Hunts run"
                value={String(user?.agent.lastCycleId ?? 0)}
              />
              {user?.agent.lastCycleAt && (
                <Row
                  label="Last hunt"
                  value={new Date(user.agent.lastCycleAt).toLocaleString()}
                />
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  valueClass = "text-void-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-void-500">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
