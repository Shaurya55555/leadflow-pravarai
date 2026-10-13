import { describe, expect, it } from "vitest";
import {
  formatShort,
  isDueToday,
  isOverdue,
  localDateTimeToISO,
  pinTodaysFollowUps,
  timeAgo,
  toDateInputValue,
} from "@/lib/time";
import { makeLead } from "./factories";

// The suite runs in Asia/Kolkata (UTC+05:30); local midnight is 18:30 UTC.
const at = (iso: string) => new Date(iso);

describe("timezone", () => {
  it("runs in IST so the midnight cases below are meaningful", () => {
    expect(new Date("2026-10-13T18:30:00Z").getDate()).toBe(14);
  });
});

describe("timeAgo", () => {
  const now = at("2026-10-13T12:00:00Z").getTime();

  it("says just now for under a minute, in either direction", () => {
    expect(timeAgo("2026-10-13T11:59:30Z", now)).toBe("just now");
    expect(timeAgo("2026-10-13T12:00:20Z", now)).toBe("just now");
  });

  it("formats past and future distances", () => {
    expect(timeAgo("2026-10-13T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-10-12T12:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-10-10T12:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo("2026-10-13T14:00:00Z", now)).toBe("in 2 hours");
  });
});

describe("isDueToday / isOverdue around local midnight", () => {
  const lastMinute = makeLead({ follow_up_at: "2026-10-13T18:29:00Z" }); // 23:59 IST on the 13th
  const firstMinute = makeLead({ follow_up_at: "2026-10-13T18:30:00Z" }); // 00:00 IST on the 14th

  it("one second before local midnight", () => {
    const now = at("2026-10-13T18:29:59Z");
    expect(isDueToday(lastMinute, now)).toBe(true);
    expect(isOverdue(lastMinute, now)).toBe(true);
    expect(isDueToday(firstMinute, now)).toBe(false);
    expect(isOverdue(firstMinute, now)).toBe(false);
  });

  it("exactly at local midnight the day rolls over", () => {
    const now = at("2026-10-13T18:30:00Z");
    expect(isDueToday(lastMinute, now)).toBe(false);
    expect(isOverdue(lastMinute, now)).toBe(true);
    expect(isDueToday(firstMinute, now)).toBe(true);
  });

  it("uses the viewer's local day, not the UTC date", () => {
    // 20:00 UTC on the 13th is 01:30 IST on the 14th.
    const lead = makeLead({ follow_up_at: "2026-10-13T20:00:00Z" });
    const now = at("2026-10-14T03:00:00Z"); // 08:30 IST on the 14th
    expect(isDueToday(lead, now)).toBe(true);
    expect(isOverdue(lead, now)).toBe(true);
  });

  it("a later time today is due but not overdue", () => {
    const lead = makeLead({ follow_up_at: "2026-10-13T10:00:00Z" });
    const now = at("2026-10-13T06:00:00Z");
    expect(isDueToday(lead, now)).toBe(true);
    expect(isOverdue(lead, now)).toBe(false);
  });

  it("never flags leads without a follow-up", () => {
    const lead = makeLead({ follow_up_at: null });
    expect(isDueToday(lead)).toBe(false);
    expect(isOverdue(lead)).toBe(false);
  });

  it("never flags closed leads", () => {
    for (const status of ["Won", "Lost"] as const) {
      const lead = makeLead({ status, follow_up_at: "2026-10-13T06:00:00Z" });
      const now = at("2026-10-13T12:00:00Z");
      expect(isDueToday(lead, now)).toBe(false);
      expect(isOverdue(lead, now)).toBe(false);
    }
  });
});

describe("pinTodaysFollowUps", () => {
  const now = at("2026-10-13T08:00:00Z");

  it("pins today's leads earliest first and keeps the rest in server order", () => {
    const leads = [
      makeLead({ id: 1, follow_up_at: null }),
      makeLead({ id: 2, follow_up_at: "2026-10-13T11:00:00Z" }),
      makeLead({ id: 3, follow_up_at: "2026-10-20T11:00:00Z" }),
      makeLead({ id: 4, follow_up_at: "2026-10-13T05:00:00Z" }),
      makeLead({ id: 5, follow_up_at: "2026-10-12T05:00:00Z" }),
    ];
    const { today, rest } = pinTodaysFollowUps(leads, now);
    expect(today.map((l) => l.id)).toEqual([4, 2]);
    expect(rest.map((l) => l.id)).toEqual([1, 3, 5]);
  });

  it("returns an empty pinned list when nothing is due today", () => {
    const { today, rest } = pinTodaysFollowUps([makeLead({ id: 1 })], now);
    expect(today).toEqual([]);
    expect(rest).toHaveLength(1);
  });
});

describe("date and time input helpers", () => {
  it("converts local date + time to a UTC ISO string", () => {
    expect(localDateTimeToISO("2026-10-20", "11:00")).toBe("2026-10-20T05:30:00.000Z");
  });

  it("returns null when either part is missing or invalid", () => {
    expect(localDateTimeToISO("", "11:00")).toBeNull();
    expect(localDateTimeToISO("2026-10-20", "")).toBeNull();
    expect(localDateTimeToISO("not-a-date", "11:00")).toBeNull();
  });

  it("formats a Date as the local yyyy-mm-dd, not the UTC date", () => {
    expect(toDateInputValue(at("2026-10-13T20:00:00Z"))).toBe("2026-10-14");
  });

  it("shows the year only when it differs from the current one", () => {
    const now = at("2026-10-13T12:00:00Z");
    expect(formatShort("2026-05-04T05:00:00Z", now)).not.toContain("2026");
    expect(formatShort("2025-05-04T05:00:00Z", now)).toContain("2025");
  });
});
