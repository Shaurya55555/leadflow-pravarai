import { describe, expect, it } from "vitest";
import { suggestFollowUp } from "@/lib/suggest";
import { snoozeOptions } from "@/lib/time";

// Tuesday 13 Oct 2026, 13:30 IST (the suite runs in Asia/Kolkata).
const now = new Date("2026-10-13T08:00:00Z");

describe("suggestFollowUp", () => {
  it("uses a default interval per status, always at 10:00", () => {
    expect(suggestFollowUp("New", "", now)).toMatchObject({ date: "2026-10-14", time: "10:00" });
    expect(suggestFollowUp("Contacted", "", now)?.date).toBe("2026-10-15");
    expect(suggestFollowUp("Qualified", "", now)?.date).toBe("2026-10-16");
    expect(suggestFollowUp("Proposal Sent", "", now)?.date).toBe("2026-10-15");
  });

  it("gives no suggestion for closed leads", () => {
    expect(suggestFollowUp("Won", "call tomorrow", now)).toBeNull();
    expect(suggestFollowUp("Lost", "", now)).toBeNull();
  });

  it("lets the note override the default", () => {
    expect(suggestFollowUp("Qualified", "Said to ping tomorrow", now)?.date).toBe("2026-10-14");
    expect(suggestFollowUp("Qualified", "Busy, try next week", now)?.date).toBe("2026-10-20");
    expect(suggestFollowUp("Qualified", "Back in 5 days", now)?.date).toBe("2026-10-18");
  });

  it("resolves weekday names to the next occurrence, never today", () => {
    expect(suggestFollowUp("New", "Call on Friday", now)?.date).toBe("2026-10-16");
    expect(suggestFollowUp("New", "Call on tuesday", now)?.date).toBe("2026-10-20");
    expect(suggestFollowUp("New", "monday works", now)?.date).toBe("2026-10-19");
  });

  it("explains itself", () => {
    expect(suggestFollowUp("New", "tomorrow", now)?.reason).toContain("tomorrow");
    expect(suggestFollowUp("Contacted", "", now)?.reason).toContain("Contacted");
  });

  it("ignores an unusable day count and falls back to the default", () => {
    expect(suggestFollowUp("Contacted", "in 0 days", now)?.date).toBe("2026-10-15");
  });

  it("crosses month and year ends correctly", () => {
    const monthEnd = new Date("2026-10-30T08:00:00Z");
    expect(suggestFollowUp("Qualified", "", monthEnd)?.date).toBe("2026-11-02");
    const yearEnd = new Date("2026-12-30T08:00:00Z");
    expect(suggestFollowUp("Contacted", "", yearEnd)?.date).toBe("2027-01-01");
  });
});

describe("snoozeOptions", () => {
  it("offers tomorrow, in 3 days and next week at 10:00", () => {
    expect(snoozeOptions(now)).toEqual([
      { label: "Tomorrow", date: "2026-10-14", time: "10:00" },
      { label: "In 3 days", date: "2026-10-16", time: "10:00" },
      { label: "Next week", date: "2026-10-20", time: "10:00" },
    ]);
  });

  it("rolls over month ends", () => {
    const options = snoozeOptions(new Date("2026-10-30T08:00:00Z"));
    expect(options.map((o) => o.date)).toEqual(["2026-10-31", "2026-11-02", "2026-11-06"]);
  });
});
