import clsx from "clsx";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  activeId,
  onChange,
  className,
}: {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-1 border-b border-line overflow-x-auto", className)}>
      {items.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
            tab.id === activeId ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-1.5 rounded bg-raised px-1 py-0.5 text-[10px] text-fg-muted tabular-nums">
              {tab.count}
            </span>
          )}
          {tab.id === activeId && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
          )}
        </button>
      ))}
    </div>
  );
}
