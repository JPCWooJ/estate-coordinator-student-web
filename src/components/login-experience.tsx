"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Brand } from "./brand";

const syntheticUsers = [
  { id: "11111111-1111-4111-8111-111111111111", label: "Use synthetic student A" },
  { id: "22222222-2222-4222-8222-222222222222", label: "Use synthetic student B" },
];

export function LoginExperience({ syntheticMode }: { syntheticMode: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.user) router.replace("/home");
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setBusy(false);
    setStatus(
      response.ok
        ? "Check your email for a one-time sign-in link."
        : (data.error ?? "The link could not be sent."),
    );
  }

  async function syntheticLogin(userId: string) {
    setBusy(true);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusy(false);
    if (response.ok) {
      router.push("/home");
      router.refresh();
    } else {
      setStatus("Synthetic sign-in failed.");
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="welcome-title">
        <Brand />
        <div className="eyebrow">Private student experience</div>
        <h1 id="welcome-title">Open your estate-planning matter</h1>
        <p className="lede">
          A guided conversation to establish your goals, people, timing, and
          planning context before any Estate Blueprint work begins.
        </p>

        <form onSubmit={requestLink} className="auth-form">
          <label htmlFor="email">Invited email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <button className="button button-primary" disabled={busy}>
            {busy ? "Please wait…" : "Email me a sign-in link"}
          </button>
        </form>

        {syntheticMode && (
          <div className="synthetic-logins" aria-label="Synthetic test access">
            <span>Local verification only</span>
            {syntheticUsers.map((user) => (
              <button
                key={user.id}
                className="button button-secondary"
                onClick={() => syntheticLogin(user.id)}
                disabled={busy}
              >
                {user.label}
              </button>
            ))}
          </div>
        )}

        <p className="status-text" role="status" aria-live="polite">
          {status}
        </p>
        <p className="auth-footnote">
          Access is limited to invited participants. No application password is
          collected.
        </p>
      </section>
      <aside className="auth-aside" aria-label="Experience overview">
        <div>
          <span className="aside-number">01</span>
          <h2>Matter Opening</h2>
          <p>One question at a time, with narrative answers and only triggered follow-ups.</p>
        </div>
        <div>
          <span className="aside-number">02</span>
          <h2>Confirm the record</h2>
          <p>Review and correct the structured opening before it becomes confirmed.</p>
        </div>
        <div>
          <span className="aside-number">03</span>
          <h2>Resume reliably</h2>
          <p>Your last accepted answer is the durable restart point.</p>
        </div>
      </aside>
    </main>
  );
}
