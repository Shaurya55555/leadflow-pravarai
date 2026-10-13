import type { Discussion, Lead } from "@/lib/types";

export function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: "Sarah Connor",
    company: "Acme Corp",
    phone: "555-0199",
    status: "Qualified",
    follow_up_at: null,
    created_at: "2026-10-01T05:00:00Z",
    last_note: null,
    last_discussion_at: null,
    ...overrides,
  };
}

export function makeDiscussion(overrides: Partial<Discussion> = {}): Discussion {
  return {
    id: 1,
    lead_id: 1,
    note: "Sent pricing PDF.",
    follow_up_at: null,
    created_at: "2026-10-10T05:00:00Z",
    ...overrides,
  };
}
