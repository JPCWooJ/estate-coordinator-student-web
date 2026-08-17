"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Brand } from "./brand";

export function AppHeader({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="app-header">
      <Brand />
      <div className="header-account">
        <span>{email}</span>
        <button className="button button-quiet" onClick={signOut} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
