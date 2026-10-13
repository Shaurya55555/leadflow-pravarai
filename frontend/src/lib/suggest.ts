import { addDays, toDateInputValue } from "./time";
import type { LeadStatus } from "./types";

export interface FollowUpSuggestion {
  /** Local yyyy-mm-dd, ready for an <input type="date">. */
  date: string;
  /** Local HH:MM, ready for an <input type="time">. */
  time: string;
  /** Short human-readable explanation shown next to the suggestion. */
  reason: string;
}

const STATUS_DEFAULTS: Partial<Record<LeadStatus, { days: number; reason: string }>> = {
  New: { days: 1, reason: "New lead: make first contact within a day" },
  Contacted: { days: 2, reason: "Contacted: follow up in 2 days" },
  Qualified: { days: 3, reason: "Qualified: send next steps in 3 days" },
  "Proposal Sent": { days: 2, reason: "Proposal sent: check in after 2 days" },
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Rule-based (no AI service) follow-up suggestion.
 *
 * It starts from a default interval for the lead's status and lets the note text override it
 * when it names a time ("tomorrow", "next week", "in 5 days", a weekday). Always 10:00 local.
 * Closed leads (Won/Lost) get no suggestion. The result is only ever a suggestion; the UI never
 * saves it without the user's action.
 */
export function suggestFollowUp(
  status: LeadStatus,
  note: string,
  now: Date,
): FollowUpSuggestion | null {
  const base = STATUS_DEFAULTS[status];
  if (!base) return null;

  const text = note.toLowerCase();
  let days = base.days;
  let reason = base.reason;

  const inDays = text.match(/\bin (\d{1,2}) days?\b/);
  if (/\btomorrow\b/.test(text)) {
    days = 1;
    reason = 'Note mentions "tomorrow"';
  } else if (inDays && Number(inDays[1]) >= 1) {
    days = Number(inDays[1]);
    reason = `Note mentions "in ${days} day${days === 1 ? "" : "s"}"`;
  } else if (/\bnext week\b/.test(text)) {
    days = 7;
    reason = 'Note mentions "next week"';
  } else {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text)) {
        // Next occurrence strictly after today (a same-day weekday means a week from now).
        days = (i - now.getDay() + 7) % 7 || 7;
        reason = `Note mentions "${WEEKDAYS[i]}"`;
        break;
      }
    }
  }

  return { date: toDateInputValue(addDays(now, days)), time: "10:00", reason };
}
