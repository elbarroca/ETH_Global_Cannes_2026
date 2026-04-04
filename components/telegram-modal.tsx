"use client";

import { useState, useEffect, useCallback } from "react";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "ETHGlobal_Cannes_2026_Bot";
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface TelegramModalProps {
  linkCode: string | null;
  onRefresh: () => Promise<void>;
}

export function TelegramModal({ linkCode, onRefresh }: TelegramModalProps) {
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [expired, setExpired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  // Countdown timer
  useEffect(() => {
    setSecondsLeft(Math.floor(CODE_TTL_MS / 1000));
    setExpired(false);
    const start = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, Math.floor((CODE_TTL_MS - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setExpired(true);
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [linkCode]);

  const handleCopy = useCallback(() => {
    if (!linkCode) return;
    navigator.clipboard.writeText(linkCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [linkCode]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      await onRefresh();
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const deepLink = linkCode
    ? `https://t.me/${BOT_USERNAME}?start=${linkCode}`
    : null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-void-900 border border-void-800 rounded-2xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-4xl">
            <svg viewBox="0 0 120 120" className="w-16 h-16 mx-auto" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="112" height="112" rx="28" fill="#0C0A09"/>
              <path d="M28 92 L42 28 L60 48 L78 28 L92 92 Z" fill="#7F1D1D"/>
              <path d="M34 92 L46 36 L60 52 L74 36 L86 92 Z" fill="#DC2626"/>
              <circle cx="50" cy="54" r="4.5" fill="#FBBF24"/>
              <circle cx="70" cy="54" r="4.5" fill="#FBBF24"/>
              <circle cx="50" cy="54" r="2" fill="#0C0A09"/>
              <circle cx="70" cy="54" r="2" fill="#0C0A09"/>
              <path d="M55 69 L60 73 L65 69" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-void-100">Connect Telegram</h2>
          <p className="text-sm text-void-400">
            Your agent reports hunts, debates, and proofs via Telegram. This step is required.
          </p>
        </div>

        {/* Deep link button */}
        {deepLink && !expired && (
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-5 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 text-white font-semibold rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.357.14-.488.003l.006-.043.21-2.958 5.32-4.81c.232-.202-.054-.316-.36-.114l-6.575 4.142-2.832-.886c-.613-.192-.626-.613.13-.908l11.076-4.268c.512-.196.96.126.794.907l.219-.037z"/>
            </svg>
            Open in Telegram
          </a>
        )}

        {/* Link code display */}
        {linkCode && !expired && (
          <div className="space-y-2">
            <p className="text-xs text-void-500 text-center">
              Or enter this code manually in Telegram:
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="flex gap-1.5">
                {linkCode.split("").map((char, i) => (
                  <span
                    key={i}
                    className="w-9 h-11 flex items-center justify-center bg-void-950 border border-void-800 rounded-lg text-gold-400 font-mono text-lg font-bold"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <button
                onClick={handleCopy}
                className="p-2 text-void-500 hover:text-void-200 transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Expired state */}
        {expired && (
          <div className="text-center space-y-3">
            <p className="text-sm text-blood-300">Code expired</p>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-5 py-2.5 bg-void-800 hover:bg-void-700 text-void-200 border border-void-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {refreshing ? "Generating..." : "Get new code"}
            </button>
            {refreshError && (
              <p className="text-xs text-blood-400">Failed to generate new code. Try again.</p>
            )}
          </div>
        )}

        {/* Waiting indicator */}
        {!expired && (
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-void-500">
              <span className="w-2 h-2 bg-blood-500 rounded-full animate-pulse" />
              Waiting for verification...
            </div>
            <p className="text-xs text-void-600 font-mono">
              Code expires in {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
