import type { LeadStatus } from "@/lib/types";

const STYLES: Record<LeadStatus, string> = {
  New: "bg-green-100 text-green-700",
  Contacted: "bg-yellow-100 text-yellow-800",
  Qualified: "bg-blue-100 text-blue-700",
  "Proposal Sent": "bg-purple-100 text-purple-700",
  Won: "bg-slate-100 text-slate-500",
  Lost: "bg-red-50 text-red-500",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
