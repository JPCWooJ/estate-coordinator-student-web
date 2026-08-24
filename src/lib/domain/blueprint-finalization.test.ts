import { describe, expect, it } from "vitest";

import { createInitialRecord, type MatterOpeningRecord } from "./matter-opening";
import {
  applyFinalReviewCorrection,
  buildBlueprintDocument,
  buildDecisionRecord,
  createInitialBlueprintState,
  evaluateBlueprint,
  freezeBlueprintGeneration,
  presentRecommendation,
  type BlueprintState,
  type DecisionRecord,
  type RecommendationContent,
  type RecommendationDomain,
} from "./blueprint";

function confirmedOpening(overrides: Partial<MatterOpeningRecord> = {}) {
  return {
    ...createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    matter_status: "BLUEPRINT_READY" as const,
    desired_outcomes: [
      "intended_transfer" as const,
      "incapacity_readiness" as const,
      "tax_minimization" as const,
    ],
    top_three_priorities: [
      "intended_transfer" as const,
      "incapacity_readiness" as const,
      "tax_minimization" as const,
    ],
    principal_definition_of_success:
      "Protect the family, preserve lifetime security, and keep the plan practical.",
    priority_details: [
      {
        outcome: "incapacity_readiness" as const,
        detail: "Keep household and investment decisions moving.",
      },
    ],
    people_and_interests_snapshot: "Spouse and two adult children.",
    people_circumstance_flags: ["creditor and marital-claim protection"],
    current_plan_status: "update_needed" as const,
    current_plan_snapshot: "Living trust and will completed in 2018.",
    geographic_and_complexity_flags: [
      "Florida home",
      "family business",
      "digital assets",
    ],
    professional_and_family_contacts: [
      {
        name: "Jordan Lee",
        firm: "Harbor Counsel",
        expertise: "estate planning",
        estate_role: "planning counsel",
        email: "contact@harborcounsel.com",
        telephone: "555-555-1111",
        contact_trigger: "planning update",
        priority: "primary" as const,
        missing_information: [],
      },
    ],
    principal_confirmed: "yes" as const,
    confirmation_date: "2026-08-23T12:00:00.000Z",
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

const recommendations: Record<RecommendationDomain, RecommendationContent> = {
  beneficiary: {
    objective: "Protect beneficiaries while preserving useful access",
    starting_point: "Use a separate continuing trust for each child.",
    rationale: "This adds protection without forcing a fixed-age distribution.",
    alternative_or_tradeoff: "Outright distributions are simpler but less protective.",
    open_confirmation: "Counsel should confirm the final provisions.",
    response_question: "Does this fit your objectives?",
  },
  fiduciary_continuity: {
    objective: "Keep essential responsibilities moving",
    starting_point: "Separate family judgment from independent administration.",
    rationale: "This matches authority to responsibility and reduces key-person risk.",
    alternative_or_tradeoff: "An all-individual structure may be simpler but less resilient.",
    open_confirmation: "Counsel should confirm appointments and succession.",
    response_question: "Does this fit the people and responsibilities involved?",
  },
  special_asset: {
    objective: "Preserve specialized assets",
    starting_point: "Use separate continuity instructions for the business and digital assets.",
    rationale: "Those assets need operating knowledge beyond ordinary administration.",
    alternative_or_tradeoff: null,
    open_confirmation: "Counsel and asset advisers should confirm authority and succession.",
    response_question: "Does this fit the special assets involved?",
  },
  readiness: {
    objective: "Match participation to readiness",
    starting_point: "Increase beneficiary participation as readiness is demonstrated.",
    rationale: "This preserves protection while creating a path to responsibility.",
    alternative_or_tradeoff: "Fixed-age authority is simpler but may not match readiness.",
    open_confirmation: "Counsel should confirm the readiness standard.",
    response_question: "Does this progression fit your intent?",
  },
  tax_transfer_strategy: {
    objective: "Preserve lifetime security while evaluating transfer opportunities",
    starting_point:
      "Model transfer strategies only for value above the lifetime-security and retained-control boundaries.",
    rationale:
      "This keeps tax planning subordinate to financial security and confirmed liquidity.",
    alternative_or_tradeoff:
      "Retaining assets preserves control and may preserve tax benefits, while transferring can reduce future estate exposure.",
    open_confirmation: "Tax advisers, counsel, and valuation professionals must confirm the modeling inputs.",
    response_question: "Does this planning direction fit your priorities?",
  },
  administration_liquidity: {
    objective: "Reduce avoidable administration while preserving liquidity",
    starting_point:
      "Use the revocable plan as the administrative hub and confirm a practical source of estate liquidity.",
    rationale:
      "This can reduce avoidable transfer friction without assuming that illiquid assets should be sold.",
    alternative_or_tradeoff:
      "More lifetime restructuring may reduce later administration but adds cost and complexity now.",
    open_confirmation: "Counsel and financial advisers should confirm ownership, beneficiary designations, and liquidity.",
    response_question: "Does this administrative and liquidity direction fit your objectives?",
  },
  asset_transfer_strategy: {
    objective: "Coordinate material-asset transfer treatment",
    starting_point: "Confirm asset-specific ownership, transfer, and liquidity treatment.",
    rationale: "This avoids applying a general structure where an asset needs different handling.",
    alternative_or_tradeoff: null,
    open_confirmation: "Counsel and the relevant asset advisers should confirm the final treatment.",
    response_question: "Does this asset-specific direction fit your objectives?",
  },
};

function acceptedDecision(
  state: BlueprintState,
  domain: RecommendationDomain,
): DecisionRecord {
  const presented = presentRecommendation(
    state,
    domain,
    recommendations[domain],
  );
  return buildDecisionRecord(presented, {
    outcome: "accepted",
    acknowledgement: "Saved.",
    clarification_question: null,
    disposition: "accept",
    modification: null,
    open_confirmation: null,
    stop: null,
  });
}

function stateAtStageFive() {
  const state = createInitialBlueprintState(confirmedOpening(), {
    planningBaseline: completeBaseline,
    beneficiaryOutcomes: completeBeneficiary,
    fiduciaryContinuityOutcomes: completeFiduciary,
  });
  return {
    ...state,
    phase: "BLUEPRINT_DECISIONS" as const,
    current_gate: 5 as const,
    completed_gates: [1, 2, 3, 4],
    planning_synthesis: evaluateBlueprint(state, []).state.planning_synthesis,
    interaction: null,
  };
}

function advanceToFinalReview() {
  const state = stateAtStageFive();
  const decisions: DecisionRecord[] = [];
  for (const domain of [
    "beneficiary",
    "fiduciary_continuity",
    "special_asset",
    "readiness",
  ] as const) {
    const decision = acceptedDecision(state, domain);
    decisions.push(decision);
  }

  let evaluation = evaluateBlueprint(state, decisions);
  while (evaluation.recommendationNeeded) {
    const decision = acceptedDecision(
      evaluation.state,
      evaluation.recommendationNeeded,
    );
    decisions.push(decision);
    evaluation = evaluateBlueprint(evaluation.state, decisions);
  }
  return { state: evaluation.state, decisions };
}

describe("Estate Blueprint finalization", () => {
  it("moves from Stage 5 into only applicable residual Stage 6 recommendations", () => {
    const state = stateAtStageFive();
    const decisions = [
      acceptedDecision(state, "beneficiary"),
      acceptedDecision(state, "fiduciary_continuity"),
      acceptedDecision(state, "special_asset"),
      acceptedDecision(state, "readiness"),
    ];

    const result = evaluateBlueprint(state, decisions);

    expect(result.state.current_gate).toBe(6);
    expect(result.state.phase).toBe("BLUEPRINT_DECISIONS");
    expect(result.state.completed_gates).toEqual([1, 2, 3, 4, 5]);
    expect(result.recommendationNeeded).toBe("tax_transfer_strategy");
    expect([
      "beneficiary",
      "fiduciary_continuity",
      "special_asset",
      "readiness",
    ]).not.toContain(result.recommendationNeeded);
  });

  it("deduplicates overlapping special-asset work already resolved in Stage 5", () => {
    const state = stateAtStageFive();
    const decisions = [
      acceptedDecision(state, "beneficiary"),
      acceptedDecision(state, "fiduciary_continuity"),
      acceptedDecision(state, "special_asset"),
      acceptedDecision(state, "readiness"),
      acceptedDecision(state, "tax_transfer_strategy"),
      acceptedDecision(state, "administration_liquidity"),
    ];

    const result = evaluateBlueprint(state, decisions);

    expect(result.state.current_gate).toBe(7);
    expect(result.state.phase).toBe("FINAL_REVIEW");
    expect(result.state.interaction).toMatchObject({ kind: "final_review" });
    expect(decisions.map((decision) => decision.decision_id)).not.toContain(
      "BR-006-ASSET-TRANSFER",
    );
  });

  it("applies a Final Review correction only to the affected profile section", () => {
    const { state } = advanceToFinalReview();
    expect(state.interaction).toMatchObject({ kind: "final_review" });
    const originalProfile = state.final_review_profile;

    const corrected = applyFinalReviewCorrection(state, {
      section: "planning_baseline",
      replacement:
        "The lifetime-security floor is $5.5 million, including liquid investments and the primary residence.",
      acknowledgement: "The planning baseline is updated.",
    }).state;

    expect(corrected.final_review_profile?.planning_baseline).toContain(
      "$5.5 million",
    );
    expect(corrected.final_review_profile?.beneficiary_architecture).toBe(
      originalProfile?.beneficiary_architecture,
    );
    expect(corrected.final_review_profile?.fiduciary_and_continuity_design).toBe(
      originalProfile?.fiduciary_and_continuity_design,
    );
    expect(corrected.interaction).toMatchObject({
      kind: "final_review",
      profile: expect.objectContaining({
        planning_baseline: expect.stringContaining("$5.5 million"),
      }),
    });
  });

  it("freezes an immutable generation input from the confirmed Final Review", () => {
    const { state, decisions } = advanceToFinalReview();
    const frozen = freezeBlueprintGeneration(state, decisions, {
      blueprintId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      matterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      clientLabel: "My Estate Plan",
      frozenAt: "2026-08-23T15:00:00.000Z",
    });

    expect(frozen.state.phase).toBe("ESTATE_BLUEPRINT");
    expect(frozen.state.completed_gates).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(frozen.state.generation_snapshot_id).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(frozen.generationInput.profile).toEqual(state.final_review_profile);
    expect(frozen.generationInput.decisions).toEqual(decisions);

    state.final_review_profile!.planning_baseline = "Changed after freeze";
    decisions[0].recommendation = "Changed after freeze";

    expect(frozen.generationInput.profile.planning_baseline).not.toBe(
      "Changed after freeze",
    );
    expect(frozen.generationInput.decisions[0].recommendation).not.toBe(
      "Changed after freeze",
    );
  });

  it("builds the four approved Blueprint sections without internal workflow language", () => {
    const finalReview = advanceToFinalReview();
    const correctedState = applyFinalReviewCorrection(finalReview.state, {
      section: "planning_baseline",
      replacement: "Preserve $6 million for lifetime security.",
      acknowledgement: "The planning baseline is updated.",
    }).state;
    const { generationInput } = freezeBlueprintGeneration(correctedState, finalReview.decisions, {
      blueprintId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      matterId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      clientLabel: "My Estate Plan",
      frozenAt: "2026-08-23T15:00:00.000Z",
    });

    const document = buildBlueprintDocument(generationInput);
    const serialized = JSON.stringify(document);

    expect(document.sections.map((section) => section.title)).toEqual([
      "Your Estate Blueprint - At a Glance",
      "How Your Plan Works",
      "What Still Needs to Be Confirmed",
      "What Happens Next",
    ]);
    expect(document.source_snapshot_id).toBe(generationInput.blueprint_id);
    expect(document.estate_team).toEqual([
      expect.objectContaining({
        name: "Jordan Lee",
        role: "planning counsel",
      }),
    ]);
    expect(serialized).toContain(
      "developed before review of your existing estate-planning documents",
    );
    expect(serialized).toContain(
      "does not verify legal, tax, valuation, GST, or other professional conclusions",
    );
    expect(serialized).toContain("Preserve $6 million for lifetime security.");
    expect(document.sections[0].overview[0]).not.toContain("..");
    expect(serialized).not.toContain("Lifetime-security floor: $5 million");
    expect(serialized).not.toMatch(/BR-00|Stage 6|Stage 7|BLUEPRINT_/);
    expect(serialized).not.toMatch(/\{\{[^}]+\}\}/);
  });
});
