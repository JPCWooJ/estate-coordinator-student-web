import "server-only";

import { randomUUID } from "node:crypto";

import {
  applyFinalReviewCorrection,
  applyBlueprintAnswer,
  applyEvidenceTreatment,
  applyRecommendationResponse,
  BlueprintState,
  BlueprintStateSchema,
  BlueprintDocument,
  BlueprintDocumentSchema,
  BlueprintGenerationInput,
  BlueprintGenerationInputSchema,
  buildBlueprintDocument,
  createInitialBlueprintState,
  DecisionRecord,
  DecisionRecordSchema,
  evaluateBlueprint,
  EvidenceTreatment,
  freezeBlueprintGeneration,
  phaseLabel,
  phaseProgress,
  PlanningBaseline,
  publishBlueprint,
  presentRecommendation,
} from "@/lib/domain/blueprint";
import {
  appendGeneratedResponse,
  generatedResponseMetadata,
} from "@/lib/domain/generated-response";
import {
  createInitialRecord,
  createInitialWorkflowState,
  MatterOpeningRecord,
  MatterOpeningRecordSchema,
  WORKFLOW_VERSION,
  WorkflowState,
  WorkflowStateSchema,
} from "@/lib/domain/matter-opening";
import {
  applyAcceptedInterpretation,
  applyPlanningSummaryCorrection,
  confirmOpening,
  getCanonicalQuestion,
  getStepLabel,
  getWorkflowProgress,
} from "@/lib/domain/workflow";
import { syntheticModeEnabled } from "./auth";
import {
  generateBlueprintRecommendation,
  interpretBlueprintAnswer,
  interpretBlueprintEvidence,
  interpretFinalReviewCorrection,
  interpretMatterOpeningAnswer,
  interpretPlanningSummaryCorrection,
  interpretRecommendationResponse,
} from "./interpreter";
import { extractStageRelevantEvidence } from "./evidence";
import { createAdminSupabaseClient } from "./supabase";
import { renderBlueprintPdf } from "./blueprint-pdf";

type MatterStatus =
  | "matter_opening"
  | "stopped"
  | "blueprint_ready"
  | "blueprint_in_progress"
  | "blueprint_complete";

export type BlueprintArtifact = {
  id: string;
  status: "generating" | "ready";
  document: BlueprintDocument | null;
  frozenAt: string;
  generatedAt: string | null;
  downloadFilename: string;
};

export type MatterSummary = {
  id: string;
  name: string;
  status: MatterStatus;
  currentStep: WorkflowState["step"];
  stepLabel: string;
  progress: number;
  openingConfirmedAt: string | null;
  updatedAt: string;
};

export type MatterMessage = {
  id: string;
  role: "student" | "assistant";
  step: string;
  content: string;
  createdAt: string;
};

export type MatterView = MatterSummary & {
  record: MatterOpeningRecord;
  workflowState: WorkflowState;
  messages: MatterMessage[];
  currentQuestion: string;
  savedAt: string;
  blueprintState: BlueprintState | null;
  decisions: DecisionRecord[];
  blueprint: BlueprintArtifact | null;
};

type StoredBlueprintArtifact = BlueprintArtifact & {
  generationInput: BlueprintGenerationInput;
  pdfStoragePath: string | null;
  pdfBytes: Uint8Array | null;
};

type SyntheticMatter = {
  id: string;
  ownerId: string;
  name: string;
  status: MatterStatus;
  record: MatterOpeningRecord;
  state: WorkflowState;
  revision: number;
  messages: MatterMessage[];
  processedTurnKeys: Set<string>;
  openingConfirmedAt: string | null;
  updatedAt: string;
  blueprintState: BlueprintState | null;
  decisions: DecisionRecord[];
  evidence: Array<{
    id: string;
    filename: string | null;
    status: string;
  }>;
  blueprintSeed: Parameters<typeof createInitialBlueprintState>[1] | null;
  blueprint: StoredBlueprintArtifact | null;
};

const syntheticProfiles = new Set<string>();
const syntheticMatters = new Map<string, SyntheticMatter>();

function parseRecord(value: unknown) {
  return MatterOpeningRecordSchema.parse(value);
}

function parseState(value: unknown) {
  return WorkflowStateSchema.parse(value);
}

function parseBlueprintState(value: unknown) {
  return BlueprintStateSchema.parse(value);
}

function parseBlueprintArtifact(value: {
  id: string;
  status: string;
  document: unknown;
  frozen_at: string;
  generated_at: string | null;
  download_filename: string;
}): BlueprintArtifact {
  if (value.status !== "generating" && value.status !== "ready") {
    throw new Error("The Estate Blueprint has an invalid generation status.");
  }
  const document = value.document
    ? BlueprintDocumentSchema.parse(value.document)
    : null;
  if (value.status === "ready" && !document) {
    throw new Error("The completed Estate Blueprint document is missing.");
  }
  return {
    id: value.id,
    status: value.status,
    document,
    frozenAt: value.frozen_at,
    generatedAt: value.generated_at,
    downloadFilename: value.download_filename,
  };
}

