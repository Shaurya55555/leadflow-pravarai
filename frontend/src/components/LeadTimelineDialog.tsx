"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime, isOverdue, localInputToISO, timeAgo } from "@/lib/time";
import { STATUSES, type Discussion, type Lead, type LeadStatus } from "@/lib/types";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";

interface Props {
  lead: Lead;
  onClose: () => void;
  /** Called with the fresh server copy of the lead whenever status/follow-up/last note change. */
  onLeadChange: (lead: Lead) => void;
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

export function LeadTimelineDialog({ lead, onClose, onLeadChange }: Props) {
  const [discussions, setDiscussions] = useState<Discussion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  const leadId = lead.id;
  useEffect(() => {
    let cancelled = false;
    api
      .listDiscussions(leadId)
      .then((data) => {
        if (cancelled) return;
        setDiscussions(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not load discussions.");
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, reloadKey]);

  async function changeStatus(next: LeadStatus) {
    if (next === lead.status) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      onLeadChange(await api.updateLead(leadId, { status: next }));
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function clearFollowUp() {
    setStatusError(null);
    try {
      onLeadChange(await api.updateLead(leadId, { follow_up_at: null }));
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Could not clear follow-up.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setFormError("Write a note before saving.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const { discussion, lead: updated } = await api.addDiscussion(leadId, {
        note: note.trim(),
        follow_up_at: localInputToISO(followUp),
      });
      setDiscussions((prev) => [discussion, ...(prev ?? [])]);
      onLeadChange(updated);
      setNote("");
      setFollowUp("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the discussion.");
    } finally {
      setSaving(false);
    }
  }

  const overdue = isOverdue(lead);

  return (
    <Modal title={lead.name} onClose={onClose} wide>
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm text-slate-600">
            {[lead.company, lead.phone].filter(Boolean).join(" · ") || "No company or phone"}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <label className="sr-only" htmlFor="lead-status">
              Status
            </label>
            <select
              id="lead-status"
              value={lead.status}
              disabled={statusSaving}
              onChange={(e) => changeStatus(e.target.value as LeadStatus)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {lead.follow_up_at && (
          <p className={`mt-2 text-sm ${overdue ? "font-medium text-rose-600" : "text-slate-600"}`}>
            Follow-up: {formatDateTime(lead.follow_up_at)}
            {overdue ? " (overdue)" : ""}{" "}
            <button
              type="button"
              onClick={clearFollowUp}
              className="ml-1 text-xs text-slate-500 underline hover:text-slate-800"
            >
              clear
            </button>
          </p>
        )}
        {statusError && (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            {statusError}
          </p>
        )}
      </div>

      <div className="min-h-32 flex-1 overflow-y-auto px-5 py-4">
        {loadError ? (
          <div role="alert" className="rounded-lg bg-rose-50 px-3 py-3 text-sm text-rose-700">
            {loadError}{" "}
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="font-medium underline"
            >
              Retry
            </button>
          </div>
        ) : discussions === null ? (
          <p className="text-sm text-slate-500">Loading discussions...</p>
        ) : discussions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No discussions yet. Log the first one below.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {discussions.map((d) => (
              <li key={d.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                <p className="whitespace-pre-wrap text-sm text-slate-900">{d.note}</p>
                <p className="mt-1 text-xs text-slate-500">
                  <time dateTime={d.created_at} title={formatDateTime(d.created_at)}>
                    {timeAgo(d.created_at)}
                  </time>
                  {d.follow_up_at && <> · follow-up set for {formatDateTime(d.follow_up_at)}</>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={submit} className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">New discussion</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="What was discussed?"
            className={inputCls}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Follow-up <span className="font-normal text-slate-500">(optional)</span>
            </span>
            <input
              type="datetime-local"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save discussion"}
          </button>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-rose-600">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  );
}
