"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { MatterSummary } from "@/lib/server/data";
import { AppHeader } from "./app-header";

type SessionPayload = {
  user: { id: string; email: string } | null;
  betaAcknowledged: boolean;
};

async function fetchHomePayload(): Promise<{
  session: SessionPayload;
  matters: MatterSummary[];
}> {
  const sessionResponse = await fetch("/api/session");
  const session: SessionPayload = await sessionResponse.json();
  if (!session.user || !session.betaAcknowledged) {
    return { session, matters: [] };
  }
  const mattersResponse = await fetch("/api/matters");
  const data = await mattersResponse.json();
  if (!mattersResponse.ok) throw new Error("Matter home request failed.");
  return { session, matters: data.matters };
}

export function HomeExperience() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchHomePayload()
      .then((payload) => {
        if (!active) return;
        if (!payload.session.user) {
          router.replace("/");
          return;
        }
        setSession(payload.session);
        setMatters(payload.matters);
      })
      .catch(() => {
        if (active) setError("The home page could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function acknowledge() {
    if (!accepted) return;
    setBusy(true);
    const response = await fetch("/api/beta", { method: "POST" });
    setBusy(false);
    if (!response.ok) {
      setError("The acknowledgement could not be saved.");
      return;
    }
    const payload = await fetchHomePayload();
    setSession(payload.session);
    setMatters(payload.matters);
  }

  async function startMatter() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/matters", { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (response.ok) router.push(`/matter/${data.id}`);
    else setError(data.error ?? "The matter could not be started.");
  }

  if (!session?.user) {
    return (
      <main className="centered-state" aria-live="polite">
        Loading your matter…
      </main>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader email={session.user.email} />
      <main className="home-main">
        {!session.betaAcknowledged ? (
          <section className="notice-card" aria-labelledby="beta-title">
            <div className="eyebrow">Before you begin</div>
            <h1 id="beta-title">Controlled educational beta</h1>
            <div className="notice-copy">
              <p>
                This product organizes information and provides planning
                recommendations within the approved Estate Coordinator boundary.
                It is not legal or tax advice.
              </p>
              <ul>
                <li>Use synthetic test facts only in this Slice 1 build.</li>
                <li>
                  Do not enter passwords, private keys, seed phrases, or full
                  account identifiers.
                </li>
                <li>
                  Existing personal estate-planning documents are not reviewed
                  in this launch slice.
                </li>
                <li>
                  Synthetic development records remain until the test data is
                  reset; no real-student retention policy is active.
                </li>
              </ul>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>I understand and agree to use synthetic test data only.</span>
            </label>
            <button
              className="button button-primary"
              onClick={acknowledge}
              disabled={!accepted || busy}
            >
              {busy ? "Saving…" : "Acknowledge and continue"}
            </button>
          </section>
        ) : (
          <section aria-labelledby="home-title">
            <div className="home-heading">
              <div>
                <div className="eyebrow">Your private workspace</div>
                <h1 id="home-title">Matter home</h1>
                <p>Resume from the last accepted answer or open your matter.</p>
              </div>
              {matters.length === 0 && (
                <button
                  className="button button-primary"
                  onClick={startMatter}
                  disabled={busy}
                >
                  {busy ? "Opening…" : "Start Matter Opening"}
                </button>
              )}
            </div>

            <div className="matter-list">
              {matters.map((matter) => (
                <article className="matter-card" key={matter.id}>
                  <div>
                    <span className={`status-pill status-${matter.status}`}>
                      {matter.status === "opening_confirmed"
                        ? "Opening confirmed"
                        : matter.status === "stopped"
                          ? "Professional follow-up required"
                          : "In progress"}
                    </span>
                    <h2>{matter.name}</h2>
                    <p>{matter.stepLabel}</p>
                    <small>
                      Last saved {new Date(matter.updatedAt).toLocaleString()}
                    </small>
                  </div>
                  <div className="matter-card-action">
                    <div
                      className="mini-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={matter.progress}
                      aria-label="Matter Opening progress"
                    >
                      <span style={{ width: `${matter.progress}%` }} />
                    </div>
                    <Link className="button button-secondary" href={`/matter/${matter.id}`}>
                      {matter.openingConfirmedAt ? "View confirmed record" : "Resume matter"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <p className="error-text" role="alert">
          {error}
        </p>
      </main>
    </div>
  );
}
