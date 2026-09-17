import type { ReactNode } from "react";

export const LEVEL_META: Record<number, { label: string; cls: string; dot: string }> = {
  1: { label: "Уровень 1", cls: "bg-good-soft text-good-deep", dot: "bg-good" },
  2: { label: "Уровень 2", cls: "bg-amber-soft text-amber", dot: "bg-amber" },
  3: { label: "Уровень 3", cls: "bg-rust-soft text-rust", dot: "bg-rust" },
  4: { label: "Уровень 4", cls: "bg-line-soft text-ink-soft", dot: "bg-ink" },
};

export function LevelChip({ level, compact }: { level: number; compact?: boolean }) {
  const m = LEVEL_META[level] ?? LEVEL_META[1];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${m.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {compact ? `Ур. ${level}` : m.label}
    </span>
  );
}

export function TypeChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-card-2 px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line-soft">
      {label}
    </span>
  );
}

export function Bar({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line-soft ${className}`}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-line bg-card shadow-[0_1px_2px_rgba(38,34,25,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function BestBadge({ best }: { best: number | null }) {
  if (best === null)
    return <span className="text-[11px] font-semibold text-muted/70">не пройдено</span>;
  const pct = Math.round(best * 100);
  if (pct >= 100)
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-good-soft px-2 py-0.5 text-[11px] font-bold text-good-deep">
        100%
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md bg-amber-soft px-2 py-0.5 text-[11px] font-bold text-amber">
      {pct}%
    </span>
  );
}
