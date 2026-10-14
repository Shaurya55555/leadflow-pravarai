import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { api, ApiError } from "@/lib/api";
import { makeLead } from "./factories";

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { createLead: vi.fn() },
}));

const createLead = vi.mocked(api.createLead);

function setup() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  render(<AddLeadDialog onClose={onClose} onCreated={onCreated} />);
  return { user: userEvent.setup(), onClose, onCreated };
}

beforeEach(() => vi.clearAllMocks());

describe("AddLeadDialog", () => {
  it("requires a name and never calls the API without one", async () => {
    const { user, onCreated } = setup();
    await user.click(screen.getByRole("button", { name: "Save Lead" }));
    expect(screen.getByText("Name is required.")).toBeTruthy();
    expect(createLead).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only name as missing", async () => {
    const { user } = setup();
    await user.type(screen.getByPlaceholderText("e.g., John Doe"), "    ");
    await user.click(screen.getByRole("button", { name: "Save Lead" }));
    expect(screen.getByText("Name is required.")).toBeTruthy();
    expect(createLead).not.toHaveBeenCalled();
  });

  it("trims input, omits empty optional fields and leaves status to the server default", async () => {
    createLead.mockResolvedValue(makeLead({ name: "Ada", status: "New" }));
    const { user, onCreated, onClose } = setup();
    await user.type(screen.getByPlaceholderText("e.g., John Doe"), "  Ada  ");
    await user.type(screen.getByPlaceholderText("e.g., Stark Industries"), "   ");
    await user.click(screen.getByRole("button", { name: "Save Lead" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createLead).toHaveBeenCalledWith({ name: "Ada", company: undefined, phone: undefined });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the form and shows the server message when saving fails", async () => {
    createLead.mockRejectedValue(new ApiError("Cannot reach the server. Is the API running?", 0));
    const { user, onCreated, onClose } = setup();
    await user.type(screen.getByPlaceholderText("e.g., John Doe"), "Ada");
    await user.click(screen.getByRole("button", { name: "Save Lead" }));
    expect(await screen.findByText("Cannot reach the server. Is the API running?")).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText("e.g., John Doe") as HTMLInputElement).value).toBe("Ada");
    expect((screen.getByRole("button", { name: "Save Lead" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("ignores a second submit while the first is in flight", async () => {
    let resolve!: (l: ReturnType<typeof makeLead>) => void;
    createLead.mockReturnValue(new Promise((r) => (resolve = r)));
    const { user } = setup();
    await user.type(screen.getByPlaceholderText("e.g., John Doe"), "Ada");
    const button = screen.getByRole("button", { name: "Save Lead" });
    await user.click(button);
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    expect(createLead).toHaveBeenCalledTimes(1);
    resolve(makeLead());
  });
});
