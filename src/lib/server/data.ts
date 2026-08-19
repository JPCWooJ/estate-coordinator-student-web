import "server-only";

import { randomUUID } from "node:crypto";

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
  getProgress,
  getStepLabel,
} from "@/lib/domain/workflow";
import { syntheticModeEnabled } from "./auth";
import {
  interpretMatterOpeningAnswer,
  interpretPlanningSummaryCorrection,
} from "./interpreter";
import { createAdminSupabaseClient } from "./supabase";

type MatterStatus = "matter_opening" | "stopped" | "blueprint_ready";

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
};

const syntheticProfiles = new Set<string>();
const syntheticMatters = new Map<string, SyntheticMatter>();

function parseRecord(value: unknown) {
  return MatterOpeningRecordSchema.parse(value);
}

function parseState(value: unknown) {
  return WorkflowStateSchema.parse(value);
}

function summary(input: {
  id: string;
  name: string;
  status: MatterStatus;
  state: WorkflowState;
  openingConfirmedAt: string | null;
  updatedAt: string;
}): MatterSummary {
  return {
    id: input.id,
    name: input.name,
    status: input.status,
    currentStep: input.state.step,
    stepLabel: getStepLabel(input.state.step),
    progress: getProgress(input.state.step),
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
      openingConfirmedAt: matter.openingConfirmedAt,
      updatedAt: matter.updatedAt,
    }),
    record: matter.record,
    workflowState: matter.state,
    messages: matter.messages,
    currentQuestion: getCanonicalQuestion(matter.record, matter.state),
    savedAt: matter.updatedAt,
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

  const { data: openings, error: openingError } = await supabase
    .from("matter_openings")
    .select("matter_id,workflow_state")
    .eq("owner_id", userId)
    .in(
      "matter_id",
      matters.map((matter) => matter.id),
    );
  if (openingError) throw openingError;
  const states = new Map(
    (openings ?? []).map((opening) => [
      opening.matter_id,
      parseState(opening.workflow_state),
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
  const [matterResult, openingResult, messageResult] = await Promise.all([
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
  ]);
  if (matterResult.error) throw matterResult.error;
  if (openingResult.error) throw openingResult.error;
  if (messageResult.error) throw messageResult.error;
  if (!matterResult.data || !openingResult.data) return null;

  const state = parseState(openingResult.data.workflow_state);
  const record = parseRecord(openingResult.data.record);
  return {
    ...summary({
      id: matterResult.data.id,
      name: matterResult.data.name,
      status: matterResult.data.status as MatterStatus,
      state,
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
    savedAt: openingResult.data.updated_at,
  };
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
    appendSyntheticMessage(matter, "student", expectedState.step, input.answer);
    appendSyntheticMessage(
      matter,
      "assistant",
      result.state.step,
      result.assistantMessage,
    );
    matter.record = result.record;
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
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("apply_matter_opening_turn", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_turn_key: input.turnKey,
    p_expected_workflow_state: expectedState,
    p_student_message: input.answer,
    p_assistant_message: result.assistantMessage,
    p_record: result.record,
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
    appendSyntheticMessage(matter, "student", matter.state.step, input.correction);
    appendSyntheticMessage(
      matter,
      "assistant",
      result.state.step,
      result.assistantMessage,
    );
    matter.record = result.record;
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
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("correct_matter_opening_summary", {
    p_matter_id: input.matterId,
    p_owner_id: input.userId,
    p_turn_key: input.turnKey,
    p_expected_workflow_state: matter.workflowState,
    p_student_message: input.correction,
    p_assistant_message: result.assistantMessage,
    p_record: result.record,
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
  if (syntheticModeEnabled()) {
    const matter = requireSyntheticMatter(input.userId, input.matterId);
    const result = confirmOpening(matter.record, matter.state);
    matter.record = result.record;
    matter.state = result.state;
    matter.status = "blueprint_ready";
    matter.revision += 1;
    matter.openingConfirmedAt = result.record.confirmation_date;
    matter.updatedAt = result.record.confirmation_date;
    appendSyntheticMessage(
      matter,
      "assistant",
      result.state.step,
      result.assistantMessage,
    );
    return syntheticView(matter);
  }

  const matter = await getMatter(input.userId, input.matterId);
  if (!matter) throw new Error("Matter not found.");
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

export function resetSyntheticStoreForTests() {
  syntheticProfiles.clear();
  syntheticMatters.clear();
}
