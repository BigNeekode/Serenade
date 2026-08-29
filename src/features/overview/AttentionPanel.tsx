import { Link } from "react-router-dom";
import { AlertTriangle, CircleDot, RotateCcw, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isStaleHeartbeat } from "@/hooks/use-now";
import type { AgentRun, Task } from "@/types/domain";
import { formatRelativeTime } from "@/lib/format";

export type AttentionClass = "diagnostic" | "progression" | "retry";

interface PresentationAttentionItem {
  id: string;
  source: "legacy-derived";
  class: AttentionClass;
  title: string;
  reason: string;
  href: string;
}

function deriveLegacyAttention(tasks: Task[], agents: AgentRun[], now: number): PresentationAttentionItem[] {
  const items: PresentationAttentionItem[] = [];

  for (const task of tasks) {
    if (task.status === "failed") {
      items.push({
        id: `failed:${task.id}`,
        source: "legacy-derived",
        class: "retry",
        title: task.title,
        reason: "Legacy Task projection reports a failed state. Inspect current Hand facts before retrying.",
        href: `/tasks/${task.id}`,
      });
    } else if (task.status === "review" || task.status === "ready") {
      items.push({
        id: `review:${task.id}`,
        source: "legacy-derived",
        class: "progression",
        title: task.title,
        reason: "Presentation projection suggests operator review/progression may be useful.",
        href: `/tasks/${task.id}`,
      });
    }
  }

  for (const agent of agents) {
    if (isStaleHeartbeat(agent.heartbeatAt, agent.status, now)) {
      items.push({
        id: `stale:${agent.id}`,
        source: "legacy-derived",
        class: "diagnostic",
        title: agent.id,
        reason: `Last observed heartbeat ${formatRelativeTime(agent.heartbeatAt)}. This is a diagnostic hint, not canonical Hand Attention.`,
        href: "/agents",
      });
    }
  }

  const order: Record<AttentionClass, number> = {
    diagnostic: 0,
    retry: 1,
    progression: 2,
  };
  return items.sort((a, b) => order[a.class] - order[b.class] || a.id.localeCompare(b.id));
}

const classMeta = {
  diagnostic: { label: "diagnostic", tone: "warning" as const, icon: <AlertTriangle size={12} /> },
  retry: { label: "retry", tone: "danger" as const, icon: <RotateCcw size={12} /> },
  progression: { label: "progression", tone: "neutral" as const, icon: <CircleDot size={12} /> },
};

export function AttentionPanel({ tasks, agents, now }: { tasks: Task[]; agents: AgentRun[]; now: number }) {
  const items = deriveLegacyAttention(tasks, agents, now);

  return (
    <Card>
      <CardHeader
        title="Attention"
        action={
          <Badge tone="neutral">
            legacy-derived · {items.length}
          </Badge>
        }
      />
      <div className="border-b border-line px-3 py-2 text-[10px] leading-relaxed text-fg-subtle">
        Compatibility view only. These indicators are derived by Serenade and do not acknowledge, authorize, or replace Hand state. When Hand exposes canonical Attention, this surface will consume that projection instead.
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-3 text-xs text-fg-subtle">
            <Search size={13} />
            No legacy indicators currently need inspection.
          </div>
        ) : (
          items.slice(0, 8).map((item) => {
            const meta = classMeta[item.class];
            return (
              <Link
                key={item.id}
                to={item.href}
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 hover:bg-hover/50"
              >
                <span className="mt-0.5 text-fg-subtle">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="truncate text-xs font-medium text-fg-muted">{item.title}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-fg-subtle">{item.reason}</p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}
