"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  formatShort,
  isOverdue,
  localDateTimeToISO,
  timeAgo,
  toDateInputValue,
} from "@/lib/time";
import { STATUSES, type Discussion, type Lead, type LeadStatus } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { Modal } from "./Modal";

interface Props {
  lead: Lead;
  onClose: () => void;
  /** Called with the fresh server copy of the lead whenever status/follow-up/last note change. */
  onLeadChange: (lead: Lead) => void;
}

const inputCls =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400";

export function LeadTimelineDialog({ lead, onClose, onLeadChange }: Props) {
  const [discussions, setDiscussions] = useState<Discussion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [note, setNote] = useState("");
  const [setFollowUp, setSetFollowUp] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const now = useNow();
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

  function toggleFollowUp(on: boolean) {
    setSetFollowUp(on);
    setFormError(null);
    if (on && !date) {
      // Sensible default: tomorrow at 10:00 local time.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDate(toDateInputValue(tomorrow));
      setTime("10:00");
    }
  }

  async function changeStatus(next: LeadStatus) {
    if (next === lead.status || statusSaving) return;
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
    if (saving) return;
    if (!note.trim()) {
      setFormError("Write a note before saving.");
      return;
    }
    let followUpISO: string | null = null;
    if (setFollowUp) {
      followUpISO = localDateTimeToISO(date, time);
      if (!followUpISO) {
        setFormError("Pick both a date and a time for the follow-up.");
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    try {
      const { discussion, lead: updated } = await api.addDiscussion(leadId, {
        note: note.trim(),
        follow_up_at: followUpISO,
      });
      setDiscussions((prev) => [discussion, ...(prev ?? [])]);
      onLeadChange(updated);
      setNote("");
      setSetFollowUp(false);
      setDate("");
      setTime("");
    } catch (err) {
      // Keep the typed note so nothing is lost.
      setFormError(err instanceof Error ? err.message : "Could not save the discussion.");
    } finally {
      setSaving(false);
    }
  }

  const overdue = isOverdue(lead, now);
  const closed = lead.status === "Won" || lead.status === "Lost";

  return (
    <Modal
      label={`Lead ${lead.name}`}
      onClose={onClose}
      wide
      title={
        <>
          {lead.name}
          {lead.company && (
            <span className="ml-1.5 font-normal text-slate-500">({lead.company})</span>
          )}
        </>
      }
      subtitle={
        <>
          {lead.phone ? `📞 ${lead.phone}` : <span className="italic">No phone</span>}
        </>
      }
      actions={
        <>
          <label className="sr-only" htmlFor="lead-status">
            Status
          </label>
          <select
            id="lead-status"
            value={lead.status}
            disabled={statusSaving}
            onChange={(e) => changeStatus(e.target.value as LeadStatus)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </>
      }
    >
      {(lead.follow_up_at && !closed) || statusError ? (
        <div className="space-y-1 border-b border-slate-200 bg-white px-5 py-2 text-sm">
          {lead.follow_up_at && !closed && (
            <p className={overdue ? "font-medium text-rose-600" : "text-blue-700"}>
              {overdue ? "⏰ Overdue follow-up: " : "🔔 Next follow-up: "}
              {formatShort(lead.follow_up_at, now)}{" "}
              <button
                type="button"
                onClick={clearFollowUp}
                className="ml-1 text-xs font-normal text-slate-500 underline hover:text-slate-800"
              >
                clear
              </button>
            </p>
          )}
          {statusError && (
            <p role="alert" className="text-rose-600">
              {statusError}
            </p>
          )}
        </div>
      ) : null}

      <div className="min-h-40 flex-1 overflow-y-auto bg-slate-50 px-5 py-5">
        {loadError ? (
          <div role="alert" className="rounded-md bg-rose-50 px-3 py-3 text-sm text-rose-700">
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
        ) : (
          <ol className="relative space-y-5 border-l-2 border-slate-200 pl-6">
            {discussions.length === 0 && (
              <li className="text-sm text-slate-500">
                No discussions yet. Log the first one below.
              </li>
            )}
            {discussions.map((d, i) => (
              <li key={d.id} className="relative">
                <span
                  className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-slate-50 ${
                    i === 0 ? "bg-blue-500" : "bg-slate-300"
                  }`}
                />
                <p className="text-xs text-slate-500">
                  <time dateTime={d.created_at}>{formatShort(d.created_at, now)}</time>{" "}
                  <span className="text-slate-400">({timeAgo(d.created_at)})</span>
                </p>
                <div className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{d.note}</p>
                  {d.follow_up_at && (
                    <p className="mt-1.5 w-fit rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      📅 Follow-up set for: {formatShort(d.follow_up_at, now)}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {discussions !== null && (
              // System event derived from the lead itself; never stored as a discussion,
              // so it can never become the "last note" shown in the list.
              <li className="relative">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-slate-300 ring-4 ring-slate-50" />
                <p className="text-xs text-slate-500">
                  <time dateTime={lead.created_at}>{formatShort(lead.created_at, now)}</time>{" "}
                  <span className="text-slate-400">({timeAgo(lead.created_at)})</span>
                </p>
                <div className="mt-1 rounded-md border border-dashed border-slate-300 px-3 py-2">
                  <p className="text-sm italic text-slate-500">Lead created.</p>
                </div>
              </li>
            )}
          </ol>
        )}
      </div>

      <form onSubmit={submit} noValidate className="space-y-3 border-t border-slate-200 bg-white px-5 py-4">
        <label className="block">
          <span className="sr-only">New discussion</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Log a new discussion..."
            className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={setFollowUp}
              onChange={(e) => toggleFollowUp(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Set Follow-up
          </label>
          <input
            type="date"
            aria-label="Follow-up date"
            value={date}
            disabled={!setFollowUp}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
          <input
            type="time"
            aria-label="Follow-up time"
            value={time}
            disabled={!setFollowUp}
            onChange={(e) => setTime(e.target.value)}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={saving}
            className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Note"}
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
