import { useMemo, useState } from "react";
import clsx from "clsx";
import { Bot, HeartPulse } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, Mono, ProviderBadge, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SearchInput, Select } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useAgents } from "@/hooks/use-agents";
import { useTasks } from "@/hooks/use-tasks";
import { useNow } from "@/hooks/use-now";
import { useUiStore } from "@/state/ui-store";
import { formatCost, formatDuration, formatRelativeTime, formatTokens } from "@/lib/format";
import type { AgentRun } from "@/types/domain";

function heartbeatTone(heartbeatAt: string | undefined, status: string | undefined, now: number): "ok" | "stale" | "none" {
  if (status !== "running" && status !== "waiting") return heartbeatAt ? "ok" : "none";
  if (!heartbeatAt) return "none";
  return now - new Date(heartbeatAt).getTime() > 5 * 60_000 ? "stale" : "ok";
}

export function AgentsPage() {
  const agents = useAgents();
  const { data: tasks } = useTasks();
  const now = useNow();
  const { selectAgent } = useUiStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");

  const taskTitle = (id?: string) => (id ? tasks?.find((t) => t.id === id)?.title : undefined);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (agents.data ?? []).filter((agent) => {
      if (statusFilter !== "all" && agent.status !== statusFilter) return false;
      if (providerFilter !== "all" && agent.provider !== providerFilter) return false;
      if (
        q &&
        !agent.id.toLowerCase().includes(q) &&
        !(agent.model ?? "").toLowerCase().includes(q) &&
        !(agent.branch ?? "").toLowerCase().includes(q) &&
        !(tasks?.find((t) => t.id === agent.taskId)?.title ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [agents.data, search, statusFilter, providerFilter, tasks]);

  const columns: Column<AgentRun>[] = [
    {
      key: "agent",
      header: "Worker",
      sortValue: (a) => a.id,
      render: (a) => (
        <span className="flex items-center gap-2">
          <Bot size={13} className="text-fg-subtle" />
          <Mono>{a.id}</Mono>
        </span>
      ),
    },
    { key: "provider", header: "Provider", sortValue: (a) => a.provider, render: (a) => <ProviderBadge provider={a.provider} /> },
    { key: "model", header: "Model", sortValue: (a) => a.model ?? "", render: (a) => <Mono>{a.model ?? "—"}</Mono> },
    {
      key: "task",
      header: "Task",
      render: (a) =>
        a.taskId ? (
          <span className="flex items-center gap-1.5">
            <Mono className="text-[10px] text-accent">{a.taskId}</Mono>
            <span className="block max-w-52 truncate text-fg-subtle">{taskTitle(a.taskId) ?? ""}</span>
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    { key: "status", header: "Status", sortValue: (a) => a.status, render: (a) => <StatusBadge status={a.status} kind="agent" /> },
    {
      key: "runtime",
      header: "Runtime",
      sortValue: (a) => a.startedAt ?? "",
      render: (a) => <span className="tabular-nums text-fg-muted">{formatDuration(a.startedAt, a.endedAt)}</span>,
    },
    {
      key: "heartbeat",
      header: "Heartbeat",
      sortValue: (a) => a.heartbeatAt ?? "",
      render: (a) => {
        const tone = heartbeatTone(a.heartbeatAt, a.status, now);
        return (
          <Tooltip label={tone === "stale" ? "Heartbeat is stale — worker may be stuck" : a.heartbeatAt}>
            <span
              className={clsx(
                "flex items-center gap-1.5",
                tone === "stale" ? "text-warning" : "text-fg-subtle",
              )}
            >
              {tone === "stale" && <HeartPulse size={11} />}
              {formatRelativeTime(a.heartbeatAt)}
            </span>
          </Tooltip>
        );
      },
    },
    { key: "branch", header: "Branch", render: (a) => <Mono className="text-[10px]">{a.branch ?? "—"}</Mono> },
    {
      key: "progress",
      header: "Progress",
      sortValue: (a) => a.progress ?? 0,
      render: (a) => (
        <div className="flex w-20 items-center gap-2">
          <ProgressBar value={a.progress} />
          <span className="shrink-0 tabular-nums text-fg-subtle">{a.progress ?? 0}%</span>
        </div>
      ),
    },
    {
      key: "tokens",
      header: "Tokens",
      sortValue: (a) => a.tokenUsage ?? 0,
      render: (a) => <span className="tabular-nums text-fg-muted">{formatTokens(a.tokenUsage)}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      sortValue: (a) => a.costEstimate ?? 0,
      render: (a) => <span className="tabular-nums text-fg-muted">{formatCost(a.costEstimate)}</span>,
    },
  ];

  const providers = [...new Set((agents.data ?? []).map((a) => a.provider))];
  const activeCount = (agents.data ?? []).filter((a) =>
    ["running", "waiting", "starting"].includes(a.status),
  ).length;

  return (
    <PageContainer
      title="Agents"
      subtitle={`${activeCount} active workers across the fleet`}
      actions={<LastUpdated query={agents} />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search workers…" className="w-52" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 w-36 text-xs">
          <option value="all">all statuses</option>
          <option value="running">running</option>
          <option value="waiting">waiting</option>
          <option value="starting">starting</option>
          <option value="blocked">blocked</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="stopped">stopped</option>
          <option value="unknown">unknown</option>
        </Select>
        <Select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="h-8 w-36 text-xs">
          <option value="all">all providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        {(agents.data ?? []).some((a) => heartbeatTone(a.heartbeatAt, a.status, now) === "stale") && (
          <Badge tone="warning">stale heartbeat detected</Badge>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        getKey={(a) => a.id}
        onRowClick={(a) => selectAgent(a.id)}
        loading={agents.isLoading}
        emptyTitle="No workers match"
        emptyDescription="Adjust the filters, or start a task to spawn workers."
      />
    </PageContainer>
  );
}
