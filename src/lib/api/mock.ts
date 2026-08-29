import type {
  AgentRun,
  AppConfig,
  CreateTaskInput,
  Diagnostics,
  EnvironmentStatus,
  FleetEvent,
  FleetEventSeverity,
  LogChunkRequest,
  LogChunkResponse,
  LogLine,
  LogLevel,
  Project,
  Provider,
  Report,
  RouteRule,
  SupervisorReply,
  Task,
  TaskStatus,
  Worktree,
} from "@/types/domain";
import { SerenadeApiError } from "@/types/domain";
import type { SerenadeApi } from "./interface";

const NOW = Date.now();
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const delay = () => new Promise((r) => setTimeout(r, 60 + Math.random() * 220));
const clone = <T>(v: T): T => structuredClone(v);

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const projects: Project[] = [
  {
    id: "p_atlas",
    name: "atlas-api",
    repoPath: "C:\\dev\\atlas-api",
    repoUrl: "git@github.com:acme/atlas-api.git",
    status: "active",
    defaultBranch: "main",
    createdAt: ago(60 * 24 * 40),
    updatedAt: ago(6),
  },
  {
    id: "p_console",
    name: "web-console",
    repoPath: "C:\\dev\\web-console",
    repoUrl: "git@github.com:acme/web-console.git",
    status: "active",
    defaultBranch: "main",
    createdAt: ago(60 * 24 * 21),
    updatedAt: ago(14),
  },
  {
    id: "p_pipeline",
    name: "data-pipeline",
    repoPath: "C:\\dev\\data-pipeline",
    repoUrl: "git@github.com:acme/data-pipeline.git",
    status: "paused",
    defaultBranch: "main",
    createdAt: ago(60 * 24 * 9),
    updatedAt: ago(60 * 30),
  },
];

