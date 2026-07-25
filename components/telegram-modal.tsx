"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DawgLogo } from "./dawg-logo";

const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "ETHGlobal_Cannes_2026_Bot";
const CODE_TTL_MS = 10 * 60 * 1000;

interface TelegramModalProps {
  linkCode: string | null;
  onRefresh: () => Promise<void>;
}

type CopyState = "idle" | "copied" | "failed";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function TelegramModal({ linkCode, onRefresh }: TelegramModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const refreshButtonRef = useRef<HTMLButtonElement>(null);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(CODE_TTL_MS / 1000));
  const [expired, setExpired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.focus();

    const containFocus = (event: KeyboardEvent): void => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutside = activeElement === panel || !panel.contains(activeElement);
      if (focusIsOutside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", containFocus);
    return () => {
      document.removeEventListener("keydown", containFocus);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!expired || refreshing) return;
    (refreshButtonRef.current ?? panelRef.current)?.focus();
  }, [expired, refreshing]);

  useEffect(() => {
    if (!linkCode) return;

    setSecondsLeft(Math.floor(CODE_TTL_MS / 1000));
    setExpired(false);
    setCopyState("idle");
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((CODE_TTL_MS - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setExpired(true);
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [linkCode]);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }, [linkCode]);

  const handleRefresh = useCallback(async (): Promise<void> => {
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
    ? `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(linkCode)}`
    : null;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdown = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="dialog-backdrop" data-testid="telegram-dialog-backdrop">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="telegram-dialog-title"
        aria-describedby="telegram-dialog-description"
        tabIndex={-1}
        className="dialog-panel max-w-lg p-5 sm:p-8"
      >
        <div className="grid gap-7">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <DawgLogo size={128} className="h-14 w-14 rounded-xl" />
            <div>
              <h2 id="telegram-dialog-title" className="text-2xl font-bold text-void-100">
                Link Telegram to this wallet session
              </h2>
              <p
                id="telegram-dialog-description"
                className="mt-2 text-sm leading-relaxed text-void-400"
              >
                Telegram sends commands to the same authenticated account. It never replaces
                wallet authority.
              </p>
            </div>
          </div>

          {!linkCode && (
            <div role="status" aria-live="polite" className="border-t border-void-800 pt-6">
              <p className="text-sm font-medium text-void-200">Preparing a one-time code</p>
              <p className="mt-1 text-xs leading-relaxed text-void-500">
                Keep this dialog open while the authenticated session creates the link.
              </p>
            </div>
          )}

          {linkCode && !expired && deepLink && (
            <div className="grid gap-5">
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-xl bg-dawg-500 px-5 py-3 font-bold text-void-950 transition-[background-color,transform] hover:bg-dawg-400 active:translate-y-px"
              >
                Open Telegram
              </a>

              <div className="border-t border-void-800 pt-5">
                <p className="text-sm text-void-400">
                  Or send this one-time code in a private chat.
                </p>
                <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                  <code
                    aria-label={`One-time Telegram code ${linkCode}`}
                    className="min-w-0 flex-1 break-all rounded-xl border border-void-700 bg-void-950 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.22em] text-dawg-400"
                  >
                    {linkCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="min-h-11 shrink-0 rounded-xl border border-void-600 px-4 py-2 text-sm font-semibold text-void-200 transition-[border-color,color,transform] hover:border-void-400 hover:text-void-100 active:translate-y-px"
                  >
                    {copyState === "copied"
                      ? "Copied"
                      : copyState === "failed"
                        ? "Copy failed"
                        : "Copy code"}
                  </button>
                </div>
                <p aria-live="polite" className="mt-2 min-h-5 text-xs text-void-500">
                  {copyState === "copied" && "Code copied to the clipboard."}
                  {copyState === "failed" &&
                    "Clipboard access was refused. Select and copy the code manually."}
                </p>
              </div>

              <div role="status" aria-live="polite" className="border-t border-void-800 pt-5">
                <p className="text-sm font-medium text-void-200">
                  Waiting for Telegram to confirm this private chat.
                </p>
                <p className="mt-1 font-mono text-xs text-void-500">
                  Code expires in {countdown}
                </p>
              </div>
            </div>
          )}

          {linkCode && expired && (
            <div role="status" aria-live="polite" className="border-t border-void-800 pt-6">
              <p className="text-base font-semibold text-blood-300">
                This code expired without linking an account.
              </p>
              <button
                ref={refreshButtonRef}
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                aria-busy={refreshing}
                className="mt-4 min-h-11 rounded-xl bg-dawg-500 px-5 py-2.5 font-semibold text-void-950 transition-[background-color,transform] hover:bg-dawg-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? "Creating new code" : "Create new code"}
              </button>
              {refreshError && (
                <p role="alert" className="mt-3 text-sm text-blood-300">
                  A new code could not be created. Try again.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
