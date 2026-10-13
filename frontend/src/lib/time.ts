import type { Lead } from "./types";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "in 2 hours", "just now". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const isClosed = (lead: Lead) => lead.status === "Won" || lead.status === "Lost";

/** Follow-up falls on the viewer's local calendar day. Closed (Won/Lost) leads are never flagged. */
export function isDueToday(lead: Lead, now: Date = new Date()): boolean {
  return !!lead.follow_up_at && !isClosed(lead) && isSameLocalDay(new Date(lead.follow_up_at), now);
}

/** Follow-up time has already passed. Closed (Won/Lost) leads are never flagged. */
export function isOverdue(lead: Lead, now: Date = new Date()): boolean {
  return !!lead.follow_up_at && !isClosed(lead) && new Date(lead.follow_up_at) < now;
}

/** Today's follow-ups first (earliest due first); everything else keeps the server order. */
export function pinTodaysFollowUps(leads: Lead[], now: Date = new Date()) {
  const today = leads
    .filter((l) => isDueToday(l, now))
    .sort((a, b) => new Date(a.follow_up_at!).getTime() - new Date(b.follow_up_at!).getTime());
  const rest = leads.filter((l) => !isDueToday(l, now));
  return { today, rest };
}

/** Value of an <input type="datetime-local"> (local time) -> ISO string (UTC). */
export function localInputToISO(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
