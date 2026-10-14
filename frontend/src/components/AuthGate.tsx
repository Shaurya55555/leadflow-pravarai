"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UNAUTHORIZED_EVENT, clearToken, getToken } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";
import { LeadFlowApp } from "./LeadFlowApp";
import { LoginScreen } from "./LoginScreen";

type Session = { state: "checking" } | { state: "anon" } | { state: "in"; user: AuthUser };

/** Shows the login screen until a valid session exists, then the app. */
export function AuthGate() {
  const [session, setSession] = useState<Session>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;
    const resolve = (next: Session) => {
      if (!cancelled) setSession(next);
    };
    if (!getToken()) {
      Promise.resolve().then(() => resolve({ state: "anon" }));
    } else {
      api
        .me()
        .then((user) => resolve({ state: "in", user }))
        .catch(() => resolve({ state: "anon" }));
    }
    const onUnauthorized = () => resolve({ state: "anon" });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  if (session.state === "checking") {
    return <p className="py-24 text-center text-sm text-slate-500">Loading...</p>;
  }
  if (session.state === "anon") {
    return <LoginScreen onSignedIn={(user) => setSession({ state: "in", user })} />;
  }
  return (
    <LeadFlowApp
      user={session.user}
      onLogout={() => {
        clearToken();
        setSession({ state: "anon" });
      }}
    />
  );
}
