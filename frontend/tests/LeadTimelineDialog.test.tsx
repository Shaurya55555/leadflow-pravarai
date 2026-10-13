import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadTimelineDialog } from "@/components/LeadTimelineDialog";
import { api } from "@/lib/api";
import { makeDiscussion, makeLead } from "./factories";

vi.mock("@/lib/api", () => ({
  api: { listDiscussions: vi.fn(), addDiscussion: vi.fn(), updateLead: vi.fn() },
}));

const mocked = vi.mocked(api);
const NOTE_PLACEHOLDER = "Log a new discussion...";

async function setup() {
  const onClose = vi.fn();
  const onLeadChange = vi.fn();
  const lead = makeLead();
  render(<LeadTimelineDialog lead={lead} onClose={onClose} onLeadChange={onLeadChange} />);
  await screen.findByText("Lead created.");
  return { user: userEvent.setup(), onClose, onLeadChange, lead };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.listDiscussions.mockResolvedValue([makeDiscussion()]);
});

describe("timeline", () => {
  it("lists discussions and ends with the system 'Lead created' event", async () => {
    await setup();
    expect(screen.getByText("Sent pricing PDF.")).toBeTruthy();
    expect(screen.getByText("Lead created.")).toBeTruthy();
  });

  it("shows the newest discussion first, as returned by the API", async () => {
    mocked.listDiscussions.mockResolvedValue([
      makeDiscussion({ id: 3, note: "third" }),
      makeDiscussion({ id: 2, note: "second" }),
    ]);
    await setup();
    const text = screen.getByRole("list").textContent ?? "";
    expect(text.indexOf("third")).toBeLessThan(text.indexOf("second"));
    expect(text.indexOf("second")).toBeLessThan(text.indexOf("Lead created."));
  });

  it("shows an error with a retry when history fails to load", async () => {
    mocked.listDiscussions.mockRejectedValueOnce(new Error("Cannot reach the server."));
    render(<LeadTimelineDialog lead={makeLead()} onClose={vi.fn()} onLeadChange={vi.fn()} />);
    await screen.findByText(/Cannot reach the server/);
    mocked.listDiscussions.mockResolvedValue([makeDiscussion()]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Lead created.");
  });
});

describe("saving a discussion", () => {
  it("sends the follow-up as a UTC instant when 'Set Follow-up' is ticked", async () => {
    const { user, onLeadChange } = await setup();
    const updated = makeLead({ follow_up_at: "2026-10-20T05:30:00.000Z", last_note: "Budget approved" });
    mocked.addDiscussion.mockResolvedValue({
      discussion: makeDiscussion({ id: 2, note: "Budget approved", follow_up_at: updated.follow_up_at }),
      lead: updated,
    });

    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "Budget approved");
    await user.click(screen.getByLabelText("Set Follow-up"));
    fireEvent.change(screen.getByLabelText("Follow-up date"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Follow-up time"), { target: { value: "11:00" } });
    await user.click(screen.getByRole("button", { name: "Save Note" }));

    await waitFor(() =>
      expect(mocked.addDiscussion).toHaveBeenCalledWith(1, {
        note: "Budget approved",
        follow_up_at: "2026-10-20T05:30:00.000Z",
      }),
    );
    expect(onLeadChange).toHaveBeenCalledWith(updated);
    await screen.findByText("Note saved.");
    expect((screen.getByPlaceholderText(NOTE_PLACEHOLDER) as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByLabelText("Set Follow-up") as HTMLInputElement).checked).toBe(false);
  });

  it("prefills tomorrow 10:00 when the checkbox is ticked", async () => {
    const { user } = await setup();
    await user.click(screen.getByLabelText("Set Follow-up"));
    expect((screen.getByLabelText("Follow-up time") as HTMLInputElement).value).toBe("10:00");
    expect((screen.getByLabelText("Follow-up date") as HTMLInputElement).value).not.toBe("");
  });

  it("sends no follow-up when the checkbox is not ticked", async () => {
    const { user } = await setup();
    mocked.addDiscussion.mockResolvedValue({ discussion: makeDiscussion({ id: 2 }), lead: makeLead() });
    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "Just a note");
    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await waitFor(() =>
      expect(mocked.addDiscussion).toHaveBeenCalledWith(1, { note: "Just a note", follow_up_at: null }),
    );
  });

  it("rejects an empty or whitespace-only note without calling the API", async () => {
    const { user } = await setup();
    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "   ");
    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Write a note before saving.");
    expect(mocked.addDiscussion).not.toHaveBeenCalled();
  });

  it("requires both date and time when a follow-up is requested", async () => {
    const { user } = await setup();
    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "Call back");
    await user.click(screen.getByLabelText("Set Follow-up"));
    fireEvent.change(screen.getByLabelText("Follow-up time"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Pick both a date and a time for the follow-up.");
    expect(mocked.addDiscussion).not.toHaveBeenCalled();
  });

  it("keeps what the user typed and shows the server error when saving fails", async () => {
    const { user } = await setup();
    mocked.addDiscussion.mockRejectedValue(new Error("Server exploded"));
    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "Important note");
    await user.click(screen.getByRole("button", { name: "Save Note" }));
    await screen.findByText("Server exploded");
    expect((screen.getByPlaceholderText(NOTE_PLACEHOLDER) as HTMLTextAreaElement).value).toBe(
      "Important note",
    );
  });

  it("ignores a second submit while the first is in flight", async () => {
    const { user } = await setup();
    let resolve!: (v: Awaited<ReturnType<typeof api.addDiscussion>>) => void;
    mocked.addDiscussion.mockReturnValue(new Promise((r) => (resolve = r)));
    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "Once only");
    const save = screen.getByRole("button", { name: "Save Note" });
    await user.click(save);
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    expect(mocked.addDiscussion).toHaveBeenCalledTimes(1);
    resolve({ discussion: makeDiscussion({ id: 2 }), lead: makeLead() });
    await screen.findByText("Note saved.");
  });
});

describe("status", () => {
  it("persists a status change through the API and reports the fresh lead", async () => {
    const { user, onLeadChange } = await setup();
    const won = makeLead({ status: "Won" });
    mocked.updateLead.mockResolvedValue(won);
    await user.selectOptions(screen.getByLabelText("Status"), "Won");
    await waitFor(() => expect(mocked.updateLead).toHaveBeenCalledWith(1, { status: "Won" }));
    expect(onLeadChange).toHaveBeenCalledWith(won);
  });

  it("shows an error and does not report a change when the update fails", async () => {
    const { user, onLeadChange } = await setup();
    mocked.updateLead.mockRejectedValue(new Error("Lead 1 not found"));
    await user.selectOptions(screen.getByLabelText("Status"), "Lost");
    await screen.findByText("Lead 1 not found");
    expect(onLeadChange).not.toHaveBeenCalled();
  });
});

describe("closing with unsaved input", () => {
  it("closes immediately when nothing was typed", async () => {
    const { user, onClose } = await setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard your unsaved changes?")).toBeNull();
  });

  it("asks before discarding a typed note, and can keep editing", async () => {
    const { user, onClose } = await setup();
    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "Half written");
    await user.click(screen.getByRole("button", { name: "Close" }));

    await screen.findByText("Discard your unsaved changes?");
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByText("Discard your unsaved changes?")).toBeNull();
    expect((screen.getByPlaceholderText(NOTE_PLACEHOLDER) as HTMLTextAreaElement).value).toBe(
      "Half written",
    );
  });

  it("closes after the user confirms the discard", async () => {
    const { user, onClose } = await setup();
    await user.type(screen.getByPlaceholderText(NOTE_PLACEHOLDER), "Half written");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
