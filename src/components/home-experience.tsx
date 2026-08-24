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
            <div className="eyebrow">Welcome to your private planning workspace</div>
            <h1 id="orientation-title">Build the foundation for your Estate Blueprint</h1>
            <div className="notice-copy">
              <p>
                In approximately 10–15 minutes, you will organize the goals, people,
                current planning, team, and broad financial ranges that should shape
                your estate plan.
              </p>
              <h2>Helpful information to have nearby</h2>
              <ul>
                <li>Names and roles of family members, advisers, and trusted backups.</li>
                <li>The kinds and approximate age of existing estate documents.</li>
                <li>Broad asset, liability, and lifetime-security ranges—never account-level detail.</li>
              </ul>
              <h2>What you will receive</h2>
              <p>
                You will review a professional Planning Summary, make the material
                Blueprint decisions that apply to you, and receive a web and PDF
                Estate Blueprint to use with your professional advisers.
              </p>
              <h2>Privacy and professional boundaries</h2>
              <p>
                Estate Coordinator supports planning and organization. It does not
                provide legal, tax, investment, or valuation advice. Confirm final
                decisions with qualified professional advisors.
              </p>
              <ul>
                <li>
                  Share only the planning context needed here; do not enter account
                  numbers, government identifiers, passwords, or private keys.
                </li>
                <li>
                  Your answers are saved so you can resume. Sign out when finished
                  on a shared device.
                </li>
              </ul>
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
              {busy ? "Opening your plan…" : "Start my Estate Blueprint"}
            </button>
          </section>
        ) : (
          <section aria-labelledby="home-title">
            <div className="home-heading">
              <div>
                <div className="eyebrow">Your private workspace</div>
                <h1 id="home-title">Estate Planning Priorities</h1>
                <p>
                  Resume from your last saved answer, or start a new planning
                  conversation.
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
                          ? "Planning Foundation"
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
                      aria-label="Estate planning progress"
                    >
                      <span style={{ width: `${matter.progress}%` }} />
                    </div>
                    <Link className="button button-secondary" href={`/matter/${matter.id}`}>
                      {matter.openingConfirmedAt
                        ? "Resume planning"
                        : "Resume conversation"}
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
