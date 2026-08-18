"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { MatterView } from "@/lib/server/data";
import { AppHeader } from "./app-header";
import { OpeningSummary } from "./opening-summary";

type SessionPayload = { user: { id: string; email: string } | null };

async function fetchMatterPayload(matterId: string): Promise<{
  session: SessionPayload;
  matter: MatterView;
}> {
  const [sessionResponse, matterResponse] = await Promise.all([
    fetch("/api/session"),
    fetch(`/api/matters/${matterId}`),
  ]);
  const session: SessionPayload = await sessionResponse.json();
  const data = await matterResponse.json();
  if (!matterResponse.ok) {
    throw new Error(data.error ?? "The matter could not be loaded.");
  }
  return { session, matter: data.matter };
}

export function MatterExperience({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [matter, setMatter] = useState<MatterView | null>(null);
  const [email, setEmail] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading saved state…");
  const [error, setError] = useState("");
  const pendingTurnKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMatterPayload(matterId)
      .then((payload) => {
        if (!active) return;
        if (!payload.session.user) {
          router.replace("/");
          return;
        }
        setEmail(payload.session.user.email);
        setMatter(payload.matter);
        setSaveStatus(
          `Saved ${new Date(payload.matter.savedAt).toLocaleTimeString()}`,
        );
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The matter could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [matterId, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || !matter) return;
    setBusy(true);
    setError("");
    setSaveStatus("Saving…");
    pendingTurnKey.current ??= crypto.randomUUID();
    const response = await fetch(`/api/matters/${matterId}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turnKey: pendingTurnKey.current,
        answer,
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setSaveStatus("Not saved");
      setError(data.error ?? "Your response could not be saved. Please retry.");
      return;
    }
    pendingTurnKey.current = null;
    setMatter(data.matter);
    setAnswer("");
    setCorrecting(false);
    setSaveStatus(`Saved ${new Date(data.matter.savedAt).toLocaleTimeString()}`);
  }

  async function confirm() {
    setBusy(true);
    setError("");
    setSaveStatus("Saving confirmation…");
    const response = await fetch(`/api/matters/${matterId}/confirm`, {
      method: "POST",
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setSaveStatus("Not saved");
      setError(data.error ?? "The confirmation could not be saved.");
      return;
    }
    setMatter(data.matter);
    setSaveStatus("Confirmed and saved");
  }

  if (!matter || !email) {
    return (
      <main className="centered-state" role="status">
        {error || "Restoring the last committed state…"}
      </main>
    );
  }

  const isReview = matter.workflowState.step === "MO08_CONFIRM";
  const isStopped = matter.workflowState.step === "STOPPED";
  const isConfirmed = matter.workflowState.step === "CONFIRMED";
  const hideLastAssistant =
    !isConfirmed &&
    matter.messages.at(-1)?.role === "assistant";
  const visibleMessages = hideLastAssistant
    ? matter.messages.slice(0, -1)
    : matter.messages;

  return (
    <div className="app-shell">
      <AppHeader email={email} />
      <main className="matter-main">
        <div className="matter-topbar">
          <div>
            <Link href="/home" className="back-link">
              ← Matter home
            </Link>
            <h1>{matter.name}</h1>
            <p>{matter.stepLabel}</p>
          </div>
          <span className="save-state" role="status" aria-live="polite">
            <span aria-hidden="true" /> {saveStatus}
          </span>
        </div>

        <div className="progress-block">
          <div className="progress-copy">
            <span>Matter Opening</span>
            <strong>{matter.progress}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Matter Opening progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={matter.progress}
          >
            <span style={{ width: `${matter.progress}%` }} />
          </div>
        </div>

        {isConfirmed ? (
          <section className="endpoint-card" aria-labelledby="confirmed-title">
            <div className="success-mark" aria-hidden="true">
              ✓
            </div>
            <div className="eyebrow">Saved endpoint</div>
            <h2 id="confirmed-title">Matter Opening confirmed</h2>
            <p>
              The confirmed structured record is preserved for resume. This Slice
              1 test stops here; Estate Blueprint stages are not available.
            </p>
            <OpeningSummary record={matter.record} />
            <Link className="button button-primary" href="/home">
              Return to matter home
            </Link>
          </section>
        ) : isStopped ? (
          <section className="stop-card" aria-labelledby="stop-title">
            <div className="eyebrow">Self-service paused</div>
            <h2 id="stop-title">Professional follow-up is required</h2>
            <p>{matter.workflowState.stop?.reason}</p>
            <strong>{matter.workflowState.stop?.immediate_action}</strong>
            <p>Your last accepted state remains saved. This lane cannot continue here.</p>
          </section>
        ) : (
          <div className="workspace-grid">
            <section className="conversation" aria-label="Matter Opening conversation">
              <div className="conversation-history" aria-live="polite">
                {visibleMessages.map((message) => (
                  <article
                    key={message.id}
                    className={`message message-${message.role}`}
                  >
                    <span>{message.role === "student" ? "You" : "Estate Coordinator"}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>

              {isReview ? (
                <section className="review-card" aria-labelledby="review-title">
                  <div className="eyebrow">Review before confirming</div>
                  <h2 id="review-title">Matter Opening record</h2>
                  <p>
                    Check this concise record. Confirm it, or describe one correction
                    and review the updated record again.
                  </p>
                  <OpeningSummary record={matter.record} />
                  {!correcting && (
                    <div className="review-actions">
                      <button
                        className="button button-primary"
                        onClick={confirm}
                        disabled={busy}
                      >
                        {busy ? "Confirming…" : "Confirm Matter Opening"}
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => setCorrecting(true)}
                        disabled={busy}
                      >
                        I need to correct something
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <article className="active-question" aria-labelledby="active-question-label">
                  <span id="active-question-label">Estate Coordinator</span>
                  <p>{matter.currentQuestion}</p>
                </article>
              )}

              {(!isReview || correcting) && (
                <form className="composer" onSubmit={submit}>
                  <label htmlFor="answer">
                    {correcting ? "Describe the correction" : "Your response"}
                  </label>
                  <textarea
                    id="answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder={
                      correcting
                        ? "Tell us exactly what should change."
                        : "Answer in your own words. Unknown, not decided, and not applicable are accepted."
                    }
                    rows={5}
                    maxLength={5000}
                    disabled={busy}
                  />
                  <div className="composer-footer">
                    <small>{answer.length}/5000</small>
                    <button
                      className="button button-primary"
                      disabled={busy || !answer.trim()}
                    >
                      {busy ? "Saving…" : correcting ? "Save correction" : "Continue"}
                    </button>
                  </div>
                </form>
              )}
              <p className="error-text" role="alert">
                {error}
              </p>
            </section>

            <aside className="workspace-aside">
              <h2>What to expect</h2>
              <p>One active question at a time. Follow-ups appear only when triggered.</p>
              <div className="boundary-note">
                <strong>Professional boundary</strong>
                <p>
                  Matter Opening records goals and context. It does not provide legal,
                  tax, or investment conclusions.
                </p>
              </div>
              <div className="privacy-note">
                <strong>Use synthetic data only</strong>
                <p>Never enter credentials, private keys, or full account identifiers.</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