const tasks: Task[] = [
  // atlas-api
  { id: "t_1041", projectId: "p_atlas", title: "Investigate query latency regression in /metrics endpoint", description: "Latency p95 regressed from 120ms to 900ms after the v2.4 release. Find the root cause and produce a remediation plan.", type: "scout", executionClass: "deep", status: "scouting", tags: ["api", "perf"], assignedAgentId: "ag_opus_1", worktreeId: "wt_3", branch: "scout/1041-metrics-perf", progress: 62, attempts: 1, createdAt: ago(220), updatedAt: ago(3) },
  { id: "t_1042", projectId: "p_atlas", title: "Implement per-tenant rate limiting", description: "Add sliding-window rate limits per tenant on public endpoints. Config via env, default 100 req/min.", type: "ship", executionClass: "standard", status: "in_progress", tags: ["api", "security"], assignedAgentId: "ag_claude_1", worktreeId: "wt_1", branch: "ship/1042-rate-limits", progress: 55, attempts: 1, createdAt: ago(400), updatedAt: ago(2) },
  { id: "t_1043", projectId: "p_atlas", title: "Add cursor pagination to /users", type: "ship", executionClass: "mechanical", status: "done", tags: ["api"], assignedAgentId: "ag_codex_4", worktreeId: "wt_2", reportId: "r_run_1043", branch: "ship/1043-pagination", progress: 100, attempts: 1, createdAt: ago(60 * 20), updatedAt: ago(60 * 6) },
  { id: "t_1044", projectId: "p_atlas", title: "Refactor auth flow to middleware chain", description: "Extract the hand-rolled auth checks into composable middleware. Keep behavior identical.", type: "ship", executionClass: "standard", status: "in_progress", tags: ["api", "refactor"], assignedAgentId: "ag_codex_2", worktreeId: "wt_4", branch: "ship/1044-auth-flow", progress: 30, attempts: 1, createdAt: ago(180), updatedAt: ago(5) },
  { id: "t_1045", projectId: "p_atlas", title: "Bump OpenAPI spec to 3.1", type: "ship", executionClass: "mechanical", status: "review", tags: ["docs"], worktreeId: "wt_2", branch: "ship/1045-openapi", progress: 100, attempts: 1, createdAt: ago(60 * 10), updatedAt: ago(40) },
  { id: "t_1046", projectId: "p_atlas", title: "Scout: migration path to Bun runtime", description: "Evaluate feasibility, breakages, and expected build-time wins for moving atlas-api to Bun.", type: "scout", executionClass: "standard", status: "done", tags: ["infra"], reportId: "r_scout_1046", progress: 100, attempts: 1, createdAt: ago(60 * 30), updatedAt: ago(60 * 8) },
  { id: "t_1047", projectId: "p_atlas", title: "Ship: structured JSON logging", description: "Replace text logs with structured JSON including request ids.", type: "ship", executionClass: "standard", status: "failed", tags: ["observability"], assignedAgentId: "ag_codex_3", worktreeId: "wt_4", branch: "ship/1047-json-logs", progress: 20, attempts: 2, createdAt: ago(60 * 14), updatedAt: ago(35) },
  { id: "t_1048", projectId: "p_atlas", title: "Add health check for DB pool saturation", type: "ship", executionClass: "mechanical", status: "backlog", tags: ["observability"], attempts: 0, createdAt: ago(90), updatedAt: ago(90) },
  // web-console
  { id: "t_1049", projectId: "p_console", title: "Scout: bundle size is 3.1MB — find the fat", description: "Analyze the web-console bundle, identify the largest contributors, propose a reduction plan.", type: "scout", executionClass: "standard", status: "done", tags: ["frontend", "perf"], reportId: "r_scout_1049", progress: 100, attempts: 1, createdAt: ago(60 * 26), updatedAt: ago(60 * 5) },
  { id: "t_1050", projectId: "p_console", title: "Ship: virtualize the deployment list", description: "The deployment list renders 2000+ rows. Virtualize with react-window.", type: "ship", executionClass: "deep", status: "queued", tags: ["frontend", "perf"], attempts: 0, createdAt: ago(70), updatedAt: ago(20) },
  { id: "t_1051", projectId: "p_console", title: "Ship: redesign settings table", type: "ship", executionClass: "standard", status: "scouting", tags: ["frontend"], assignedAgentId: "ag_gemini_1", worktreeId: "wt_5", branch: "ship/1051-settings-table", progress: 15, attempts: 1, createdAt: ago(300), updatedAt: ago(8) },
  { id: "t_1052", projectId: "p_console", title: "Fix flaky E2E login test", type: "ship", executionClass: "mechanical", status: "done", tags: ["tests"], progress: 100, attempts: 1, createdAt: ago(60 * 18), updatedAt: ago(60 * 4) },
  { id: "t_1053", projectId: "p_console", title: "Ship: chart rendering on Safari 17", description: "Canvas charts render blank on Safari 17. Investigate and fix.", type: "ship", executionClass: "standard", status: "blocked", tags: ["frontend", "bug"], worktreeId: "wt_7", branch: "ship/1053-safari-charts", progress: 45, attempts: 1, createdAt: ago(60 * 12), updatedAt: ago(60) },
  { id: "t_1054", projectId: "p_console", title: "Scout: dark theme token audit", description: "Audit hardcoded colors and produce a token migration plan.", type: "scout", executionClass: "deep", status: "ready", tags: ["design"], reportId: "r_scout_1054", worktreeId: "wt_6", branch: "scout/1054-theme-tokens", progress: 100, attempts: 1, createdAt: ago(60 * 16), updatedAt: ago(60 * 3) },
  { id: "t_1055", projectId: "p_console", title: "Ship: keyboard navigation for command menu", type: "ship", executionClass: "mechanical", status: "review", tags: ["a11y"], progress: 100, attempts: 1, createdAt: ago(60 * 9), updatedAt: ago(75) },
  { id: "t_1056", projectId: "p_console", title: "Scout: evaluate TanStack Form vs RHF", type: "scout", executionClass: "standard", status: "backlog", tags: ["frontend"], attempts: 0, createdAt: ago(45), updatedAt: ago(45) },
  { id: "t_1057", projectId: "p_console", title: "Ship: empty-state illustrations", type: "ship", executionClass: "mechanical", status: "stopped", tags: ["design"], progress: 10, attempts: 1, createdAt: ago(60 * 22), updatedAt: ago(60 * 7) },
  // data-pipeline
  { id: "t_1058", projectId: "p_pipeline", title: "Scout: nightly backfill failures", description: "Backfill job fails 2-3 times per week. Find the failure signature and recommend fixes.", type: "scout", executionClass: "deep", status: "done", tags: ["data", "reliability"], reportId: "r_scout_1058", progress: 100, attempts: 1, createdAt: ago(60 * 48), updatedAt: ago(60 * 26) },
  { id: "t_1059", projectId: "p_pipeline", title: "Ship: idempotent partition writers", type: "ship", executionClass: "standard", status: "done", tags: ["data"], progress: 100, attempts: 1, createdAt: ago(60 * 44), updatedAt: ago(60 * 28) },
  { id: "t_1060", projectId: "p_pipeline", title: "Ship: schema evolution guardrails", description: "Prevent breaking avro schema changes from deploying.", type: "ship", executionClass: "deep", status: "failed", tags: ["data"], worktreeId: "wt_8", branch: "ship/1060-schema-guardrails", progress: 70, attempts: 3, createdAt: ago(60 * 40), updatedAt: ago(60 * 5) },
  { id: "t_1061", projectId: "p_pipeline", title: "Bump Kafka client to 3.7", type: "ship", executionClass: "mechanical", status: "backlog", tags: ["infra"], attempts: 0, createdAt: ago(60 * 6), updatedAt: ago(60 * 6) },
  { id: "t_1062", projectId: "p_pipeline", title: "Scout: dead-letter queue audit", type: "scout", executionClass: "standard", status: "backlog", tags: ["data"], attempts: 0, createdAt: ago(60 * 5), updatedAt: ago(60 * 5) },
  { id: "t_1063", projectId: "p_pipeline", title: "Ship: backfill progress metrics", type: "ship", executionClass: "mechanical", status: "review", tags: ["observability", "data"], progress: 100, attempts: 1, createdAt: ago(60 * 36), updatedAt: ago(60 * 10) },
  { id: "t_1064", projectId: "p_pipeline", title: "Ship: partition retention policy", type: "ship", executionClass: "standard", status: "done", tags: ["data"], progress: 100, attempts: 1, createdAt: ago(60 * 50), updatedAt: ago(60 * 30) },
];

const agents: AgentRun[] = [
  { id: "ag_claude_1", taskId: "t_1042", projectId: "p_atlas", provider: "anthropic", model: "claude-sonnet-4-5", status: "running", branch: "ship/1042-rate-limits", progress: 55, startedAt: ago(240), heartbeatAt: ago(0.2), tokenUsage: 184_200, costEstimate: 1.38, logPath: "~/.hand/agents/ag_claude_1.log" },
  { id: "ag_codex_2", taskId: "t_1044", projectId: "p_atlas", provider: "openai", model: "codex", status: "running", branch: "ship/1044-auth-flow", progress: 30, startedAt: ago(160), heartbeatAt: ago(0.4), tokenUsage: 96_500, costEstimate: 0.61, logPath: "~/.hand/agents/ag_codex_2.log" },
  { id: "ag_opus_1", taskId: "t_1041", projectId: "p_atlas", provider: "anthropic", model: "claude-opus-4", status: "running", branch: "scout/1041-metrics-perf", progress: 62, startedAt: ago(210), heartbeatAt: ago(9), tokenUsage: 412_800, costEstimate: 8.94, logPath: "~/.hand/agents/ag_opus_1.log" },
  { id: "ag_gemini_1", taskId: "t_1051", projectId: "p_console", provider: "google", model: "gemini-2.5-pro", status: "waiting", branch: "ship/1051-settings-table", progress: 15, startedAt: ago(290), heartbeatAt: ago(7), tokenUsage: 51_300, costEstimate: 0.22, logPath: "~/.hand/agents/ag_gemini_1.log" },
  { id: "ag_codex_3", taskId: "t_1047", projectId: "p_atlas", provider: "openai", model: "codex", status: "failed", branch: "ship/1047-json-logs", startedAt: ago(80), endedAt: ago(35), heartbeatAt: ago(35), tokenUsage: 12_400, costEstimate: 0.08, logPath: "~/.hand/agents/ag_codex_3.log" },
  { id: "ag_codex_4", taskId: "t_1043", projectId: "p_atlas", provider: "openai", model: "codex-mini", status: "completed", branch: "ship/1043-pagination", progress: 100, startedAt: ago(60 * 22), endedAt: ago(60 * 6), heartbeatAt: ago(60 * 6), tokenUsage: 38_900, costEstimate: 0.04, logPath: "~/.hand/agents/ag_codex_4.log" },
];

