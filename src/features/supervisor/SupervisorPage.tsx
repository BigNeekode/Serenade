import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useMutation } from "@tanstack/react-query";
import { BrainCircuit, Check, Loader2, RotateCcw, Send, Sparkles, User } from "lucide-react";
import { PageContainer } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/common/MarkdownView";
import { Select } from "@/components/ui/input";
import { ClassBadge, Mono, TypeBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/api";
import { InteractionGateway } from "@/lib/interaction/gateway";
import { useProjects } from "@/hooks/use-projects";
import { useUiStore } from "@/state/ui-store";
import { toAppError } from "@/types/domain";
import type { ExecutionClass, TaskType } from "@/types/domain";

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
          <Button variant="primary" size="xs" onClick={onCreate} loading={busy}>
            <Sparkles size={11} />
            Approve & spawn
          </Button>
        )}
      </div>
    </div>
  );
}

/** Scope key for chat persistence: "fleet" or a project name. */
const FLEET_SCOPE = "fleet";

export function SupervisorPage() {
  const api = useApi();
  const interaction = useMemo(() => new InteractionGateway(api), [api]);
  const toast = useToast();
  const { data: projects } = useProjects();
  const { getSupervisorChat, setSupervisorChat, appendSupervisorMessage, selectedProjectId } = useUiStore();
  const [scope, setScope] = useState<string>(() =>
    selectedProjectId ?? FLEET_SCOPE,
  );
  const [input, setInput] = useState("");
  const [busyTitles, setBusyTitles] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Chat state lives in the global UI store, so history survives navigating
  // away and back — and each scope keeps its own conversation. It is UX state,
  // not canonical Fleet truth.
  const chat = getSupervisorChat(scope);

  const projectId = scope === FLEET_SCOPE ? undefined : scope;

  // Reasoning-required path: prose goes to the Supervisor Harness.
  const sendMutation = useMutation({
    mutationFn: (message: string) => interaction.sendReasoningInput(message, projectId),
    onSuccess: (reply) => {
      appendSupervisorMessage(scope, { role: "supervisor", text: reply.text });
    },
    onError: (err) => {
      const appErr = toAppError(err);
      // Persist the failure in the transcript so it stays visible after any
      // transient toast expires — a silent-looking chat is never acceptable.
      const detail = appErr.detail ? `\n\n\`\`\`\n${appErr.detail}\n\`\`\`` : "";
      appendSupervisorMessage(scope, {
        role: "supervisor",
        text: `**${appErr.title}**\n\n${appErr.message}${detail}${
          appErr.suggestedAction ? `\n\n${appErr.suggestedAction}` : ""
        }`,
      });
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
  }, [chat.messages.length, sendMutation.isPending]);

  const proposals = useMemo(() => {
    const last = [...chat.messages].reverse().find((m) => m.role === "supervisor");
    return last ? parseProposals(last.text) : [];
  }, [chat.messages]);

  const createdSet = useMemo(() => new Set(chat.createdTitles), [chat.createdTitles]);

  const send = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    appendSupervisorMessage(scope, { role: "operator", text });
    sendMutation.mutate(text);
  };

  const reset = async () => {
    await api.supervisorReset(projectId);
    setSupervisorChat(scope, { messages: [], createdTitles: [], counter: 0 });
    toast.showToast({ variant: "info", title: "Supervisor runtime reset" });
  };

  // Exact typed-action path: approval dispatches directly through Hand's
  // mutation adapter. It does not spend another Supervisor/LLM turn.
  const spawn = async (proposal: TaskProposal) => {
    setBusyTitles((s) => new Set(s).add(proposal.title));
    try {
      const task = await interaction.createTask({
        projectId: proposal.project,
        title: proposal.title,
        description: proposal.description,
        type: proposal.kind,
        executionClass: proposal.executionClass,
        tags: proposal.tags,
      });
      setSupervisorChat(scope, {
        ...chat,
        createdTitles: [...chat.createdTitles, proposal.title],
      });
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

  const pendingCount = proposals.filter((p) => !createdSet.has(p.title)).length;
  const scopeProject = projects?.find((p) => p.id === scope);

  return (
    <PageContainer
      title={
        <span className="flex items-center gap-2">
          <BrainCircuit size={17} className="text-accent" />
          Supervisor
        </span>
      }
      subtitle={
        scope === FLEET_SCOPE
          ? "Chat with the fleet's supervising agent — it plans work, you approve exact dispatches"
          : `Project supervisor for ${scope} — runs inside the project clone, proposes work for this repo`
      }
      actions={
        <div className="flex items-center gap-2">
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-8 w-52 text-xs"
            aria-label="Supervisor scope"
          >
            <option value={FLEET_SCOPE}>Whole fleet</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {chat.messages.length > 0 && (
            <Button variant="ghost" onClick={reset} disabled={sendMutation.isPending}>
              <RotateCcw size={13} />
              New runtime
            </Button>
          )}
        </div>
      }
    >
      <div className="flex min-h-[60vh] flex-col gap-4 rounded-xl border border-line bg-panel">
        <div ref={scrollRef} className="max-h-[52vh] min-h-48 flex-1 overflow-y-auto p-4">
          {chat.messages.length === 0 && !sendMutation.isPending && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
              <BrainCircuit size={22} className="text-fg-subtle" />
              <p className="text-xs font-medium text-fg-muted">
                {scope === FLEET_SCOPE
                  ? "Ask the supervisor to reason about work for the fleet"
                  : `Ask the ${scope} supervisor to reason about work`}
              </p>
              <p className="max-w-md text-[11px] leading-relaxed text-fg-subtle">
                {scope === FLEET_SCOPE
                  ? "The Supervisor re-orients against Hand before reasoning; proposed exact tasks appear as approval cards below."
                  : "This Supervisor runs inside the project clone and re-orients against Hand before reasoning. Proposed work appears as approval cards below."}
              </p>
              {scope !== FLEET_SCOPE && !scopeProject && (
                <p className="text-[11px] text-warning">
                  Project {scope} is not registered — pick another scope or register it first.
                </p>
              )}
            </div>
          )}
          <div className="space-y-4">
            {chat.messages.map((message) => (
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
            {sendMutation.isPending && (
              <div className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-accent-soft text-accent">
                  <BrainCircuit size={12} />
                </span>
                <p className="flex items-center gap-2 pt-1 text-xs text-fg-subtle">
                  <Loader2 size={12} className="animate-spin" />
                  supervisor is orienting & reasoning… (can take a minute)
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
                      if (!createdSet.has(proposal.title)) void spawn(proposal);
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
                  created={createdSet.has(proposal.title)}
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
            placeholder={
              scope === FLEET_SCOPE
                ? "Tell the supervisor what you want reasoned/planned…"
                : `Tell the ${scope} supervisor what you want reasoned/planned…`
            }
            className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:border-accent/70 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <Button
            variant="primary"
            size="md"
            onClick={send}
            loading={sendMutation.isPending}
            disabled={!input.trim()}
          >
            <Send size={13} />
            Send
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
