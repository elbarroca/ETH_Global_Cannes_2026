"use client";

import { useUser } from "@/contexts/user-context";
import { TelegramModal } from "./telegram-modal";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isOnboarded, telegramVerified, linkCode, refreshLinkCode } = useUser();

  // Show unskippable modal when wallet connected but telegram not linked
  if (isOnboarded && !telegramVerified) {
    return (
      <>
        <div className="blur-sm pointer-events-none select-none" aria-hidden>
          {children}
        </div>
        <TelegramModal linkCode={linkCode} onRefresh={refreshLinkCode} />
      </>
    );
  }

  return <>{children}</>;
}
