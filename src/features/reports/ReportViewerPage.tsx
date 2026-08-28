import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Plus, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { MarkdownView } from "@/components/common/MarkdownView";
import { Button } from "@/components/ui/button";
import { Badge, Mono } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useReport } from "@/hooks/use-reports";
import { useProjects } from "@/hooks/use-projects";
import { useTasks, usePromoteTask } from "@/hooks/use-tasks";
import { TaskCreateDialog } from "@/features/tasks/TaskCreateDialog";
import { formatRelativeTime } from "@/lib/format";

export function ReportViewerPage() {
  const { reportId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const report = useReport(reportId);
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const promote = usePromoteTask();
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const task = tasks?.find((t) => t.id === report.data?.taskId);
  const projectName = projects?.find((p) => p.id === report.data?.projectId)?.name;

  if (report.isError) {
    return (
      <PageContainer title="Report">
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={
        report.data ? (
          <span className="flex items-center gap-2.5">
            <Link to="/reports" className="text-fg-subtle hover:text-fg-muted" aria-label="Back to reports">
              <ArrowLeft size={15} />
            </Link>
            {report.data.title}
          </span>
        ) : (
          <Skeleton className="h-6 w-56" />
        )
      }
      subtitle={
        report.data && (
          <span className="flex flex-wrap items-center gap-2">
            <Mono>{report.data.id}</Mono>
            <Badge tone={report.data.kind === "failure_summary" ? "danger" : "info"}>
              {report.data.kind.replaceAll("_", " ")}
            </Badge>
            <span>{projectName}</span>
            {task && (
              <span>
                task{" "}
                <Link to={`/tasks/${task.id}`} className="font-mono text-accent hover:underline">
                  {task.id}
                </Link>
              </span>
            )}
            <span>{formatRelativeTime(report.data.createdAt)}</span>
          </span>
        )
      }
      actions={
        report.data && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(report.data!.content ?? "");
                toast.showToast({ variant: "success", title: "Report copied" });
              }}
            >
              <Copy size={13} />
              Copy
            </Button>
            <Button variant="secondary" onClick={() => setFollowUpOpen(true)}>
              <Plus size={13} />
              Create task from report
            </Button>
            {task?.type === "scout" && (
              <Button
                variant="primary"
                loading={promote.isPending}
                onClick={() =>
                  promote.mutate(task.id, {
                    onSuccess: (ship) => {
                      toast.showToast({ variant: "success", title: `Promoted to ${ship.id}`, description: ship.title });
                      navigate(`/tasks/${ship.id}`);
                    },
                    onError: (err) =>
                      toast.showToast({
                        variant: "error",
                        title: "Promotion failed",
                        description: err instanceof Error ? err.message : undefined,
                      }),
                  })
                }
              >
                <Sparkles size={13} />
                Promote scout
              </Button>
            )}
          </div>
        )
      }
    >
      {report.isLoading && <Skeleton className="h-64" />}
      {report.data && (
        <>
          <Card>
            <CardHeader
              title="Report"
              action={
                report.data.path && (
                  <Mono className="text-[10px]">{report.data.path}</Mono>
                )
              }
            />
            <div className="p-5">
              <MarkdownView content={report.data.content ?? report.data.summary ?? ""} />
            </div>
          </Card>
          <TaskCreateDialog
            open={followUpOpen}
            onClose={() => setFollowUpOpen(false)}
            defaults={
              report.data
                ? {
                    projectId: report.data.projectId,
                    title: `Ship: ${report.data.title}`,
                    description: `Implementation task based on report ${report.data.id} (task ${report.data.taskId}).`,
                    tags: ["from-report"],
                  }
                : undefined
            }
          />
        </>
      )}
    </PageContainer>
  );
}
