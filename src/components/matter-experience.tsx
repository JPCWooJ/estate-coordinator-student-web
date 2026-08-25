"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { RecommendationDecisionSubmission } from "@/lib/domain/blueprint";
import type { IntakeSection, StructuredIntakeSubmission } from "@/lib/domain/intake";
import type { MatterView } from "@/lib/server/data";
import { AppHeader } from "./app-header";
import { BlueprintPreview } from "./blueprint-preview";
import { OpeningSummary } from "./opening-summary";
import { StructuredIntakeForm } from "./structured-intake-form";

type EditableSection = Exclude<IntakeSection, "planning_summary">;
type SessionPayload = { user: { id: string; email: string } | null };

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  let data: T & { error?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(data.error ?? fallback);
  return data;
}

export async function postStructuredIntakeWithReconciliation(
  url: string,
  submission: StructuredIntakeSubmission,
  request: typeof fetch = fetch,
) {
  const body = JSON.stringify(submission);
  const post = () =>
    request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

  let response: Response;
  try {
    response = await post();
  } catch {
    return post();
  }
  return response.status >= 500 && response.status <= 599
    ? post()
    : response;
}

async function loadMatter(matterId: string) {
  const [sessionResponse, matterResponse] = await Promise.all([
    fetch("/api/session"),
    fetch(`/api/matters/${matterId}`),
  ]);
  const session = await responseJson<SessionPayload>(sessionResponse, "Your session could not be restored.");
  if (!session.user || matterResponse.status === 401) return { user: null, matter: null };
  const payload = await responseJson<{ matter: MatterView }>(matterResponse, "The planning workspace could not be loaded.");
  return { user: session.user, matter: payload.matter };
}

function journeyStep(matter: MatterView) {
  const section = matter.record.canonical_intake?.currentSection;
  if (!matter.blueprintState) {
    if (section === "goals_family") return 1;
    if (section === "planning_context") return 2;
    if (section === "team_continuity") return 3;
    if (section === "financial_range") return 4;
    return 5;
  }
  if (matter.blueprintState.interaction?.kind === "final_review") return 7;
  if (["generating", "blueprint"].includes(matter.blueprintState.interaction?.kind ?? "")) return 7;
  return 6;
}

