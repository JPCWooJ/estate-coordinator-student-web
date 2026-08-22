import { describe, expect, it } from "vitest";

import { createInitialRecord, MatterOpeningRecord } from "./matter-opening";
import {
  applyBlueprintAnswer,
  applyEvidenceTreatment,
  BlueprintAnswerInterpretation,
  buildDecisionRecord,
  createInitialBlueprintState,
  DecisionDisposition,
  evaluateBlueprint,
  presentRecommendation,
  RecommendationContent,
} from "./blueprint";

function confirmedOpening(overrides: Partial<MatterOpeningRecord> = {}) {
  return {
    ...createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    matter_status: "BLUEPRINT_READY" as const,
    desired_outcomes: ["intended_transfer" as const, "incapacity_readiness" as const],
    top_three_priorities: [
      "intended_transfer" as const,
      "incapacity_readiness" as const,
      "asset_protection" as const,
    ],
    principal_definition_of_success: "Protect the family and preserve continuity.",
    priority_details: [
      { outcome: "incapacity_readiness" as const, detail: "Keep essential responsibilities moving." },
    ],
    people_and_interests_snapshot: "Spouse and two adult children.",
    people_circumstance_flags: ["creditor and marital-claim protection"],
    current_plan_status: "update_needed" as const,
    current_plan_snapshot: "Living trust and will completed in 2018.",
    geographic_and_complexity_flags: ["Florida home", "family business"],
    principal_confirmed: "yes" as const,
    confirmation_date: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

const completeBaseline = {
  material_assets_range: "$8 million to $10 million",
  liabilities_range: "$500,000 to $750,000",
  expected_inheritance_range: "none expected",
  lifetime_security_floor: "$5 million",
  assets_counted_toward_floor: "liquid investments and primary residence",
  retained_control_requirement: "retain the home and liquid investments",
  extraordinary_future_obligations: "education support for grandchildren",
  exposure_summary: "Planning range is sufficient.",
};

const completeBeneficiary = {
  intended_beneficiaries: "spouse and two adult children",
  substitute_beneficiaries: "descendants of a deceased child",
  relative_treatment: "equal treatment for the children",
  protection_needs: "creditor and marital-claim protection",
  stewardship_objectives: "increasing participation based on readiness",
  special_treatment: "family-business interests need coordinated management",
};

const completeFiduciary = {
  trusted_people_or_institutions: "spouse, counsel, and an independent fiduciary",
  backups: "an independent trust company",
  essential_responsibilities: "household, investment, and business oversight",
  special_assets_or_purposes: "family business and digital assets",
  beneficiary_readiness: "financial education and demonstrated judgment",
};

const recommendation: RecommendationContent = {
  objective: "Protect beneficiaries",
  starting_point: "Use a separate continuing trust for each child.",
  rationale: "This preserves access while adding protection.",
  alternative_or_tradeoff: "Outright distributions are simpler but less protective.",
  open_confirmation: "Counsel should confirm the final provisions.",
  response_question: "Does this fit your objectives?",
};

function acceptedPatch(patch: BlueprintAnswerInterpretation["patch"]): BlueprintAnswerInterpretation {
  return {
    outcome: "accepted",
    acknowledgement: "Saved.",
    clarification_question: null,
    patch,
  };
}

describe("Estate Blueprint internal gates 1-5", () => {
  it("completes Stage 2 with zero turns and makes untriggered Stage 3 completely invisible", () => {
    const state = createInitialBlueprintState(confirmedOpening(), {
      planningBaseline: completeBaseline,
      beneficiaryOutcomes: completeBeneficiary,
    });
    const result = evaluateBlueprint(state, []);

    expect(result.state.phase).toBe("BLUEPRINT_DECISIONS");
    expect(result.state.current_gate).toBe(4);
    expect(result.state.completed_gates).toEqual([1, 2, 3]);
    expect(result.state.evidence.status).toBe("not_applicable");
    expect(result.state.interaction).toBeNull();
    expect(result.recommendationNeeded).toBe("beneficiary");
  });

  it("asks one consolidated Stage 2 question containing only missing decision inputs", () => {
    const state = createInitialBlueprintState(confirmedOpening(), {
      planningBaseline: {
        material_assets_range: "$8 million to $10 million",
        liabilities_range: "$500,000 to $750,000",
        assets_counted_toward_floor: "liquid investments",
        retained_control_requirement: "retain the primary home",
        extraordinary_future_obligations: "none",
      },
    });
    const result = evaluateBlueprint(state, []);

    expect(result.state.current_gate).toBe(2);
    expect(result.state.interaction).toMatchObject({
      kind: "question",
      key: "planning_baseline",
    });
    expect(result.state.interaction?.kind === "question" && result.state.interaction.prompt)
      .toContain("lifetime security");
    expect(JSON.stringify(result.state.interaction)).not.toContain("material assets");
    expect(JSON.stringify(result.state.interaction)).not.toContain("liabilities");
  });

  it("shows only the focused evidence checkpoint when materially triggered and continues with a dependency", () => {
    const opening = confirmedOpening({
      geographic_and_complexity_flags: [
        "material expected inheritance through a third-party trust",
      ],
    });
    const state = createInitialBlueprintState(opening, {
      planningBaseline: completeBaseline,
      beneficiaryOutcomes: completeBeneficiary,
    });
    const checkpoint = evaluateBlueprint(state, []).state;

    expect(checkpoint.current_gate).toBe(3);
    expect(checkpoint.interaction).toMatchObject({
      kind: "evidence",
      key: "focused_evidence_checkpoint",
    });
    const treated = applyEvidenceTreatment(checkpoint, {
      working_scenario: "Treat the interest as a continuing third-party trust.",
      contingency: "Revise if current governing terms differ.",
      confirmation_dependency: "Counsel must confirm funding and governing terms.",
    });
    const continued = evaluateBlueprint(treated, []);
    expect(continued.state.current_gate).toBe(4);
    expect(continued.state.evidence.status).toBe("dependency");
    expect(continued.recommendationNeeded).toBe("beneficiary");
  });

  it("routes a qualifying inheritance first disclosed in Stage 2 through the evidence checkpoint", () => {
    const stage2 = evaluateBlueprint(
      createInitialBlueprintState(confirmedOpening(), {
        planningBaseline: {
          ...completeBaseline,
          expected_inheritance_range: null,
          lifetime_security_floor: null,
        },
        beneficiaryOutcomes: completeBeneficiary,
      }),
      [],
    ).state;
    const answered = applyBlueprintAnswer(
      stage2,
      acceptedPatch({
        planning_baseline: {
          expected_inheritance_range:
            "$2 million to $3 million through a third-party trust",
          lifetime_security_floor: "$5 million",
        },
        beneficiary_outcomes: null,
        fiduciary_continuity_outcomes: null,
      }),
    ).state;
    const result = evaluateBlueprint(answered, []);

    expect(result.state.current_gate).toBe(3);
    expect(result.state.completed_gates).toEqual([1, 2]);
    expect(result.state.evidence).toMatchObject({
      triggered: true,
      status: "pending",
    });
    expect(result.state.interaction).toMatchObject({
      kind: "evidence",
      key: "focused_evidence_checkpoint",
    });
  });

  it("preserves permitted uncertainty and advances without repeat-question loops", () => {
    const state = createInitialBlueprintState(confirmedOpening(), {
      planningBaseline: {
        ...completeBaseline,
        liabilities_range: "unknown",
        expected_inheritance_range: "none",
        retained_control_requirement: "not decided",
        extraordinary_future_obligations: "not applicable",
      },
      beneficiaryOutcomes: {
        ...completeBeneficiary,
        substitute_beneficiaries: "not decided",
        protection_needs: "unknown",
        special_treatment: "none",
      },
    });
    const stage4 = evaluateBlueprint(state, []);

    expect(stage4.state.current_gate).toBe(4);
    expect(stage4.recommendationNeeded).toBe("beneficiary");
    expect(stage4.state.planning_baseline).toMatchObject({
      liabilities_range: "unknown",
      expected_inheritance_range: "none",
      retained_control_requirement: "not decided",
      extraordinary_future_obligations: "not applicable",
    });
    expect(stage4.state.beneficiary_outcomes).toMatchObject({
      substitute_beneficiaries: "not decided",
      protection_needs: "unknown",
      special_treatment: "none",
    });

    const stage5 = evaluateBlueprint(
      {
        ...stage4.state,
        current_gate: 5,
        fiduciary_continuity_outcomes: {
          trusted_people_or_institutions: "not decided",
          backups: "unknown",
          essential_responsibilities: "not applicable",
          special_assets_or_purposes: "none",
          beneficiary_readiness: "not decided",
        },
      },
      [],
    );
    expect(stage5.recommendationNeeded).toBe("fiduciary_continuity");
    expect(stage5.state.interaction).toBeNull();
  });

  it("goes directly to the beneficiary recommendation when confirmed state is sufficient", () => {
    const state = createInitialBlueprintState(confirmedOpening(), {
      planningBaseline: completeBaseline,
      beneficiaryOutcomes: completeBeneficiary,
    });
    const evaluated = evaluateBlueprint(state, []);
    const presented = presentRecommendation(
      evaluated.state,
      "beneficiary",
      recommendation,
    );

    expect(presented.interaction).toMatchObject({
      kind: "recommendation",
      decision_id: "BR-004-BENEFICIARY",
    });
    expect(JSON.stringify(presented.interaction)).toContain(
      "Use a separate continuing trust",
    );
  });

  it("lets one Stage 5 narrative interpretation satisfy every missing outcome before recommendation", () => {
    let state = createInitialBlueprintState(confirmedOpening(), {
      planningBaseline: completeBaseline,
      beneficiaryOutcomes: completeBeneficiary,
    });
    const beneficiaryEvaluation = evaluateBlueprint(state, []);
    state = presentRecommendation(
      beneficiaryEvaluation.state,
      "beneficiary",
      recommendation,
    );
    const beneficiaryDecision = buildDecisionRecord(state, {
      outcome: "accepted",
      acknowledgement: "Saved.",
      clarification_question: null,
      disposition: "accept",
      modification: null,
      open_confirmation: null,
    });
    const stage5 = evaluateBlueprint(
      { ...state, interaction: null },
      [beneficiaryDecision],
    ).state;
    expect(stage5.interaction).toMatchObject({
      kind: "question",
      key: "fiduciary_continuity_outcomes",
    });

    const answered = applyBlueprintAnswer(
      stage5,
      acceptedPatch({
        planning_baseline: null,
        beneficiary_outcomes: null,
        fiduciary_continuity_outcomes: completeFiduciary,
      }),
    ).state;
    const recommendationRequest = evaluateBlueprint(answered, [beneficiaryDecision]);
    expect(recommendationRequest.recommendationNeeded).toBe(
      "fiduciary_continuity",
    );
    expect(recommendationRequest.state.interaction).toBeNull();
  });

  it("carries Matter Opening participants as known people without confirming Stage 5 fiduciary choices", () => {
    const opening = confirmedOpening({
      priority_details: [
        {
          outcome: "incapacity_readiness",
          detail: "Keep household and investment decisions moving.",
        },
        {
          outcome: "heir_readiness",
          detail: "Require financial education before greater authority.",
        },
      ],
      professional_and_family_contacts: [
        {
          name: "Jordan Lee",
          firm: "Harbor Counsel",
          expertise: "estate planning",
          estate_role: "planning counsel",
          email: "",
          telephone: "",
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
          involvement_timing: "now",
        },
      ],
    });
    let state = createInitialBlueprintState(opening, {
      planningBaseline: completeBaseline,
      beneficiaryOutcomes: completeBeneficiary,
    });

    expect(state.fiduciary_continuity_outcomes.trusted_people_or_institutions)
      .toBeNull();

    const beneficiaryEvaluation = evaluateBlueprint(state, []);
    state = presentRecommendation(
      beneficiaryEvaluation.state,
      "beneficiary",
      recommendation,
    );
    const beneficiaryDecision = buildDecisionRecord(state, {
      outcome: "accepted",
      acknowledgement: "Saved.",
      clarification_question: null,
      disposition: "accept",
      modification: null,
      open_confirmation: null,
    });
    const stage5 = evaluateBlueprint(
      { ...state, interaction: null },
      [beneficiaryDecision],
    );

    expect(stage5.state.current_gate).toBe(5);
    expect(stage5.state.interaction).toMatchObject({
      kind: "question",
      key: "fiduciary_continuity_outcomes",
    });
    expect(JSON.stringify(stage5.state.interaction)).toContain(
      "people or institutions you trust",
    );
    expect(JSON.stringify(stage5.state.interaction)).toContain(
      "appropriate backups",
    );
    expect(JSON.stringify(stage5.state.interaction)).not.toContain(
      "responsibilities that must continue",
    );
    expect(JSON.stringify(stage5.state.interaction)).not.toContain(
      "special assets or purposes",
    );
    expect(JSON.stringify(stage5.state.interaction)).not.toContain(
      "what readiness should precede",
    );
  });

  it.each([
    "accept",
    "modify",
    "alternative_requested",
    "defer",
    "reject",
    "confirmation_required",
  ] as DecisionDisposition[])("persists the '%s' decision disposition", (disposition) => {
    const state = presentRecommendation(
      {
        ...createInitialBlueprintState(confirmedOpening(), {
          planningBaseline: completeBaseline,
          beneficiaryOutcomes: completeBeneficiary,
        }),
        current_gate: 4,
        phase: "BLUEPRINT_DECISIONS",
      },
      "beneficiary",
      recommendation,
    );
    const record = buildDecisionRecord(state, {
      outcome: "accepted",
      acknowledgement: "Saved.",
      clarification_question: null,
      disposition,
      modification: disposition === "modify" ? "Use staged participation." : null,
      open_confirmation:
        disposition === "confirmation_required" ? "Confirm with counsel." : null,
    });
    expect(record.principal_response).toBe(disposition);
    expect(record.resolved).toBe(true);
  });

  it("returns a resumed state to the genuinely incomplete interaction", () => {
    const state = createInitialBlueprintState(confirmedOpening(), {
      planningBaseline: completeBaseline,
      beneficiaryOutcomes: completeBeneficiary,
      fiduciaryContinuityOutcomes: completeFiduciary,
    });
    const first = evaluateBlueprint(state, []);
    const persisted = presentRecommendation(first.state, "beneficiary", recommendation);
    const resumed = evaluateBlueprint(persisted, []);

    expect(resumed.state.interaction).toEqual(persisted.interaction);
    expect(resumed.state.current_gate).toBe(4);
    expect(resumed.recommendationNeeded).toBeNull();
  });
});