const worktrees: Worktree[] = [
  { id: "wt_1", projectId: "p_atlas", taskId: "t_1042", agentId: "ag_claude_1", path: "C:\\dev\\atlas-api\\.worktrees\\ship-1042-rate-limits", branch: "ship/1042-rate-limits", gitStatus: "dirty", changedFiles: 7, aheadBehind: [2, 0], lastCommit: "feat: sliding window limiter core", state: "active", createdAt: ago(238) },
  { id: "wt_2", projectId: "p_atlas", taskId: "t_1045", path: "C:\\dev\\atlas-api\\.worktrees\\ship-1045-openapi", branch: "ship/1045-openapi", gitStatus: "clean", changedFiles: 0, aheadBehind: [1, 0], lastCommit: "chore: openapi 3.1 spec", state: "ready-for-review", createdAt: ago(60 * 10) },
  { id: "wt_3", projectId: "p_atlas", taskId: "t_1041", agentId: "ag_opus_1", path: "C:\\dev\\atlas-api\\.worktrees\\scout-1041-metrics-perf", branch: "scout/1041-metrics-perf", gitStatus: "dirty", changedFiles: 12, aheadBehind: [4, 1], lastCommit: "wip: perf probe scripts", state: "active", createdAt: ago(218) },
  { id: "wt_4", projectId: "p_atlas", taskId: "t_1044", agentId: "ag_codex_2", path: "C:\\dev\\atlas-api\\.worktrees\\ship-1044-auth-flow", branch: "ship/1044-auth-flow", gitStatus: "dirty", changedFiles: 3, aheadBehind: [0, 0], lastCommit: "refactor: extract bearer middleware", state: "active", createdAt: ago(175) },
  { id: "wt_5", projectId: "p_console", taskId: "t_1051", agentId: "ag_gemini_1", path: "C:\\dev\\web-console\\.worktrees\\ship-1051-settings-table", branch: "ship/1051-settings-table", gitStatus: "dirty", changedFiles: 1, aheadBehind: [0, 0], lastCommit: "wip: table primitives", state: "active", createdAt: ago(288) },
  { id: "wt_6", projectId: "p_console", taskId: "t_1054", path: "C:\\dev\\web-console\\.worktrees\\scout-1054-theme-tokens", branch: "scout/1054-theme-tokens", gitStatus: "clean", changedFiles: 0, aheadBehind: [1, 0], lastCommit: "docs: token migration plan", state: "ready-for-review", createdAt: ago(60 * 16) },
  { id: "wt_7", projectId: "p_console", taskId: "t_1053", path: "C:\\dev\\web-console\\.worktrees\\ship-1053-safari-charts", branch: "ship/1053-safari-charts", gitStatus: "diverged", changedFiles: 8, aheadBehind: [3, 2], lastCommit: "fix: fallback to 2d context", state: "idle", createdAt: ago(60 * 12) },
  { id: "wt_8", projectId: "p_pipeline", taskId: "t_1060", path: "C:\\dev\\data-pipeline\\.worktrees\\ship-1060-schema-guardrails", branch: "ship/1060-schema-guardrails", gitStatus: "dirty", changedFiles: 15, aheadBehind: [6, 4], lastCommit: "wip: schema registry hook", state: "orphaned", createdAt: ago(60 * 40) },
];

