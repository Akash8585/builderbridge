"use client";

import Link from "next/link";
import { Check, Database, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import { getToolName } from "ai";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { AssistantActionProposal } from "@/components/ai-elements/AssistantActionProposal";
import type { AssistantActionProposalView } from "@/lib/assistant-types";

type SourceLink = { label: string; href: string };

const TOOL_LABELS: Record<string, string> = {
  searchProjectDocuments: "Project documents searched",
  searchProjectTasks: "Project tasks searched",
  getProjectMembers: "Project members checked",
  proposeRoadblockChange: "Roadblock request checked",
  proposeTaskChange: "Task change checked",
  proposeScheduleChange: "Schedule impact checked",
  proposeRfiChange: "RFI request checked",
  proposeSubmittalChange: "Submittal request checked",
  getPortfolioHealth: "Portfolio health checked",
  getProjectOverview: "Project overview checked",
  getScheduleRisks: "Schedule risks reviewed",
  getOpenItems: "Open items reviewed",
};

function readActionProposal(output: unknown): AssistantActionProposalView | null {
  if (!output || typeof output !== "object" || !("kind" in output) || !("proposal" in output)) return null;
  if (output.kind !== "action-proposal") return null;
  const proposal = output.proposal;
  if (
    !proposal ||
    typeof proposal !== "object" ||
    !("id" in proposal) ||
    !("status" in proposal) ||
    !("changes" in proposal) ||
    typeof proposal.id !== "string" ||
    !Array.isArray(proposal.changes)
  ) {
    return null;
  }
  return proposal as AssistantActionProposalView;
}

function readSources(output: unknown): SourceLink[] {
  if (!output || typeof output !== "object" || !("sources" in output)) return [];
  const sources = (output as { sources?: unknown }).sources;
  if (!Array.isArray(sources)) return [];
  return sources.filter(
    (source): source is SourceLink =>
      !!source &&
      typeof source === "object" &&
      "label" in source &&
      "href" in source &&
      typeof source.label === "string" &&
      typeof source.href === "string" &&
      source.href.startsWith("/")
  );
}

export function AssistantToolResult({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const toolName = getToolName(part);
  const label = TOOL_LABELS[toolName] ?? "Project data checked";

  if (part.state === "output-error") {
    return (
      <div className="flex items-center gap-2 text-xs text-error">
        <TriangleAlert size={14} aria-hidden />
        <span>{part.errorText || "Could not read this project data."}</span>
      </div>
    );
  }

  if (part.state !== "output-available") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <LoaderCircle size={14} className="animate-spin" aria-hidden />
        <span>Checking live project data</span>
      </div>
    );
  }

  const actionProposal = readActionProposal(part.output);
  if (actionProposal) {
    return (
      <AssistantActionProposal
        key={`${part.toolCallId}-${actionProposal.status}`}
        initialProposal={actionProposal}
      />
    );
  }

  const sources = readSources(part.output);
  return (
    <div className="rounded-md border border-hairline bg-surface-soft px-3.5 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-body">
        <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-canvas text-success shadow-sm">
          <Check size={13} strokeWidth={2.25} aria-hidden />
        </span>
        <Database size={13} className="text-muted" aria-hidden />
        <span>{label}</span>
      </div>
      {sources.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Sources">
          {sources.map((source) => (
            <Link
              key={`${part.toolCallId}-${source.href}-${source.label}`}
              href={source.href}
              className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-hairline bg-canvas px-2.5 text-[11px] font-medium text-body transition-colors hover:border-muted-soft hover:text-ink"
            >
              <span className="max-w-48 truncate">{source.label}</span>
              <ExternalLink size={11} aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
