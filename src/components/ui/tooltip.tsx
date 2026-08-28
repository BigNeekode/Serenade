import type { ReactNode } from "react";
import clsx from "clsx";

export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: ReactNode;
  side?: "top" | "bottom" | "right";
  children: ReactNode;
}) {
  const position =
    side === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-1.5"
      : side === "bottom"
        ? "top-full left-1/2 -translate-x-1/2 mt-1.5"
        : "left-full top-1/2 -translate-y-1/2 ml-1.5";
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md border border-line-strong bg-raised px-2 py-1 text-[11px] text-fg shadow-lg group-hover/tt:block",
          position,
        )}
      >
        {label}
      </span>
    </span>
  );
}