function summary(input: {
  id: string;
  name: string;
  status: MatterStatus;
  state: WorkflowState;
  blueprintState: BlueprintState | null;
  openingConfirmedAt: string | null;
  updatedAt: string;
}): MatterSummary {
  const status = input.blueprintState?.stop ? "stopped" : input.status;
  const blueprintLabel = input.blueprintState
    ? input.blueprintState.stop
      ? "Professional follow-up required"
      : phaseLabel(input.blueprintState.phase)
    : input.status === "blueprint_ready"
      ? "Planning Foundation"
      : null;
  return {
    id: input.id,
    name: input.name,
    status,
    currentStep: input.state.step,
    stepLabel: blueprintLabel ?? getStepLabel(input.state.step),
    progress: input.blueprintState
      ? phaseProgress(input.blueprintState.phase)
      : input.status === "blueprint_ready"
        ? phaseProgress("PLANNING_FOUNDATION")
        : getWorkflowProgress(input.state),
    openingConfirmedAt: input.openingConfirmedAt,
    updatedAt: input.updatedAt,
  };
}

function syntheticView(matter: SyntheticMatter): MatterView {
  return {
    ...summary({
      id: matter.id,
      name: matter.name,
      status: matter.status,
      state: matter.state,
      blueprintState: matter.blueprintState,
      openingConfirmedAt: matter.openingConfirmedAt,
      updatedAt: matter.updatedAt,
    }),
    record: matter.record,
    workflowState: matter.state,
    messages: matter.messages,
    currentQuestion: getCanonicalQuestion(matter.record, matter.state),
    savedAt: matter.updatedAt,
    blueprintState: matter.blueprintState,
    decisions: matter.decisions,
    blueprint: matter.blueprint
      ? {
          id: matter.blueprint.id,
          status: matter.blueprint.status,
          document: matter.blueprint.document,
          frozenAt: matter.blueprint.frozenAt,
          generatedAt: matter.blueprint.generatedAt,
          downloadFilename: matter.blueprint.downloadFilename,
        }
      : null,
  };
}

function requireSyntheticMatter(userId: string, matterId: string) {
  const matter = syntheticMatters.get(matterId);
  if (!matter || matter.ownerId !== userId) throw new Error("Matter not found.");
  return matter;
}

function appendSyntheticMessage(
  matter: SyntheticMatter,
  role: MatterMessage["role"],
  step: string,
  content: string,
) {
  matter.messages.push({
    id: randomUUID(),
    role,
    step,
    content,
    createdAt: new Date().toISOString(),
  });
}