const reports: Report[] = [
  {
    id: "r_scout_1046", taskId: "t_1046", projectId: "p_atlas", kind: "scout_report",
    title: "Bun runtime migration assessment",
    path: "~/.hand/fleets/main/reports/r_scout_1046.md",
    summary: "Bun is viable for atlas-api. Expected 2.8x faster cold installs and 40% faster test runs; two blockers documented.",
    createdAt: ago(60 * 8),
    content: `# Bun runtime migration assessment

## Verdict
**Viable, with two blockers.** Recommend a staged migration behind a flag.

## Findings
1. **Test suite**: 38 of 4,200 tests rely on Node \`fs\` semantics Bun does not replicate.
2. **Native deps**: \`sharp\` requires a WASM fallback; build size grows by 1.4MB.
3. **Cold install**: 22s → 8s measured locally.

## Recommended plan
\`\`\`text
phase 1 — CI parity job on Bun (no deploy)
phase 2 — migrate dev scripts
phase 3 — canary deploy behind RUNTIME=bun
\`\`\`

## Risks
- \`node:worker_threads\` API drift in Bun 1.x has broken twice upstream.
- Team has no Bun on-call experience yet.`,
  },
  {
    id: "r_scout_1049", taskId: "t_1049", projectId: "p_console", kind: "scout_report",
    title: "Bundle size analysis",
    path: "~/.hand/fleets/main/reports/r_scout_1049.md",
    summary: "3.1MB bundle. 46% is moment.js pulled in by two date pickers. Replacement plan included.",
    createdAt: ago(60 * 5),
    content: `# Bundle size analysis

## Headline
The web-console main bundle is **3.1MB** (gzipped: 812KB). Nearly half is avoidable.

## Top contributors
| Package | Size | Note |
|---|---|---|
| moment + locales | 1.43MB | pulled by \`DateRangePicker\` and \`ReportFilters\` |
| lodash (full) | 540KB | imported wholesale in 3 files |
| recharts | 380KB | fine |
| monaco | 310KB | lazy-loadable |

## Plan
1. Replace moment with date-fns (est. -1.35MB).
2. Babel-plugin-lodash cherry-picking (est. -480KB).
3. Lazy-load monaco via \`React.lazy\`.

## Expected result
**~1.3MB main bundle** after phases 1–2.`,
  },
  {
    id: "r_scout_1054", taskId: "t_1054", projectId: "p_console", kind: "scout_report",
    title: "Dark theme token audit",
    path: "~/.hand/fleets/main/reports/r_scout_1054.md",
    summary: "214 hardcoded hex colors across 87 files. Migration to design tokens estimated at 3 mechanical ship tasks.",
    createdAt: ago(60 * 3),
    content: `# Dark theme token audit

## Summary
214 hardcoded color literals across 87 files. The audit maps every literal to an existing design token where possible.

## Breakdown
- 121 literals map 1:1 to existing tokens
- 58 literals are near-misses (off-by-one lightness) — propose token consolidation
- 35 literals have no token (mostly chart palettes)

## Proposed ship tasks
1. \`mechanical\` — replace 1:1 mappings (codemod-able)
2. \`mechanical\` — consolidate near-misses (needs design sign-off list, attached)
3. \`standard\` — add chart palette tokens + migrate charts`,
  },
  {
    id: "r_scout_1058", taskId: "t_1058", projectId: "p_pipeline", kind: "scout_report",
    title: "Nightly backfill failure analysis",
    path: "~/.hand/fleets/main/reports/r_scout_1058.md",
    summary: "Failures correlate with partition rollover at 02:00 UTC. Race between writer flush and partition switch.",
    createdAt: ago(60 * 26),
    content: `# Nightly backfill failure analysis

## Failure signature
All 11 failures in the last 30 days happen within 90s of **02:00 UTC** — the partition rollover moment.

## Root cause
The partition writer holds an open file handle while the rollover job renames the partition directory. On Windows hosts the rename blocks; on Linux it silently splits writes across two partitions.

## Recommendations
1. Stop the writer before rollover (requires graceful drain — see t_1059, now done).
2. Add a guardrail so rollover refuses to run while writers are attached to the partition.
3. Alert on \`write_lag > 30s\` during the 01:55–02:10 window.`,
  },
  {
    id: "r_run_1043", taskId: "t_1043", projectId: "p_atlas", kind: "run_summary",
    title: "Run summary: cursor pagination",
    path: "~/.hand/fleets/main/reports/r_run_1043.md",
    summary: "Completed in 16 attempts-free minutes. 9 files changed, 42 tests added, all green.",
    createdAt: ago(60 * 6),
    content: `# Run summary — cursor pagination

- **Duration**: 16m
- **Files changed**: 9
- **Tests added**: 42 (all green)
- **Commits**: 3

## Notes
Reused the cursor helper from \`internal/paging\`. The reviewer should double-check the composite cursor encoding for tenant-prefixed keys.`,
  },
  {
    id: "r_fail_1047", taskId: "t_1047", projectId: "p_atlas", kind: "failure_summary",
    title: "Failure summary: structured JSON logging",
    path: "~/.hand/fleets/main/reports/r_fail_1047.md",
    summary: "Worker agent-codex-3 failed to start: the configured Codex executable was not found.",
    createdAt: ago(35),
    content: `# Failure summary — structured JSON logging

## What happened
Attempt 2 failed during worker start.

\`\`\`
hand: could not start worker agent-codex-3
reason: configured Codex executable not found at /opt/codex/bin/codex
\`\`\`

## Likely reason
The provider config points at a stale path after the 0.9.1 → 0.9.2 upgrade moved the binary.

## Next steps
1. Update the Codex provider executable path.
2. Retry the task — the worktree still contains attempt-1 scaffolding (7 commits, clean tree).`,
  },
  {
    id: "r_fail_1060", taskId: "t_1060", projectId: "p_pipeline", kind: "failure_summary",
    title: "Failure summary: schema evolution guardrails",
    path: "~/.hand/fleets/main/reports/r_fail_1060.md",
    summary: "Three attempts failed at the same integration test: schema registry mock returns 503 under parallel test execution.",
    createdAt: ago(60 * 5),
    content: `# Failure summary — schema evolution guardrails

## What happened
All three attempts fail at \`guardrails/registry_client_test.go:88\`.

\`\`\`
--- FAIL: TestRegistryClientRetry
    registry_client_test.go:88: expected 3 retries, got 1 (503 from mock)
\`\`\`

## Analysis
The mock schema registry returns 503 when tests run in parallel — a resource contention issue in the test harness, not in the shipped code.

## Recommendation
- Fix the test harness isolation before attempt 4.
- The 15 changed files in the worktree look complete; do not discard them.`,
  },
];

