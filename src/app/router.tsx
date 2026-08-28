import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { ProjectDashboardPage } from "@/features/projects/ProjectDashboardPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { TaskDetailPage } from "@/features/tasks/TaskDetailPage";
import { AgentsPage } from "@/features/agents/AgentsPage";
import { WorktreesPage } from "@/features/worktrees/WorktreesPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { ReportViewerPage } from "@/features/reports/ReportViewerPage";
import { RoutesPage } from "@/features/routes/RoutesPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { SupervisorPage } from "@/features/supervisor/SupervisorPage";

export function Router() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="supervisor" element={<SupervisorPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDashboardPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="worktrees" element={<WorktreesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:reportId" element={<ReportViewerPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
