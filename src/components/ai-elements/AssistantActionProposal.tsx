"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
    <section className="overflow-hidden rounded-md border border-white/[0.1] bg-white/[0.035]" aria-label="Action proposal">
      <div className="border-b border-white/[0.08] bg-white/[0.035] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[#111211]">
            {proposal.status === "CONFIRMED" ? (
              <CheckCircle2 size={17} aria-hidden />
            ) : (
              <ShieldCheck size={17} aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase text-white/35">
              {proposal.status === "CONFIRMED"
                ? "Change applied"
                : proposal.status === "CANCELLED"
                  ? "Proposal cancelled"
                  : proposal.status === "EXPIRED"
                    ? "Proposal expired"
                    : "Confirmation required"}
            </p>
            <h4 className="mt-0.5 text-sm font-semibold text-white/90">{proposal.title}</h4>
            <p className="mt-1 text-xs text-white/35">{proposal.projectName}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/[0.07] px-4">
        {proposal.changes.map((change) => (
          <div
            key={change.field}
            className="grid gap-1.5 py-3 sm:grid-cols-[92px_1fr_18px_1fr] sm:items-center"
          >
            <span className="text-[11px] font-semibold text-white/35">{change.label}</span>
            <span className="min-w-0 break-words text-xs text-white/50">{change.before}</span>
            <ArrowRight size={13} className="hidden text-white/25 sm:block" aria-hidden />
            <span className="min-w-0 break-words text-xs font-semibold text-white/85">{change.after}</span>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="border-t border-warning/25 bg-warning/8 px-4 py-3">
          <div className="flex items-start gap-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-white/85">Schedule impact</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-white/55">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="border-t border-white/[0.08] bg-error/10 px-4 py-2.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-3">
        <Link
          href={proposal.href}
          onClick={(event) => {
            window.dispatchEvent(
              new CustomEvent("builderbridge:toggle-assistant", { detail: { open: false } })
            );
            const destination = new URL(proposal.href, window.location.href);
            const currentLocation = `${window.location.pathname}${window.location.search}`;
            if (`${destination.pathname}${destination.search}` === currentLocation) {
              event.preventDefault();
              router.refresh();
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 text-xs font-semibold text-white/60 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-xs font-semibold text-[#111211] hover:bg-white/85 disabled:opacity-50"
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