const events: FleetEvent[] = [
  { id: "e_01", kind: "task.updated", message: "t_1042 rate limiting — agent committed sliding window core", projectId: "p_atlas", taskId: "t_1042", agentId: "ag_claude_1", severity: "info", createdAt: ago(2) },
  { id: "e_02", kind: "agent.heartbeat", message: "ag_opus_1 heartbeat is stale for 9 minutes (deep scout still running)", projectId: "p_atlas", taskId: "t_1041", agentId: "ag_opus_1", severity: "warning", createdAt: ago(9) },
  { id: "e_03", kind: "task.failed", message: "t_1047 structured JSON logging failed: Codex executable not found", projectId: "p_atlas", taskId: "t_1047", agentId: "ag_codex_3", severity: "error", createdAt: ago(35) },
  { id: "e_04", kind: "report.created", message: "Failure summary ready for t_1060 schema guardrails", projectId: "p_pipeline", taskId: "t_1060", severity: "info", createdAt: ago(60 * 5) },
  { id: "e_05", kind: "task.completed", message: "t_1049 bundle size scout completed — report ready", projectId: "p_console", taskId: "t_1049", severity: "success", createdAt: ago(60 * 5) },
  { id: "e_06", kind: "task.created", message: "t_1062 dead-letter queue audit added to backlog", projectId: "p_pipeline", taskId: "t_1062", severity: "info", createdAt: ago(60 * 5) },
  { id: "e_07", kind: "agent.started", message: "ag_gemini_1 started for t_1051 settings table", projectId: "p_console", taskId: "t_1051", agentId: "ag_gemini_1", severity: "info", createdAt: ago(290) },
  { id: "e_08", kind: "task.review", message: "t_1045 OpenAPI 3.1 moved to review", projectId: "p_atlas", taskId: "t_1045", severity: "info", createdAt: ago(40) },
  { id: "e_09", kind: "task.blocked", message: "t_1053 Safari charts blocked — canvas 2d fallback rejected by reviewer", projectId: "p_console", taskId: "t_1053", severity: "warning", createdAt: ago(60) },
  { id: "e_10", kind: "task.completed", message: "t_1052 flaky E2E login test fixed", projectId: "p_console", taskId: "t_1052", severity: "success", createdAt: ago(60 * 4) },
  { id: "e_11", kind: "task.failed", message: "t_1060 schema guardrails failed attempt 3 (test harness 503)", projectId: "p_pipeline", taskId: "t_1060", severity: "error", createdAt: ago(60 * 5) },
  { id: "e_12", kind: "task.completed", message: "t_1043 cursor pagination shipped", projectId: "p_atlas", taskId: "t_1043", severity: "success", createdAt: ago(60 * 6) },
  { id: "e_13", kind: "report.created", message: "Scout report ready: Bun migration assessment", projectId: "p_atlas", taskId: "t_1046", severity: "info", createdAt: ago(60 * 8) },
  { id: "e_14", kind: "agent.completed", message: "ag_codex_4 finished t_1043 in 16 minutes", projectId: "p_atlas", taskId: "t_1043", agentId: "ag_codex_4", severity: "success", createdAt: ago(60 * 6) },
  { id: "e_15", kind: "task.ready", message: "t_1054 dark theme scout promoted to Ready to Ship", projectId: "p_console", taskId: "t_1054", severity: "success", createdAt: ago(60 * 3) },
  { id: "e_16", kind: "task.stopped", message: "t_1057 empty-state illustrations stopped by operator", projectId: "p_console", taskId: "t_1057", severity: "warning", createdAt: ago(60 * 7) },
  { id: "e_17", kind: "project.paused", message: "data-pipeline paused by operator", projectId: "p_pipeline", severity: "info", createdAt: ago(60 * 30) },
  { id: "e_18", kind: "task.created", message: "t_1061 Kafka client bump added to backlog", projectId: "p_pipeline", taskId: "t_1061", severity: "info", createdAt: ago(60 * 6) },
];

const providers: Provider[] = [
  { id: "anthropic", name: "Anthropic", enabled: true, connected: true, defaultModel: "claude-sonnet-4-5", activeWorkers: 2, tasksCompleted: 31 },
  { id: "openai", name: "OpenAI", enabled: true, connected: true, defaultModel: "codex", activeWorkers: 1, tasksCompleted: 24, recentError: "codex executable not found at /opt/codex/bin/codex (fixed pending retry)" },
  { id: "google", name: "Google", enabled: true, connected: true, defaultModel: "gemini-2.5-pro", activeWorkers: 1, tasksCompleted: 7 },
  { id: "ollama", name: "Ollama (local)", enabled: false, connected: false, defaultModel: "qwen3-coder:30b", activeWorkers: 0, tasksCompleted: 0 },
];

const routes: RouteRule[] = [
  { id: "rt_1", taskType: "scout", executionClass: "deep", providerId: "anthropic", model: "claude-opus-4", priority: 10, enabled: true },
  { id: "rt_2", taskType: "ship", executionClass: "mechanical", providerId: "openai", model: "codex-mini", priority: 20, enabled: true },
  { id: "rt_3", taskType: "ship", executionClass: "standard", providerId: "openai", model: "codex", priority: 30, enabled: true },
  { id: "rt_4", taskType: "scout", executionClass: "standard", providerId: "anthropic", model: "claude-sonnet-4-5", priority: 40, enabled: true },
  { id: "rt_5", taskType: null, executionClass: null, providerId: "anthropic", model: "claude-sonnet-4-5", priority: 100, enabled: true, fallback: true },
];

const defaultConfig: AppConfig = {
  handBinaryPath: "hand",
  fleetPath: "~/.hand/fleets/main",
  preferredEditor: "vscode",
  customEditorPath: null,
  refreshProfile: "default",
  appearance: "dark",
  density: "comfortable",
  reducedMotion: false,
  notifications: { workerFailed: true, taskCompleted: true, reportReady: true, approvalRequired: true },
  setupCompleted: false,
};

// ---------------------------------------------------------------------------
// Deterministic log generation
// ---------------------------------------------------------------------------

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SHIP_STEPS = [
  "reading task context and repo layout",
  "creating branch and worktree",
  "writing failing tests first",
  "implementing core change",
  "running focused test suite",
  "updating call sites",
  "running full test suite",
  "addressing lint findings",
  "updating documentation",
  "committing staged work",
];

const SCOUT_STEPS = [
  "reading task context and repo layout",
  "searching codebase for relevant symbols",
  "tracing call paths",
  "reproducing the reported issue locally",
  "collecting measurements",
  "correlating timeline with deploys",
  "drafting findings",
  "validating hypotheses against data",
  "writing report",
];

