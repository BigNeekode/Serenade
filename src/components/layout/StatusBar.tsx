import clsx from "clsx";
import { useAgents } from "@/hooks/use-agents";
import { useTasks } from "@/hooks/use-tasks";
import { useEnvironment } from "@/hooks/use-config";
import { formatCost, formatTokens } from "@/lib/format";

export function StatusBar() {
  const { data: agents } = useAgents();
  const { data: tasks } = useTasks();
  const { data: env } = useEnvironment();

  const activeAgents = agents?.filter((a) => a.status === "running" || a.status === "waiting" || a.status === "starting") ?? [];
  const tokens = agents?.reduce((sum, a) => sum + (a.tokenUsage ?? 0), 0);
  const cost = agents?.reduce((sum, a) => sum + (a.costEstimate ?? 0), 0);
  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  const failed = tasks?.filter((t) => t.status === "failed").length ?? 0;

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-4 text-[11px] text-fg-subtle">
      <span className="flex items-center gap-1.5">
        <span className={clsx("h-1.5 w-1.5 rounded-full", activeAgents.length > 0 ? "bg-success" : "bg-fg-subtle")} />
        supervisor online
      </span>
      <span>
        agents <span className="text-fg-muted tabular-nums">{activeAgents.length}</span> active
      </span>
      <span>
        tokens <span className="text-fg-muted tabular-nums">{formatTokens(tokens)}</span>
      </span>
      <span>
        cost <span className="text-fg-muted tabular-nums">{formatCost(cost)}</span>
      </span>
      <span>
        done <span className="text-success tabular-nums">{done}</span>
      </span>
      <span>
        errors <span className={failed > 0 ? "text-danger tabular-nums" : "tabular-nums"}>{failed}</span>
      </span>
      <span className="ml-auto truncate">
        {env?.ready
          ? `hand ${env.tools.find((t) => t.id === "hand")?.version ?? ""} • ${env.fleet.path ?? ""}`.trim()
          : env
            ? "environment issues — open Settings"
            : "checking environment…"}
      </span>
    </footer>
  );
}
