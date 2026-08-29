import { describe, expect, it } from "vitest";
import { deriveLegacyAttention } from "./AttentionPanel";
import type { AgentRun, Task, TaskStatus } from "@/types/domain";

function task(id: string, status: TaskStatus): Task {
  return {
    id,
    projectId: "demo",
    title: `Task ${id}`,
    type: "ship",
    executionClass: "standard",
    status,
    tags: [],
    attempts: 1,
    createdAt: "2026-08-29T10:00:00Z",
    updatedAt: "2026-08-29T10:00:00Z",
  };
}

function agent(id: string, status: AgentRun["status"], heartbeatAt?: string): AgentRun {
  return {
    id,
    projectId: "demo",
    provider: "opencode",
    status,
    heartbeatAt,
  };
}

describe("deriveLegacyAttention", () => {
  it("marks all compatibility indicators as legacy-derived", () => {
    const now = Date.parse("2026-08-29T12:00:00Z");
    const items = deriveLegacyAttention(
      [task("failed-one", "failed"), task("review-one", "review")],
      [agent("stale-worker", "running", "2026-08-29T11:40:00Z")],
      now,
    );

    expect(items.map((item) => item.class)).toEqual(["diagnostic", "retry", "progression"]);
    expect(items.every((item) => item.source === "legacy-derived")).toBe(true);
    expect(items[0]?.reason).toContain("not canonical Hand Attention");
  });

  it("does not manufacture stale Attention for terminal workers", () => {
    const now = Date.parse("2026-08-29T12:00:00Z");
    const items = deriveLegacyAttention(
      [],
      [agent("old-but-completed", "completed", "2026-08-29T10:00:00Z")],
      now,
    );

    expect(items).toEqual([]);
  });
});
