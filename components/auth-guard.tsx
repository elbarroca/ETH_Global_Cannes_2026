"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/contexts/user-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, user } = useUser();
  const [mounted, setMounted] = useState(false);

  // Wait for client hydration before rendering conditional UI
  // This prevents SSR mismatch with Dynamic Labs' injected elements
  useEffect(() => setMounted(true), []);

  if (!mounted) return <>{children}</>;

  // While wallet is connected but user record hasn't loaded yet, show loading
  if (isConnected && !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blood-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-void-500">Loading your agent...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
