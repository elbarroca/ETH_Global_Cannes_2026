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
      className={`bg-white border border-gray-200 rounded-2xl ${className}`}
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
      className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${className}`}
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
  subColor = "text-gray-400",
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-gray-400 text-xs mb-2">
        <span>{emoji}</span>
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-semibold text-gray-900">
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
      className={`bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-700 leading-relaxed ${className}`}
    >
      {children}
    </div>
  );
}
