"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { MatterView } from "@/lib/server/data";
import { AppHeader } from "./app-header";
import { BlueprintPreview } from "./blueprint-preview";
import { OpeningSummary } from "./opening-summary";

type SessionPayload = { user: { id: string; email: string } | null };
type SessionPayloadWithMatter = {
  session: SessionPayload;
  matter: MatterView | null;
};

async function fetchMatterPayload(matterId: string): Promise<SessionPayloadWithMatter> {
  const [sessionResponse, matterResponse] = await Promise.all([
    fetch("/api/session"),
    fetch(`/api/matters/${matterId}`),
  ]);
  const session: SessionPayload = await sessionResponse.json();
  if (!session.user || matterResponse.status === 401) {
    return { session: { user: null }, matter: null };
  }
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
  if (matter.blueprintState?.phase === "FINAL_REVIEW") {
    return "Review the complete planning direction as one profile. Corrections stay local to the section you identify, and nothing is generated until you confirm it.";
  }
  if (matter.blueprintState?.phase === "ESTATE_BLUEPRINT") {
    return "Your confirmed planning direction is frozen into one version. The web preview and downloadable PDF come from that same saved Blueprint.";
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
  const [finalReviewCorrecting, setFinalReviewCorrecting] = useState(false);
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
        if (!payload.matter) {
          throw new Error("The planning workspace could not be loaded.");
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
    try {
      const endpoint = matter.blueprintState
        ? matter.blueprintState.interaction?.kind === "final_review"
          ? `/api/matters/${matterId}/blueprint/final-review/corrections`
          : `/api/matters/${matterId}/blueprint/turns`
        : `/api/matters/${matterId}/${correcting ? "corrections" : "turns"}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          matter.blueprintState?.interaction?.kind === "final_review"
            ? { turnKey: pendingTurnKey.current, correction: answer }
            : correcting
            ? { turnKey: pendingTurnKey.current, correction: answer }
            : { turnKey: pendingTurnKey.current, answer },
        ),
      });
      let data: { error?: string; matter?: MatterView };
      try {
        data = await response.json();
      } catch {
        throw new Error("Your response could not be saved. Please retry.");
      }
      if (!response.ok || !data.matter) {
        throw new Error(data.error ?? "Your response could not be saved. Please retry.");
      }
      pendingTurnKey.current = null;
      setMatter(data.matter);
      setInterviewStarted(true);
      setAnswer("");
      setFinalReviewCorrecting(false);
      setCorrecting(
        data.matter.workflowState.step === "MO08_CONFIRM" &&
          Boolean(data.matter.workflowState.clarification),
      );
      setSaveStatus(`Saved ${new Date(data.matter.savedAt).toLocaleTimeString()}`);
    } catch {
      setSaveStatus("Not saved - retry");
      setError("Your response could not be saved. Please retry.");
    } finally {
      setBusy(false);
    }
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
    try {
      const response = await fetch(`/api/matters/${matterId}/blueprint/evidence`, {
        method: "POST",
        body: form,
      });
      let data: { error?: string; matter?: MatterView };
      try {
        data = await response.json();
      } catch {
        throw new Error("The evidence could not be processed. Please retry.");
      }
      if (!response.ok || !data.matter) {
        throw new Error(
          data.error ?? "The evidence could not be processed. Please retry.",
        );
      }
      pendingTurnKey.current = null;
      setEvidenceFile(null);
      setMatter(data.matter);
      setSaveStatus(`Saved ${new Date(data.matter.savedAt).toLocaleTimeString()}`);
    } catch {
      setSaveStatus("Not saved - retry");
      setError("The evidence could not be processed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setBusy(true);
    setError("");
    setSaveStatus("Generating your Estate Blueprint…");
    try {
      const response = await fetch(`/api/matters/${matterId}/blueprint/finalize`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        matter?: MatterView;
      };
      if (!response.ok || !data.matter) {
        throw new Error(data.error ?? "The Estate Blueprint could not be generated.");
      }
      setMatter(data.matter);
      setFinalReviewCorrecting(false);
      setSaveStatus("Blueprint generated and saved");
    } catch (generationError) {
      setSaveStatus("Generation paused - retry");
      setError(
        generationError instanceof Error
          ? generationError.message
          : "The Estate Blueprint could not be generated.",
      );
    } finally {
      setBusy(false);
    }
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
  const isGenerating = blueprintInteraction?.kind === "generating";
  const blueprintDocument = matter.blueprint?.document ?? null;
  const isBlueprintReady =
    blueprintInteraction?.kind === "blueprint" && Boolean(blueprintDocument);
  const lastAssistantMessage = matter.messages.at(-1);
  const isStartingInterview =
    !matter.blueprintState &&
    !isReview &&
    !isStopped &&
    matter.workflowState.step === "MO01_OUTCOMES" &&
    !interviewStarted;
  const activeClarification =
    matter.workflowState.clarification?.question ??
    (blueprintInteraction?.kind === "question" &&
    blueprintInteraction.key === "clarification"
      ? blueprintInteraction.prompt
      : null);
  const hideLastAssistant = Boolean(
    activeClarification &&
      lastAssistantMessage?.role === "assistant" &&
      lastAssistantMessage.content === activeClarification,
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
    blueprintInteraction?.kind !== "generating" &&
    blueprintInteraction?.kind !== "blueprint" &&
    (!isReview || correcting) &&
    (blueprintInteraction?.kind !== "final_review" || finalReviewCorrecting);

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

        {isBlueprintReady && blueprintDocument ? (
          <BlueprintPreview
            document={blueprintDocument}
            downloadHref={`/api/matters/${matterId}/blueprint/pdf`}
          />
        ) : isGenerating ? (
          <section className="endpoint-card" aria-labelledby="generating-title">
            <div className="eyebrow">Estate Blueprint</div>
            <h2 id="generating-title">Your confirmed Blueprint is ready to finish</h2>
            <p>
              The planning direction is already frozen. Continue generation to create
              the matching web preview and PDF.
            </p>
            <div className="review-actions">
              <button className="button button-primary" onClick={finalize} disabled={busy}>
                {busy ? "Generating…" : "Continue Blueprint generation"}
              </button>
            </div>
            <p className="error-text" role="alert">{error}</p>
          </section>
        ) : isComplete ? (
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
              ) : blueprintInteraction?.kind === "final_review" ? (
                <section
                  className="final-review-card"
                  aria-labelledby="final-review-title"
                  tabIndex={-1}
                  ref={(node) => { activeTaskRef.current = node; }}
                >
                  <div className="eyebrow">Final Review</div>
                  <h2 id="final-review-title">Review your Estate Blueprint</h2>
                  <p className="final-review-intro">
                    Read the complete planning direction as one profile. You can make
                    a local correction before confirming the version used for your
                    web preview and PDF.
                  </p>
                  <div className="final-review-grid">
                    <section>
                      <h3>Goals and priorities</h3>
                      <p>{blueprintInteraction.profile.goals_and_priorities}</p>
                    </section>
                    <section data-testid="final-review-planning-baseline">
                      <h3>Planning baseline</h3>
                      <p>{blueprintInteraction.profile.planning_baseline}</p>
                    </section>
                    <section data-testid="final-review-beneficiary-architecture">
                      <h3>Beneficiary architecture</h3>
                      <p>{blueprintInteraction.profile.beneficiary_architecture}</p>
                    </section>
                    <section>
                      <h3>Fiduciary and continuity design</h3>
                      <p>{blueprintInteraction.profile.fiduciary_and_continuity_design}</p>
                    </section>
                    <section>
                      <h3>Tax and transfer direction</h3>
                      <p>{blueprintInteraction.profile.tax_and_transfer_direction}</p>
                    </section>
                    <section>
                      <h3>Asset and liquidity treatment</h3>
                      <p>{blueprintInteraction.profile.asset_and_liquidity_treatment}</p>
                    </section>
                    <section>
                      <h3>Family-readiness design</h3>
                      <p>{blueprintInteraction.profile.family_readiness_design}</p>
                    </section>
                    <section className="final-review-wide">
                      <h3>Material open confirmations</h3>
                      {blueprintInteraction.profile.material_open_confirmations.length ? (
                        <ul>
                          {blueprintInteraction.profile.material_open_confirmations.map(
                            (item) => <li key={item}>{item}</li>,
                          )}
                        </ul>
                      ) : (
                        <p>No material open confirmations remain.</p>
                      )}
                    </section>
                  </div>
                  {!finalReviewCorrecting ? (
                    <div className="review-actions">
                      <button
                        className="button button-primary"
                        onClick={finalize}
                        disabled={busy}
                      >
                        {busy ? "Generating…" : "Confirm and generate Estate Blueprint"}
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => setFinalReviewCorrecting(true)}
                        disabled={busy}
                      >
                        I need to correct something
                      </button>
                    </div>
                  ) : null}
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
                    {finalReviewCorrecting
                      ? "Describe the Final Review correction"
                      : correcting
                        ? "Describe the correction"
                        : "Your response"}
                  </label>
                  <textarea
                    id="answer"
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder={
                      finalReviewCorrecting || correcting
                        ? "Tell us exactly what should change."
                        : "Answer in your own words."
                    }
                    rows={5}
                    maxLength={5000}
                    disabled={busy}
                  />
                  <div className="composer-footer">
                    <small>{answer.length}/5000</small>
                    <button className="button button-primary" disabled={busy || !answer.trim()}>
                      {busy
                        ? "Saving…"
                        : finalReviewCorrecting
                          ? "Save Final Review correction"
                          : correcting
                            ? "Save correction"
                            : "Continue"}
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