export function MatterExperience({ matterId }: { matterId: string }) {
  const router = useRouter();
  const [matter, setMatter] = useState<MatterView | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Restoring saved work…");
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [finalReviewCorrecting, setFinalReviewCorrecting] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [editSection, setEditSection] = useState<EditableSection | null>(null);
  const [decisionInputs, setDecisionInputs] = useState<Record<string, RecommendationDecisionSubmission>>({});
  const pendingOperation = useRef<string | null>(null);
  const pendingIntakeOperations = useRef<Partial<Record<EditableSection, string>>>({});
  const surfaceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    void loadMatter(matterId)
      .then(async ({ user, matter: loadedMatter }) => {
        if (!user) {
          router.replace("/");
          return;
        }
        if (!loadedMatter) throw new Error("The planning workspace could not be loaded.");
        let loaded = loadedMatter;
        if (loaded.status === "blueprint_ready" && !loaded.blueprintState) {
          const response = await fetch(`/api/matters/${matterId}/blueprint/start`, { method: "POST" });
          loaded = (await responseJson<{ matter: MatterView }>(response, "Blueprint decisions could not be prepared.")).matter;
        }
        if (!active) return;
        setEmail(user.email);
        setMatter(loaded);
        setSaveStatus(`Saved ${new Date(loaded.savedAt).toLocaleTimeString()}`);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "The planning workspace could not be loaded.");
      });
    return () => { active = false; };
  }, [matterId, router]);

  async function saveStructured(submission: StructuredIntakeSubmission) {
    setBusy(true);
    setError("");
    setSaveStatus("Syncing…");
    const operationId =
      pendingIntakeOperations.current[submission.section] ?? submission.operationId;
    pendingIntakeOperations.current[submission.section] = operationId;
    try {
      const url = `/api/matters/${matterId}/intake`;
      const idempotentSubmission = { ...submission, operationId };
      const response =
        submission.section === "financial_range"
          ? await postStructuredIntakeWithReconciliation(url, idempotentSubmission)
          : await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(idempotentSubmission),
            });
      const payload = await responseJson<{ matter: MatterView }>(response, "This section could not be saved. Your entries remain here.");
      delete pendingIntakeOperations.current[submission.section];
      setMatter(payload.matter);
      setEditSection(null);
      setSaveStatus(`Saved ${new Date(payload.matter.savedAt).toLocaleTimeString()}`);
      requestAnimationFrame(() =>
        surfaceRef.current?.scrollIntoView({ block: "start" }),
      );
    } catch (reason) {
      setSaveStatus("Not saved — entries retained");
      setError(
        reason instanceof Error && !/failed to fetch|networkerror/i.test(reason.message)
          ? reason.message
          : "This section could not be saved. Your entries remain here.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmSummary() {
    setBusy(true);
    setError("");
    setSaveStatus("Confirming — preparing your decisions…");
    try {
      const confirmedResponse = await fetch(`/api/matters/${matterId}/confirm`, { method: "POST" });
      await responseJson<{ matter: MatterView }>(confirmedResponse, "The Planning Summary could not be confirmed.");
      const startResponse = await fetch(`/api/matters/${matterId}/blueprint/start`, { method: "POST" });
      const payload = await responseJson<{ matter: MatterView }>(startResponse, "Blueprint decisions could not be prepared.");
      setMatter(payload.matter);
      setSaveStatus("Confirmed and saved");
    } catch (reason) {
      setSaveStatus("Confirmation paused — retry available");
      setError(reason instanceof Error ? reason.message : "The Planning Summary could not be confirmed.");
    } finally {
      setBusy(false);
    }
  }

  function decisionValue(decisionId: string): RecommendationDecisionSubmission {
    return decisionInputs[decisionId] ?? {
      decisionId,
      disposition: "accept",
      modification: null,
      openConfirmation: null,
    };
  }

  async function saveDecisions() {
    if (matter?.blueprintState?.interaction?.kind !== "recommendations") return;
    setBusy(true);
    setError("");
    setSaveStatus("Saving Blueprint decisions…");
    pendingOperation.current ??= crypto.randomUUID();
    try {
      const decisions = matter.blueprintState.interaction.items.map((item) => decisionValue(item.decision_id));
      const response = await fetch(`/api/matters/${matterId}/blueprint/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: pendingOperation.current, decisions }),
      });
      const payload = await responseJson<{ matter: MatterView }>(response, "Your Blueprint decisions could not be saved.");
      pendingOperation.current = null;
      setMatter(payload.matter);
      setSaveStatus("Decisions saved");
    } catch (reason) {
      setSaveStatus("Not saved — selections retained");
      setError(reason instanceof Error ? reason.message : "Your Blueprint decisions could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function submitNarrative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matter || !answer.trim()) return;
    setBusy(true);
    setError("");
    setSaveStatus("Saving…");
    pendingOperation.current ??= crypto.randomUUID();
    const finalCorrection = matter.blueprintState?.interaction?.kind === "final_review";
    const endpoint = finalCorrection
      ? `/api/matters/${matterId}/blueprint/final-review/corrections`
      : `/api/matters/${matterId}/blueprint/turns`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalCorrection
          ? { turnKey: pendingOperation.current, correction: answer }
          : { turnKey: pendingOperation.current, answer }),
      });
      const payload = await responseJson<{ matter: MatterView }>(response, "Your response could not be saved.");
      pendingOperation.current = null;
      setMatter(payload.matter);
      setAnswer("");
      setFinalReviewCorrecting(false);
      setSaveStatus(`Saved ${new Date(payload.matter.savedAt).toLocaleTimeString()}`);
    } catch (reason) {
      setSaveStatus("Not saved — response retained");
      setError(reason instanceof Error ? reason.message : "Your response could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEvidence(file: File | null) {
    setBusy(true);
    setError("");
    setSaveStatus("Saving evidence choice…");
    pendingOperation.current ??= crypto.randomUUID();
    const form = new FormData();
    form.set("turnKey", pendingOperation.current);
    if (file) form.set("file", file);
    try {
      const response = await fetch(`/api/matters/${matterId}/blueprint/evidence`, { method: "POST", body: form });
      const payload = await responseJson<{ matter: MatterView }>(response, "The evidence choice could not be saved.");
      pendingOperation.current = null;
      setEvidenceFile(null);
      setMatter(payload.matter);
      setSaveStatus("Evidence choice saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The evidence choice could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setBusy(true);
    setError("");
    setSaveStatus("Generating your Estate Blueprint…");
    try {
      const response = await fetch(`/api/matters/${matterId}/blueprint/finalize`, { method: "POST" });
      const payload = await responseJson<{ matter: MatterView }>(response, "The Estate Blueprint could not be generated.");
      setMatter(payload.matter);
      setFinalReviewCorrecting(false);
      setSaveStatus("Blueprint generated and saved");
    } catch (reason) {
      setSaveStatus("Generation paused — retry available");
      setError(reason instanceof Error ? reason.message : "The Estate Blueprint could not be generated.");
    } finally {
      setBusy(false);
    }
  }

  if (!matter || !email) return <main className="centered-state" role="status">{error || "Restoring your saved work…"}</main>;

  const canonical = matter.record.canonical_intake;
  const interaction = matter.blueprintState?.interaction ?? null;
  const activeSection = editSection ?? (canonical?.currentSection !== "planning_summary" ? canonical?.currentSection : null);
  const stopped = matter.workflowState.step === "STOPPED" || interaction?.kind === "stop" || Boolean(matter.blueprintState?.stop);
  const step = journeyStep(matter);
  const progress = Math.round((step / 7) * 100);

  return (
    <div className="app-shell rescue-shell">
      <AppHeader email={email} />
      <main className="matter-main rescue-main">
        <div className="matter-topbar">
          <div><Link href="/home" className="back-link">← Your planning workspace</Link><h1>{matter.name}</h1></div>
          <span className="save-state" role="status" aria-live="polite"><span aria-hidden="true" /> {saveStatus}</span>
        </div>
        <div className="progress-block rescue-progress">
          <div className="progress-copy"><span>{matter.stepLabel}</span><strong>{step} of 7</strong></div>
          <div className="progress-track" role="progressbar" aria-label="Estate Blueprint progress" aria-valuemin={0} aria-valuemax={7} aria-valuenow={step}><span style={{ width: `${progress}%` }} /></div>
        </div>

        <section ref={surfaceRef} className="rescue-surface" aria-live="polite">
          {interaction?.kind === "blueprint" && matter.blueprint?.document ? (
            <BlueprintPreview document={matter.blueprint.document} downloadHref={`/api/matters/${matterId}/blueprint/pdf`} />
          ) : interaction?.kind === "generating" ? (
            <div className="endpoint-card"><div className="eyebrow">Estate Blueprint</div><h2>Your confirmed Blueprint is ready to finish</h2><p>The saved generation snapshot is intact.</p><button className="button button-primary" onClick={finalize} disabled={busy}>{busy ? "Generating…" : "Continue Blueprint generation"}</button></div>
          ) : stopped ? (
            <div className="stop-card"><div className="eyebrow">Professional follow-up required</div><h2>A qualified professional should review this next</h2><p>{matter.blueprintState?.stop?.reason ?? matter.workflowState.stop?.reason}</p><strong>{matter.blueprintState?.stop?.immediate_action ?? matter.workflowState.stop?.immediate_action}</strong></div>
          ) : canonical && activeSection ? (
            <StructuredIntakeForm section={activeSection} canonical={canonical} busy={busy} onSave={saveStructured} onCancel={editSection ? () => setEditSection(null) : undefined} />
          ) : !matter.blueprintState && matter.workflowState.step === "MO08_CONFIRM" ? (
            <div className="review-card"><div className="eyebrow">5 of 7 · Professional synthesis</div><h2>Your Planning Summary</h2><p>Review one synthesized baseline. Each material fact appears in the section where it informs planning.</p><OpeningSummary record={matter.record} />{canonical ? <div className="summary-edit-links"><span>Correct a section:</span>{(["goals_family", "planning_context", "team_continuity", "financial_range"] as EditableSection[]).map((section) => <button key={section} type="button" onClick={() => setEditSection(section)}>{section.replaceAll("_", " ")}</button>)}</div> : null}<div className="review-actions"><button className="button button-primary" onClick={confirmSummary} disabled={busy}>{busy ? "Preparing decisions…" : "Confirm Planning Summary"}</button></div></div>
          ) : interaction?.kind === "recommendations" ? (
            <div className="decision-surface"><div className="eyebrow">6 of 7 · Blueprint decisions</div><h2>Choose the direction for your Estate Blueprint</h2><p>Only recommendations supported by your confirmed information appear here.</p><div className="recommendation-list">{interaction.items.map((item) => { const input = decisionValue(item.decision_id); return <article className="recommendation-card" key={item.decision_id}><h3>{item.content.objective}</h3><h4>Recommended starting point</h4><p>{item.content.starting_point}</p><h4>Why this fits</h4><p>{item.content.rationale}</p>{item.content.alternative_or_tradeoff ? <><h4>Tradeoff or alternative</h4><p>{item.content.alternative_or_tradeoff}</p></> : null}<label className="intake-field"><span>Your decision</span><select value={input.disposition} onChange={(event) => setDecisionInputs((current) => ({ ...current, [item.decision_id]: { ...input, disposition: event.target.value as RecommendationDecisionSubmission["disposition"] } }))}><option value="accept">Accept recommendation</option><option value="modify">Modify</option><option value="alternative_requested">Request an alternative</option><option value="defer">Defer</option></select></label>{input.disposition === "modify" ? <label className="intake-field"><span>What should change?</span><textarea rows={2} value={input.modification ?? ""} onChange={(event) => setDecisionInputs((current) => ({ ...current, [item.decision_id]: { ...input, modification: event.target.value } }))} required /></label> : null}</article>; })}</div><button className="button button-primary" onClick={saveDecisions} disabled={busy || interaction.items.some((item) => { const value = decisionValue(item.decision_id); return value.disposition === "modify" && !value.modification?.trim(); })}>{busy ? "Saving decisions…" : "Save decisions and continue"}</button></div>
          ) : interaction?.kind === "final_review" ? (
            <div className="final-review-card"><div className="eyebrow">7 of 7 · Final Blueprint Profile</div><h2>Review your target-state design</h2><p>This is the planning direction your Estate Blueprint will use—not another intake summary.</p><div className="final-review-grid">{Object.entries(interaction.profile).filter(([key]) => key !== "material_open_confirmations").map(([key, value]) => <section key={key} data-testid={`final-review-${key.replaceAll("_", "-")}`}><h3>{key.replaceAll("_", " ")}</h3><p>{String(value)}</p></section>)}<section className="final-review-wide"><h3>Material open confirmations</h3>{interaction.profile.material_open_confirmations.length ? <ul>{interaction.profile.material_open_confirmations.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No material open confirmations remain.</p>}</section></div>{!finalReviewCorrecting ? <div className="review-actions"><button className="button button-primary" onClick={finalize} disabled={busy}>{busy ? "Generating…" : "Confirm and generate Estate Blueprint"}</button><button className="button button-secondary" onClick={() => setFinalReviewCorrecting(true)}>Correct one section</button></div> : <form className="composer" onSubmit={submitNarrative}><label htmlFor="answer">Describe the one section and replacement direction</label><textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={3} required /><button className="button button-primary" disabled={busy}>Save correction</button></form>}</div>
          ) : interaction?.kind === "evidence" ? (
            <div className="evidence-card"><div className="eyebrow">Conditional evidence check</div><h2>A specific external arrangement may affect a decision</h2><p>{interaction.prompt}</p><p>{interaction.helper}</p><label htmlFor="evidence-file">Relevant PDF</label><input id="evidence-file" type="file" accept="application/pdf,.pdf" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} /><div className="review-actions"><button className="button button-primary" onClick={() => void submitEvidence(evidenceFile)} disabled={busy || !evidenceFile}>Review relevant PDF</button><button className="button button-secondary" onClick={() => void submitEvidence(null)} disabled={busy}>I do not have this now</button></div></div>
          ) : interaction?.kind === "recommendation" || interaction?.kind === "question" ? (
            <div><article className={interaction.kind === "recommendation" ? "recommendation-card" : "active-question"}><div className="eyebrow">Blueprint planning</div><h2>{interaction.kind === "recommendation" ? interaction.content.objective : "One material follow-up"}</h2><p>{interaction.kind === "recommendation" ? interaction.content.starting_point : interaction.prompt}</p>{interaction.kind === "recommendation" ? <p>{interaction.content.rationale}</p> : interaction.helper ? <small>{interaction.helper}</small> : null}</article><form className="composer" onSubmit={submitNarrative}><label htmlFor="answer">Your response</label><textarea id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={4} maxLength={5000} required /><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Continue"}</button></form></div>
          ) : (
            <div className="centered-state">Preparing your next step…</div>
          )}
          <p className="error-text" role="alert">{error}</p>
        </section>
      </main>
    </div>
  );
}
