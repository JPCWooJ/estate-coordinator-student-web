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
        <div className="auth-content">
          <h1 id="welcome-title">
            Tell us what matters most to you and your family.
          </h1>
          <p className="lede">
            We will help you achieve your goals. Your Estate Blueprint is designed
            around your family, priorities, and future.
          </p>

          <form onSubmit={requestLink} className="auth-form">
            <p className="status-text auth-status-prominent" role="status" aria-live="polite">
              {status}
            </p>
            <label htmlFor="email">Email address</label>
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

          <p className="auth-footnote">
            Estate Coordinator provides planning guidance, not legal or tax advice.
          </p>
        </div>
      </section>
      <aside className="auth-aside" aria-labelledby="steps-title">
        <div className="auth-aside-inner">
          <h2 id="steps-title" className="auth-aside-title">
            Your Estate Plan in 3 Simple Steps
          </h2>
          <ol className="auth-steps">
            <li>
              <span className="aside-number" aria-hidden="true">01</span>
              <div>
                <h3>Tell us what matters.</h3>
                <p>Focused questions about goals, family, and current planning.</p>
              </div>
            </li>
            <li>
              <span className="aside-number" aria-hidden="true">02</span>
              <div>
                <h3>Make your key decisions.</h3>
                <p>Clear recommendations and decisions shaped around what matters.</p>
              </div>
            </li>
            <li>
              <span className="aside-number" aria-hidden="true">03</span>
              <div>
                <h3>Get your Estate Blueprint.</h3>
                <p>
                  A clear planning blueprint to use with your attorney and advisors.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </aside>
    </main>
  );
}
