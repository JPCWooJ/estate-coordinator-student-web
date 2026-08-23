"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { MatterView } from "@/lib/server/data";
import { AppHeader } from "./app-header";
import { OpeningSummary } from "./opening-summary";

type SessionPayload = { user: { id: string; email: string } | null };
type SessionPayloadWithMatter = { session: SessionPayload; matter: MatterView };

async function fetchMatterPayload(matterId: string): Promise<SessionPayloadWithMatter> {
  const [sessionResponse, matterResponse] = await Promise.all([
    fetch("/api/session"),
    fetch(`/api/matters/${matterId}`),
  ]);
  const session: SessionPayload = await sessionResponse.json();
  const data = await matterResponse.json();
  if (!matterResponse.ok) {
    throw new Error(data.error ?? "The planning workspace could not be loaded.");
  }
  return { session, matter: data.matter };
}

async function continueIntoBlueprint(matterId: string) {
  const response = await fetch(`/api/matters/${matterId}/blueprint/start`, {
    method: "POST",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Planning Foundation could not be prepared.");
  }
  return data.matter as MatterView;
}

function whatToExpect(matter: MatterView) {
  if (matter.blueprintState?.phase === "PLANNING_FOUNDATION") {
    return "We are establishing the planning range needed for sound decisions, not collecting account-level detail. Evidence appears only when it could materially change that foundation.";
  }
  if (matter.blueprintState?.phase === "BLUEPRINT_DECISIONS") {
    return "The Estate Coordinator will recommend a starting point before asking for your response. Confirmed information and decisions carry forward.";
  }
  return "Answer in your own words. Brief follow-ups appear only when something important needs clarification, and your work is saved as you go.";
}

export function MatterExperience({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [matter, setMatter] = useState<MatterView | null>(null);
  const [email, setEmail] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Restoring saved work…");
  const [error, setError] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const pendingTurnKey = useRef<string | null>(null);
  const activeTaskRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMatterPayload(matterId)
      .then(async (payload) => {
        if (!payload.session.user) {
          router.replace("/");
          return;
        }
        let loaded = payload.matter;
        if (loaded.status === "blueprint_ready" && !loaded.blueprintState) {
          loaded = await continueIntoBlueprint(matterId);
        }
        if (!active) return;
        setEmail(payload.session.user.email);
        setMatter(loaded);
        setCorrecting(
          loaded.workflowState.step === "MO08_CONFIRM" &&
            Boolean(loaded.workflowState.clarification),
        );
        setInterviewStarted(
          loaded.workflowState.step !== "MO01_OUTCOMES" || loaded.messages.length > 0,
        );
        setSaveStatus(`Saved ${new Date(loaded.savedAt).toLocaleTimeString()}`);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The planning workspace could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [matterId, router]);

  useEffect(() => {
    if (matter?.blueprintState || interviewStarted) activeTaskRef.current?.focus();
  }, [interviewStarted, matter?.blueprintState]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || !matter) return;
    setBusy(true);
    setError("");
    setSaveStatus("Saving…");
    pendingTurnKey.current ??= crypto.randomUUID();
    const endpoint = matter.blueprintState
      ? `/api/matters/${matterId}/blueprint/turns`
      : `/api/matters/${matterId}/${correcting ? "corrections" : "turns"}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        correcting
          ? { turnKey: pendingTurnKey.current, correction: answer }
          : { turnKey: pendingTurnKey.current, answer },
      ),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setSaveStatus("Not saved - retry");
      setError(data.error ?? "Your response could not be saved. Please retry.");
      return;
    }
    pendingTurnKey.current = null;
    setMatter(data.matter);
    setInterviewStarted(true);
    setAnswer("");
    setCorrecting(
      data.matter.workflowState.step === "MO08_CONFIRM" &&
        Boolean(data.matter.workflowState.clarification),
    );
    setSaveStatus(`Saved ${new Date(data.matter.savedAt).toLocaleTimeString()}`);
  }

  async function confirm() {
    setBusy(true);
    setError("");
    setSaveStatus("Saving…");
    try {
      const response = await fetch(`/api/matters/${matterId}/confirm`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "The confirmation could not be saved.");
      }
      const continued = await continueIntoBlueprint(matterId);
      setMatter(continued);
      setCorrecting(false);
      setSaveStatus("Confirmed and saved");
    } catch (confirmationError) {
      setSaveStatus("Not saved - retry");
      setError(
        confirmationError instanceof Error
          ? confirmationError.message
          : "The confirmation could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitEvidence(file: File | null) {
    setBusy(true);
    setError("");
    setSaveStatus(file ? "Reviewing and saving…" : "Saving…");
    pendingTurnKey.current ??= crypto.randomUUID();
    const form = new FormData();
    form.set("turnKey", pendingTurnKey.current);
    if (file) form.set("file", file);
    const response = await fetch(`/api/matters/${matterId}/blueprint/evidence`, {
      method: "POST",
      body: form,
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setSaveStatus("Not saved - retry");
      setError(data.error ?? "The evidence could not be processed. Please retry.");
      return;
    }
    pendingTurnKey.current = null;
    setEvidenceFile(null);
    setMatter(data.matter);
    setSaveStatus(`Saved ${new Date(data.matter.savedAt).toLocaleTimeString()}`);
  }

  if (!matter || !email) {
    return (
      <main className="centered-state" role="status">
        {error || "Restoring your saved work…"}
      </main>
    );
  }

  const isReview = !matter.blueprintState && matter.workflowState.step === "MO08_CONFIRM";
  const blueprintInteraction = matter.blueprintState?.interaction ?? null;
  const blueprintStop =
    matter.blueprintState?.stop ??
    (blueprintInteraction?.kind === "stop" ? blueprintInteraction.stop : null);
  const isStopped =
    matter.workflowState.step === "STOPPED" || Boolean(blueprintStop);
  const isComplete = blueprintInteraction?.kind === "complete";
  const lastAssistantMessage = matter.messages.at(-1);
  const isStartingInterview =
    !matter.blueprintState &&
    !isReview &&
    !isStopped &&
    matter.workflowState.step === "MO01_OUTCOMES" &&
    !interviewStarted;
  const hideLastAssistant = Boolean(
    matter.workflowState.clarification && lastAssistantMessage?.role === "assistant",
  );
  const visibleMessages = hideLastAssistant
    ? matter.messages.slice(0, -1)
    : matter.messages;
  const activePrompt =
    blueprintInteraction?.kind === "question"
      ? blueprintInteraction.prompt
      : matter.currentQuestion;
  const showComposer =
    !isStartingInterview &&
    !isStopped &&
    !isComplete &&
    blueprintInteraction?.kind !== "evidence" &&
    (!isReview || correcting);

  return (
    <div className="app-shell">
      <AppHeader email={email} />
      <main className="matter-main">
        <div className="matter-topbar">
          <div>
            <Link href="/home" className="back-link">
              ← Your planning workspace
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
            <span>{matter.stepLabel}</span>
            <strong>{matter.progress}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Estate Blueprint progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={matter.progress}
          >
            <span style={{ width: `${matter.progress}%` }} />
          </div>
        </div>

        {isComplete ? (
          <section className="endpoint-card" aria-labelledby="complete-title">
            <div className="success-mark" aria-hidden="true">✓</div>
            <div className="eyebrow">Blueprint Decisions</div>
            <h2 id="complete-title">{blueprintInteraction.title}</h2>
            <p>{blueprintInteraction.message}</p>
            <div className="review-actions">
              <Link className="button button-primary" href="/home">
                Return to planning workspace
              </Link>
            </div>
          </section>
        ) : isStopped ? (
          <section className="stop-card" aria-labelledby="stop-title">
            <div className="eyebrow">Professional follow-up required</div>
            <h2 id="stop-title">A qualified professional should review this next</h2>
            <p>{blueprintStop?.reason ?? matter.workflowState.stop?.reason}</p>
            <strong>
              {blueprintStop?.immediate_action ??
                matter.workflowState.stop?.immediate_action}
            </strong>
            <p>Your last accepted work remains saved.</p>
          </section>
        ) : (
          <div className="workspace-grid">
            <section
              className={`conversation${isStartingInterview ? " conversation-start" : ""}`}
              aria-label="Estate planning conversation"
            >
              <div className="active-task">
              {isReview ? (
                <section className="review-card" aria-labelledby="review-title">
                  <div className="eyebrow">Review before confirming</div>
                  <h2 id="review-title">Your Planning Summary</h2>
                  <p>
                    Confirm this summary, or tell us what should change. Confirmed
                    information carries directly into Planning Foundation.
                  </p>
                  <OpeningSummary record={matter.record} />
                  {matter.workflowState.clarification && (
                    <article className="active-question" aria-labelledby="correction-question-label">
                      <span id="correction-question-label">Estate Coordinator</span>
                      <p>{matter.currentQuestion}</p>
                    </article>
                  )}
                  {!correcting && (
                    <div className="review-actions">
                      <button className="button button-primary" onClick={confirm} disabled={busy}>
                        {busy ? "Confirming…" : "Confirm planning summary"}
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
              ) : isStartingInterview ? (
                <section className="start-card" aria-labelledby="start-title">
                  <div className="eyebrow">Before you begin</div>
                  <h2 id="start-title">Estate Planning Priorities</h2>
                  <div className="start-copy">
                    <p>
                      In approximately 10 minutes, this conversation will help us
                      understand what matters most, the people you want to protect,
                      and your current planning.
                    </p>
                    <p>
                      There are no right or wrong answers. Answer in ordinary language,
                      and say when you are unsure or have not decided.
                    </p>
                    <p>
                      Your answers become the foundation for your Estate Blueprint and
                      the planning decisions that follow.
                    </p>
                  </div>
                  <div className="start-action">
                    <button
                      type="button"
                      className="button button-primary start-button"
                      onClick={() => setInterviewStarted(true)}
                    >
                      Begin
                    </button>
                  </div>
                </section>
              ) : blueprintInteraction?.kind === "evidence" ? (
                <section
                  className="evidence-card"
                  aria-labelledby="evidence-title"
                  tabIndex={-1}
                  ref={(node) => { activeTaskRef.current = node; }}
                >
                  <div className="eyebrow">Planning Foundation</div>
                  <h2 id="evidence-title">A focused evidence check</h2>
                  <p className="evidence-question">{blueprintInteraction.prompt}</p>
                  <p>{blueprintInteraction.helper}</p>
                  <label htmlFor="evidence-file">Relevant PDF</label>
                  <input
                    id="evidence-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                    disabled={busy}
                  />
                  <div className="review-actions">
                    <button
                      className="button button-primary"
                      onClick={() => void submitEvidence(evidenceFile)}
                      disabled={busy || !evidenceFile}
                    >
                      {busy ? "Reviewing…" : "Review relevant PDF"}
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() => void submitEvidence(null)}
                      disabled={busy}
                    >
                      I do not have this now
                    </button>
                  </div>
                </section>
              ) : blueprintInteraction?.kind === "recommendation" ? (
                <article
                  className="recommendation-card"
                  aria-labelledby="recommendation-title"
                  tabIndex={-1}
                  ref={(node) => { activeTaskRef.current = node; }}
                >
                  <div className="eyebrow">Blueprint Decisions</div>
                  <h2 id="recommendation-title">{blueprintInteraction.content.objective}</h2>
                  <div className="recommendation-section">
                    <h3>Recommended starting point</h3>
                    <p>{blueprintInteraction.content.starting_point}</p>
                  </div>
                  <div className="recommendation-section">
                    <h3>Why this fits</h3>
                    <p>{blueprintInteraction.content.rationale}</p>
                  </div>
                  {blueprintInteraction.content.alternative_or_tradeoff && (
                    <div className="recommendation-section">
                      <h3>Alternative or tradeoff</h3>
                      <p>{blueprintInteraction.content.alternative_or_tradeoff}</p>
                    </div>
                  )}
                  {blueprintInteraction.content.open_confirmation && (
                    <div className="recommendation-section">
                      <h3>Still to confirm</h3>
                      <p>{blueprintInteraction.content.open_confirmation}</p>
                    </div>
                  )}
                  <p className="recommendation-question">
                    {blueprintInteraction.content.response_question}
                  </p>
                </article>
              ) : (
                <article
                  className="active-question"
                  aria-labelledby="active-question-label"
                  tabIndex={-1}
                  ref={(node) => { activeTaskRef.current = node; }}
                >
                  <span id="active-question-label">Estate Coordinator</span>
                  <p>{activePrompt}</p>
                  {blueprintInteraction?.kind === "question" && blueprintInteraction.helper && (
                    <small>{blueprintInteraction.helper}</small>
                  )}
                </article>
              )}

              {showComposer && (
                <form className="composer" onSubmit={submit}>
                  <label htmlFor="answer">
                    {correcting ? "Describe the correction" : "Your response"}
                  </label>
                  <textarea
                    id="answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder={correcting ? "Tell us exactly what should change." : "Answer in your own words."}
                    rows={5}
                    maxLength={5000}
                    disabled={busy}
                  />
                  <div className="composer-footer">
                    <small>{answer.length}/5000</small>
                    <button className="button button-primary" disabled={busy || !answer.trim()}>
                      {busy ? "Saving…" : correcting ? "Save correction" : "Continue"}
                    </button>
                  </div>
                </form>
              )}
              <p className="error-text" role="alert">{error}</p>
              </div>

              {!isStartingInterview ? (
                <aside className="workspace-aside">
                  <h2>What to Expect</h2>
                  <p>{whatToExpect(matter)}</p>
                </aside>
              ) : null}

              <div className="conversation-history" aria-live="polite">
                {visibleMessages.map((message) => (
                  <article key={message.id} className={`message message-${message.role}`}>
                    <span>{message.role === "student" ? "You" : "Estate Coordinator"}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
