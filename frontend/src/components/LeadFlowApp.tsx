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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">LeadFlow</h1>
          <p className="text-sm text-slate-500">
            Track leads, log conversations, never miss a follow-up.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          + Add lead
        </button>
      </header>

      <div className="mb-4 space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads by name"
          aria-label="Search leads by name"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {([null, ...STATUSES] as (LeadStatus | null)[]).map((s) => {
            const active = s === statusFilter;
            return (
              <button
                key={s ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition ${
                  active
                    ? "bg-indigo-600 text-white ring-indigo-600"
                    : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {s ?? "All"}
              </button>
            );
          })}
        </div>
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
                className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700"
              >
                Today&apos;s follow-ups
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">
                  {today.length}
                </span>
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
              {today.length > 0 && (
                <h2
                  id="all-heading"
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  All leads
                </h2>
              )}
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
  );
}
