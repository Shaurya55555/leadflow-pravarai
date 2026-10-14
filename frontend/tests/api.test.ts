import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { UNAUTHORIZED_EVENT, getToken, setToken } from "@/lib/auth";

function respond(status: number, body?: unknown, raw?: string) {
  return new Response(raw ?? (body === undefined ? null : JSON.stringify(body)), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("api error handling", () => {
  it("turns a network failure into a readable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.listLeads({})).rejects.toMatchObject({
      message: "Cannot reach the server. Is the API running?",
      status: 0,
    });
  });

  it("uses a string detail as the message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(404, { detail: "Lead 9 not found" })));
    await expect(api.listLeads({})).rejects.toMatchObject({ message: "Lead 9 not found", status: 404 });
  });

  it("flattens field-level validation errors", async () => {
    const detail = [
      { loc: ["body", "name"], msg: "String should have at least 1 character" },
      { loc: ["body", "note"], msg: "Field required" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(422, { detail })));
    await expect(api.listLeads({})).rejects.toMatchObject({
      message: "name: String should have at least 1 character; note: Field required",
    });
  });

  it("falls back to a generic message for a non-JSON error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 })),
    );
    const err = await api.listLeads({}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Request failed (502)");
  });

  it("handles a 204 with no body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api.me()).resolves.toBeUndefined();
  });

  it("sends the bearer token when signed in and omits it otherwise", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => respond(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await api.listLeads({});
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
    setToken("abc");
    await api.listLeads({});
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer abc");
  });

  it("clears the token and signals the app when the session is rejected", async () => {
    setToken("expired");
    const handler = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(401, { detail: "Not authenticated" })));
    await expect(api.listLeads({})).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  });

  it("does not treat a failed login as an expired session", async () => {
    const handler = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond(401, { detail: "Incorrect email or password" })),
    );
    await expect(api.login("a@b.co", "bad")).rejects.toMatchObject({
      message: "Incorrect email or password",
    });
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  });

  it("builds the query string without empty filters", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => respond(200, []));
    vi.stubGlobal("fetch", fetchMock);
    await api.listLeads({ status: null, q: "   " });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/leads$/);
    await api.listLeads({ status: "Won", q: " ann " });
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/leads\?status=Won&q=ann$/);
  });
});
