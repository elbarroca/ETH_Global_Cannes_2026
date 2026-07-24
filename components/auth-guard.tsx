"use client";

import { useState, useSyncExternalStore } from "react";
import { useUser } from "@/contexts/user-context";
import { DawgLoader } from "./dawg-loader";

const AUTH_MESSAGES = [
  "Verifying wallet…",
  "Checking pack membership…",
  "Unlocking dashboard…",
];

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, user } = useUser();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [hasShownLoader, setHasShownLoader] = useState(false);
  const [blastDone, setBlastDone] = useState(false);

  const stillLoading = mounted && isConnected && !user;

  // Latch: once we've ever shown the loader, keep it mounted through the blast.
  if (stillLoading && !hasShownLoader) setHasShownLoader(true);

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
