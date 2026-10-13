"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { pinTodaysFollowUps } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { AddLeadDialog } from "./AddLeadDialog";
import { LeadRow } from "./LeadRow";
import { LeadTimelineDialog } from "./LeadTimelineDialog";

export function LeadFlowApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api
      .listLeads({ status: statusFilter, q: debouncedSearch })
      .then((data) => {
        if (cancelled) return;
        setLeads(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load leads.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, debouncedSearch, reloadKey]);

  const matchesFilters = useCallback(
    (lead: Lead) =>
      (!statusFilter || lead.status === statusFilter) &&
      (!debouncedSearch.trim() ||
        lead.name.toLowerCase().includes(debouncedSearch.trim().toLowerCase())),
    [statusFilter, debouncedSearch],
  );

  /** Merge a server-fresh lead into the list immediately, without a refetch. */
  const upsertLead = useCallback(
    (updated: Lead) => {
      setLeads((prev) => {
        const without = prev.filter((l) => l.id !== updated.id);
        if (!matchesFilters(updated)) return without;
        // Server orders by most recent activity; reproduce that locally.
        return [updated, ...without].sort(
          (a, b) =>
            new Date(b.last_discussion_at ?? b.created_at).getTime() -
            new Date(a.last_discussion_at ?? a.created_at).getTime(),
        );
      });
    },
    [matchesFilters],
  );

  const { today, rest } = useMemo(() => pinTodaysFollowUps(leads, now), [leads, now]);
  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const filtering = statusFilter !== null || debouncedSearch.trim() !== "";

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-blue-600">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M2 14l5-5 3 3 7-7M12 5h5v5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            LeadFlow
          </h1>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="shrink-0 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add New Lead
          </button>
        </div>
      </header>

    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filters:
          </span>
          {([null, ...STATUSES] as (LeadStatus | null)[]).map((s) => {
            const active = s === statusFilter;
            return (
              <button
                key={s ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {s ?? "All"}
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads by name"
          aria-label="Search leads by name"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-xl bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}{" "}
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="font-medium underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-slate-500">Loading leads...</p>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-600">
            {filtering ? "No leads match your filters." : "No leads yet. Add your first one."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {today.length > 0 && (
            <section aria-labelledby="today-heading">
              <h2
                id="today-heading"
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                <span aria-hidden="true">📌 </span>Today&apos;s Follow-ups
              </h2>
              <ul className="space-y-2">
                {today.map((l) => (
                  <LeadRow key={l.id} lead={l} now={now} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </ul>
            </section>
          )}
          {rest.length > 0 && (
            <section aria-labelledby="all-heading">
              <h2
                id="all-heading"
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                All Leads
              </h2>
              <ul className="space-y-2">
                {rest.map((l) => (
                  <LeadRow key={l.id} lead={l} now={now} onOpen={(x) => setSelectedId(x.id)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {selected && (
        <LeadTimelineDialog
          key={selected.id}
          lead={selected}
          onClose={() => setSelectedId(null)}
          onLeadChange={upsertLead}
        />
      )}
      {adding && <AddLeadDialog onClose={() => setAdding(false)} onCreated={upsertLead} />}
    </main>
    </>
  );
}
