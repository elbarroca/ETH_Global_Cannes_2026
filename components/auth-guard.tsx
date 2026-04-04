"use client";

import { useUser } from "@/contexts/user-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, user } = useUser();

  // While wallet is connected but user record hasn't loaded yet, show loading
  // This prevents a flash of unblocked content before the modal appears
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
