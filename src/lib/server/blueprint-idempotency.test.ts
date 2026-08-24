import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postBlueprintEvidence } from "@/app/api/matters/[id]/blueprint/evidence/route";
import { POST as postBlueprintStart } from "@/app/api/matters/[id]/blueprint/start/route";
import { POST as postBlueprintTurn } from "@/app/api/matters/[id]/blueprint/turns/route";
import { POST as postMatterConfirmation } from "@/app/api/matters/[id]/confirm/route";
import {
  BlueprintState,
  BlueprintStateSchema,
  createInitialBlueprintState,
  DecisionRecord,
  DecisionRecordSchema,
  evaluateBlueprint,
  presentRecommendation,
  RecommendationContent,
} from "@/lib/domain/blueprint";
import {
  createInitialRecord,
  MatterOpeningRecord,
} from "@/lib/domain/matter-opening";
import {
  resetSyntheticStoreForTests,
  seedSyntheticBlueprintScenario,
} from "@/lib/server/data";

const mocks = vi.hoisted(() => ({
  createAdminSupabaseClient: vi.fn(),
  extractStageRelevantEvidence: vi.fn(),
  generateBlueprintRecommendation: vi.fn(),
  getCurrentUser: vi.fn(),
  interpretBlueprintAnswer: vi.fn(),
  interpretBlueprintEvidence: vi.fn(),
  interpretMatterOpeningAnswer: vi.fn(),
  interpretPlanningSummaryCorrection: vi.fn(),
  interpretRecommendationResponse: vi.fn(),
  syntheticModeEnabled: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
  syntheticModeEnabled: mocks.syntheticModeEnabled,
}));
vi.mock("@/lib/server/evidence", () => ({
  extractStageRelevantEvidence: mocks.extractStageRelevantEvidence,
}));
vi.mock("@/lib/server/interpreter", () => ({
  generateBlueprintRecommendation: mocks.generateBlueprintRecommendation,
  interpretBlueprintAnswer: mocks.interpretBlueprintAnswer,
  interpretBlueprintEvidence: mocks.interpretBlueprintEvidence,
  interpretMatterOpeningAnswer: mocks.interpretMatterOpeningAnswer,
  interpretPlanningSummaryCorrection: mocks.interpretPlanningSummaryCorrection,
  interpretRecommendationResponse: mocks.interpretRecommendationResponse,
}));
vi.mock("@/lib/server/supabase", () => ({
  createAdminSupabaseClient: mocks.createAdminSupabaseClient,
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const MATTER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TURN_KEY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEW_TURN_KEY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = "2026-08-22T12:00:00.000Z";

const completeBaseline = {
  material_assets_range: "$8 million to $10 million",
  liabilities_range: "$500,000 to $750,000",
  expected_inheritance_range: "none expected",
  lifetime_security_floor: "$5 million",
  assets_counted_toward_floor: "liquid investments and primary residence",
  retained_control_requirement: "retain the home and liquid investments",
  extraordinary_future_obligations: "education support for grandchildren",
};

const completeBeneficiary = {
  intended_beneficiaries: "spouse and two adult children",
  substitute_beneficiaries: "descendants of a deceased child",
  relative_treatment: "equal treatment for the children",
  protection_needs: "creditor and marital-claim protection",
  stewardship_objectives: "increasing participation based on readiness",
  special_treatment: "family-business interests need coordinated management",
};

const recommendation: RecommendationContent = {
  objective: "Protect beneficiaries",
  starting_point: "Use a separate continuing trust for each child.",
  rationale: "This preserves access while adding protection.",
  alternative_or_tradeoff: "Outright distributions are simpler but less protective.",
  open_confirmation: "Counsel should confirm the final provisions.",
  response_question: "Does this fit your objectives?",
};

type StoredMessage = {
  id: string;
  matter_id: string;
  owner_id: string;
  turn_key: string;
  role: "student" | "assistant";
  step: string;
  content: string;
  created_at: string;
};

type QueryFilter = readonly [column: string, value: unknown];

class FakeQuery {
  private readonly filters: QueryFilter[] = [];

  constructor(
    private readonly database: FakeDatabase,
    private readonly table: string,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  maybeSingle() {
    const rows = this.database.rows(this.table, this.filters);
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  order() {
    return Promise.resolve({
      data: this.database.rows(this.table, this.filters),
      error: null,
    });
  }
}

class FakeDatabase {
  readonly analyticsEvents: string[] = [];
  readonly decisions: DecisionRecord[] = [];
  readonly evidenceRecords: Array<Record<string, unknown>> = [];
  readonly messages: StoredMessage[] = [];
  readonly removedStoragePaths: string[] = [];
  readonly rpcCalls: string[] = [];
  readonly uploadedStoragePaths: string[] = [];
  advanceBeforeNextTurnRpc = false;

  readonly client = {
    from: (table: string) => new FakeQuery(this, table),
    rpc: (name: string, args: Record<string, unknown>) => this.rpc(name, args),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          this.uploadedStoragePaths.push(path);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          this.removedStoragePaths.push(...paths);
          return { error: null };
        },
      }),
    },
  };

  constructor(
    readonly record: MatterOpeningRecord,
    public blueprintState: BlueprintState,
  ) {}

  rows(table: string, filters: QueryFilter[]) {
    let rows: Array<Record<string, unknown>>;
    if (table === "matters") {
      rows = [
        {
          id: MATTER_ID,
          owner_id: USER_ID,
          name: "My Estate Plan",
          status: "blueprint_in_progress",
          opening_confirmed_at: NOW,
          updated_at: NOW,
        },
      ];
    } else if (table === "matter_openings") {
      rows = [
        {
          matter_id: MATTER_ID,
          owner_id: USER_ID,
          record: this.record,
          workflow_state: {
            step: "BLUEPRINT_READY",
            clarification: null,
            stop: null,
          },
          updated_at: NOW,
        },
      ];
    } else if (table === "messages") {
      rows = this.messages.map((message) => ({ ...message }));
    } else if (table === "blueprint_states") {
      rows = [
        {
          matter_id: MATTER_ID,
          owner_id: USER_ID,
          state: this.blueprintState,
          updated_at: NOW,
        },
      ];
    } else if (table === "decision_records") {
      rows = this.decisions.map((decision, index) => ({
        matter_id: MATTER_ID,
        owner_id: USER_ID,
        created_at: `${NOW}-${index}`,
        record: decision,
      }));
    } else {
      rows = [];
    }

    return rows.filter((row) =>
      filters.every(([column, value]) => row[column] === value),
    );
  }

  private async rpc(name: string, args: Record<string, unknown>) {
    this.rpcCalls.push(name);
    const turnKey = String(args.p_turn_key);
    if (
      String(args.p_matter_id) !== MATTER_ID ||
      String(args.p_owner_id) !== USER_ID
    ) {
      return { data: null, error: new Error("matter not found") };
    }
    if (
      this.messages.some(
        (message) => message.turn_key === turnKey && message.role === "student",
      )
    ) {
      return { data: true, error: null };
    }

    if (name === "apply_blueprint_turn" && this.advanceBeforeNextTurnRpc) {
      this.blueprintState = {
        ...this.blueprintState,
        revision: this.blueprintState.revision + 1,
      };
      this.advanceBeforeNextTurnRpc = false;
    }

    const expectedState = BlueprintStateSchema.parse(args.p_expected_state);
    if (JSON.stringify(this.blueprintState) !== JSON.stringify(expectedState)) {
      return { data: null, error: new Error("stale blueprint state") };
    }

    const nextState = BlueprintStateSchema.parse(args.p_state);
    if (name === "apply_blueprint_turn") {
      this.appendMessages(
        turnKey,
        String(args.p_student_message),
        String(args.p_assistant_message),
        this.blueprintState.current_gate,
        nextState.current_gate,
      );
      if (args.p_decision) {
        const decision = DecisionRecordSchema.parse(args.p_decision);
        const existing = this.decisions.findIndex(
          (record) => record.decision_id === decision.decision_id,
        );
        if (existing === -1) this.decisions.push(decision);
        else this.decisions[existing] = decision;
      }
      this.analyticsEvents.push("blueprint_turn_completed");
    } else if (name === "apply_blueprint_evidence") {
      if (this.blueprintState.interaction?.kind !== "evidence") {
        return {
          data: null,
          error: new Error("focused evidence checkpoint is not active"),
        };
      }
      this.evidenceRecords.push({
        ...(args.p_evidence as Record<string, unknown>),
      });
      this.appendMessages(
        turnKey,
        "Relevant evidence provided.",
        "The focused evidence treatment is saved.",
        3,
        nextState.current_gate,
      );
      this.analyticsEvents.push("evidence_checkpoint_completed");
    } else {
      return { data: null, error: new Error(`Unexpected RPC: ${name}`) };
    }

    this.blueprintState = nextState;
    return { data: true, error: null };
  }

  private appendMessages(
    turnKey: string,
    studentContent: string,
    assistantContent: string,
    studentGate: number,
    assistantGate: number,
  ) {
    const createdAt = `${NOW}-${this.messages.length}`;
    this.messages.push(
      {
        id: `message-${this.messages.length + 1}`,
        matter_id: MATTER_ID,
        owner_id: USER_ID,
        turn_key: turnKey,
        role: "student",
        step: `BLUEPRINT_${studentGate}`,
        content: studentContent,
        created_at: createdAt,
      },
      {
        id: `message-${this.messages.length + 2}`,
        matter_id: MATTER_ID,
        owner_id: USER_ID,
        turn_key: turnKey,
        role: "assistant",
        step: `BLUEPRINT_${assistantGate}`,
        content: assistantContent,
        created_at: createdAt,
      },
    );
  }
}

function confirmedOpening(
  geographicAndComplexityFlags = ["Florida home", "family business"],
): MatterOpeningRecord {
  return {
    ...createInitialRecord(MATTER_ID),
    matter_status: "BLUEPRINT_READY",
    desired_outcomes: ["intended_transfer", "incapacity_readiness"],
    top_three_priorities: [
      "intended_transfer",
      "incapacity_readiness",
      "asset_protection",
    ],
    principal_definition_of_success:
      "Protect the family and preserve continuity.",
    priority_details: [
      {
        outcome: "incapacity_readiness",
        detail: "Keep household and investment decisions moving.",
      },
    ],
    people_and_interests_snapshot: "Spouse and two adult children.",
    people_circumstance_flags: ["creditor and marital-claim protection"],
    geographic_and_complexity_flags: geographicAndComplexityFlags,
    principal_confirmed: "yes",
    confirmation_date: NOW,
  };
}

function beneficiaryRecommendationState(record: MatterOpeningRecord) {
  const evaluated = evaluateBlueprint(
    createInitialBlueprintState(record, {
      planningBaseline: completeBaseline,
      beneficiaryOutcomes: completeBeneficiary,
    }),
    [],
  );
  return presentRecommendation(
    evaluated.state,
    "beneficiary",
    recommendation,
  );
}

function focusedEvidenceState(record: MatterOpeningRecord) {
  return evaluateBlueprint(
    createInitialBlueprintState(record, {
      planningBaseline: {
        ...completeBaseline,
        expected_inheritance_range:
          "$2 million to $3 million through a third-party trust",
      },
      beneficiaryOutcomes: completeBeneficiary,
    }),
    [],
  ).state;
}

function turnRequest(turnKey: string, answer: string) {
  return new Request(`http://localhost/api/matters/${MATTER_ID}/blueprint/turns`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost",
      origin: "http://localhost",
    },
    body: JSON.stringify({ turnKey, answer }),
  });
}

