import { formatDateTime, isOverdue, timeAgo } from "@/lib/time";
import type { Lead } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  lead: Lead;
  now: Date;
  onOpen: (lead: Lead) => void;
}

export function LeadRow({ lead, now, onOpen }: Props) {
  const overdue = isOverdue(lead, now);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(lead)}
        className={`flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          overdue
            ? "border-rose-200 bg-rose-50/60 hover:bg-rose-50"
            : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-900">{lead.name}</span>
          {lead.company && <span className="truncate text-sm text-slate-500">{lead.company}</span>}
          <span className="ml-auto shrink-0">
            <StatusBadge status={lead.status} />
          </span>
        </div>
        <p className={`truncate text-sm ${lead.last_note ? "text-slate-700" : "italic text-slate-400"}`}>
          {lead.last_note ?? "No discussions yet"}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
          {lead.last_discussion_at && (
            <span title={formatDateTime(lead.last_discussion_at)}>
              Last discussed {timeAgo(lead.last_discussion_at, now.getTime())}
            </span>
          )}
          {lead.follow_up_at && (
            <span className={overdue ? "font-medium text-rose-600" : undefined}>
              {overdue ? "Overdue: " : "Follow-up: "}
              {formatDateTime(lead.follow_up_at)}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}
