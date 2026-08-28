import clsx from "clsx";

export function ProgressBar({
  value,
  className,
  tone = "accent",
}: {
  value?: number;
  className?: string;
  tone?: "accent" | "success" | "warning" | "danger";
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const toneClass =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : tone === "danger"
          ? "bg-danger"
          : "bg-accent";
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-raised", className)}
    >
      <div className={clsx("h-full rounded-full transition-all", toneClass)} style={{ width: `${pct}%` }} />
    </div>
  );
}