function evidenceRequest(turnKey: string) {
  const form = new FormData();
  form.set("turnKey", turnKey);
  form.set(
    "file",
    new File(["%PDF-1.7 focused trust terms"], "third-party-trust.pdf", {
      type: "application/pdf",
    }),
  );
  return new Request(
    `http://localhost/api/matters/${MATTER_ID}/blueprint/evidence`,
    {
      method: "POST",
      headers: { host: "localhost", origin: "http://localhost" },
      body: form,
    },
  );
}

function postRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { host: "localhost", origin: "http://localhost" },
  });
}

const routeContext = { params: Promise.resolve({ id: MATTER_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  resetSyntheticStoreForTests();
  mocks.syntheticModeEnabled.mockReturnValue(false);
  mocks.getCurrentUser.mockResolvedValue({
    id: USER_ID,
    email: "student-a@example.test",
  });
  mocks.interpretRecommendationResponse.mockResolvedValue({
    outcome: "accepted",
    acknowledgement: "The decision is saved.",
    clarification_question: null,
    disposition: "accept",
    modification: null,
    open_confirmation: null,
    stop: null,
  });
  mocks.interpretBlueprintAnswer.mockResolvedValue({
    outcome: "clarification",
    acknowledgement: "",
    clarification_question: "Please clarify that outcome.",
    patch: {
      planning_baseline: null,
      beneficiary_outcomes: null,
      fiduciary_continuity_outcomes: null,
    },
    stop: null,
  });
  mocks.extractStageRelevantEvidence.mockResolvedValue(
    "The beneficiary has no unilateral withdrawal power.",
  );
  mocks.interpretBlueprintEvidence.mockResolvedValue({
    working_scenario: "Treat the interest as a continuing third-party trust.",
    contingency: "Revise if the governing terms differ.",
    confirmation_dependency: "Counsel must confirm the governing terms.",
  });
  mocks.generateBlueprintRecommendation.mockResolvedValue(recommendation);
});

describe("Blueprint server/API idempotency", () => {
  it("continues after a committed confirmation when the first Blueprint start fails", async () => {
    mocks.syntheticModeEnabled.mockReturnValue(true);
    const matterId = await seedSyntheticBlueprintScenario({
      userId: USER_ID,
      scenario: "zero_turn",
    });
    const context = { params: Promise.resolve({ id: matterId }) };
    mocks.generateBlueprintRecommendation.mockRejectedValueOnce(
      new Error("transient Blueprint start failure"),
    );

    const failedStart = await postBlueprintStart(
      postRequest(`/api/matters/${matterId}/blueprint/start`),
      context,
    );
    expect(failedStart.status).toBe(400);

    const retriedConfirmation = await postMatterConfirmation(
      postRequest(`/api/matters/${matterId}/confirm`),
      context,
    );
    expect(retriedConfirmation.status).toBe(200);
    const confirmedPayload = (await retriedConfirmation.json()) as {
      matter: {
        blueprintState: BlueprintState | null;
        messages: StoredMessage[];
      };
    };
    expect(confirmedPayload.matter.blueprintState).toBeNull();
    expect(confirmedPayload.matter.messages).toHaveLength(0);

    const continued = await postBlueprintStart(
      postRequest(`/api/matters/${matterId}/blueprint/start`),
      context,
    );
    expect(continued.status).toBe(200);
    const continuedPayload = (await continued.json()) as {
      matter: {
        blueprintState: BlueprintState;
        messages: StoredMessage[];
      };
    };
    expect(continuedPayload.matter.blueprintState.phase).toBe(
      "BLUEPRINT_DECISIONS",
    );
    expect(continuedPayload.matter.messages).toHaveLength(0);
  });

  it("returns the saved first turn on an accepted-key retry and still rejects a new stale turn", async () => {
    const database = new FakeDatabase(
      confirmedOpening(),
      beneficiaryRecommendationState(confirmedOpening()),
    );
    mocks.createAdminSupabaseClient.mockReturnValue(database.client);

    const first = await postBlueprintTurn(
      turnRequest(TURN_KEY, "I accept this recommendation."),
      routeContext,
    );
    expect(first.status).toBe(200);
    const firstPayload = (await first.json()) as {
      matter: { blueprintState: BlueprintState };
    };
    expect(firstPayload.matter.blueprintState.current_gate).toBe(5);
    expect(database.messages).toHaveLength(2);
    expect(database.decisions).toHaveLength(1);
    expect(database.analyticsEvents).toEqual(["blueprint_turn_completed"]);
    const savedState = structuredClone(database.blueprintState);

    const retry = await postBlueprintTurn(
      turnRequest(TURN_KEY, "Duplicate retry after the response was lost."),
      routeContext,
    );
    expect(retry.status).toBe(200);
    const retryPayload = (await retry.json()) as {
      matter: { blueprintState: BlueprintState };
    };
    expect(retryPayload.matter.blueprintState).toEqual(savedState);
    expect(database.blueprintState).toEqual(savedState);
    expect(database.messages).toHaveLength(2);
    expect(database.decisions).toHaveLength(1);
    expect(database.analyticsEvents).toEqual(["blueprint_turn_completed"]);
    expect(mocks.interpretRecommendationResponse).toHaveBeenCalledTimes(1);
    expect(database.rpcCalls).toEqual(["apply_blueprint_turn"]);

    database.advanceBeforeNextTurnRpc = true;
    const stale = await postBlueprintTurn(
      turnRequest(NEW_TURN_KEY, "This is a genuinely new response."),
      routeContext,
    );
    expect(stale.status).toBe(400);
    await expect(stale.json()).resolves.toEqual({
      error: "stale blueprint state",
    });
    expect(database.messages).toHaveLength(2);
    expect(database.decisions).toHaveLength(1);
    expect(database.analyticsEvents).toEqual(["blueprint_turn_completed"]);
    expect(mocks.interpretBlueprintAnswer).toHaveBeenCalledTimes(1);
    expect(database.rpcCalls).toEqual([
      "apply_blueprint_turn",
      "apply_blueprint_turn",
    ]);
  });

  it("durably saves the exact API-returned model identities with the Blueprint state and decision", async () => {
    const recommendationGeneration = {
      operation: "blueprint_recommendation" as const,
      configured_model: "gpt-5.6",
      returned_model: "gpt-5.6-2026-08-07",
      response_id: "resp_recommendation",
    };
    const responseGeneration = {
      operation: "blueprint_recommendation_response" as const,
      configured_model: "gpt-5.6",
      returned_model: "gpt-5.6-2026-08-07",
      response_id: "resp_response",
    };
    const record = confirmedOpening();
    const evaluated = evaluateBlueprint(
      createInitialBlueprintState(record, {
        planningBaseline: completeBaseline,
        beneficiaryOutcomes: completeBeneficiary,
      }),
      [],
    );
    const state = presentRecommendation(evaluated.state, "beneficiary", {
      ...recommendation,
      generation_metadata: recommendationGeneration,
    });
    const database = new FakeDatabase(record, state);
    mocks.createAdminSupabaseClient.mockReturnValue(database.client);
    mocks.interpretRecommendationResponse.mockResolvedValueOnce({
      outcome: "accepted",
      acknowledgement: "The decision is saved.",
      clarification_question: null,
      disposition: "accept",
      modification: null,
      open_confirmation: null,
      stop: null,
      generation_metadata: responseGeneration,
    });

    const saved = await postBlueprintTurn(
      turnRequest(TURN_KEY, "I accept this recommendation."),
      routeContext,
    );

    expect(saved.status).toBe(200);
    expect(database.blueprintState.generated_responses).toEqual([
      recommendationGeneration,
      responseGeneration,
    ]);
    expect(database.decisions[0]).toMatchObject({
      recommendation_generation: recommendationGeneration,
      response_interpretation_generation: responseGeneration,
    });
    const savedPayload = (await saved.json()) as {
      matter: { blueprintState: BlueprintState; decisions: DecisionRecord[] };
    };
    expect(savedPayload.matter.blueprintState.generated_responses).toEqual([
      recommendationGeneration,
      responseGeneration,
    ]);
    expect(savedPayload.matter.decisions[0]).toMatchObject({
      recommendation_generation: recommendationGeneration,
      response_interpretation_generation: responseGeneration,
    });
  });

  it("returns saved focused evidence on retry without reprocessing or duplicating it", async () => {
    const record = confirmedOpening([
      "material expected inheritance through a third-party trust",
    ]);
    const database = new FakeDatabase(record, focusedEvidenceState(record));
    mocks.createAdminSupabaseClient.mockReturnValue(database.client);

    const first = await postBlueprintEvidence(
      evidenceRequest(TURN_KEY),
      routeContext,
    );
    expect(first.status).toBe(200);
    const firstPayload = (await first.json()) as {
      matter: { blueprintState: BlueprintState };
    };
    expect(firstPayload.matter.blueprintState.current_gate).toBe(4);
    expect(firstPayload.matter.blueprintState.evidence.status).toBe("dependency");
    expect(database.evidenceRecords).toHaveLength(1);
    expect(database.messages).toHaveLength(2);
    expect(database.analyticsEvents).toEqual([
      "evidence_checkpoint_completed",
    ]);
    expect(database.uploadedStoragePaths).toHaveLength(1);
    const savedState = structuredClone(database.blueprintState);

    const retry = await postBlueprintEvidence(
      evidenceRequest(TURN_KEY),
      routeContext,
    );
    expect(retry.status).toBe(200);
    const retryPayload = (await retry.json()) as {
      matter: { blueprintState: BlueprintState };
    };
    expect(retryPayload.matter.blueprintState).toEqual(savedState);
    expect(database.blueprintState).toEqual(savedState);
    expect(database.evidenceRecords).toHaveLength(1);
    expect(database.messages).toHaveLength(2);
    expect(database.analyticsEvents).toEqual([
      "evidence_checkpoint_completed",
    ]);
    expect(database.uploadedStoragePaths).toHaveLength(1);
    expect(mocks.extractStageRelevantEvidence).toHaveBeenCalledTimes(1);
    expect(mocks.interpretBlueprintEvidence).toHaveBeenCalledTimes(1);
    expect(mocks.generateBlueprintRecommendation).toHaveBeenCalledTimes(1);
    expect(database.rpcCalls).toEqual(["apply_blueprint_evidence"]);
  });
});
