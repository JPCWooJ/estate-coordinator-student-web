import "server-only";

import {
  createInitialRecord,
  createInitialWorkflowState,
  MatterOpeningRecord,
  MatterOpeningRecordSchema,
  OpeningStepSchema,
  WorkflowState,
  WorkflowStateSchema,
  WORKFLOW_VERSION,
} from "@/lib/domain/matter-opening";
import {
  applyAcceptedInterpretation,
  confirmOpening,
  getCanonicalQuestion,
  getProgress,
  getStepLabel,
  prepareMatterOpeningForConfirmation,
} from "@/lib/domain/workflow";
import { interpretMatterOpeningTurn } from "./interpreter";
import { createAdminSupabaseClient, createUserSupabaseClient } from "./supabase";
import { syntheticModeEnabled } from "./auth";

export type MatterSummary = {
  id: string;
  name: string;
  status: string;
  currentStep: string;
  stepLabel: string;
  progress: number;
  updatedAt: string;
  openingConfirmedAt: string | null;
};

export type PublicMessage = {
  id: string;
  turnKey: string;
  role: "student" | "assistant";
  step: string;
  content: string;
  createdAt: string;
};

export type MatterView = MatterSummary & {
  record: MatterOpeningRecord;
  workflowState: WorkflowState;
  messages: PublicMessage[];
  currentQuestion: string;
  savedAt: string;
};

type SyntheticMatter = {
  id: string;
  ownerId: string;
  name: string;
  status: string;
  record: MatterOpeningRecord;
  state: WorkflowState;
  messages: PublicMessage[];
  updatedAt: string;
  confirmedAt: string | null;
  revision: number;
};

type SyntheticStore = {
  acknowledgedUsers: Set<string>;
  matters: Map<string, SyntheticMatter>;
};

declare global {
  var __ecSyntheticStore: SyntheticStore | undefined;
}

function syntheticStore(): SyntheticStore {
  if (!globalThis.__ecSyntheticStore) {
    globalThis.__ecSyntheticStore = {
      acknowledgedUsers: new Set<string>(),
      matters: new Map<string, SyntheticMatter>(),
    };
  }
  return globalThis.__ecSyntheticStore;
}

export function resetSyntheticStoreForTests() {
  if (!syntheticModeEnabled()) throw new Error("Not found.");
  globalThis.__ecSyntheticStore = {
    acknowledgedUsers: new Set<string>(),
    matters: new Map<string, SyntheticMatter>(),
  };
}

function summarize(matter: SyntheticMatter): MatterSummary {
  return {
    id: matter.id,
    name: matter.name,
    status: matter.status,
    currentStep: matter.state.step,
    stepLabel: getStepLabel(matter.state.step),
    progress: getProgress(matter.state.step),
    updatedAt: matter.updatedAt,
    openingConfirmedAt: matter.confirmedAt,
  };
}

function viewSynthetic(matter: SyntheticMatter): MatterView {
  const record =
    matter.state.step === "MO08_CONFIRM"
      ? prepareMatterOpeningForConfirmation(matter.record)
      : matter.record;
  return {
    ...summarize(matter),
    record,
    workflowState: matter.state,
    messages: matter.messages,
    currentQuestion: getCanonicalQuestion(matter.state, record),
    savedAt: matter.updatedAt,
  };
}

export async function betaAcknowledged(userId: string): Promise<boolean> {
  if (syntheticModeEnabled()) {
    return syntheticStore().acknowledgedUsers.has(userId);
  }
  const supabase = await createUserSupabaseClient();
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
    syntheticStore().acknowledgedUsers.add(userId);
    return acknowledgedAt;
  }
  const supabase = await createUserSupabaseClient();
  const { error } = await supabase.from("student_profiles").upsert({
    user_id: userId,
    beta_acknowledged_at: acknowledgedAt,
    beta_notice_version: "0.1",
  });
  if (error) throw error;
  return acknowledgedAt;
}

