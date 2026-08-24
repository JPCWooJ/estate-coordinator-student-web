import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BlueprintStateSchema,
  createInitialBlueprintState,
  FinalReviewProfile,
  RecommendationContent,
} from "@/lib/domain/blueprint";
import { createInitialRecord } from "@/lib/domain/matter-opening";
import {
  generateBlueprintRecommendation,
  interpretFinalReviewCorrection,
  interpretBlueprintAnswer,
} from "./interpreter";
import { generateSyntheticRecommendation } from "./synthetic-interpreter";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  syntheticModeEnabled: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { parse: mocks.parse };
  },
}));
vi.mock("@/lib/server/auth", () => ({
  syntheticModeEnabled: mocks.syntheticModeEnabled,
}));

const recommendation: RecommendationContent = {
  objective: "Protect beneficiaries",
  starting_point: "Use a separate continuing trust for each child.",
  rationale: "This preserves access while adding protection.",
  alternative_or_tradeoff: null,
  open_confirmation: "Counsel should confirm the final provisions.",
  response_question: "Does this fit your objectives?",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.syntheticModeEnabled.mockReturnValue(false);
  mocks.parse.mockResolvedValue({
    id: "resp_recommendation",
    model: "gpt-5.6-2026-08-07",
    output_parsed: recommendation,
  });
  process.env.OPENAI_API_KEY = "test-key";
});

describe("Blueprint recommendation context", () => {
  it("interprets one local Final Review correction without authorizing progression", async () => {
    const profile: FinalReviewProfile = {
      goals_and_priorities: "Protect the family.",
      planning_baseline: "Preserve $5 million.",
      beneficiary_architecture: "Continuing trusts.",
      fiduciary_and_continuity_design: "Family plus independent support.",
      tax_and_transfer_direction: "Model transfers above the floor.",
      asset_and_liquidity_treatment: "Coordinate ownership and liquidity.",
      family_readiness_design: "Increase participation with readiness.",
      material_open_confirmations: ["Counsel must confirm final provisions."],
    };
    mocks.parse.mockResolvedValueOnce({
      id: "resp_final_review",
      model: "gpt-5.6-2026-08-07",
      output_parsed: {
        section: "planning_baseline",
        replacement: "Preserve $6 million.",
        acknowledgement: "The planning baseline now preserves $6 million.",
      },
    });

    const result = await interpretFinalReviewCorrection({
      correction: "Change the lifetime-security floor to $6 million.",
      profile,
    });

    expect(result.section).toBe("planning_baseline");
    expect(result.generation_metadata?.operation).toBe("final_review_correction");
    expect(mocks.parse.mock.calls[0][0].store).toBe(false);
  });

  it("supports deterministic Final Review corrections in synthetic journeys", async () => {
    mocks.syntheticModeEnabled.mockReturnValue(true);
    const result = await interpretFinalReviewCorrection({
      correction: "Change the lifetime-security floor to $6 million.",
      profile: {
        goals_and_priorities: "Protect the family.",
        planning_baseline: "Preserve $5 million.",
        beneficiary_architecture: "Continuing trusts.",
        fiduciary_and_continuity_design: "Family plus independent support.",
        tax_and_transfer_direction: "Model transfers above the floor.",
        asset_and_liquidity_treatment: "Coordinate ownership and liquidity.",
        family_readiness_design: "Increase participation with readiness.",
        material_open_confirmations: ["Counsel must confirm final provisions."],
      },
    });

    expect(result).toMatchObject({
      section: "planning_baseline",
      replacement: "Preserve $6 million.",
    });
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it("keeps each residual Stage 6 synthetic recommendation materially distinct", () => {
    const tax = generateSyntheticRecommendation({
      domain: "tax_transfer_strategy",
    });
    const administration = generateSyntheticRecommendation({
      domain: "administration_liquidity",
    });

    expect(tax.starting_point).toContain("lifetime-security");
    expect(tax.rationale).toContain("tax");
    expect(administration.starting_point).toContain("administrative hub");
    expect(administration.rationale).toContain("liquidity");
    expect(administration.starting_point).not.toBe(tax.starting_point);
  });

  it("supplies only the persisted structured Stage 3 treatment", async () => {
    const opening = createInitialRecord(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const treatment = {
      working_scenario:
        "Treat the interest as a continuing third-party trust.",
      contingency: "Revise if the governing terms differ.",
      confirmation_dependency: "Counsel must confirm the governing terms.",
    };
    const downstream = BlueprintStateSchema.parse({
      ...createInitialBlueprintState(opening),
      current_gate: 4,
      phase: "BLUEPRINT_DECISIONS",
      completed_gates: [1, 2, 3],
      evidence: {
        triggered: true,
        trigger_reason: "expected_inheritance",
        planning_question:
          "Could the third-party trust change the planning baseline?",
        status: "dependency",
        ...treatment,
      },
    });

    const generated = await generateBlueprintRecommendation({
      domain: "beneficiary",
      state: downstream,
      openingRecord: opening,
      decisions: [],
    });

    const request = mocks.parse.mock.calls[0][0] as {
      input: Array<{ content: string }>;
    };
    const context = JSON.parse(request.input[1].content) as {
      evidence_treatment: Record<string, unknown>;
      planning_baseline: Record<string, unknown>;
      planning_synthesis: Record<string, unknown> | null;
      source_context: Record<string, unknown>;
    };
    expect(context.evidence_treatment).toEqual(treatment);
    expect(Object.keys(context.evidence_treatment).sort()).toEqual([
      "confirmation_dependency",
      "contingency",
      "working_scenario",
    ]);
    expect(context.planning_baseline).toEqual(downstream.planning_baseline);
    expect(context.planning_synthesis).toBeNull();
    expect(context.source_context).toEqual(downstream.source_context);
    expect(generated.generation_metadata).toEqual({
      operation: "blueprint_recommendation",
      configured_model: "gpt-5.6",
      returned_model: "gpt-5.6-2026-08-07",
      response_id: "resp_recommendation",
    });
  });

  it("retains the exact API-returned model identity for a Blueprint interpretation", async () => {
    mocks.parse.mockResolvedValueOnce({
      id: "resp_interpretation",
      model: "gpt-5.6-2026-08-07",
      output_parsed: {
        outcome: "accepted",
        acknowledgement: "Saved.",
        clarification_question: null,
        patch: {
          planning_baseline: { lifetime_security_floor: "$5 million" },
          beneficiary_outcomes: null,
          fiduciary_continuity_outcomes: null,
        },
        stop: null,
      },
    });
    const state = BlueprintStateSchema.parse({
      ...createInitialBlueprintState(
        createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      ),
      interaction: {
        kind: "question",
        key: "planning_baseline",
        prompt: "What lifetime-security floor should planning preserve?",
        helper: null,
      },
    });

    const interpreted = await interpretBlueprintAnswer({
      answer: "$5 million",
      state,
    });

    expect(interpreted.generation_metadata).toEqual({
      operation: "blueprint_answer_interpretation",
      configured_model: "gpt-5.6",
      returned_model: "gpt-5.6-2026-08-07",
      response_id: "resp_interpretation",
    });
  });
});
