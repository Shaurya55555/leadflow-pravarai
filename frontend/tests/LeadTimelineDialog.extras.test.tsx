import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadTimelineDialog } from "@/components/LeadTimelineDialog";
import { api } from "@/lib/api";
import { toDateInputValue } from "@/lib/time";
import type { Lead } from "@/lib/types";
import { makeDiscussion, makeLead } from "./factories";

vi.mock("@/lib/api", () => ({
  api: { listDiscussions: vi.fn(), addDiscussion: vi.fn(), updateLead: vi.fn() },
}));

const mocked = vi.mocked(api);
const NOTE = "Log a new discussion...";

async function setup(lead: Lead = makeLead()) {
  const onClose = vi.fn();
  const onLeadChange = vi.fn();
  render(<LeadTimelineDialog lead={lead} onClose={onClose} onLeadChange={onLeadChange} />);
  await screen.findByText("Lead created.");
  return { user: userEvent.setup(), onClose, onLeadChange };
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.listDiscussions.mockResolvedValue([makeDiscussion()]);
});

describe("quick follow-up presets", () => {
  it("fills date and time and ticks the checkbox, without saving", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "In 3 days" }));

    const expected = new Date();
    expected.setDate(expected.getDate() + 3);
    expect(field("Set Follow-up").checked).toBe(true);
    expect(field("Follow-up date").value).toBe(toDateInputValue(expected));
    expect(field("Follow-up time").value).toBe("10:00");
    expect(mocked.addDiscussion).not.toHaveBeenCalled();
  });

  it("sends the preset when the note is saved", async () => {
    const { user } = await setup();
    mocked.addDiscussion.mockResolvedValue({ discussion: makeDiscussion({ id: 2 }), lead: makeLead() });
    await user.type(screen.getByPlaceholderText(NOTE), "Will think about it");
    await user.click(screen.getByRole("button", { name: "Tomorrow" }));
    await user.click(screen.getByRole("button", { name: "Save Note" }));

    await waitFor(() => expect(mocked.addDiscussion).toHaveBeenCalledTimes(1));
    const payload = mocked.addDiscussion.mock.calls[0][1];
    expect(payload.note).toBe("Will think about it");
    expect(payload.follow_up_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });
});

describe("rule-based suggestion", () => {
  it("shows a labelled suggestion with its reason", async () => {
    await setup(makeLead({ status: "Contacted" }));
    expect(screen.getByText("Suggested follow-up:")).toBeTruthy();
    expect(screen.getByText(/Contacted: follow up in 2 days/)).toBeTruthy();
  });

  it("reacts to what the note says", async () => {
    const { user } = await setup();
    await user.type(screen.getByPlaceholderText(NOTE), "She asked me to call tomorrow");
    expect(screen.getByText(/Note mentions "tomorrow"/)).toBeTruthy();
  });

  it("only fills the form when 'Use suggestion' is clicked, and never saves by itself", async () => {
    const { user } = await setup();
    expect(field("Set Follow-up").checked).toBe(false);
    await user.click(screen.getByRole("button", { name: "Use suggestion" }));
    expect(field("Set Follow-up").checked).toBe(true);
    expect(field("Follow-up time").value).toBe("10:00");
    expect(mocked.addDiscussion).not.toHaveBeenCalled();
    expect(mocked.updateLead).not.toHaveBeenCalled();
  });

  it("is not offered for closed leads", async () => {
    await setup(makeLead({ status: "Won" }));
    expect(screen.queryByText("Suggested follow-up:")).toBeNull();
  });
});

describe("editing lead details", () => {
  it("saves name, company and phone through the API and reports the fresh lead", async () => {
    const { user, onLeadChange } = await setup();
    const updated = makeLead({ company: "New Co" });
    mocked.updateLead.mockResolvedValue(updated);

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    const company = screen.getByLabelText("Company");
    await user.clear(company);
    await user.type(company, "New Co");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocked.updateLead).toHaveBeenCalledWith(1, {
        name: "Sarah Connor",
        company: "New Co",
        phone: "555-0199",
      }),
    );
    expect(onLeadChange).toHaveBeenCalledWith(updated);
    expect(screen.queryByRole("form", { name: "Edit lead details" })).toBeNull();
  });

  it("sends an empty string to clear an optional field", async () => {
    const { user } = await setup();
    mocked.updateLead.mockResolvedValue(makeLead({ phone: null }));
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.clear(screen.getByLabelText("Phone"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(mocked.updateLead).toHaveBeenCalledWith(1, {
        name: "Sarah Connor",
        company: "Acme Corp",
        phone: "",
      }),
    );
  });

  it("requires a name and does not call the API without one", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.clear(screen.getByLabelText("Full Name"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Name is required.");
    expect(mocked.updateLead).not.toHaveBeenCalled();
  });

  it("shows the server error and stays in edit mode when saving fails", async () => {
    const { user } = await setup();
    mocked.updateLead.mockRejectedValue(new Error("Lead 1 not found"));
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.type(screen.getByLabelText("Company"), "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Lead 1 not found");
    expect(screen.getByLabelText("Company")).toBeTruthy();
  });

  it("asks before closing the dialog with unsaved edits", async () => {
    const { user, onClose } = await setup();
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.type(screen.getByLabelText("Company"), " Ltd");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await screen.findByText("Discard your unsaved changes?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancel leaves the lead untouched", async () => {
    const { user, onLeadChange } = await setup();
    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await user.type(screen.getByLabelText("Company"), " Ltd");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocked.updateLead).not.toHaveBeenCalled();
    expect(onLeadChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit details" })).toBeTruthy();
  });
});