function generateLogs(task: Task, agent: AgentRun | undefined): LogLine[] {
  const seed = hash(task.id);
  const lines: LogLine[] = [];
  let ts = new Date(task.createdAt).getTime();
  const step = 45_000 + (seed % 40_000);
  let i = 0;
  const push = (source: LogLine["source"], level: LogLevel, message: string) => {
    lines.push({
      id: `${task.id}-L${i++}`,
      ts: new Date(ts).toISOString(),
      source,
      level,
      message,
    });
    ts += step;
  };

  push("system", "info", `task ${task.id} created (${task.type}/${task.executionClass})`);
  if (task.attempts > 1) push("system", "warn", `attempt ${task.attempts} started after previous failure`);
  if (agent) {
    push("supervisor", "info", `delegating to worker ${agent.id} on ${agent.provider}/${agent.model}`);
    push("worker", "info", "session started; reading task brief");
  } else if (task.status !== "backlog" && task.status !== "queued") {
    push("system", "info", "awaiting worker assignment");
  }

  const steps = task.type === "scout" ? SCOUT_STEPS : SHIP_STEPS;
  const doneCount = Math.max(0, Math.min(steps.length, Math.round(((task.progress ?? 0) / 100) * steps.length)));
  for (let s = 0; s < doneCount; s++) {
    push("worker", "info", steps[s]);
    if ((seed >> s) % 5 === 0) push("worker", "warn", `retrying after transient error in: ${steps[s]}`);
  }

  if (task.status === "failed") {
    push("worker", "error", "fatal: worker could not continue");
    push("supervisor", "error", "task failed; failure summary written");
  } else if (task.status === "blocked") {
    push("worker", "warn", "blocked: waiting on operator decision");
  } else if (task.status === "stopped") {
    push("supervisor", "warn", "stop requested by operator");
    push("worker", "warn", "session terminated; worktree left in place");
  } else if (task.status === "done" || task.status === "review" || task.status === "ready") {
    push("worker", "success", "all steps complete");
    push("supervisor", "success", `task reached status ${task.status}`);
  } else if (task.status === "in_progress" || task.status === "scouting") {
    push("worker", "info", "…working");
  }
  return lines;
}

// ---------------------------------------------------------------------------
// MockSerenadeApi
// ---------------------------------------------------------------------------

let eventCounter = 100;
let taskCounter = 1100;

export class MockSerenadeApi implements SerenadeApi {
  private config: AppConfig = clone(defaultConfig);
  private taskStore: Task[] = clone(tasks);
  private agentStore: AgentRun[] = clone(agents);
  private worktreeStore: Worktree[] = clone(worktrees);
  private reportStore: Report[] = clone(reports);
  private eventStore: FleetEvent[] = clone(events);
  private logStore = new Map<string, LogLine[]>();
  private recentErrors: string[] = [];

  private logs(taskId: string): LogLine[] {
    if (!this.logStore.has(taskId)) {
      const task = this.taskStore.find((t) => t.id === taskId);
      if (!task) throw new SerenadeApiError({ code: "TASK_NOT_FOUND", title: "Task not found", message: `No task with id ${taskId}.`, recoverable: false });
      const agent = this.agentStore.find((a) => a.id === task.assignedAgentId);
      this.logStore.set(taskId, generateLogs(task, agent));
    }
    return this.logStore.get(taskId)!;
  }

  private event(kind: string, message: string, severity: FleetEventSeverity, refs: Partial<FleetEvent> = {}) {
    this.eventStore.unshift({
      id: `e_${eventCounter++}`,
      kind,
      message,
      severity,
      createdAt: new Date().toISOString(),
      ...refs,
    });
  }

  private touch(task: Task, status?: TaskStatus) {
    task.updatedAt = new Date().toISOString();
    if (status) task.status = status;
  }

  // -- config & environment -------------------------------------------------

  async getConfig(): Promise<AppConfig> {
    await delay();
    return clone(this.config);
  }

  async updateConfig(input: Partial<AppConfig>): Promise<AppConfig> {
    await delay();
    this.config = { ...this.config, ...input, notifications: { ...this.config.notifications, ...input.notifications } };
    return clone(this.config);
  }

  async validateEnvironment(): Promise<EnvironmentStatus> {
    await delay();
    // In mock mode, the default "hand" placeholder simulates PATH discovery.
    const handFound = !!this.config.handBinaryPath;
    const fleetValid = !!this.config.fleetPath;
    const issues: string[] = [];
    if (!handFound) issues.push("hand executable not found — configure the binary path in Settings.");
    if (!fleetValid) issues.push("fleet path is not set or does not look like a valid hand fleet.");
    return {
      platform: { os: "mock", arch: "mock" },
      tools: [
        {
          id: "git",
          label: "Git",
          required: true,
          ownership: "system",
          path: "/usr/bin/git",
          version: "2.42.0",
          state: "ready",
          compatible: true,
          message: "System Git detected.",
          capabilities: ["version-control"],
        },
        {
          id: "hand",
          label: "Secondhand / hand",
          required: true,
          ownership: handFound ? "custom" : undefined,
          path: this.config.handBinaryPath ?? undefined,
          version: handFound ? "0.6.3 (mock)" : undefined,
          state: handFound ? "ready" : "missing",
          compatible: handFound ? true : false,
          message: handFound ? "Verified legacy Hand 0.6 integration." : "No Hand executable found.",
          suggestedAction: handFound
            ? undefined
            : "Use Quick Setup to install a managed version, or set a system/custom Hand path.",
          capabilities: ["fleet"],
        },
        {
          id: "treehouse",
          label: "Treehouse",
          required: true,
          ownership: "system",
          path: "C:\\Users\\you\\AppData\\Local\\treehouse\\treehouse.exe",
          version: "2.3.0 (mock)",
          state: "ready",
          compatible: true,
          message: "Treehouse detected.",
          capabilities: ["worktree-runtime"],
        },
        {
          id: "herdr",
          label: "Herdr",
          required: true,
          ownership: "system",
          path: "C:\\Users\\you\\AppData\\Local\\Programs\\Herdr\\bin\\herdr.exe",
          version: "0.8.2 (mock)",
          state: "ready",
          compatible: true,
          message: "Herdr detected.",
          capabilities: ["terminal-runtime"],
        },
        {
          id: "supervisor",
          label: "Serenade Supervisor (OpenCode)",
          required: false,
          ownership: "system",
          path: "/usr/bin/opencode",
          version: "0.1.0 (mock)",
          state: "installed",
          compatible: true,
          message: "OpenCode executable found. Complete provider authentication if prompted.",
          capabilities: ["supervisor-chat"],
        },
      ],
      fleet: {
        path: this.config.fleetPath ?? undefined,
        state: fleetValid ? "ready" : "missing",
        message: fleetValid ? "Valid Fleet home detected." : "No Fleet path configured.",
      },
      ready: handFound && fleetValid,
      issues,
    };
  }

