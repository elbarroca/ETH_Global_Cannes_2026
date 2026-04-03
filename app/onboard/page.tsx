"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { onboard, configure, deposit, getUser } from "@/lib/api";
import { useUser } from "@/contexts/user-context";

type Step = 1 | 2 | 3 | 4;
type RiskProfile = "conservative" | "balanced" | "aggressive";
type NotifyPref = "every_cycle" | "trades_only" | "daily_digest";

export default function OnboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessage } = useSignMessage();
  const { user, setUser, linkCode } = useUser();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localLinkCode, setLocalLinkCode] = useState<string | null>(null);

  // Resume from correct step
  useEffect(() => {
    if (!user) return;
    if (user.telegram?.verified && user.agent.fundShares > 0) {
      router.push("/dashboard");
    } else if (user.agent.riskProfile && !user.telegram?.verified) {
      setStep(2);
    } else if (user.agent.fundShares > 0 && user.telegram?.verified) {
      setStep(4);
    } else if (user.id) {
      setStep(2);
    }
  }, [user, router]);

  // Poll for Telegram verification
  useEffect(() => {
    if (step !== 2 || !user?.id) return;
    const interval = setInterval(async () => {
      if (!address) return;
      const refreshed = await getUser(address);
      if (refreshed?.telegram?.verified) {
        setUser(refreshed);
        setStep(3);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, user?.id, address, setUser]);

  // Step 1: Connect wallet + onboard
  async function handleConnectAndOnboard() {
    if (!isConnected) {
      const connector = connectors.find((c) => c.name === "MetaMask") ?? connectors[0];
      if (connector) connect({ connector });
      return;
    }
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const nonce = Math.random().toString(36).slice(2, 10);
      const message = `Link wallet to VaultMind agent: ${nonce}`;
      await new Promise<void>((resolve, reject) => {
        signMessage(
          { message },
          {
            onSuccess: async (signature) => {
              try {
                const userData = await onboard(address, signature, message);
                setUser(userData);
                setLocalLinkCode(userData.linkCode ?? null);
                setStep(2);
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            onError: reject,
          }
        );
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Configure risk profile
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("balanced");
  const [notifyPref, setNotifyPref] = useState<NotifyPref>("trades_only");

  async function handleConfigure() {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await configure(user.id, riskProfile, notifyPref);
      setUser(updated);
      setStep(4);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Step 4: Deposit
  const [depositAmount, setDepositAmount] = useState("100");

  async function handleDeposit() {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await deposit(user.id, parseFloat(depositAmount));
      setUser(updated);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const displayLinkCode = localLinkCode ?? linkCode ?? user?.linkCode ?? "";

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Step indicator */}
      <div className="hidden md:flex flex-col items-center w-16 pt-20 gap-4">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s === step
                  ? "bg-indigo-500 text-white"
                  : s < step
                  ? "bg-green-500 text-white"
                  : "bg-slate-700 text-slate-500"
              }`}
            >
              {s < step ? "✓" : s}
            </div>
            {s < 4 && (
              <div className={`w-0.5 h-8 ${s < step ? "bg-green-500" : "bg-slate-700"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Step counter mobile */}
          <div className="md:hidden text-slate-500 text-sm mb-6">{step}/4</div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Connect Your Wallet</h1>
                <p className="text-slate-400 mt-2">
                  Connect your wallet to create your personal AI investment agent.
                </p>
              </div>
              <button
                onClick={handleConnectAndOnboard}
                disabled={loading}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-lg font-semibold text-white transition-colors"
              >
                {loading
                  ? "Creating agent…"
                  : isConnected
                  ? "Sign & Create Agent"
                  : "Connect MetaMask"}
              </button>
              {isConnected && address && (
                <p className="text-sm text-slate-500 text-center font-mono">
                  {address.slice(0, 10)}…{address.slice(-8)}
                </p>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Link Telegram</h1>
                <p className="text-slate-400 mt-2">
                  Get real-time trade notifications on Telegram.
                </p>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <p className="text-sm text-slate-400 mb-3">Your link code:</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-mono font-bold text-indigo-300 tracking-widest">
                    {displayLinkCode || "Loading…"}
                  </span>
                  {displayLinkCode && (
                    <button
                      onClick={() => navigator.clipboard.writeText(displayLinkCode)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400 space-y-1">
                <p>1. Open <strong className="text-white">@VaultMindBot</strong> on Telegram</p>
                <p>2. Send: <code className="text-indigo-300">/link {displayLinkCode}</code></p>
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Waiting for verification…
                </p>
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip for now →
              </button>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Configure Your Agent</h1>
                <p className="text-slate-400 mt-2">Choose your risk tolerance.</p>
              </div>

              <div className="grid gap-3">
                {(
                  [
                    { id: "conservative", icon: "🛡️", label: "Conservative", desc: "Max 5% per trade. Sleep well." },
                    { id: "balanced", icon: "⚖️", label: "Balanced", desc: "Max 12% per trade. Smart risk." },
                    { id: "aggressive", icon: "🔥", label: "Aggressive", desc: "Max 25% per trade. High conviction." },
                  ] as { id: RiskProfile; icon: string; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setRiskProfile(opt.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                      riskProfile === opt.id
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-700 bg-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <div className="font-semibold text-white">{opt.label}</div>
                      <div className="text-sm text-slate-400">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-400">Notifications:</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["every_cycle", "trades_only", "daily_digest"] as NotifyPref[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNotifyPref(p)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all ${
                        notifyPref === p
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-700 text-slate-500 hover:border-slate-600"
                      }`}
                    >
                      {p === "every_cycle" ? "Every Cycle" : p === "trades_only" ? "Trades Only" : "Daily Digest"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfigure}
                disabled={loading}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-lg font-semibold text-white transition-colors"
              >
                {loading ? "Saving…" : "Save & Continue →"}
              </button>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Deposit Funds</h1>
                <p className="text-slate-400 mt-2">
                  Fund your agent with USDC to start trading.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-400">Amount (USDC)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    min="1"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => setDepositAmount("1000")}
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                onClick={handleDeposit}
                disabled={loading}
                className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg font-semibold text-white transition-colors"
              >
                {loading ? "Processing…" : "Approve & Deposit →"}
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip, go to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
