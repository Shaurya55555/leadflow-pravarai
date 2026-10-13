import { formatShort, formatTime, isDueToday, isOverdue, timeAgo } from "@/lib/time";
import type { Lead } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  lead: Lead;
  now: Date;
  onOpen: (lead: Lead) => void;
}

export function LeadRow({ lead, now, onOpen }: Props) {
  const closed = lead.status === "Won" || lead.status === "Lost";
  const overdue = isOverdue(lead, now);
  const dueToday = isDueToday(lead, now);

  const card = closed
    ? "border-slate-200 bg-white opacity-60 hover:opacity-100"
    : overdue
      ? "border-rose-200 bg-rose-50 hover:shadow-sm"
      : dueToday
        ? "border-blue-200 bg-blue-50 shadow-sm hover:shadow"
        : "border-slate-200 bg-white hover:shadow-sm";

  let chip: { text: string; cls: string } | null = null;
  if (lead.follow_up_at && !closed) {
    if (overdue) {
      chip = {
        text: `⏰ Overdue: ${formatShort(lead.follow_up_at, now)}`,
        cls: "bg-rose-100 text-rose-700",
      };
    } else if (dueToday) {
      chip = {
        text: `🔔 Follow-up today at ${formatTime(lead.follow_up_at)}`,
        cls: "bg-blue-100 text-blue-700",
      };
    } else {
      chip = {
        text: `🔔 Follow-up ${formatShort(lead.follow_up_at, now)}`,
        cls: "bg-slate-100 text-slate-600",
      };
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(lead)}
        className={`flex w-full flex-col gap-1.5 rounded-lg border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${card}`}
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-slate-900">{lead.name}</span>
          {lead.company && (
            <span className="truncate text-sm text-slate-500">({lead.company})</span>
          )}
          <span className="ml-auto shrink-0">
            <StatusBadge status={lead.status} />
          </span>
        </div>
        <p className="flex items-baseline gap-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="font-medium text-slate-700">Last Note: </span>
            <span className={lead.last_note ? "text-slate-600" : "italic text-slate-400"}>
              {lead.last_note ?? "No discussions yet"}
            </span>
          </span>
          {lead.last_discussion_at && (
            <span className="shrink-0 text-xs text-slate-400">
              · {timeAgo(lead.last_discussion_at, now.getTime())}
            </span>
          )}
        </p>
        {chip && (
          <span
            className={`w-fit rounded px-2 py-0.5 text-xs font-medium ${chip.cls}`}
          >
            {chip.text}
          </span>
        )}
      </button>
    </li>
  );
}
