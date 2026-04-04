"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { DawgLoader } from "./dawg-loader";

const AUTH_MESSAGES = [
  "Verifying wallet…",
  "Checking pack membership…",
  "Unlocking dashboard…",
];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [hasShownLoader, setHasShownLoader] = useState(false);
  const [blastDone, setBlastDone] = useState(false);

  // Wait for client hydration before rendering conditional UI —
  // prevents SSR mismatch with Dynamic Labs' injected elements.
  useEffect(() => setMounted(true), []);

  const stillLoading = mounted && isConnected && !user;

  // Latch: once we've ever shown the loader, keep it mounted through the blast.
  useEffect(() => {
    if (stillLoading) setHasShownLoader(true);
  }, [stillLoading]);

  if (!mounted) return <>{children}</>;

  // Never triggered the loader (fast load / not connected) → just render.
  if (!hasShownLoader) return <>{children}</>;

  // Loader was shown and blast has completed → reveal content.
  if (blastDone) return <>{children}</>;

  // Loader is active (spinning or blasting). When `stillLoading` flips false,
  // DawgLoader internally transitions to 'blasting' and fires onComplete.
  return (
    <DawgLoader
      isLoading={stillLoading}
      messages={AUTH_MESSAGES}
      onComplete={() => setBlastDone(true)}
    />
  );
}
