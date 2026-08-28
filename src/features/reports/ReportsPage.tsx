import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { LastUpdated } from "@/components/common/LastUpdated";
import { Badge, Mono } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { SearchInput, Select } from "@/components/ui/input";
import { useReports } from "@/hooks/use-reports";
import { useProjects } from "@/hooks/use-projects";
import { formatRelativeTime } from "@/lib/format";

const KIND_LABELS: Record<string, string> = {
  scout_report: "scout report",
  run_summary: "run summary",
  failure_summary: "failure summary",
  postmortem: "postmortem",
  learning: "learning",
  operator_note: "operator note",
};

export function ReportsPage() {
  const navigate = useNavigate();
  const reports = useReports();
  const { data: projects } = useProjects();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");

  const projectName = (id?: string) => projects?.find((p) => p.id === id)?.name ?? id ?? "—";

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (reports.data ?? []).filter((report) => {
      if (projectFilter !== "all" && report.projectId !== projectFilter) return false;
      if (kindFilter !== "all" && report.kind !== kindFilter) return false;
      if (
        q &&
        !report.title.toLowerCase().includes(q) &&
        !(report.summary ?? "").toLowerCase().includes(q) &&
        !report.id.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [reports.data, search, projectFilter, kindFilter]);

  return (
    <PageContainer
      title="Reports"
      subtitle="Scout findings, run summaries, and failure analyses"
      actions={<LastUpdated query={reports} />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search reports…" className="w-56" />
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 w-36 text-xs">
          <option value="all">all projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="h-8 w-40 text-xs">
          <option value="all">all types</option>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title={search ? "No reports match" : "No reports yet"}
          description="Scout tasks produce reports when they complete."
          icon={<FileText size={18} />}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((report) => (
          <Card key={report.id} className="p-4" onClick={() => navigate(`/reports/${report.id}`)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{report.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-muted">
                  {report.summary ?? report.content?.slice(0, 160)}
                </p>
              </div>
              <Badge
                tone={
                  report.kind === "failure_summary"
                    ? "danger"
                    : report.kind === "scout_report"
                      ? "info"
                      : "neutral"
                }
              >
                {KIND_LABELS[report.kind] ?? report.kind}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-line pt-2.5 text-[10px] text-fg-subtle">
              <Mono>{report.id}</Mono>
              <span>{projectName(report.projectId)}</span>
              {report.taskId && <Mono className="text-accent/80">{report.taskId}</Mono>}
              <span className="ml-auto">{formatRelativeTime(report.createdAt)}</span>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
