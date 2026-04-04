"use client";

import { Card, CardBody } from "@/components/ui/card";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 backdrop-blur-sm">
      <Card className="w-full max-w-sm mx-4">
        <CardBody className="space-y-4 text-center">
          <p className="text-lg font-bold text-void-200">{title}</p>
          <p className="text-sm text-void-400">{body}</p>
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate(ctaHref)}
              className="flex-1 px-4 py-3 bg-dawg-500 hover:bg-dawg-400 text-void-950 text-sm font-bold rounded-xl transition-colors"
            >
              {ctaLabel}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-void-800 hover:bg-void-700 text-void-300 text-sm font-bold rounded-xl transition-colors border border-void-700"
            >
              Dismiss
            </button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
