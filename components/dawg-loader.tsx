"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { DawgLogo } from "./dawg-logo";

interface DawgLoaderProps {
  /** Parent-controlled. When this transitions `true → false`, the coin blasts. */
  isLoading: boolean;
  /** Cycled under the coin. Sensible defaults provided. */
  messages?: string[];
  /** Fired after the blast animation completes. */
  onComplete?: () => void;
  /** `true` = fixed fullscreen overlay; `false` = inline block. Defaults to fullscreen. */
  fullScreen?: boolean;
  /** Milliseconds between message rotations. Defaults to 2000. */
  messageIntervalMs?: number;
}

type Phase = "spinning" | "blasting" | "done";

const DEFAULT_MESSAGES = [
  "Setting up agents…",
  "Retrieving wallet…",
  "Getting things ready…",
];

/** 12 particle angles in 30° increments for the blast burst. */
const PARTICLE_ANGLES = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * Coin-flip loading experience.
 *
 * States:
 *   spinning  → coin rotates on Y axis, text cycles through messages
 *   blasting  → coin explodes outward with shockwave ring + 12 particles
 *   done      → component returns null; `onComplete` has fired
 */
export function DawgLoader({
  isLoading,
  messages = DEFAULT_MESSAGES,
  onComplete,
  fullScreen = true,
  messageIntervalMs = 2000,
}: DawgLoaderProps) {
  const [phase, setPhase] = useState<Phase>(isLoading ? "spinning" : "blasting");
  const [messageIndex, setMessageIndex] = useState(0);

  // Trigger blast when parent flips isLoading off.
  useEffect(() => {
    if (!isLoading && phase === "spinning") {
      setPhase("blasting");
    }
  }, [isLoading, phase]);

  // Cycle messages while spinning.
  useEffect(() => {
    if (phase !== "spinning") return;
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, messageIntervalMs);
    return () => clearInterval(id);
  }, [phase, messages.length, messageIntervalMs]);

  // Cleanup handler: fires when the blast coin animation ends.
  const handleBlastEnd = () => {
    if (phase !== "blasting") return;
    setPhase("done");
    onComplete?.();
  };

  if (phase === "done") return null;

  const containerClass = fullScreen
    ? "fixed inset-0 z-50 flex items-center justify-center bg-void-950/95 backdrop-blur-sm"
    : "flex items-center justify-center py-8";

  const isBlasting = phase === "blasting";
  const currentMessage = messages[messageIndex] ?? "";

  return (
    <div className={containerClass} aria-live="polite" aria-busy={!isBlasting}>
      <div className="flex flex-col items-center">
        {/* Coin stage — perspective wrapper for 3D flip */}
        <div className="dawg-loader-stage relative w-28 h-28">
          {/* Shockwave ring (only during blast) */}
          {isBlasting && <div className="dawg-shockwave" aria-hidden="true" />}

          {/* Particle burst (only during blast) */}
          {isBlasting &&
            PARTICLE_ANGLES.map((angle) => (
              <span
                key={angle}
                className="dawg-particle"
                style={{ "--dawg-angle": `${angle}deg` } as CSSProperties}
                aria-hidden="true"
              />
            ))}

          {/* The coin itself — logo inside a circular mask */}
          <div
            className={`dawg-coin w-28 h-28 rounded-full overflow-hidden ${
              isBlasting ? "dawg-coin-blast" : "dawg-coin-spin"
            }`}
            onAnimationEnd={isBlasting ? handleBlastEnd : undefined}
          >
            <DawgLogo className="w-full h-full" />
          </div>
        </div>

        {/* Cycling text label */}
        <div
          className="mt-6 h-5 font-mono text-sm text-void-300 tracking-wide transition-opacity duration-200"
          style={{ opacity: isBlasting ? 0 : 1 }}
        >
          <span key={messageIndex} className="dawg-text-in inline-block">
            {currentMessage}
          </span>
        </div>
      </div>
    </div>
  );
}
