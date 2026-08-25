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
  if (mattersResponse.status === 401) {
    return {
      session: { user: null, betaAcknowledged: false },
      matters: [],
    };
  }
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

  async function startMatter() {
    if (!session?.betaAcknowledged && !accepted) return;
    setBusy(true);
    setError("");
    if (!session?.betaAcknowledged) {
      const acknowledgement = await fetch("/api/beta", { method: "POST" });
      if (!acknowledgement.ok) {
        setBusy(false);
        setError("The privacy acknowledgement could not be saved.");
        return;
      }
    }
    const response = await fetch("/api/matters", { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (response.ok) router.push(`/matter/${data.id}`);
    else setError(data.error ?? "The matter could not be started.");
  }

  if (!session?.user) {
    return (
      <main className="centered-state" aria-live="polite">
        Loading your workspace…
      </main>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader email={session.user.email} />
      <main className="home-main">
        {matters.length === 0 ? (
          <section className="notice-card orientation-card" aria-labelledby="orientation-title">
            <h1 id="orientation-title">Build your estate plan around what matters most</h1>
            <p className="orientation-intro">
              We will guide you through the goals, people, current planning, and broad
              financial ranges that should shape your plan.
            </p>
            <div className="orientation-grid">
              <section className="orientation-section">
                <h2>What to expect</h2>
                <ul>
                  <li><strong>About 10–15 minutes</strong> for a typical estate.</li>
                  <li>Plain-language questions, one focused section at a time.</li>
                  <li>Your answers are saved so you can leave and resume.</li>
                </ul>
              </section>
              <section className="orientation-section">
                <h2>Helpful information to have nearby</h2>
                <ul>
                  <li>Names and roles of family, advisers, and trusted backups.</li>
                  <li>The kinds and approximate age of existing estate documents.</li>
                  <li>Broad financial ranges—never account-level detail.</li>
                </ul>
              </section>
              <section className="orientation-section">
                <h2>What you will receive</h2>
                <p>
                  A professional Planning Summary and an Estate Blueprint—a clear
                  planning guide to review with your attorney and other advisers.
                </p>
              </section>
              <section className="orientation-section">
                <h2>Privacy and professional boundaries</h2>
                <p>
                  Estate Coordinator supports planning and organization. It does not
                  provide legal, tax, investment, or valuation advice.
                </p>
                <p>
                  Share only the context needed here. Do not enter account numbers,
                  government identifiers, passwords, or private keys.
                </p>
              </section>
            </div>
            {!session.betaAcknowledged ? <label className="check-row">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>I understand the process, privacy terms, and professional boundaries.</span>
            </label> : null}
            <button
              className="button button-primary"
              onClick={startMatter}
              disabled={(!session.betaAcknowledged && !accepted) || busy}
            >
              {busy ? "Opening your plan…" : "Start my estate plan"}
            </button>
          </section>
        ) : (
          <section aria-labelledby="home-title">
            <div className="home-heading">
              <div>
                <h1 id="home-title">Estate Planning Priorities</h1>
                <p>
                  Continue from your last saved step. Your progress is saved so you
                  can come back at any time.
                </p>
              </div>
            </div>

            <div className="matter-list">
              {matters.map((matter) => (
                <article className="matter-card" key={matter.id}>
                  <div>
                    <span className={`status-pill status-${matter.status}`}>
                      {matter.status === "blueprint_in_progress"
                        ? matter.stepLabel
                        : matter.status === "blueprint_ready"
                          ? "Ready for planning decisions"
                        : matter.status === "stopped"
                          ? "Professional follow-up required"
                          : "In progress"}
                    </span>
                    <h2>{matter.name}</h2>
                    <p>
                      {matter.status === "blueprint_ready"
                        ? "Your priorities are ready for the next planning decisions."
                        : matter.stepLabel}
                    </p>
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
                      aria-label="Estate planning progress"
                    >
                      <span style={{ width: `${matter.progress}%` }} />
                    </div>
                    <Link className="button button-secondary" href={`/matter/${matter.id}`}>
                      Resume my estate plan
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
