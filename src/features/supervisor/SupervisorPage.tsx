import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { BrainCircuit, Check, Loader2, RotateCcw, Send, Sparkles, User } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/common/MarkdownView";
import { ClassBadge, Mono, TypeBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { toAppError } from "@/types/domain";
import type { ExecutionClass, TaskType } from "@/types/domain";

interface ChatMessage {
  id: number;
  role: "operator" | "supervisor";
  text: string;
}

interface TaskProposal {
  title: string;
  project: string;
  kind: TaskType;
  executionClass: ExecutionClass;
  description?: string;
  tags?: string[];
}

/** Extract ```tasks [...]``` fenced blocks from supervisor text. */
function parseProposals(text: string): TaskProposal[] {
  const proposals: TaskProposal[] = [];
  const re = /```tasks\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item?.title === "string" && typeof item?.project === "string") {
            proposals.push({
              title: item.title,
              project: item.project,
              kind: item.kind === "scout" ? "scout" : "ship",
              executionClass:
                item.executionClass === "mechanical" || item.executionClass === "deep"
                  ? item.executionClass
                  : "standard",
              description: typeof item.description === "string" ? item.description : undefined,
              tags: Array.isArray(item.tags)
                ? item.tags.filter((t: unknown): t is string => typeof t === "string")
                : undefined,
            });
          }
        }
      }
    } catch {
      // malformed block — skip it, the chat text still renders
    }
  }
  return proposals;
}

function ProposalCard({
  proposal,
  created,
  onCreate,
  busy,
}: {
  proposal: TaskProposal;
  created: boolean;
  onCreate: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-lg border bg-panel p-3",
        created ? "border-success/40" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-fg">{proposal.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Mono className="text-[10px]">{proposal.project}</Mono>
            <TypeBadge type={proposal.kind} />
            <ClassBadge executionClass={proposal.executionClass} />
            {proposal.tags?.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-fg-muted border border-line">
                #{tag}
              </span>
            ))}
          </div>
          {proposal.description && (
            <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-fg-muted">
              {proposal.description}
            </p>
          )}
        </div>
        {created ? (
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-success">
            <Check size={12} /> spawned
          </span>
        ) : (
          <Button variant="primary" size="xs" onClick={onCreate} loading={busy} disabled={created}>
            <Sparkles size={11} />
            Approve & spawn
          </Button>
        )}
      </div>
    </div>
  );
}

export function SupervisorPage() {
  const api = useApi();
  const toast = useToast();
  const { data: projects } = useProjects();
  const createTask = useCreateTask();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [createdTitles, setCreatedTitles] = useState<Set<string>>(new Set());
  const [busyTitles, setBusyTitles] = useState<Set<string>>(new Set());
  const counter = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useMutation({
    mutationFn: (message: string) => api.supervisorChat(message),
    onSuccess: (reply) => {
      setMessages((list) => [...list, { id: ++counter.current, role: "supervisor", text: reply.text }]);
    },
    onError: (err) => {
      const appErr = toAppError(err);
      toast.showToast({
        variant: "error",
        title: appErr.title,
        description: appErr.message,
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, chat.isPending]);

  const proposals = useMemo(() => {
    const last = [...messages].reverse().find((m) => m.role === "supervisor");
    return last ? parseProposals(last.text) : [];
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || chat.isPending) return;
    setInput("");
    setMessages((list) => [...list, { id: ++counter.current, role: "operator", text }]);
    setCreatedTitles(new Set());
    chat.mutate(text);
  };

  const reset = async () => {
    await api.supervisorReset();
    setMessages([]);
    setCreatedTitles(new Set());
    toast.showToast({ variant: "info", title: "Supervisor session reset" });
  };

  const spawn = async (proposal: TaskProposal) => {
    setBusyTitles((s) => new Set(s).add(proposal.title));
    try {
      const task = await createTask.mutateAsync({
        projectId: proposal.project,
        title: proposal.title,
        description: proposal.description,
        type: proposal.kind,
        executionClass: proposal.executionClass,
        tags: proposal.tags,
      });
      setCreatedTitles((s) => new Set(s).add(proposal.title));
      toast.showToast({
        variant: "success",
        title: `Worker dispatched: ${task.id}`,
        description: proposal.title,
      });
    } catch (err) {
      const appErr = toAppError(err);
      toast.showToast({
        variant: "error",
        title: appErr.title,
        description: appErr.message,
      });
    } finally {
      setBusyTitles((s) => {
        const next = new Set(s);
        next.delete(proposal.title);
        return next;
      });
    }
  };

  const pendingCount = proposals.filter((p) => !createdTitles.has(p.title)).length;

  return (
    <PageContainer
      title={
        <span className="flex items-center gap-2">
          <BrainCircuit size={17} className="text-accent" />
          Supervisor
        </span>
      }
      subtitle="Chat with the fleet's supervising agent — it plans work, you approve the dispatches"
      actions={
        messages.length > 0 && (
          <Button variant="ghost" onClick={reset} disabled={chat.isPending}>
            <RotateCcw size={13} />
            New session
          </Button>
        )
      }
    >
      <div className="flex min-h-[60vh] flex-col gap-4 rounded-xl border border-line bg-panel">
        <div ref={scrollRef} className="max-h-[52vh] min-h-48 flex-1 overflow-y-auto p-4">
          {messages.length === 0 && !chat.isPending && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
              <BrainCircuit size={22} className="text-fg-subtle" />
              <p className="text-xs font-medium text-fg-muted">Ask the supervisor to plan work</p>
              <p className="max-w-md text-[11px] leading-relaxed text-fg-subtle">
                e.g. “Look at the fleet and propose tasks to improve the site's accessibility.”
                The supervisor sees your fleet's live state and hand's supervision contract; the
                tasks it proposes appear as approval cards below.
              </p>
              {projects && projects.length === 0 && (
                <p className="text-[11px] text-warning">Register a project first — the supervisor dispatches into projects.</p>
              )}
            </div>
          )}
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <span
                  className={clsx(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                    message.role === "supervisor"
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-line bg-raised text-fg-muted",
                  )}
                >
                  {message.role === "supervisor" ? <BrainCircuit size={12} /> : <User size={12} />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                    {message.role === "supervisor" ? "supervisor" : "you"}
                  </p>
                  <MarkdownView content={message.text} />
                </div>
              </div>
            ))}
            {chat.isPending && (
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent-soft text-accent">
                  <BrainCircuit size={12} />
                </span>
                <p className="flex items-center gap-2 pt-1 text-xs text-fg-subtle">
                  <Loader2 size={12} className="animate-spin" />
                  supervisor is thinking… (can take a minute)
                </p>
              </div>
            )}
          </div>
        </div>

        {proposals.length > 0 && (
          <div className="border-t border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                Proposed tasks {pendingCount > 0 ? `(${pendingCount} awaiting approval)` : "(all dispatched)"}
              </p>
              {pendingCount > 1 && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => {
                    for (const proposal of proposals) {
                      if (!createdTitles.has(proposal.title)) void spawn(proposal);
                    }
                  }}
                >
                  Approve all
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={`${proposal.project}-${proposal.title}`}
                  proposal={proposal}
                  created={createdTitles.has(proposal.title)}
                  busy={busyTitles.has(proposal.title)}
                  onCreate={() => void spawn(proposal)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-line p-3">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Tell the supervisor what you want done…"
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:border-accent/70 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <Button variant="primary" size="md" onClick={send} loading={chat.isPending} disabled={!input.trim()}>
            <Send size={13} />
            Send
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