  async getDiagnostics(): Promise<Diagnostics> {
    await delay();
    const env = await this.validateEnvironment();
    return {
      appVersion: "0.1.0",
      mode: "mock",
      capabilities: {
        supportsStructuredTaskOutput: true,
        supportsPause: false,
        supportsRouteWrite: true,
        supportsTaskMessage: true,
        supportsReportListing: true,
      },
      handPath: env.tools.find((t) => t.id === "hand")?.path,
      handVersion: env.tools.find((t) => t.id === "hand")?.version,
      fleetPath: env.fleet.path,
      fleetValid: env.fleet.state === "ready",
      recentErrors: this.recentErrors.slice(0, 10),
    };
  }

  async initializeFleet(path: string, _force?: boolean): Promise<void> {
    await delay();
    this.config = { ...this.config, fleetPath: path.trim() || null };
  }

  async installManagedHand(): Promise<string> {
    await delay();
    const path = "C:\\mock\\Serenade\\tools\\hand\\0.6.0\\hand.exe";
    this.config = { ...this.config, handBinaryPath: path };
    return path;
  }

  async installTreehouse(): Promise<string> {
    await delay();
    return "treehouse 2.3.0";
  }

  async installHerdr(): Promise<string> {
    await delay();
    return "herdr 0.8.2";
  }

  // -- reads ------------------------------------------------------------------

  async listProjects(): Promise<Project[]> {
    await delay();
    return clone(projects);
  }

  async getProject(projectId: string): Promise<Project> {
    await delay();
    const p = projects.find((x) => x.id === projectId);
    if (!p) throw new SerenadeApiError({ code: "PROJECT_NOT_FOUND", title: "Project not found", message: `No project with id ${projectId}.`, recoverable: false });
    return clone(p);
  }

