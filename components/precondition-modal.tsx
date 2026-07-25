"use client";

import { WarningCircleIcon } from "@phosphor-icons/react";

interface PreconditionModalProps {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  onClose: () => void;
  onNavigate: (href: string) => void;
}

export function PreconditionModal({
  title,
  body,
  ctaLabel,
  ctaHref,
  onClose,
  onNavigate,
}: PreconditionModalProps) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel max-w-sm">
        <div className="px-6 py-7 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] border border-dawg-700/40 bg-dawg-500/10">
            <WarningCircleIcon size={24} weight="duotone" className="text-dawg-400" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-bold text-void-100 text-balance">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-void-400 text-pretty">{body}</p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => onNavigate(ctaHref)}
              className="cta-primary flex-1 rounded-[11px] px-4 py-3 text-sm font-bold"
            >
              {ctaLabel}
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-[11px] border border-void-700 bg-void-800 px-4 py-3 text-sm font-semibold text-void-300 transition-colors hover:bg-void-700 hover:text-void-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
