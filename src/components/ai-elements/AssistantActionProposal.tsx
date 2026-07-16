"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { AssistantActionProposalView } from "@/lib/assistant-types";

type ActionResponse = {
  proposal?: AssistantActionProposalView;
  error?: string;
};

export function AssistantActionProposal({ initialProposal }: { initialProposal: AssistantActionProposalView }) {
  const [proposal, setProposal] = useState(initialProposal);
  const [submitting, setSubmitting] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "confirm" | "cancel") {
    setSubmitting(action);
    setError(null);
    try {
      const response = await fetch(`/api/assistant/actions/${proposal.id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as ActionResponse | null;
      if (!response.ok || !data?.proposal) {
        throw new Error(data?.error ?? "Could not update this proposal.");
      }
      setProposal(data.proposal);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update this proposal.");
    } finally {
      setSubmitting(null);
    }
  }

  const pending = proposal.status === "PENDING";
  const warnings = proposal.warnings ?? [];
  return (
    <section className="overflow-hidden rounded-md border border-hairline bg-canvas" aria-label="Action proposal">
      <div className="border-b border-hairline bg-surface-soft px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-white">
            {proposal.status === "CONFIRMED" ? (
              <CheckCircle2 size={17} aria-hidden />
            ) : (
              <ShieldCheck size={17} aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase text-muted">
              {proposal.status === "CONFIRMED"
                ? "Change applied"
                : proposal.status === "CANCELLED"
                  ? "Proposal cancelled"
                  : proposal.status === "EXPIRED"
                    ? "Proposal expired"
                    : "Confirmation required"}
            </p>
            <h4 className="mt-0.5 text-sm font-semibold text-ink">{proposal.title}</h4>
            <p className="mt-1 text-xs text-muted">{proposal.projectName}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-hairline px-4">
        {proposal.changes.map((change) => (
          <div
            key={change.field}
            className="grid gap-1.5 py-3 sm:grid-cols-[92px_1fr_18px_1fr] sm:items-center"
          >
            <span className="text-[11px] font-semibold text-muted">{change.label}</span>
            <span className="min-w-0 break-words text-xs text-body">{change.before}</span>
            <ArrowRight size={13} className="hidden text-muted-soft sm:block" aria-hidden />
            <span className="min-w-0 break-words text-xs font-semibold text-ink">{change.after}</span>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="border-t border-warning/25 bg-warning/8 px-4 py-3">
          <div className="flex items-start gap-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-ink">Schedule impact</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-body">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="border-t border-hairline bg-error-soft px-4 py-2.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 py-3">
        <Link
          href={proposal.href}
          className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-body hover:text-ink"
        >
          {proposal.hrefLabel}
          <ExternalLink size={12} aria-hidden />
        </Link>
        {pending && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit("cancel")}
              disabled={submitting !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline px-3 text-xs font-semibold text-body hover:bg-surface-soft disabled:opacity-50"
            >
              {submitting === "cancel" ? (
                <LoaderCircle size={13} className="animate-spin" aria-hidden />
              ) : (
                <X size={13} aria-hidden />
              )}
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit("confirm")}
              disabled={submitting !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-xs font-semibold text-white hover:bg-primary-active disabled:opacity-50"
            >
              {submitting === "confirm" ? (
                <LoaderCircle size={13} className="animate-spin" aria-hidden />
              ) : (
                <Check size={13} aria-hidden />
              )}
              Confirm change
            </button>
          </div>
        )}
      </footer>
    </section>
  );
}