  async addProject(source: string): Promise<void> {
    await delay();
    const trimmed = source.trim();
    if (!trimmed) throw new SerenadeApiError({ code: "INVALID_PATH", title: "Invalid source", message: "Project source must not be empty.", recoverable: true });
    if (!/^(https:\/\/|git@|ssh:\/\/|git:\/\/)/.test(trimmed)) {
      throw new SerenadeApiError({
        code: "INVALID_PATH",
        title: "Unsupported project source",
        message: "Hand 0.6 only registers remote Git URLs (https://, git@, ssh://, git://).",
        recoverable: true,
      });
    }
    const name = trimmed.split("/").pop()?.replace(/\.git$/, "") ?? `project-${this.projectStore.length + 1}`;
    this.projectStore.push({
      id: `p_${name}`,
      name,
      repoUrl: trimmed,
      status: "active",
      defaultBranch: "main",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private get projectStore(): Project[] {
    return projects;
  }

  async listTasks(projectId?: string): Promise<Task[]> {
    await delay();
    return clone(this.taskStore.filter((t) => !projectId || t.projectId === projectId));
  }

  async getTask(taskId: string): Promise<Task> {
    await delay();
    const t = this.taskStore.find((x) => x.id === taskId);
    if (!t) throw new SerenadeApiError({ code: "TASK_NOT_FOUND", title: "Task not found", message: `No task with id ${taskId}.`, recoverable: false });
    return clone(t);
  }

  async listAgents(): Promise<AgentRun[]> {
    await delay();
    return clone(this.agentStore);
  }

  async listWorktrees(projectId?: string): Promise<Worktree[]> {
    await delay();
    return clone(this.worktreeStore.filter((w) => !projectId || w.projectId === projectId));
  }

  async listReports(projectId?: string): Promise<Report[]> {
    await delay();
    return clone(this.reportStore.filter((r) => !projectId || r.projectId === projectId));
  }

  async getReport(reportId: string): Promise<Report> {
    await delay();
    const r = this.reportStore.find((x) => x.id === reportId);
    if (!r) throw new SerenadeApiError({ code: "NOT_FOUND", title: "Report not found", message: `No report with id ${reportId}.`, recoverable: false });
    return clone(r);
  }

  async listRoutes(): Promise<{ providers: Provider[]; routes: RouteRule[] }> {
    await delay();
    return clone({ providers, routes: this.routeStore });
  }

  private get routeStore(): RouteRule[] {
    return routes;
  }

  async listEvents(limit = 50): Promise<FleetEvent[]> {
    await delay();
    return clone(this.eventStore.slice(0, limit));
  }

  async readTaskLogs(request: LogChunkRequest): Promise<LogChunkResponse> {
    await delay();
    const lines = this.logs(request.taskId);
    const start = request.cursor ? parseInt(request.cursor, 10) : 0;
    const limit = request.limit ?? 50;
    const slice = lines.slice(start, start + limit);
    const next = start + limit;
    return {
      lines: clone(slice),
      nextCursor: next < lines.length ? String(next) : undefined,
    };
  }

  // -- mutations ----------------------------------------------------------------

  async createTask(input: CreateTaskInput): Promise<Task> {
    await delay();
    if (!projects.some((p) => p.id === input.projectId)) {
      throw new SerenadeApiError({ code: "PROJECT_NOT_FOUND", title: "Project not found", message: `No project with id ${input.projectId}.`, recoverable: true, suggestedAction: "Pick a project from the list." });
    }
    const id = `t_${taskCounter++}`;
    const now = new Date().toISOString();
    const task: Task = {
      id,
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      type: input.type,
      executionClass: input.executionClass,
      status: "backlog",
      tags: input.tags ?? [],
      attempts: 0,
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.taskStore.unshift(task);
    this.event("task.created", `${id} ${input.title} added to backlog`, "info", { projectId: input.projectId, taskId: id });
    return clone(task);
  }

  async sendTaskMessage(taskId: string, message: string): Promise<void> {
    await delay();
    const task = this.taskStore.find((t) => t.id === taskId);
    if (!task) throw new SerenadeApiError({ code: "TASK_NOT_FOUND", title: "Task not found", message: `No task with id ${taskId}.`, recoverable: false });
    const lines = this.logs(taskId);
    const now = new Date().toISOString();
    lines.push({ id: `${taskId}-L${lines.length}`, ts: now, source: "supervisor", level: "info", message });
    lines.push({ id: `${taskId}-L${lines.length + 1}`, ts: now, source: "system", level: "success", message: "instruction delivered to worker" });
    const agent = this.agentStore.find((a) => a.id === task.assignedAgentId);
    if (agent && agent.status === "running") {
      lines.push({ id: `${taskId}-L${lines.length + 2}`, ts: new Date().toISOString(), source: "worker", level: "info", message: "acknowledged — adjusting plan" });
      agent.heartbeatAt = new Date().toISOString();
    }
    this.touch(task);
    this.event("task.message", `operator sent an instruction to ${taskId}`, "info", { projectId: task.projectId, taskId });
  }

  async retryTask(taskId: string): Promise<void> {
    await delay();
    const task = this.taskStore.find((t) => t.id === taskId);
    if (!task) throw new SerenadeApiError({ code: "TASK_NOT_FOUND", title: "Task not found", message: `No task with id ${taskId}.`, recoverable: false });
    if (task.status !== "failed" && task.status !== "stopped" && task.status !== "blocked") {
      throw new SerenadeApiError({ code: "COMMAND_FAILED", title: "Task is not retryable", message: `Task ${taskId} is ${task.status}; only failed, stopped, or blocked tasks can be retried.`, recoverable: true });
    }
    task.attempts += 1;
    task.progress = 0;
    this.touch(task, "in_progress");
    const agent = this.agentStore.find((a) => a.id === task.assignedAgentId);
    if (agent) {
      agent.status = "running";
      agent.startedAt = new Date().toISOString();
      agent.heartbeatAt = new Date().toISOString();
      agent.progress = 0;
      agent.endedAt = undefined;
    }
    const lines = this.logs(taskId);
    lines.push({ id: `${taskId}-L${lines.length}`, ts: new Date().toISOString(), source: "supervisor", level: "info", message: `retry requested by operator — attempt ${task.attempts}` });
    this.event("task.retry", `${taskId} retry started (attempt ${task.attempts})`, "info", { projectId: task.projectId, taskId });
  }

  async stopTask(taskId: string): Promise<void> {
    await delay();
    const task = this.taskStore.find((t) => t.id === taskId);
    if (!task) throw new SerenadeApiError({ code: "TASK_NOT_FOUND", title: "Task not found", message: `No task with id ${taskId}.`, recoverable: false });
    const agent = this.agentStore.find((a) => a.id === task.assignedAgentId);
    if (agent && (agent.status === "running" || agent.status === "waiting" || agent.status === "starting")) {
      agent.status = "stopped";
      agent.endedAt = new Date().toISOString();
    }
    this.touch(task, "stopped");
    const lines = this.logs(taskId);
    lines.push({ id: `${taskId}-L${lines.length}`, ts: new Date().toISOString(), source: "supervisor", level: "warn", message: "stop requested by operator" });
    this.event("task.stopped", `${taskId} stopped by operator`, "warning", { projectId: task.projectId, taskId, agentId: task.assignedAgentId });
  }

  async promoteTask(taskId: string): Promise<Task> {
    await delay();
    const task = this.taskStore.find((t) => t.id === taskId);
    if (!task) throw new SerenadeApiError({ code: "TASK_NOT_FOUND", title: "Task not found", message: `No task with id ${taskId}.`, recoverable: false });
    if (task.type !== "scout") {
      throw new SerenadeApiError({ code: "COMMAND_FAILED", title: "Only scouts can be promoted", message: `${taskId} is a ${task.type} task.`, recoverable: true });
    }
    const id = `t_${taskCounter++}`;
    const now = new Date().toISOString();
    const ship: Task = {
      id,
      projectId: task.projectId,
      title: `Ship: ${task.title.replace(/^Scout:\s*/i, "").replace(/^Investigate\s*/i, "Implement ")}`,
      description: `Promoted from scout ${task.id}.${task.reportId ? ` Plan: ${task.reportId}.` : ""}`,
      type: "ship",
      executionClass: "standard",
      status: "ready",
      tags: [...task.tags, "promoted"],
      reportId: task.reportId,
      attempts: 0,
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.taskStore.unshift(ship);
    this.event("task.promoted", `${task.id} promoted to ship task ${id}`, "success", { projectId: task.projectId, taskId: id });
    return clone(ship);
  }

  // -- local tooling ---------------------------------------------------------------

  async cleanupWorktree(worktreeId: string): Promise<void> {
    await delay();
    const idx = this.worktreeStore.findIndex((w) => w.id === worktreeId);
    if (idx === -1) throw new SerenadeApiError({ code: "WORKTREE_NOT_FOUND", title: "Worktree not found", message: `No worktree with id ${worktreeId}.`, recoverable: false });
    const [w] = this.worktreeStore.splice(idx, 1);
    this.event("worktree.cleaned", `worktree ${w.branch} removed (${w.path})`, "info", { projectId: w.projectId });
  }

  async openWorktree(_worktreeId: string, _target: "editor" | "folder" | "terminal"): Promise<void> {
    await delay();
    // Mock mode: the real implementation shells out to a fixed editor/folder/terminal action.
  }

  async supervisorChat(message: string, projectId?: string): Promise<SupervisorReply> {
    await delay();
    const scope = projectId ?? "the whole fleet";
    return {
      text: `**(mock supervisor for ${scope})** Understood: “${message}”. In mock mode I can't run a real model — inside the Tauri app this chat hosts a headless opencode supervisor scoped to ${scope}. Here's a sample proposal:

\`\`\`tasks
[{"title": "Sample: survey the repository", "project": "${projectId ?? "atlas-api"}", "kind": "scout", "executionClass": "standard", "description": "Produce an orientation report for the repo.", "tags": ["mock"]}]
\`\`\``,
    };
  }

  async supervisorReset(_projectId?: string): Promise<void> {
    await delay();
  }
}

export const mockApi = new MockSerenadeApi();