export async function listMatters(userId: string): Promise<MatterSummary[]> {
  if (syntheticModeEnabled()) {
    return Array.from(syntheticStore().matters.values())
      .filter((matter) => matter.ownerId === userId)
      .map(summarize)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const supabase = await createUserSupabaseClient();
  const { data, error } = await supabase
    .from("matters")
    .select(
      "id,name,status,current_step,progress,updated_at,opening_confirmed_at",
    )
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((matter) => ({
    id: matter.id,
    name: matter.name,
    status: matter.status,
    currentStep: matter.current_step,
    stepLabel: getStepLabel(OpeningStepSchema.parse(matter.current_step)),
    progress: Number(matter.progress),
    updatedAt: matter.updated_at,
    openingConfirmedAt: matter.opening_confirmed_at,
  }));
}

export async function createMatter(userId: string): Promise<string> {
  if (syntheticModeEnabled()) {
    const existing = Array.from(syntheticStore().matters.values()).find(
      (matter) => matter.ownerId === userId,
    );
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    syntheticStore().matters.set(id, {
      id,
      ownerId: userId,
      name: "Estate Planning Matter",
      status: "matter_opening",
      record: createInitialRecord(id, now),
      state: createInitialWorkflowState(),
      messages: [],
      updatedAt: now,
      confirmedAt: null,
      revision: 0,
    });
    return id;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("create_slice1_matter", {
    p_owner_id: userId,
    p_name: "Estate Planning Matter",
    p_workflow_version: WORKFLOW_VERSION,
  });
  if (error) throw error;
  return String(data);
}

export async function getMatter(
  userId: string,
  matterId: string,
): Promise<MatterView | null> {
  if (syntheticModeEnabled()) {
    const matter = syntheticStore().matters.get(matterId);
    if (!matter || matter.ownerId !== userId) return null;
    return viewSynthetic(matter);
  }

  const supabase = await createUserSupabaseClient();
  const { data: matter, error: matterError } = await supabase
    .from("matters")
    .select(
      "id,name,status,current_step,progress,updated_at,opening_confirmed_at",
    )
    .eq("id", matterId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (matterError) throw matterError;
  if (!matter) return null;

  const [{ data: opening, error: openingError }, { data: messages, error: messageError }] =
    await Promise.all([
      supabase
        .from("matter_openings")
        .select("record,workflow_state,updated_at")
        .eq("matter_id", matterId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id,turn_key,role,step,content,created_at")
        .eq("matter_id", matterId)
        .order("created_at", { ascending: true }),
    ]);
  if (openingError) throw openingError;
  if (messageError) throw messageError;
  if (!opening) return null;

  const storedRecord = MatterOpeningRecordSchema.parse(opening.record);
  const state = WorkflowStateSchema.parse(opening.workflow_state);
  const record =
    state.step === "MO08_CONFIRM"
      ? prepareMatterOpeningForConfirmation(storedRecord)
      : storedRecord;
  return {
    id: matter.id,
    name: matter.name,
    status: matter.status,
    currentStep: matter.current_step,
    stepLabel: getStepLabel(state.step),
    progress: Number(matter.progress),
    updatedAt: matter.updated_at,
    openingConfirmedAt: matter.opening_confirmed_at,
    record,
    workflowState: state,
    messages: (messages ?? []).map((message) => ({
      id: message.id,
      turnKey: message.turn_key,
      role: message.role,
      step: message.step,
      content: message.content,
      createdAt: message.created_at,
    })),
    currentQuestion: getCanonicalQuestion(state, record),
    savedAt: opening.updated_at,
  };
}

export async function submitMatterTurn(args: {
  userId: string;
  matterId: string;
  turnKey: string;
  answer: string;
}): Promise<MatterView> {
  const current = await getMatter(args.userId, args.matterId);
  if (!current) throw new Error("Matter not found.");
  if (["STOPPED", "CONFIRMED"].includes(current.workflowState.step)) {
    throw new Error("This Matter Opening is not accepting additional turns.");
  }
  if (
    current.messages.some(
      (message) => message.turnKey === args.turnKey && message.role === "student",
    )
  ) {
    return current;
  }

  const interpretation = await interpretMatterOpeningTurn({
    step: current.workflowState.step,
    answer: args.answer,
    record: current.record,
    state: current.workflowState,
  });
  const result = applyAcceptedInterpretation(
    current.record,
    current.workflowState,
    interpretation,
  );
  const now = new Date().toISOString();

  if (syntheticModeEnabled()) {
    const matter = syntheticStore().matters.get(args.matterId);
    if (!matter || matter.ownerId !== args.userId) throw new Error("Matter not found.");
    matter.messages.push(
      {
        id: crypto.randomUUID(),
        turnKey: args.turnKey,
        role: "student",
        step: current.workflowState.step,
        content: args.answer,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        turnKey: args.turnKey,
        role: "assistant",
        step: result.state.step,
        content: result.assistantMessage,
        createdAt: now,
      },
    );
    matter.record = result.record;
    matter.state = result.state;
    matter.status = result.state.step === "STOPPED" ? "stopped" : "matter_opening";
    matter.updatedAt = now;
    if (current.workflowState.step === "MO08_CONFIRM") matter.revision += 1;
    return viewSynthetic(matter);
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("apply_matter_opening_turn", {
    p_matter_id: args.matterId,
    p_owner_id: args.userId,
    p_turn_key: args.turnKey,
    p_expected_step: current.workflowState.step,
    p_student_message: args.answer,
    p_assistant_message: result.assistantMessage,
    p_record: result.record,
    p_workflow_state: result.state,
    p_progress: getProgress(result.state.step),
  });
  if (error) throw error;
  const updated = await getMatter(args.userId, args.matterId);
  if (!updated) throw new Error("The saved matter could not be reloaded.");
  return updated;
}

export async function confirmMatterOpening(args: {
  userId: string;
  matterId: string;
}): Promise<MatterView> {
  const current = await getMatter(args.userId, args.matterId);
  if (!current) throw new Error("Matter not found.");
  const result = confirmOpening(current.record, current.workflowState);
  const now = result.record.confirmation_date;

  if (syntheticModeEnabled()) {
    const matter = syntheticStore().matters.get(args.matterId);
    if (!matter || matter.ownerId !== args.userId) throw new Error("Matter not found.");
    matter.record = result.record;
    matter.state = result.state;
    matter.status = "opening_confirmed";
    matter.confirmedAt = now;
    matter.updatedAt = now;
    matter.revision += 1;
    matter.messages.push({
      id: crypto.randomUUID(),
      turnKey: crypto.randomUUID(),
      role: "assistant",
      step: "CONFIRMED",
      content: result.assistantMessage,
      createdAt: now,
    });
    return viewSynthetic(matter);
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("confirm_matter_opening", {
    p_matter_id: args.matterId,
    p_owner_id: args.userId,
    p_record: result.record,
    p_workflow_state: result.state,
    p_confirmation_message: result.assistantMessage,
  });
  if (error) throw error;
  const updated = await getMatter(args.userId, args.matterId);
  if (!updated) throw new Error("The confirmed matter could not be reloaded.");
  return updated;
}
