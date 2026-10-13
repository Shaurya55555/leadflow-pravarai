import type { LeadStatus } from "@/lib/types";

const STYLES: Record<LeadStatus, string> = {
  New: "bg-slate-100 text-slate-700 ring-slate-200",
  Contacted: "bg-sky-50 text-sky-700 ring-sky-200",
  Qualified: "bg-violet-50 text-violet-700 ring-violet-200",
  "Proposal Sent": "bg-amber-50 text-amber-800 ring-amber-200",
  Won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Lost: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
