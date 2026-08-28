import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-xl border border-line bg-panel",
        onClick && "cursor-pointer hover:border-line-strong hover:bg-raised/60 transition-colors",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between gap-2 px-4 py-3 border-b border-line", className)}>
      <h3 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{title}</h3>
      {action}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-xl border border-line bg-panel overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "success" | "warning" | "danger" | "accent" | "info" | "neutral";
  icon?: ReactNode;
}) {
  const valueTone =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : tone === "accent"
            ? "text-accent"
            : tone === "info"
              ? "text-info"
              : "text-fg";
  return (
    <div
      data-stat={label.toLowerCase().replace(/\s+/g, "-")}
      className="rounded-xl border border-line bg-panel px-4 py-3 flex flex-col gap-1 min-w-[130px]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
        {icon && <span className="text-fg-subtle">{icon}</span>}
      </div>
      <span className={clsx("text-2xl font-semibold tabular-nums leading-none", valueTone)}>{value}</span>
      {hint && <span className="text-[11px] text-fg-subtle truncate">{hint}</span>}
    </div>
  );
}
