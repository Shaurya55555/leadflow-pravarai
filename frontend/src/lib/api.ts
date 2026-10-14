import { UNAUTHORIZED_EVENT, clearToken, getToken } from "./auth";
import type { AuthUser, Discussion, Lead, LeadStatus, NewLeadInput } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function describe(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : null;
        return field ? `${field}: ${d.msg}` : d?.msg;
      })
      .filter(Boolean)
      .join("; ");
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const token = getToken();
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      message = describe((await res.json()).detail) ?? message;
    } catch {
      // non-JSON error body; keep the generic message
    }
    // A 401 on a call made with a token means the session is gone; a failed login has no token.
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(message, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  login(email: string, password: string) {
    return request<{ access_token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request<AuthUser>("/auth/me");
  },
  listLeads(params: { status?: LeadStatus | null; q?: string }) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.q?.trim()) qs.set("q", params.q.trim());
    const suffix = qs.size ? `?${qs}` : "";
    return request<Lead[]>(`/leads${suffix}`);
  },
  createLead(input: NewLeadInput) {
    return request<Lead>("/leads", { method: "POST", body: JSON.stringify(input) });
  },
  updateLead(
    id: number,
    patch: {
      status?: LeadStatus;
      follow_up_at?: string | null;
      name?: string;
      company?: string;
      phone?: string;
    },
  ) {
    return request<Lead>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  listDiscussions(id: number) {
    return request<Discussion[]>(`/leads/${id}/discussions`);
  },
  addDiscussion(id: number, input: { note: string; follow_up_at?: string | null }) {
    return request<{ discussion: Discussion; lead: Lead }>(`/leads/${id}/discussions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
