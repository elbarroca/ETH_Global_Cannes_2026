"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DawgLoader } from "./dawg-loader";

/** Minimum coin spin before blast — keeps the loader visible even on instant client navigations. */
const MIN_SPIN_MS = 1000;

const ROUTE_MESSAGES = [
  "Turning the page…",
  "Syncing route…",
  "Loading AlphaDawg…",
];

type Session = { id: number; loading: boolean };

function RouteTransitionLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const prevKeyRef = useRef<string | null>(null);
  const sessionIdRef = useRef(0);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (prevKeyRef.current === null) {
      prevKeyRef.current = routeKey;
      return;
    }
    if (prevKeyRef.current === routeKey) return;
    prevKeyRef.current = routeKey;

    sessionIdRef.current += 1;
    const id = sessionIdRef.current;
    setSession({ id, loading: true });

    const t = window.setTimeout(() => {
      setSession((s) => (s && s.id === id ? { ...s, loading: false } : s));
    }, MIN_SPIN_MS);

    return () => window.clearTimeout(t);
  }, [routeKey]);

  if (!session) return null;

  return (
    <DawgLoader
      key={session.id}
      isLoading={session.loading}
      messages={ROUTE_MESSAGES}
      messageIntervalMs={1800}
      className="z-[100]"
      onComplete={() => setSession(null)}
    />
  );
}

/**
 * Fullscreen coin spin + blast on every client-side route change (including
 * query updates). Skips the very first paint so the initial document load is
 * not double-covered.
 */
export function RouteTransitionLoader() {
  return (
    <Suspense fallback={null}>
      <RouteTransitionLoaderInner />
    </Suspense>
  );
}
