"use client";

import { usePathname } from "next/navigation";
import { WalletConnectButton } from "@/components/wallet-connect";
import { useUser, type AuthIssue, type AuthState } from "@/contexts/user-context";

function Boundary({
  state,
  issue,
  error,
  action,
  onAction,
}: {
  state: AuthState;
  issue: AuthIssue;
  error: string | null;
  action: string;
  onAction: () => Promise<void>;
}) {
  const content = issue === "AUTH_ACTION_REQUIRED"
    ? ["Workspace authorization required", "Authorize workspace"]
    : state === "onboarding"
      ? ["Onboarding required", "Complete onboarding"]
      : state === "stale"
        ? ["Authorization expired", "Authorize workspace"]
      : issue === "WALLET_SIGNATURE_REJECTED"
          ? ["Signature declined", "Retry signature"]
          : ["Authentication failed", action];
  return (
    <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4 py-10">
      <section role="alert" className="instrument-panel w-full max-w-lg p-6 text-center sm:p-8">
        <p className="instrument-label text-dawg-400">Protected workspace</p>
        <h1 className="mt-3 text-2xl font-semibold text-void-100">{content[0]}</h1>
        <p className="mx-auto mt-3 max-w-md break-words text-sm leading-relaxed text-void-400">
          {error ?? "A wallet signature is required before protected data can be requested."}
        </p>
        <button type="button" onClick={() => void onAction()} className="instrument-button instrument-button-primary mt-6">
          {content[1]}
        </button>
      </section>
    </main>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authState, authIssue, authError, onboardWallet, reauthenticate, retryAuthentication } = useUser();

  if (pathname === "/" || authState === "ready") return <>{children}</>;

  if (authState === "disconnected") {
    return (
      <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4 py-10">
        <section className="instrument-panel w-full max-w-lg p-6 text-center sm:p-8">
          <p className="instrument-label text-dawg-400">Protected workspace</p>
          <h1 className="mt-3 text-2xl font-semibold text-void-100">Connect your wallet</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-void-400">Connect the wallet that owns your protected goals, agents, and buyer receipts.</p>
          <div className="mt-6 flex justify-center"><WalletConnectButton /></div>
        </section>
      </main>
    );
  }

  if ((authState === "signing" && authIssue !== "AUTH_ACTION_REQUIRED") || (authState === "onboarding" && !authError)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6" aria-busy="true">
        <div role="status" className="instrument-panel space-y-4 p-6">
          <div className="h-3 w-32 animate-pulse rounded-[10px] bg-void-800" />
          <div className="h-8 w-3/4 animate-pulse rounded-[10px] bg-void-800" />
          <div className="h-4 w-full animate-pulse rounded-[10px] bg-void-800" />
          <p className="text-sm text-void-400">{authIssue === "CHECKING_SESSION" ? "Checking wallet authorization." : authState === "signing" ? "Confirm the requested wallet signature." : "Creating the protected user record."}</p>
        </div>
      </main>
    );
  }

  if (authState === "onboarding") return <Boundary state={authState} issue={authIssue} error={authError} action="Complete onboarding" onAction={onboardWallet} />;
  if (authIssue === "WALLET_SIGNATURE_REJECTED") return <Boundary state={authState} issue={authIssue} error={authError} action="Retry signature" onAction={retryAuthentication} />;
  return <Boundary state={authState} issue={authIssue} error={authError} action="Authorize workspace" onAction={reauthenticate} />;
}
