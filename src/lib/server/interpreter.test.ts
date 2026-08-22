import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BlueprintStateSchema,
  createInitialBlueprintState,
  RecommendationContent,
} from "@/lib/domain/blueprint";
import { createInitialRecord } from "@/lib/domain/matter-opening";
import { generateBlueprintRecommendation } from "./interpreter";

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
  mocks.parse.mockResolvedValue({ output_parsed: recommendation });
  process.env.OPENAI_API_KEY = "test-key";
});

describe("Blueprint recommendation context", () => {
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
        planning_question:
          "Could the third-party trust change the planning baseline?",
        status: "dependency",
        ...treatment,
      },
    });

    await generateBlueprintRecommendation({
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
    };
    expect(context.evidence_treatment).toEqual(treatment);
    expect(Object.keys(context.evidence_treatment).sort()).toEqual([
      "confirmation_dependency",
      "contingency",
      "working_scenario",
    ]);
  });
});
