import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadFlowApp } from "@/components/LeadFlowApp";
import { api, ApiError } from "@/lib/api";
import { makeLead } from "./factories";

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { listLeads: vi.fn(), listDiscussions: vi.fn().mockResolvedValue([]) },
}));

const listLeads = vi.mocked(api.listLeads);

beforeEach(() => vi.clearAllMocks());

describe("lead list states", () => {
  it("shows a loading message, then the leads", async () => {
    listLeads.mockResolvedValue([makeLead({ name: "Ada Lovelace" })]);
    render(<LeadFlowApp />);
    expect(screen.getByText("Loading leads...")).toBeTruthy();
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
  });

  it("shows a friendly empty state when there are no leads", async () => {
    listLeads.mockResolvedValue([]);
    render(<LeadFlowApp />);
    expect(await screen.findByText("No leads yet. Add your first one.")).toBeTruthy();
  });

  it("explains an empty result when a filter is active", async () => {
    listLeads.mockResolvedValue([makeLead()]);
    render(<LeadFlowApp />);
    await screen.findByText("Sarah Connor");
    listLeads.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Won" }));
    expect(await screen.findByText("No leads match your filters.")).toBeTruthy();
  });

  it("shows the error with a working Retry when the API is down", async () => {
    listLeads.mockRejectedValueOnce(new ApiError("Cannot reach the server. Is the API running?", 0));
    render(<LeadFlowApp />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Cannot reach the server/)).toBeTruthy();
    listLeads.mockResolvedValue([makeLead({ name: "Back Online" })]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Back Online")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("applies the status filter through the API", async () => {
    listLeads.mockResolvedValue([makeLead()]);
    render(<LeadFlowApp />);
    await screen.findByText("Sarah Connor");
    fireEvent.click(screen.getByRole("button", { name: "Contacted" }));
    await waitFor(() =>
      expect(listLeads).toHaveBeenLastCalledWith({ status: "Contacted", q: "" }),
    );
  });
});

describe("hostile text is rendered as plain text", () => {
  it("never interprets markup in names, companies or notes", async () => {
    const payload = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    listLeads.mockResolvedValue([
      makeLead({ name: payload, company: payload, last_note: payload }),
    ]);
    const { container } = render(<LeadFlowApp />);
    await screen.findAllByText(payload, { exact: false });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("copes with very long unbroken names without crashing", async () => {
    const long = "A".repeat(500);
    listLeads.mockResolvedValue([makeLead({ name: long })]);
    render(<LeadFlowApp />);
    expect(await screen.findByText(long)).toBeTruthy();
  });
});
