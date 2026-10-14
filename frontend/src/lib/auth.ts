const KEY = "leadflow.token";

/** Event fired by the API layer when the server rejects the stored token. */
export const UNAUTHORIZED_EVENT = "leadflow:unauthorized";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // storage blocked: the session simply will not survive a reload
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
