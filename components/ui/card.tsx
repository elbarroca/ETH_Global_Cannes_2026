import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-void-900 border border-void-800 rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border-b border-void-800 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export function MetricCard({
  emoji,
  label,
  value,
  sub,
  subColor = "text-void-500",
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-void-900 border border-void-800 rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-void-600 text-[11px] mb-2">
        <span>{emoji}</span>
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-[22px] font-bold text-void-100">
        {value}
      </div>
      {sub && <div className={`text-xs mt-0.5 ${subColor}`}>{sub}</div>}
    </div>
  );
}

export function CodeBlock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-void-950 border border-void-800 rounded-[10px] p-3 text-xs font-mono text-void-400 leading-relaxed ${className}`}
    >
      {children}
    </div>
  );
}
