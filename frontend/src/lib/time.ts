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

/** "2:00 PM" in the viewer's locale. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "May 4, 10:30 AM"; the year is added only when it is not the current year. */
export function formatShort(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Local <input type="date"> + <input type="time"> values -> ISO string (UTC), or null if incomplete. */
export function localDateTimeToISO(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Local "yyyy-mm-dd" for an <input type="date">. */
export function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A calendar-day offset in local time (safe across month ends and DST changes). */
export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export interface SnoozeOption {
  label: string;
  date: string;
  time: string;
}

/** One-click follow-up presets, all at 10:00 local time. */
export function snoozeOptions(now: Date): SnoozeOption[] {
  return [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "Next week", days: 7 },
  ].map(({ label, days }) => ({
    label,
    date: toDateInputValue(addDays(now, days)),
    time: "10:00",
  }));
}
