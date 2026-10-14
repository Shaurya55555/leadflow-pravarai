import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/AuthGate";
import { api, ApiError } from "@/lib/api";
import { UNAUTHORIZED_EVENT, getToken, setToken } from "@/lib/auth";

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { me: vi.fn(), login: vi.fn(), listLeads: vi.fn().mockResolvedValue([]) },
}));

const me = vi.mocked(api.me);

describe("AuthGate", () => {
  beforeEach(() => {
    me.mockReset();
    window.localStorage.clear();
  });

  it("shows the login screen when there is no token, without calling the API", async () => {
    render(<AuthGate />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(me).not.toHaveBeenCalled();
  });

  it("restores the session from a stored token", async () => {
    setToken("tok");
    me.mockResolvedValue({ id: 1, email: "a@b.co" });
    render(<AuthGate />);
    expect(await screen.findByRole("button", { name: "Log out" })).toBeTruthy();
  });

  it("falls back to login when the stored token is rejected", async () => {
    setToken("stale");
    me.mockRejectedValue(new ApiError("Not authenticated", 401));
    render(<AuthGate />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("log out clears the token and returns to the login screen", async () => {
    setToken("tok");
    me.mockResolvedValue({ id: 1, email: "a@b.co" });
    render(<AuthGate />);
    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy());
    expect(getToken()).toBeNull();
  });

  it("drops to login when an API call reports an expired session", async () => {
    setToken("tok");
    me.mockResolvedValue({ id: 1, email: "a@b.co" });
    render(<AuthGate />);
    await screen.findByRole("button", { name: "Log out" });
    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeTruthy();
  });
});