export async function betaAcknowledged(userId: string) {
  if (syntheticModeEnabled()) return syntheticProfiles.has(userId);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("student_profiles")
    .select("beta_acknowledged_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.beta_acknowledged_at);
}

export async function acknowledgeBeta(userId: string) {
  const acknowledgedAt = new Date().toISOString();
  if (syntheticModeEnabled()) {
    syntheticProfiles.add(userId);
    return acknowledgedAt;
  }
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("student_profiles").upsert({
    user_id: userId,
    beta_notice_version: "0.3",
    beta_acknowledged_at: acknowledgedAt,
    updated_at: acknowledgedAt,
  });
  if (error) throw error;
  return acknowledgedAt;
}

export async function createMatter(userId: string) {
  if (syntheticModeEnabled()) {
    const existing = [...syntheticMatters.values()].find(
      (matter) => matter.ownerId === userId,
    );
    if (existing) return existing.id;
    const id = randomUUID();
    const now = new Date().toISOString();
    syntheticMatters.set(id, {
      id,
      ownerId: userId,
      name: "My Estate Plan",
      status: "matter_opening",
      record: createInitialRecord(id),
      state: createInitialWorkflowState(),
      revision: 0,
      messages: [],
      processedTurnKeys: new Set(),
      openingConfirmedAt: null,
      updatedAt: now,
      blueprintState: null,
      decisions: [],
      evidence: [],
      blueprintSeed: null,
      blueprint: null,
    });
    return id;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("create_slice1_matter", {
    p_owner_id: userId,
    p_name: "My Estate Plan",
    p_workflow_version: WORKFLOW_VERSION,
  });
  if (error) throw error;
  if (!data) throw new Error("The matter could not be created.");
  return data as string;
}

export async function listMatters(userId: string): Promise<MatterSummary[]> {
  if (syntheticModeEnabled()) {
    return [...syntheticMatters.values()]
      .filter((matter) => matter.ownerId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((matter) => syntheticView(matter));
  }

  const supabase = createAdminSupabaseClient();
  const { data: matters, error: matterError } = await supabase
    .from("matters")
    .select("id,name,status,opening_confirmed_at,updated_at")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (matterError) throw matterError;
  if (!matters?.length) return [];

  const matterIds = matters.map((matter) => matter.id);
  const [openingResult, blueprintResult] = await Promise.all([
    supabase
      .from("matter_openings")
      .select("matter_id,workflow_state")
      .eq("owner_id", userId)
      .in("matter_id", matterIds),
    supabase
      .from("blueprint_states")
      .select("matter_id,state")
      .eq("owner_id", userId)
      .in("matter_id", matterIds),
  ]);
  const { data: openings, error: openingError } = openingResult;
  if (openingError) throw openingError;
  if (blueprintResult.error) throw blueprintResult.error;
  const states = new Map(
    (openings ?? []).map((opening) => [
      opening.matter_id,
      parseState(opening.workflow_state),
    ]),
  );
  const blueprintStates = new Map(
    (blueprintResult.data ?? []).map((blueprint) => [
      blueprint.matter_id,
      parseBlueprintState(blueprint.state),
    ]),
  );

  return matters.flatMap((matter) => {
    const state = states.get(matter.id);
    if (!state) return [];
    return [
      summary({
        id: matter.id,
        name: matter.name,
        status: matter.status as MatterStatus,
        state,
        blueprintState: blueprintStates.get(matter.id) ?? null,
        openingConfirmedAt: matter.opening_confirmed_at,
        updatedAt: matter.updated_at,
      }),
    ];
  });
}

export async function getMatter(
  userId: string,
  matterId: string,
): Promise<MatterView | null> {
  if (syntheticModeEnabled()) {
    const matter = syntheticMatters.get(matterId);
    return matter?.ownerId === userId ? syntheticView(matter) : null;
  }

  const supabase = createAdminSupabaseClient();
  const [
    matterResult,
    openingResult,
    messageResult,
    blueprintResult,
    decisionResult,
    artifactResult,
  ] = await Promise.all([
    supabase
      .from("matters")
      .select("id,name,status,opening_confirmed_at,updated_at")
      .eq("id", matterId)
      .eq("owner_id", userId)
      .maybeSingle(),
    supabase
      .from("matter_openings")
      .select("record,workflow_state,updated_at")
      .eq("matter_id", matterId)
      .eq("owner_id", userId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id,role,step,content,created_at")
      .eq("matter_id", matterId)
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("blueprint_states")
      .select("state,updated_at")
      .eq("matter_id", matterId)
      .eq("owner_id", userId)
      .maybeSingle(),
    supabase
      .from("decision_records")
      .select("record")
      .eq("matter_id", matterId)
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("estate_blueprints")
      .select("id,status,document,frozen_at,generated_at,download_filename")
      .eq("matter_id", matterId)
      .eq("owner_id", userId)
      .maybeSingle(),
  ]);
  if (matterResult.error) throw matterResult.error;
  if (openingResult.error) throw openingResult.error;
  if (messageResult.error) throw messageResult.error;
  if (blueprintResult.error) throw blueprintResult.error;
  if (decisionResult.error) throw decisionResult.error;
  if (artifactResult.error) throw artifactResult.error;
  if (!matterResult.data || !openingResult.data) return null;

  const state = parseState(openingResult.data.workflow_state);
  const record = parseRecord(openingResult.data.record);
  const blueprintState = blueprintResult.data
    ? parseBlueprintState(blueprintResult.data.state)
    : null;
  const decisions = (decisionResult.data ?? []).map((decision) =>
    DecisionRecordSchema.parse(decision.record),
  );
  return {
    ...summary({
      id: matterResult.data.id,
      name: matterResult.data.name,
      status: matterResult.data.status as MatterStatus,
      state,
      blueprintState,
      openingConfirmedAt: matterResult.data.opening_confirmed_at,
      updatedAt: matterResult.data.updated_at,
    }),
    record,
    workflowState: state,
    messages: (messageResult.data ?? []).map((message) => ({
      id: message.id,
      role: message.role as MatterMessage["role"],
      step: message.step,
      content: message.content,
      createdAt: message.created_at,
    })),
    currentQuestion: getCanonicalQuestion(record, state),
    savedAt: blueprintResult.data?.updated_at ?? openingResult.data.updated_at,
    blueprintState,
    decisions,
    blueprint: artifactResult.data
      ? parseBlueprintArtifact(artifactResult.data)
      : null,
  };
}

async function getAcceptedBlueprintRetry(
  userId: string,
  matterId: string,
  turnKey: string,
) {
  if (syntheticModeEnabled()) {
    const matter = syntheticMatters.get(matterId);
    return matter?.ownerId === userId && matter.processedTurnKeys.has(turnKey)
      ? syntheticView(matter)
      : null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("matter_id", matterId)
    .eq("owner_id", userId)
    .eq("turn_key", turnKey)
    .eq("role", "student")
    .maybeSingle();
  if (error) throw error;
  return data ? getMatter(userId, matterId) : null;
}

export async function submitMatterTurn(input: {
  userId: string;
  matterId: string;
  turnKey: string;
  answer: string;
}) {
  if (syntheticModeEnabled()) {
    const matter = requireSyntheticMatter(input.userId, input.matterId);
    if (matter.processedTurnKeys.has(input.turnKey)) return syntheticView(matter);
    const expectedState = matter.state;
    const interpretation = await interpretMatterOpeningAnswer({
      question: getCanonicalQuestion(matter.record, expectedState),
      answer: input.answer,
      record: matter.record,
      state: expectedState,
    });
    const result = applyAcceptedInterpretation(
      matter.record,
      expectedState,
      interpretation,
    );
    const record = appendGeneratedResponse(
      result.record,
      generatedResponseMetadata(interpretation),
    );
    appendSyntheticMessage(matter, "student", expectedState.step, input.answer);
    appendSyntheticMessage(
      matter,
      "assistant",
      result.state.step,
      result.assistantMessage,
    );
    matter.record = record;
    matter.state = result.state;
    matter.status = result.state.step === "STOPPED" ? "stopped" : "matter_opening";
    matter.processedTurnKeys.add(input.turnKey);
    matter.updatedAt = new Date().toISOString();
    return syntheticView(matter);
  }

  const matter = await getMatter(input.userId, input.matterId);
  if (!matter) throw new Error("Matter not found.");
  const expectedState = matter.workflowState;
  const interpretation = await interpretMatterOpeningAnswer({
    question: matter.currentQuestion,
    answer: input.answer,
    record: matter.record,
    state: expectedState,
  });
  const result = applyAcceptedInterpretation(
    matter.record,
    expectedState,
    interpretation,
  );
  const record = appendGeneratedResponse(
    result.record,
    generatedResponseMetadata(interpretation),
  );
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("apply_matter_opening_turn", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_turn_key: input.turnKey,
    p_expected_workflow_state: expectedState,
    p_student_message: input.answer,
    p_assistant_message: result.assistantMessage,
    p_record: record,
    p_workflow_state: result.state,
  });
  if (error) throw error;
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after save.");
  return updated;
}

export async function correctPlanningSummary(input: {
  userId: string;
  matterId: string;
  turnKey: string;
  correction: string;
}) {
  if (syntheticModeEnabled()) {
    const matter = requireSyntheticMatter(input.userId, input.matterId);
    if (matter.processedTurnKeys.has(input.turnKey)) return syntheticView(matter);
    const correction = await interpretPlanningSummaryCorrection({
      correction: input.correction,
      activeQuestion: matter.state.clarification?.question ?? null,
      record: matter.record,
    });
    const result = applyPlanningSummaryCorrection(
      matter.record,
      matter.state,
      correction,
    );
    const record = appendGeneratedResponse(
      result.record,
      generatedResponseMetadata(correction),
    );
    appendSyntheticMessage(matter, "student", matter.state.step, input.correction);
    appendSyntheticMessage(
      matter,
      "assistant",
      result.state.step,
      result.assistantMessage,
    );
    matter.record = record;
    matter.state = result.state;
    if (result.changed) matter.revision += 1;
    matter.processedTurnKeys.add(input.turnKey);
    matter.updatedAt = new Date().toISOString();
    return syntheticView(matter);
  }

  const matter = await getMatter(input.userId, input.matterId);
  if (!matter) throw new Error("Matter not found.");
  const correction = await interpretPlanningSummaryCorrection({
    correction: input.correction,
    activeQuestion: matter.workflowState.clarification?.question ?? null,
    record: matter.record,
  });
  const result = applyPlanningSummaryCorrection(
    matter.record,
    matter.workflowState,
    correction,
  );
  const record = appendGeneratedResponse(
    result.record,
    generatedResponseMetadata(correction),
  );
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("correct_matter_opening_summary", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_turn_key: input.turnKey,
    p_expected_workflow_state: matter.workflowState,
    p_student_message: input.correction,
    p_assistant_message: result.assistantMessage,
    p_record: record,
    p_workflow_state: result.state,
    p_record_changed: result.changed,
  });
  if (error) throw error;
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after correction.");
  return updated;
}

export async function confirmMatterOpening(input: {
  userId: string;
  matterId: string;
}) {
  const matter = await getMatter(input.userId, input.matterId);
  if (!matter) throw new Error("Matter not found.");
  if (
    matter.workflowState.step === "BLUEPRINT_READY" &&
    matter.record.principal_confirmed === "yes"
  ) {
    return matter;
  }

  if (syntheticModeEnabled()) {
    const synthetic = requireSyntheticMatter(input.userId, input.matterId);
    const result = confirmOpening(synthetic.record, synthetic.state);
    synthetic.record = result.record;
    synthetic.state = result.state;
    synthetic.status = "blueprint_ready";
    synthetic.revision += 1;
    synthetic.openingConfirmedAt = result.record.confirmation_date;
    synthetic.updatedAt = result.record.confirmation_date;
    appendSyntheticMessage(
      synthetic,
      "assistant",
      result.state.step,
      result.assistantMessage,
    );
    return syntheticView(synthetic);
  }

  const result = confirmOpening(matter.record, matter.workflowState);
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("confirm_matter_opening", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_expected_workflow_state: matter.workflowState,
    p_record: result.record,
    p_workflow_state: result.state,
    p_confirmation_message: result.assistantMessage,
  });
  if (error) throw error;
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after confirmation.");
  return updated;
}

async function prepareBlueprintState(
  record: MatterOpeningRecord,
  state: BlueprintState,
  decisions: DecisionRecord[],
) {
  const evaluation = evaluateBlueprint(state, decisions);
  if (!evaluation.recommendationNeeded) return evaluation.state;
  const recommendation = await generateBlueprintRecommendation({
    domain: evaluation.recommendationNeeded,
    state: evaluation.state,
    openingRecord: record,
    decisions,
  });
  return presentRecommendation(
    evaluation.state,
    evaluation.recommendationNeeded,
    recommendation,
  );
}

export async function startBlueprint(input: {
  userId: string;
  matterId: string;
}) {
  const matter = await getMatter(input.userId, input.matterId);
  if (!matter) throw new Error("Matter not found.");
  if (
    matter.workflowState.step !== "BLUEPRINT_READY" ||
    matter.record.principal_confirmed !== "yes"
  ) {
    throw new Error("The confirmed Planning Summary is required before continuing.");
  }
  if (matter.blueprintState) return matter;

  if (syntheticModeEnabled()) {
    const synthetic = requireSyntheticMatter(input.userId, input.matterId);
    const initial = createInitialBlueprintState(
      synthetic.record,
      synthetic.blueprintSeed ?? undefined,
    );
    synthetic.blueprintState = await prepareBlueprintState(
      synthetic.record,
      initial,
      synthetic.decisions,
    );
    synthetic.status = "blueprint_in_progress";
    synthetic.updatedAt = new Date().toISOString();
    return syntheticView(synthetic);
  }

  const initial = createInitialBlueprintState(matter.record);
  const prepared = await prepareBlueprintState(matter.record, initial, []);
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("start_blueprint", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_state: prepared,
  });
  if (error) throw error;
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after Blueprint start.");
  return updated;
}

export async function submitBlueprintTurn(input: {
  userId: string;
  matterId: string;
  turnKey: string;
  answer: string;
}) {
  const acceptedRetry = await getAcceptedBlueprintRetry(
    input.userId,
    input.matterId,
    input.turnKey,
  );
  if (acceptedRetry) return acceptedRetry;

  const matter = await getMatter(input.userId, input.matterId);
  if (!matter?.blueprintState) {
    throw new Error("Planning Foundation is not ready.");
  }
  if (matter.blueprintState.stop) {
    throw new Error("Professional follow-up is required before continuing.");
  }

  const expectedState = matter.blueprintState;
  let nextState: BlueprintState;
  let assistantMessage: string;
  let decision: DecisionRecord | null = null;

  if (expectedState.interaction?.kind === "recommendation") {
    const response = await interpretRecommendationResponse({
      answer: input.answer,
      state: expectedState,
    });
    const applied = applyRecommendationResponse(expectedState, response);
    decision = applied.decision;
    if (decision) {
      nextState = await prepareBlueprintState(
        matter.record,
        applied.state,
        [...matter.decisions, decision],
      );
    } else {
      nextState = applied.state;
    }
    assistantMessage = applied.assistantMessage;
  } else if (expectedState.interaction?.kind === "question") {
    const interpretation = await interpretBlueprintAnswer({
      answer: input.answer,
      state: expectedState,
    });
    const applied = applyBlueprintAnswer(expectedState, interpretation);
    nextState =
      interpretation.outcome === "accepted"
        ? await prepareBlueprintState(
            matter.record,
            applied.state,
            matter.decisions,
          )
        : applied.state;
    assistantMessage = applied.assistantMessage;
  } else {
    throw new Error("There is no Blueprint response awaiting an answer.");
  }

  if (syntheticModeEnabled()) {
    const synthetic = requireSyntheticMatter(input.userId, input.matterId);
    appendSyntheticMessage(synthetic, "student", `BLUEPRINT_${expectedState.current_gate}`, input.answer);
    if (assistantMessage) {
      appendSyntheticMessage(
        synthetic,
        "assistant",
        `BLUEPRINT_${nextState.current_gate}`,
        assistantMessage,
      );
    }
    synthetic.blueprintState = nextState;
    if (nextState.stop) synthetic.status = "stopped";
    if (decision) synthetic.decisions.push(decision);
    synthetic.processedTurnKeys.add(input.turnKey);
    synthetic.updatedAt = new Date().toISOString();
    return syntheticView(synthetic);
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("apply_blueprint_turn", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_turn_key: input.turnKey,
    p_expected_state: expectedState,
    p_student_message: input.answer,
    p_assistant_message: assistantMessage || "Your response is saved.",
    p_state: nextState,
    p_decision: decision,
  });
  if (error) throw error;
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after Blueprint save.");
  return updated;
}

function unavailableEvidenceTreatment(): EvidenceTreatment {
  return {
    working_scenario:
      "Continue using the best-supported primary scenario from the confirmed planning information.",
    contingency:
      "Revise the treatment if the external arrangement shows materially different ownership, control, or transfer terms.",
    confirmation_dependency:
      "The relevant governing evidence and professional treatment still need to be confirmed.",
  };
}

function validateEvidenceFile(file: File) {
  if (file.type !== "application/pdf") {
    throw new Error("Please upload a text-readable PDF.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The PDF must be 10 MB or smaller.");
  }
}

export async function submitBlueprintEvidence(input: {
  userId: string;
  matterId: string;
  turnKey: string;
  file: File | null;
}) {
  const acceptedRetry = await getAcceptedBlueprintRetry(
    input.userId,
    input.matterId,
    input.turnKey,
  );
  if (acceptedRetry) return acceptedRetry;

  const matter = await getMatter(input.userId, input.matterId);
  if (!matter?.blueprintState) throw new Error("Planning Foundation is not ready.");
  if (matter.blueprintState.interaction?.kind !== "evidence") {
    throw new Error("The focused evidence checkpoint is not active.");
  }

  let treatment: EvidenceTreatment;
  let evidenceStatus: "processed" | "unavailable" = "unavailable";
  let bytes: Uint8Array | null = null;
  if (input.file) {
    validateEvidenceFile(input.file);
    bytes = new Uint8Array(await input.file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new Error("The selected file is not a valid PDF.");
    }
    const planningQuestion =
      matter.blueprintState.evidence.planning_question ??
      "Determine the stage-relevant planning treatment.";
    const relevantText = await extractStageRelevantEvidence(bytes, planningQuestion);
    if (relevantText) {
      treatment = await interpretBlueprintEvidence({
        filename: input.file.name,
        relevantText,
        planningQuestion,
      });
      evidenceStatus = "processed";
    } else {
      treatment = unavailableEvidenceTreatment();
    }
  } else {
    treatment = unavailableEvidenceTreatment();
  }

  const treated = applyEvidenceTreatment(matter.blueprintState, treatment);
  const nextState = await prepareBlueprintState(
    matter.record,
    treated,
    matter.decisions,
  );

  if (syntheticModeEnabled()) {
    const synthetic = requireSyntheticMatter(input.userId, input.matterId);
    synthetic.blueprintState = nextState;
    synthetic.evidence.push({
      id: randomUUID(),
      filename: input.file?.name ?? null,
      status: evidenceStatus,
    });
    synthetic.processedTurnKeys.add(input.turnKey);
    synthetic.updatedAt = new Date().toISOString();
    return syntheticView(synthetic);
  }

  const supabase = createAdminSupabaseClient();
  let storagePath: string | null = null;
  if (input.file && bytes) {
    storagePath = `${input.userId}/${input.matterId}/${randomUUID()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("blueprint-evidence")
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) throw uploadError;
  }
  const evidence = {
    id: randomUUID(),
    filename: input.file?.name ?? null,
    storage_path: storagePath,
    status: evidenceStatus,
    treatment,
  };
  const { error } = await supabase.rpc("apply_blueprint_evidence", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_turn_key: input.turnKey,
    p_expected_state: matter.blueprintState,
    p_state: nextState,
    p_evidence: evidence,
  });
  if (error) {
    if (storagePath) {
      await supabase.storage.from("blueprint-evidence").remove([storagePath]);
    }
    throw error;
  }
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after evidence save.");
  return updated;
}

export async function correctFinalReview(input: {
  userId: string;
  matterId: string;
  turnKey: string;
  correction: string;
}) {
  const acceptedRetry = await getAcceptedBlueprintRetry(
    input.userId,
    input.matterId,
    input.turnKey,
  );
  if (acceptedRetry) return acceptedRetry;

  const matter = await getMatter(input.userId, input.matterId);
  if (
    !matter?.blueprintState ||
    matter.blueprintState.interaction?.kind !== "final_review" ||
    !matter.blueprintState.final_review_profile
  ) {
    throw new Error("Final Review is not active.");
  }
  const expectedState = matter.blueprintState;
  const finalReviewProfile = expectedState.final_review_profile;
  if (!finalReviewProfile) throw new Error("Final Review is not active.");
  const interpreted = await interpretFinalReviewCorrection({
    correction: input.correction,
    profile: finalReviewProfile,
  });
  const stateWithGeneration = appendGeneratedResponse(
    expectedState,
    generatedResponseMetadata(interpreted),
  );
  const applied = applyFinalReviewCorrection(stateWithGeneration, interpreted);

  if (syntheticModeEnabled()) {
    const synthetic = requireSyntheticMatter(input.userId, input.matterId);
    synthetic.blueprintState = applied.state;
    appendSyntheticMessage(
      synthetic,
      "student",
      "BLUEPRINT_7_FINAL_REVIEW",
      input.correction,
    );
    appendSyntheticMessage(
      synthetic,
      "assistant",
      "BLUEPRINT_7_FINAL_REVIEW",
      applied.assistantMessage,
    );
    synthetic.processedTurnKeys.add(input.turnKey);
    synthetic.updatedAt = new Date().toISOString();
    return syntheticView(synthetic);
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("apply_final_review_correction", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_turn_key: input.turnKey,
    p_expected_state: expectedState,
    p_student_message: input.correction,
    p_assistant_message: applied.assistantMessage,
    p_state: applied.state,
  });
  if (error) throw error;
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after Final Review correction.");
  return updated;
}

function blueprintDownloadFilename() {
  return "Estate-Blueprint.pdf";
}

export async function finalizeBlueprint(input: {
  userId: string;
  matterId: string;
}) {
  const matter = await getMatter(input.userId, input.matterId);
  if (!matter?.blueprintState) throw new Error("Matter not found.");
  if (matter.blueprint?.status === "ready") return matter;

  if (syntheticModeEnabled()) {
    const synthetic = requireSyntheticMatter(input.userId, input.matterId);
    let artifact = synthetic.blueprint;
    if (!artifact) {
      const blueprintId = randomUUID();
      const frozenAt = new Date().toISOString();
      const frozen = freezeBlueprintGeneration(
        synthetic.blueprintState ?? matter.blueprintState,
        synthetic.decisions,
        {
          blueprintId,
          matterId: input.matterId,
          clientLabel: synthetic.name,
          frozenAt,
        },
      );
      synthetic.blueprintState = frozen.state;
      artifact = {
        id: blueprintId,
        status: "generating",
        document: buildBlueprintDocument(frozen.generationInput),
        generationInput: frozen.generationInput,
        frozenAt,
        generatedAt: null,
        downloadFilename: blueprintDownloadFilename(),
        pdfStoragePath: null,
        pdfBytes: null,
      };
      synthetic.blueprint = artifact;
    }

    const document = buildBlueprintDocument(artifact.generationInput);
    const pdfBytes = await renderBlueprintPdf(document);
    const generatedAt = new Date().toISOString();
    synthetic.blueprintState = publishBlueprint(
      synthetic.blueprintState ?? matter.blueprintState,
      artifact.id,
    );
    synthetic.blueprint = {
      ...artifact,
      status: "ready",
      document,
      pdfBytes,
      generatedAt,
    };
    synthetic.status = "blueprint_complete";
    synthetic.updatedAt = generatedAt;
    return syntheticView(synthetic);
  }

  const supabase = createAdminSupabaseClient();
  let generationState = matter.blueprintState;
  let generationInput: BlueprintGenerationInput;
  let blueprintId: string;
  let frozenAt: string;
  const downloadFilename = blueprintDownloadFilename();

  if (!matter.blueprint) {
    blueprintId = randomUUID();
    frozenAt = new Date().toISOString();
    const frozen = freezeBlueprintGeneration(
      matter.blueprintState,
      matter.decisions,
      {
        blueprintId,
        matterId: input.matterId,
        clientLabel: matter.name,
        frozenAt,
      },
    );
    generationState = frozen.state;
    generationInput = frozen.generationInput;
    const { error } = await supabase.rpc("freeze_estate_blueprint", {
      p_matter_id: input.matterId,
      p_owner_id: input.userId,
      p_blueprint_id: blueprintId,
      p_expected_state: matter.blueprintState,
      p_state: generationState,
      p_generation_input: generationInput,
      p_download_filename: downloadFilename,
      p_frozen_at: frozenAt,
    });
    if (error) throw error;
  } else {
    blueprintId = matter.blueprint.id;
    frozenAt = matter.blueprint.frozenAt;
    const { data, error } = await supabase
      .from("estate_blueprints")
      .select("generation_input")
      .eq("id", blueprintId)
      .eq("matter_id", input.matterId)
      .eq("owner_id", input.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The frozen Estate Blueprint input is missing.");
    generationInput = BlueprintGenerationInputSchema.parse(
      data.generation_input,
    );
  }

  const document = buildBlueprintDocument(generationInput);
  const pdfBytes = await renderBlueprintPdf(document);
  const storagePath = `${input.userId}/${input.matterId}/${blueprintId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("estate-blueprints")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) throw uploadError;
  const publishedState = publishBlueprint(generationState, blueprintId);
  const generatedAt = new Date().toISOString();
  const { error: completeError } = await supabase.rpc(
    "complete_estate_blueprint",
    {
      p_matter_id: input.matterId,
      p_owner_id: input.userId,
      p_blueprint_id: blueprintId,
      p_expected_state: generationState,
      p_state: publishedState,
      p_document: document,
      p_pdf_storage_path: storagePath,
      p_generated_at: generatedAt,
    },
  );
  if (completeError) throw completeError;
  const updated = await getMatter(input.userId, input.matterId);
  if (!updated) throw new Error("Matter not found after Blueprint generation.");
  return updated;
}

export async function getBlueprintPdf(input: {
  userId: string;
  matterId: string;
}) {
  const matter = await getMatter(input.userId, input.matterId);
  if (!matter) throw new Error("Matter not found.");
  if (!matter.blueprint || matter.blueprint.status !== "ready") {
    throw new Error("The Estate Blueprint PDF is not ready.");
  }

  if (syntheticModeEnabled()) {
    const artifact = requireSyntheticMatter(
      input.userId,
      input.matterId,
    ).blueprint;
    if (!artifact?.pdfBytes) {
      throw new Error("The Estate Blueprint PDF is not ready.");
    }
    return {
      bytes: artifact.pdfBytes,
      filename: artifact.downloadFilename,
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("estate_blueprints")
    .select("pdf_storage_path,download_filename")
    .eq("id", matter.blueprint.id)
    .eq("matter_id", input.matterId)
    .eq("owner_id", input.userId)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw error;
  if (!data?.pdf_storage_path) {
    throw new Error("The Estate Blueprint PDF is not ready.");
  }
  const { data: pdf, error: downloadError } = await supabase.storage
    .from("estate-blueprints")
    .download(data.pdf_storage_path);
  if (downloadError) throw downloadError;
  return {
    bytes: new Uint8Array(await pdf.arrayBuffer()),
    filename: data.download_filename,
  };
}

export async function seedSyntheticBlueprintScenario(input: {
  userId: string;
  scenario: "zero_turn" | "incomplete" | "triggered";
}) {
  if (!syntheticModeEnabled()) throw new Error("Not found.");
  const existing = [...syntheticMatters.values()].find(
    (matter) => matter.ownerId === input.userId,
  );
  if (existing) syntheticMatters.delete(existing.id);
  const id = randomUUID();
  const now = new Date().toISOString();
  const record: MatterOpeningRecord = {
    ...createInitialRecord(id),
    matter_status: "BLUEPRINT_READY",
    desired_outcomes: [
      "intended_transfer",
      "incapacity_readiness",
      "asset_protection",
    ],
    top_three_priorities: [
      "intended_transfer",
      "incapacity_readiness",
      "asset_protection",
    ],
    principal_definition_of_success:
      "Protect the family and keep essential responsibilities moving.",
    priority_details: [
      { outcome: "intended_transfer", detail: "Benefit the spouse and children." },
      {
        outcome: "incapacity_readiness",
        detail: "Keep household and investment decisions moving.",
      },
      {
        outcome: "asset_protection",
        detail: "Protect children from creditor and marital claims.",
      },
    ],
    people_and_interests_snapshot: "Spouse and two adult children.",
    people_circumstance_flags: ["creditor and marital-claim protection"],
    current_plan_status: "update_needed",
    current_plan_snapshot: "Living trust and will completed in 2018.",
    changes_since_current_plan: ["Moved primary residence to Florida."],
    timing_event_or_deadline: {
      reason: "The plan is overdue for review.",
      event: "none identified",
      date: "none identified",
      importance: "normal",
    },
    geographic_and_complexity_flags:
      input.scenario === "triggered"
        ? ["Florida home", "material expected inheritance through a third-party trust"]
        : ["Florida home", "family business"],
    professional_and_family_contacts: [
      {
        name: "Jordan Lee",
        firm: "Harbor Counsel",
        expertise: "estate planning",
        estate_role: "planning counsel",
        email: "contact@harborcounsel.com",
        telephone: "555-555-1111",
        contact_trigger: "planning update",
        priority: "primary",
        missing_information: [],
      },
    ],
    other_participants: [
      {
        name: "Spouse",
        relationship: "family",
        intended_role: "participate in planning",
        involvement_timing: "now and during future reviews",
      },
    ],
    house_in_order_concern: "A clear plan and confirmed professional roles.",
    principal_confirmed: "yes",
    confirmation_date: now,
  };
  const completeBaseline: Partial<PlanningBaseline> = {
    material_assets_range: "$8 million to $10 million",
    liabilities_range: "$500,000 to $750,000",
    expected_inheritance_range:
      input.scenario === "triggered" ? "$2 million to $3 million" : "none expected",
    lifetime_security_floor: "$5 million",
    assets_counted_toward_floor: "liquid investments and primary residence",
    retained_control_requirement: "retain the home and liquid investments",
    extraordinary_future_obligations: "education support for grandchildren",
  };
  syntheticMatters.set(id, {
    id,
    ownerId: input.userId,
    name: "My Estate Plan",
    status: "blueprint_ready",
    record,
    state: { step: "BLUEPRINT_READY", clarification: null, stop: null },
    revision: 1,
    messages: [],
    processedTurnKeys: new Set(),
    openingConfirmedAt: now,
    updatedAt: now,
    blueprintState: null,
    decisions: [],
    evidence: [],
    blueprintSeed: {
      planningBaseline:
        input.scenario === "incomplete" ? undefined : completeBaseline,
      beneficiaryOutcomes: {
        intended_beneficiaries: "spouse and two adult children",
        substitute_beneficiaries: "descendants of a deceased child",
        relative_treatment: "equal treatment for the children",
        protection_needs: "creditor and marital-claim protection",
        stewardship_objectives: "increasing participation based on readiness",
        special_treatment: "family-business interests need coordinated management",
      },
    },
    blueprint: null,
  });
  return id;
}

export function resetSyntheticStoreForTests() {
  syntheticProfiles.clear();
  syntheticMatters.clear();
}
