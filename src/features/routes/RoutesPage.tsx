import { Info } from "lucide-react";
import clsx from "clsx";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, Mono } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { useRoutes } from "@/hooks/use-routes";

export function RoutesPage() {
  const routes = useRoutes();

  const providerName = (id: string) => routes.data?.providers.find((p) => p.id === id)?.name ?? id;

  return (
    <PageContainer
      title="Routes & Providers"
      subtitle="How work is routed to providers, based on task type and execution class"
      actions={<LastUpdated query={routes} />}
    >
      {routes.isError && <ErrorState error={routes.error} onRetry={() => void routes.refetch()} />}

      <div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3">
        <Info size={14} className="mt-0.5 shrink-0 text-info" />
        <p className="text-xs leading-relaxed text-fg-muted">
          Routes map task type + execution class to an execution profile. This view is{" "}
          <span className="text-info">read-only</span> for now — Serenade's route editor is not
          implemented yet. hand itself supports validated writes via{" "}
          <span className="font-mono">hand config route set</span>; routing picks the profile
          automatically at spawn time.
        </p>
      </div>

      <Card>
        <CardHeader title="Providers" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {routes.isLoading &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          {routes.data?.providers.map((provider) => (
            <div key={provider.id} className="rounded-lg border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-fg">{provider.name}</span>
                <Badge tone={provider.enabled ? (provider.connected ? "success" : "warning") : "neutral"}>
                  {provider.enabled ? (provider.connected ? "connected" : "disconnected") : "disabled"}
                </Badge>
              </div>
              <Mono className="mt-1 block text-[10px]">{provider.defaultModel ?? "—"}</Mono>
              <div className="mt-2.5 flex items-center gap-3 text-[11px] text-fg-muted">
                <span>
                  <span className="font-semibold text-fg tabular-nums">{provider.activeWorkers}</span> active
                </span>
                <span>
                  <span className="font-semibold text-fg tabular-nums">{provider.tasksCompleted}</span> completed
                </span>
              </div>
              {provider.recentError && (
                <p className="mt-2 rounded border border-danger/30 bg-danger-soft px-2 py-1.5 text-[10px] leading-snug text-danger">
                  {provider.recentError}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Route rules" action={<span className="text-[10px] text-fg-subtle">evaluated by priority</span>} />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line text-fg-subtle">
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Match</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-4 py-2.5 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {routes.data?.routes.map((rule) => (
                <tr key={rule.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5 tabular-nums text-fg-muted">{rule.priority}</td>
                  <td className="px-4 py-2.5">
                    {rule.fallback ? (
                      <Badge tone="warning">fallback</Badge>
                    ) : (
                      <span className="text-fg-muted">
                        {rule.taskType} + {rule.executionClass}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">{providerName(rule.providerId)}</td>
                  <td className="px-4 py-2.5">
                    <Mono>{rule.model}</Mono>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={clsx(
                        "h-1.5 w-1.5 rounded-full inline-block",
                        rule.enabled ? "bg-success" : "bg-fg-subtle",
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
