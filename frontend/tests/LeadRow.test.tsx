import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeadRow } from "@/components/LeadRow";
import { makeLead } from "./factories";

const now = new Date("2026-10-13T08:00:00Z"); // 13:30 IST

function renderRow(overrides: Parameters<typeof makeLead>[0]) {
  render(
    <ul>
      <LeadRow lead={makeLead(overrides)} now={now} onOpen={vi.fn()} />
    </ul>,
  );
}

describe("LeadRow", () => {
  it("shows name, company, status, last note and time ago", () => {
    renderRow({
      last_note: "Sent pricing PDF.",
      last_discussion_at: "2026-10-11T08:00:00Z",
    });
    expect(screen.getByText("Sarah Connor")).toBeTruthy();
    expect(screen.getByText("(Acme Corp)")).toBeTruthy();
    expect(screen.getByText("Qualified")).toBeTruthy();
    expect(screen.getByText("Sent pricing PDF.")).toBeTruthy();
    expect(screen.getByText(/2 days ago/)).toBeTruthy();
  });

  it("falls back gracefully for a lead without discussions", () => {
    renderRow({});
    expect(screen.getByText("No discussions yet")).toBeTruthy();
    expect(screen.queryByText(/ago/)).toBeNull();
  });

  it("labels a follow-up later today", () => {
    renderRow({ follow_up_at: "2026-10-13T10:00:00Z" });
    expect(screen.getByText(/Follow-up today at/)).toBeTruthy();
  });

  it("labels a follow-up whose time has passed as overdue", () => {
    renderRow({ follow_up_at: "2026-10-12T10:00:00Z" });
    expect(screen.getByText(/Overdue:/)).toBeTruthy();
  });

  it("labels a future follow-up with its date", () => {
    renderRow({ follow_up_at: "2026-10-20T10:00:00Z" });
    expect(screen.getByText(/^🔔 Follow-up (?!today)/)).toBeTruthy();
  });

  it("does not flag closed leads even with a stale follow-up", () => {
    renderRow({ status: "Won", follow_up_at: "2026-10-01T10:00:00Z" });
    expect(screen.queryByText(/Overdue/)).toBeNull();
    expect(screen.queryByText(/Follow-up/)).toBeNull();
  });
});
