"use client";

import { usePathname } from "next/navigation";
import { useUser } from "@/contexts/user-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authState, authError, reauthenticate } = useUser();
  const isEntry = pathname === "/";

  if (authState === "ready" || authState === "disconnected" || isEntry) {
    return <>{children}</>;
  }

  if (authState === "onboarding" && authError) {
    return (
      <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
        <div role="alert" className="w-full max-w-md border-y border-void-800 py-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-dawg-400">Onboarding required</p>
          <h1 className="mt-3 text-2xl font-semibold text-void-100">Complete protected onboarding</h1>
          <p className="mt-2 break-words text-sm text-void-400">{authError}</p>
          <button type="button" onClick={() => void reauthenticate()} className="instrument-button instrument-button-primary mt-6">Retry SIWE</button>
        </div>
      </main>
    );
  }

  if (authState === "signing" || authState === "onboarding") {
    return (
      <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
        <div role="status" className="w-full max-w-md border-y border-void-800 py-8 text-center">
          <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-dawg-500 border-t-transparent" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-void-100">
            {authState === "signing" ? "Confirm wallet signature" : "Preparing your workspace"}
          </h1>
          <p className="mt-2 text-sm text-void-400">
            {authState === "signing" ? "Approve the SIWE message in your wallet." : "Binding this session to your protected account."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
      <div role="alert" className="w-full max-w-md border-y border-void-800 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-dawg-400">
          {authState === "stale" ? "Authorization expired" : "Authentication failed"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-void-100">Sign in again to continue</h1>
        <p className="mt-2 break-words text-sm text-void-400">{authError ?? "A fresh wallet signature is required."}</p>
        <button type="button" onClick={() => void reauthenticate()} className="instrument-button instrument-button-primary mt-6">
          Retry SIWE
        </button>
      </div>
    </main>
  );
}
