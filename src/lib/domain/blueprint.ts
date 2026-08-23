import { z } from "zod";

import type { MatterOpeningRecord } from "./matter-opening";
import {
  appendGeneratedResponse,
  generatedResponseMetadata,
  GeneratedResponseMetadataSchema,
  type WithGeneratedResponse,
} from "./generated-response";
import { USER_JOURNEY_PROGRESS } from "./progress";

export const BLUEPRINT_WORKFLOW_VERSION = "EC_ESTATE_BLUEPRINT_0.7";

export const BlueprintPhaseSchema = z.enum([
  "PLANNING_FOUNDATION",
  "BLUEPRINT_DECISIONS",
]);
export type BlueprintPhase = z.infer<typeof BlueprintPhaseSchema>;

export const BlueprintGateSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type BlueprintGate = z.infer<typeof BlueprintGateSchema>;

const NullableText = z.string().nullable();

export const PlanningBaselineSchema = z.object({
  material_assets_range: NullableText,
  liabilities_range: NullableText,
  expected_inheritance_range: NullableText,
  lifetime_security_floor: NullableText,
  assets_counted_toward_floor: NullableText,
  retained_control_requirement: NullableText,
  extraordinary_future_obligations: NullableText,
});
export type PlanningBaseline = z.infer<typeof PlanningBaselineSchema>;

export const PlanningSynthesisSchema = z.object({
  current_and_projected_estate_range: z.string().min(1),
  lifetime_security_boundary: z.string().min(1),
  preliminary_transfer_capacity: z.string().min(1),
  potential_transfer_tax_exposure: z.string().min(1),
  liquidity_and_concentration_considerations: z.string().min(1),
  material_appreciation_exposure: NullableText,
  confirmation_dependencies: z.array(z.string().min(1)),
});
export type PlanningSynthesis = z.infer<typeof PlanningSynthesisSchema>;

export const BeneficiaryOutcomesSchema = z.object({
  intended_beneficiaries: NullableText,
  substitute_beneficiaries: NullableText,
  relative_treatment: NullableText,
  protection_needs: NullableText,
  stewardship_objectives: NullableText,
  special_treatment: NullableText,
});
export type BeneficiaryOutcomes = z.infer<typeof BeneficiaryOutcomesSchema>;

export const FiduciaryContinuityOutcomesSchema = z.object({
  trusted_people_or_institutions: NullableText,
  backups: NullableText,
  essential_responsibilities: NullableText,
  special_assets_or_purposes: NullableText,
  beneficiary_readiness: NullableText,
});
export type FiduciaryContinuityOutcomes = z.infer<
  typeof FiduciaryContinuityOutcomesSchema
>;

const EvidenceTriggerReasonSchema = z.enum([
  "expected_inheritance",
  "business_agreement",
  "external_instrument",
]);
type EvidenceTriggerReason = z.infer<typeof EvidenceTriggerReasonSchema>;

export const EvidenceStateSchema = z.object({
  triggered: z.boolean(),
  trigger_reason: EvidenceTriggerReasonSchema.nullable(),
  planning_question: NullableText,
  status: z.enum(["not_applicable", "pending", "supported", "dependency"]),
  working_scenario: NullableText,
  contingency: NullableText,
  confirmation_dependency: NullableText,
});
export type EvidenceState = z.infer<typeof EvidenceStateSchema>;

export const RecommendationContentSchema = z.object({
  objective: z.string().min(1),
  starting_point: z.string().min(1),
  rationale: z.string().min(1),
  alternative_or_tradeoff: NullableText,
  open_confirmation: NullableText,
  response_question: z.string().min(1),
});
export type RecommendationContent = z.infer<
  typeof RecommendationContentSchema
>;

export const BlueprintStopCategorySchema = z.enum([
  "identity_or_authority",
  "conflict_of_interest",
  "capacity_or_voluntariness",
  "abuse_or_exploitation",
  "disputed_instrument",
  "missing_controlling_source",
  "source_discrepancy",
  "rejected_instrument",
  "stale_or_mismatched_authority",
  "irreversible_action",
  "professional_judgment_required",
  "privacy_or_permission",
  "execution_control",
  "unresolved_dependency",
  "other",
]);
export type BlueprintStopCategory = z.infer<
  typeof BlueprintStopCategorySchema
>;

export const BlueprintStopSchema = z.object({
  category: BlueprintStopCategorySchema,
  reason: z.string().min(1),
  affected_objects: z.array(z.string().min(1)),
  resolution_condition: z.string().min(1),
  assigned_owner: z.string().min(1),
  escalation_path: z.string().min(1),
  evidence_required_to_resume: z.array(z.string().min(1)),
  immediate_action: z.string().min(1),
});
export type BlueprintStop = z.infer<typeof BlueprintStopSchema>;

export const RecommendationDomainSchema = z.enum([
  "beneficiary",
  "fiduciary_continuity",
  "special_asset",
  "readiness",
]);
export type RecommendationDomain = z.infer<typeof RecommendationDomainSchema>;

const PersistedRecommendationDomainSchema = z
  .union([RecommendationDomainSchema, z.literal("fiduciary")])
  .transform((domain) =>
    domain === "fiduciary" ? "fiduciary_continuity" : domain,
  );

export const DecisionDispositionSchema = z.enum([
  "accept",
  "modify",
  "alternative_requested",
  "defer",
  "reject",
  "confirmation_required",
]);
export type DecisionDisposition = z.infer<typeof DecisionDispositionSchema>;

export const DecisionRecordSchema = z.object({
  decision_id: z.string().min(1),
  domain: PersistedRecommendationDomainSchema,
  recommendation: z.string().min(1),
  principal_response: DecisionDispositionSchema,
  modification: NullableText,
  open_confirmation: NullableText,
  implementation_evidence: NullableText,
  resolved: z.boolean(),
  recommendation_generation: GeneratedResponseMetadataSchema.nullable().optional(),
  response_interpretation_generation:
    GeneratedResponseMetadataSchema.nullable().optional(),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

const QuestionInteractionSchema = z.object({
  kind: z.literal("question"),
  key: z.enum([
    "planning_baseline",
    "beneficiary_outcomes",
    "fiduciary_continuity_outcomes",
    "clarification",
  ]),
  prompt: z.string().min(1),
  helper: NullableText,
});

const EvidenceInteractionSchema = z.object({
  kind: z.literal("evidence"),
  key: z.literal("focused_evidence_checkpoint"),
  prompt: z.string().min(1),
  helper: z.string().min(1),
});

const RecommendationInteractionSchema = z.object({
  kind: z.literal("recommendation"),
  decision_id: z.string().min(1),
  domain: RecommendationDomainSchema,
  content: RecommendationContentSchema,
  generation_metadata: GeneratedResponseMetadataSchema.nullable().optional(),
});

const StopInteractionSchema = z.object({
  kind: z.literal("stop"),
  stop: BlueprintStopSchema,
});

const CompleteInteractionSchema = z.object({
  kind: z.literal("complete"),
  title: z.string().min(1),
  message: z.string().min(1),
});

export const BlueprintInteractionSchema = z.discriminatedUnion("kind", [
  QuestionInteractionSchema,
  EvidenceInteractionSchema,
  RecommendationInteractionSchema,
  StopInteractionSchema,
  CompleteInteractionSchema,
]);
export type BlueprintInteraction = z.infer<typeof BlueprintInteractionSchema>;

export const BlueprintStateSchema = z.object({
  workflow_version: z.literal(BLUEPRINT_WORKFLOW_VERSION),
  phase: BlueprintPhaseSchema,
  current_gate: BlueprintGateSchema,
  completed_gates: z.array(z.number().int().min(1).max(5)),
  planning_baseline: PlanningBaselineSchema,
  planning_synthesis: PlanningSynthesisSchema.nullable(),
  evidence: EvidenceStateSchema,
  beneficiary_outcomes: BeneficiaryOutcomesSchema,
  fiduciary_continuity_outcomes: FiduciaryContinuityOutcomesSchema,
  stop: BlueprintStopSchema.nullable().optional(),
  generated_responses: z.array(GeneratedResponseMetadataSchema).optional(),
  interaction: BlueprintInteractionSchema.nullable(),
  revision: z.number().int().nonnegative(),
});
export type BlueprintState = z.infer<typeof BlueprintStateSchema>;

export const BlueprintAnswerPatchSchema = z.object({
  planning_baseline: PlanningBaselineSchema.partial().nullable(),
  beneficiary_outcomes: BeneficiaryOutcomesSchema.partial().nullable(),
  fiduciary_continuity_outcomes:
    FiduciaryContinuityOutcomesSchema.partial().nullable(),
});
export type BlueprintAnswerPatch = z.infer<typeof BlueprintAnswerPatchSchema>;

export const BlueprintAnswerInterpretationSchema = z.object({
  outcome: z.enum(["accepted", "clarification", "stop"]),
  acknowledgement: z.string(),
  clarification_question: NullableText,
  patch: BlueprintAnswerPatchSchema,
  stop: BlueprintStopSchema.nullable(),
});
export type BlueprintAnswerInterpretation = z.infer<
  typeof BlueprintAnswerInterpretationSchema
>;

export const RecommendationResponseSchema = z.object({
  outcome: z.enum(["accepted", "clarification", "stop"]),
  acknowledgement: z.string(),
  clarification_question: NullableText,
  disposition: DecisionDispositionSchema.nullable(),
  modification: NullableText,
  open_confirmation: NullableText,
  stop: BlueprintStopSchema.nullable(),
});
export type RecommendationResponse = z.infer<
  typeof RecommendationResponseSchema
>;

export const EvidenceTreatmentSchema = z.object({
  working_scenario: z.string().min(1),
  contingency: NullableText,
  confirmation_dependency: NullableText,
});
export type EvidenceTreatment = z.infer<typeof EvidenceTreatmentSchema>;

export type BlueprintEvaluation = {
  state: BlueprintState;
  recommendationNeeded: RecommendationDomain | null;
};

function known(value: string | null) {
  return Boolean(value && value.trim() && value.trim().toLowerCase() !== "unknown");
}

function answered(value: string | null) {
  return Boolean(value?.trim());
}

function joinKnown(values: string[]) {
  const filtered = values.filter((value) => known(value));
  return filtered.length ? filtered.join("; ") : null;
}

function priorityDetail(record: MatterOpeningRecord, outcomes: string[]) {
  return joinKnown(
    record.priority_details
      .filter((detail) => outcomes.includes(detail.outcome))
      .map((detail) => detail.detail),
  );
}

function evidenceTrigger(searchable: string): {
  reason: EvidenceTriggerReason;
  planningQuestion: string;
} | null {
  const inheritanceArrangement = searchable.match(
    /(expected inheritance|third[- ]party trust|inherited trust)/i,
  )?.[0].toLowerCase();
  if (inheritanceArrangement) {
    const subject =
      inheritanceArrangement === "third-party trust"
        ? "third-party trust interest"
        : inheritanceArrangement;
    return {
      reason: "expected_inheritance",
      planningQuestion:
        `Could the ${subject} materially change the projected estate range or transfer capacity?`,
    };
  }
  const businessAgreement = searchable.match(
    /(business agreement|shareholder agreement|partnership agreement)/i,
  )?.[0].toLowerCase();
  if (businessAgreement) {
    return {
      reason: "business_agreement",
      planningQuestion:
        `Could the ${businessAgreement} materially change ownership, control, liquidity, or transfer restrictions?`,
    };
  }
  if (/external instrument/i.test(searchable)) {
    return {
      reason: "external_instrument",
      planningQuestion:
        "Could the external instrument materially change ownership, control, or transfer restrictions?",
    };
  }
  return null;
}

function externalEvidenceTrigger(record: MatterOpeningRecord) {
  const searchable = [
    ...record.geographic_and_complexity_flags,
    record.current_plan_snapshot,
    record.people_and_interests_snapshot,
  ]
    .join(" ")
    .toLowerCase();
  return evidenceTrigger(searchable);
}

function planningBaselineEvidenceTrigger(baseline: PlanningBaseline) {
  const expectedInheritance = baseline.expected_inheritance_range
    ?.trim()
    .toLowerCase();
  if (
    expectedInheritance &&
    !/^(unknown|not decided|not applicable|none(?: expected)?)$/.test(
      expectedInheritance,
    )
  ) {
    return (
      evidenceTrigger(expectedInheritance) ??
      evidenceTrigger("expected inheritance")
    );
  }

  return evidenceTrigger(Object.values(baseline).join(" "));
}

function createPlanningSynthesis(
  baseline: PlanningBaseline,
  evidenceTriggered: boolean,
): PlanningSynthesis {
  const value = (input: string | null) => input?.trim() || "not assessed";
  const assetContext = [
    baseline.material_assets_range,
    baseline.assets_counted_toward_floor,
    baseline.retained_control_requirement,
  ]
    .filter((input): input is string => answered(input))
    .join("; ");
  const confirmationDependencies = [
    "Estate-planning counsel and tax advisers must confirm transfer-tax exposure under then-current law.",
    "Qualified advisers must confirm valuation, liquidity, concentration, and transfer capacity before implementation.",
  ];
  const unresolved = [
    ["material asset range", baseline.material_assets_range],
    ["liability range", baseline.liabilities_range],
    ["expected inheritance", baseline.expected_inheritance_range],
    ["lifetime-security floor", baseline.lifetime_security_floor],
    ["assets counted toward the floor", baseline.assets_counted_toward_floor],
    ["retained-control requirement", baseline.retained_control_requirement],
    ["extraordinary future obligations", baseline.extraordinary_future_obligations],
  ]
    .filter(([, input]) => /^(unknown|not decided)$/i.test(value(input)))
    .map(([label]) => label);
  if (unresolved.length) {
    confirmationDependencies.push(
      `Confirm unresolved planning inputs: ${unresolved.join(", ")}.`,
    );
  }
  if (evidenceTriggered) {
    confirmationDependencies.push(
      "Confirm the governing evidence and professional treatment for the expected inheritance or external arrangement.",
    );
  }

  return PlanningSynthesisSchema.parse({
    current_and_projected_estate_range:
      `Current planning range: material assets ${value(
        baseline.material_assets_range,
      )}; liabilities ${value(
        baseline.liabilities_range,
      )}. Expected inheritance for the projected range: ${value(
        baseline.expected_inheritance_range,
      )}.`,
    lifetime_security_boundary:
      `Lifetime-security floor: ${value(
        baseline.lifetime_security_floor,
      )}; assets counted toward it: ${value(
        baseline.assets_counted_toward_floor,
      )}; retained-control boundary: ${value(
        baseline.retained_control_requirement,
      )}; extraordinary future obligations: ${value(
        baseline.extraordinary_future_obligations,
      )}.`,
    preliminary_transfer_capacity:
      `Potential transfer capacity is limited to value, if any, above the stated lifetime-security floor (${value(
        baseline.lifetime_security_floor,
      )}) after liabilities (${value(
        baseline.liabilities_range,
      )}), retained-control needs (${value(
        baseline.retained_control_requirement,
      )}), and extraordinary obligations (${value(
        baseline.extraordinary_future_obligations,
      )}); the planning-level ranges do not support a more precise amount.`,
    potential_transfer_tax_exposure:
      "Potential transfer-tax exposure is not quantified from these planning-level ranges. Compare the current and projected estate range with the then-applicable exemption using professionally confirmed values.",
    liquidity_and_concentration_considerations:
      `Assess liquidity and concentration within the identified asset context (${assetContext}) while preserving the lifetime-security and retained-control boundaries; no account-level concentration is assumed.`,
    material_appreciation_exposure:
      /(business|private|real estate|property|residence|stock|equity|digital|growth|appreciat|volatile|illiquid)/i.test(
        assetContext,
      )
        ? `Potential material appreciation exposure may exist within the identified asset context (${assetContext}); no appreciation rate or value is assumed.`
        : null,
    confirmation_dependencies: confirmationDependencies,
  });
}

export function createInitialBlueprintState(
  record: MatterOpeningRecord,
  seed: Partial<{
    planningBaseline: Partial<PlanningBaseline>;
    beneficiaryOutcomes: Partial<BeneficiaryOutcomes>;
    fiduciaryContinuityOutcomes: Partial<FiduciaryContinuityOutcomes>;
  }> = {},
): BlueprintState {
  const responsibilities = priorityDetail(record, [
    "incapacity_readiness",
    "business_charitable_family_legacy",
  ]);
  const protection = joinKnown(record.people_circumstance_flags);
  const specialAssets = joinKnown(
    record.geographic_and_complexity_flags.filter((flag) =>
      /(business|trust|digital|charit|foreign|private|real estate)/i.test(flag),
    ),
  );
  const readiness = priorityDetail(record, ["heir_readiness"]);
  const trigger = externalEvidenceTrigger(record);

  return BlueprintStateSchema.parse({
    workflow_version: BLUEPRINT_WORKFLOW_VERSION,
    phase: "PLANNING_FOUNDATION",
    current_gate: 2,
    completed_gates: [1],
    planning_baseline: {
      material_assets_range: null,
      liabilities_range: null,
      expected_inheritance_range: null,
      lifetime_security_floor: null,
      assets_counted_toward_floor: null,
      retained_control_requirement: null,
      extraordinary_future_obligations: null,
      ...seed.planningBaseline,
    },
    planning_synthesis: null,
    evidence: {
      triggered: Boolean(trigger),
      trigger_reason: trigger?.reason ?? null,
      planning_question: trigger?.planningQuestion ?? null,
      status: trigger ? "pending" : "not_applicable",
      working_scenario: null,
      contingency: null,
      confirmation_dependency: null,
    },
    beneficiary_outcomes: {
      intended_beneficiaries: known(record.people_and_interests_snapshot)
        ? record.people_and_interests_snapshot
        : null,
      substitute_beneficiaries: null,
      relative_treatment: null,
      protection_needs: protection,
      stewardship_objectives: priorityDetail(record, [
        "distribution_control",
        "heir_readiness",
      ]),
      special_treatment: specialAssets,
      ...seed.beneficiaryOutcomes,
    },
    fiduciary_continuity_outcomes: {
      trusted_people_or_institutions: null,
      backups: null,
      essential_responsibilities: responsibilities,
      special_assets_or_purposes: specialAssets,
      beneficiary_readiness: readiness,
      ...seed.fiduciaryContinuityOutcomes,
    },
    stop: null,
    generated_responses: [],
    interaction: null,
    revision: 0,
  });
}

export function stage2Sufficient(
  baseline: PlanningBaseline,
  expectedInheritanceRequired: boolean,
) {
  return (
    answered(baseline.material_assets_range) &&
    answered(baseline.liabilities_range) &&
    (!expectedInheritanceRequired ||
      answered(baseline.expected_inheritance_range)) &&
    answered(baseline.lifetime_security_floor) &&
    answered(baseline.assets_counted_toward_floor) &&
    answered(baseline.retained_control_requirement) &&
    answered(baseline.extraordinary_future_obligations)
  );
}

export function beneficiarySufficient(outcomes: BeneficiaryOutcomes) {
  return (
    answered(outcomes.intended_beneficiaries) &&
    answered(outcomes.substitute_beneficiaries) &&
    answered(outcomes.relative_treatment) &&
    answered(outcomes.protection_needs) &&
    answered(outcomes.stewardship_objectives) &&
    answered(outcomes.special_treatment)
  );
}

export function fiduciaryContinuitySufficient(
  outcomes: FiduciaryContinuityOutcomes,
) {
  return (
    answered(outcomes.trusted_people_or_institutions) &&
    answered(outcomes.backups) &&
    answered(outcomes.essential_responsibilities) &&
    answered(outcomes.special_assets_or_purposes) &&
    answered(outcomes.beneficiary_readiness)
  );
}

function missingLabels<T extends Record<string, string | null>>(
  value: T,
  labels: Record<keyof T, string>,
) {
  return (Object.keys(labels) as Array<keyof T>)
    .filter((key) => !answered(value[key]))
    .map((key) => labels[key]);
}

function question(
  key: "planning_baseline" | "beneficiary_outcomes" | "fiduciary_continuity_outcomes",
  prompt: string,
  helper: string,
): BlueprintInteraction {
  return { kind: "question", key, prompt, helper };
}

function recommendationDecisionId(domain: RecommendationDomain) {
  switch (domain) {
    case "beneficiary":
      return "BR-004-BENEFICIARY";
    case "fiduciary_continuity":
      return "BR-005-FIDUCIARY-CONTINUITY";
    case "special_asset":
      return "BR-005-SPECIAL-ASSET";
    case "readiness":
      return "BR-005-READINESS";
  }
}

function materiallyApplicable(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  return !/^(unknown|not decided|not applicable|n\/a|none(?: identified| applicable| required)?|no(?: material)? (?:special|separate|additional).*)$/.test(
    normalized,
  );
}

function normalizedOutcome(value: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function outcomeAlreadyCovered(
  value: string | null,
  relatedOutcome: string | null,
) {
  const candidate = normalizedOutcome(value);
  const related = normalizedOutcome(relatedOutcome);
  if (!candidate || !related) return false;
  return (
    candidate === related ||
    (candidate.length >= 12 && related.includes(candidate)) ||
    (related.length >= 12 && candidate.includes(related))
  );
}

function unresolvedStage5RecommendationDomains(
  state: BlueprintState,
  decisions: DecisionRecord[],
): RecommendationDomain[] {
  const applicable: RecommendationDomain[] = ["fiduciary_continuity"];
  if (
    materiallyApplicable(
      state.fiduciary_continuity_outcomes.special_assets_or_purposes,
    ) &&
    !outcomeAlreadyCovered(
      state.fiduciary_continuity_outcomes.special_assets_or_purposes,
      state.fiduciary_continuity_outcomes.essential_responsibilities,
    )
  ) {
    applicable.push("special_asset");
  }
  if (
    materiallyApplicable(
      state.fiduciary_continuity_outcomes.beneficiary_readiness,
    ) &&
    !outcomeAlreadyCovered(
      state.fiduciary_continuity_outcomes.beneficiary_readiness,
      state.beneficiary_outcomes.stewardship_objectives,
    )
  ) {
    applicable.push("readiness");
  }
  const resolvedIds = new Set(decisions.map((decision) => decision.decision_id));
  return applicable.filter(
    (domain) => !resolvedIds.has(recommendationDecisionId(domain)),
  );
}

export function evaluateBlueprint(
  inputState: BlueprintState,
  decisions: DecisionRecord[],
): BlueprintEvaluation {
  let state = BlueprintStateSchema.parse(inputState);
  if (state.stop) {
    return {
      state: {
        ...state,
        interaction: { kind: "stop", stop: state.stop },
      },
      recommendationNeeded: null,
    };
  }
  for (;;) {
    if (state.current_gate === 2) {
      const baselineTrigger = planningBaselineEvidenceTrigger(
        state.planning_baseline,
      );
      const expectedInheritanceRequired =
        state.evidence.trigger_reason === "expected_inheritance" ||
        baselineTrigger?.reason === "expected_inheritance";
      if (
        !stage2Sufficient(
          state.planning_baseline,
          expectedInheritanceRequired,
        )
      ) {
        const missing = missingLabels(state.planning_baseline, {
          material_assets_range: "the approximate range of material assets",
          liabilities_range: "the approximate range of liabilities",
          expected_inheritance_range: expectedInheritanceRequired
            ? "any material expected inheritance"
            : "",
          lifetime_security_floor: "the amount that must remain available for lifetime security",
          assets_counted_toward_floor: "which assets count toward that security floor",
          retained_control_requirement: "what must remain under your control",
          extraordinary_future_obligations: "any extraordinary future obligations",
        }).filter(Boolean);
        return {
          state: {
            ...state,
            phase: "PLANNING_FOUNDATION",
            interaction: question(
              "planning_baseline",
              `To establish the planning range, please share ${missing.join(
                ", ",
              )}. Ranges are enough.`,
              "Account-level detail is not needed. You can say none, unknown, or not decided where appropriate.",
            ),
          },
          recommendationNeeded: null,
        };
      }
      const evidenceTriggered =
        state.evidence.triggered || Boolean(baselineTrigger);
      state = {
        ...state,
        current_gate: 3,
        completed_gates: [...new Set([...state.completed_gates, 2])],
        planning_synthesis: createPlanningSynthesis(
          state.planning_baseline,
          evidenceTriggered,
        ),
        evidence: evidenceTriggered
          ? {
              ...state.evidence,
              triggered: true,
              trigger_reason:
                state.evidence.trigger_reason ?? baselineTrigger?.reason ?? null,
              planning_question:
                state.evidence.planning_question ??
                baselineTrigger?.planningQuestion ??
                null,
              status:
                state.evidence.status === "not_applicable"
                  ? "pending"
                  : state.evidence.status,
            }
          : state.evidence,
        interaction: null,
      };
      continue;
    }

    if (state.current_gate === 3) {
      if (!state.evidence.triggered) {
        state = {
          ...state,
          current_gate: 4,
          phase: "BLUEPRINT_DECISIONS",
          completed_gates: [...new Set([...state.completed_gates, 3])],
          interaction: null,
        };
        continue;
      }
      if (state.evidence.status === "pending") {
        return {
          state: {
            ...state,
            phase: "PLANNING_FOUNDATION",
            interaction: {
              kind: "evidence",
              key: "focused_evidence_checkpoint",
              prompt:
                state.evidence.planning_question ??
                "A specific external arrangement may affect the planning baseline.",
              helper:
                "Upload only the relevant third-party trust or business agreement as a text-readable PDF. Do not upload your own estate-planning documents. If it is not available, you can continue with a working scenario and confirmation item.",
            },
          },
          recommendationNeeded: null,
        };
      }
      state = {
        ...state,
        current_gate: 4,
        phase: "BLUEPRINT_DECISIONS",
        completed_gates: [...new Set([...state.completed_gates, 3])],
        interaction: null,
      };
      continue;
    }

    if (state.current_gate === 4) {
      const resolved = decisions.some(
        (decision) =>
          decision.decision_id === recommendationDecisionId("beneficiary"),
      );
      if (resolved) {
        state = {
          ...state,
          current_gate: 5,
          completed_gates: [...new Set([...state.completed_gates, 4])],
          interaction: null,
        };
        continue;
      }
      if (
        state.interaction?.kind === "recommendation" &&
        state.interaction.decision_id === "BR-004-BENEFICIARY"
      ) {
        return { state, recommendationNeeded: null };
      }
      if (!beneficiarySufficient(state.beneficiary_outcomes)) {
        const missing = missingLabels(state.beneficiary_outcomes, {
          intended_beneficiaries: "who should benefit",
          substitute_beneficiaries: "who should benefit if a primary beneficiary cannot",
          relative_treatment: "whether treatment should be equal or different",
          protection_needs: "any protection needs",
          stewardship_objectives: "your stewardship or readiness goals",
          special_treatment: "any person, asset, or purpose needing different treatment",
        });
        return {
          state: {
            ...state,
            phase: "BLUEPRINT_DECISIONS",
            interaction: question(
              "beneficiary_outcomes",
              `Before recommending a beneficiary structure, what should we understand about ${missing.join(
                ", ",
              )}?`,
              "Focus on the outcomes and protections you want. You do not need to choose a trust structure.",
            ),
          },
          recommendationNeeded: null,
        };
      }
      return { state: { ...state, interaction: null }, recommendationNeeded: "beneficiary" };
    }

    if (!fiduciaryContinuitySufficient(state.fiduciary_continuity_outcomes)) {
      const missing = missingLabels(state.fiduciary_continuity_outcomes, {
        trusted_people_or_institutions: "the people or institutions you trust",
        backups: "appropriate backups",
        essential_responsibilities: "responsibilities that must continue without interruption",
        special_assets_or_purposes: "special assets or purposes needing different treatment",
        beneficiary_readiness: "what readiness should precede greater participation or authority",
      });
      return {
        state: {
          ...state,
          phase: "BLUEPRINT_DECISIONS",
          interaction: question(
            "fiduciary_continuity_outcomes",
            `In one answer, tell us what matters about ${missing.join(
              ", ",
            )}.`,
            "One narrative answer can cover several of these points. Detailed role assignments and contact verification are not needed.",
          ),
        },
        recommendationNeeded: null,
      };
    }

    if (state.interaction?.kind === "recommendation") {
      const activeDecisionId = state.interaction.decision_id;
      const stillPending = unresolvedStage5RecommendationDomains(state, decisions).some(
        (domain) =>
          recommendationDecisionId(domain) === activeDecisionId,
      );
      if (stillPending) return { state, recommendationNeeded: null };
    }

    const [nextRecommendation] = unresolvedStage5RecommendationDomains(
      state,
      decisions,
    );
    if (!nextRecommendation) {
      return {
        state: {
          ...state,
          completed_gates: [...new Set([...state.completed_gates, 5])],
          interaction: {
            kind: "complete",
            title: "Your Blueprint decisions are saved",
            message:
              "Your beneficiary, fiduciary, and continuity direction is recorded and ready to carry forward.",
          },
        },
        recommendationNeeded: null,
      };
    }
    return {
      state: { ...state, interaction: null },
      recommendationNeeded: nextRecommendation,
    };
  }
}

export function presentRecommendation(
  state: BlueprintState,
  domain: RecommendationDomain,
  content: WithGeneratedResponse<RecommendationContent>,
): BlueprintState {
  const generationMetadata = generatedResponseMetadata(content);
  const stateWithGeneration = appendGeneratedResponse(
    state,
    generationMetadata,
  );
  return BlueprintStateSchema.parse({
    ...stateWithGeneration,
    interaction: {
      kind: "recommendation",
      decision_id: recommendationDecisionId(domain),
      domain,
      content: RecommendationContentSchema.parse(content),
      generation_metadata: generationMetadata,
    },
  });
}

function mergePatch<T extends Record<string, string | null>>(
  current: T,
  patch: Partial<T> | null,
) {
  return patch ? { ...current, ...patch } : current;
}

export function applyBlueprintAnswer(
  state: BlueprintState,
  interpretation: WithGeneratedResponse<BlueprintAnswerInterpretation>,
): { state: BlueprintState; assistantMessage: string } {
  if (state.interaction?.kind !== "question") {
    throw new Error("A Blueprint question is not active.");
  }
  const stateWithGeneration = appendGeneratedResponse(
    state,
    generatedResponseMetadata(interpretation),
  );
  if (interpretation.outcome === "stop") {
    if (!interpretation.stop) {
      throw new Error("A Blueprint stop outcome requires stop details.");
    }
    return applyBlueprintStop(stateWithGeneration, interpretation.stop);
  }
  if (interpretation.outcome === "clarification") {
    if (!interpretation.clarification_question) {
      throw new Error("A clarification outcome requires a question.");
    }
    return {
      state: {
        ...stateWithGeneration,
        interaction: {
          kind: "question",
          key: "clarification",
          prompt: interpretation.clarification_question,
          helper: state.interaction.helper,
        },
      },
      assistantMessage: interpretation.clarification_question,
    };
  }

  let updated = stateWithGeneration;
  if (state.current_gate === 2) {
    updated = {
      ...stateWithGeneration,
      planning_baseline: mergePatch(
        stateWithGeneration.planning_baseline,
        interpretation.patch.planning_baseline,
      ),
    };
  } else if (state.current_gate === 4) {
    updated = {
      ...stateWithGeneration,
      beneficiary_outcomes: mergePatch(
        stateWithGeneration.beneficiary_outcomes,
        interpretation.patch.beneficiary_outcomes,
      ),
    };
  } else if (state.current_gate === 5) {
    updated = {
      ...stateWithGeneration,
      fiduciary_continuity_outcomes: mergePatch(
        stateWithGeneration.fiduciary_continuity_outcomes,
        interpretation.patch.fiduciary_continuity_outcomes,
      ),
    };
  }
  return {
    state: { ...updated, interaction: null, revision: state.revision + 1 },
    assistantMessage: interpretation.acknowledgement,
  };
}

export function applyBlueprintStop(
  state: BlueprintState,
  stop: BlueprintStop,
): { state: BlueprintState; assistantMessage: string } {
  const parsedStop = BlueprintStopSchema.parse(stop);
  return {
    state: BlueprintStateSchema.parse({
      ...state,
      stop: parsedStop,
      interaction: { kind: "stop", stop: parsedStop },
      revision: state.revision + 1,
    }),
    assistantMessage: parsedStop.immediate_action,
  };
}

export function applyEvidenceTreatment(
  state: BlueprintState,
  treatment: WithGeneratedResponse<EvidenceTreatment>,
): BlueprintState {
  if (state.current_gate !== 3 || state.interaction?.kind !== "evidence") {
    throw new Error("The focused evidence checkpoint is not active.");
  }
  const stateWithGeneration = appendGeneratedResponse(
    state,
    generatedResponseMetadata(treatment),
  );
  return {
    ...stateWithGeneration,
    evidence: {
      ...stateWithGeneration.evidence,
      status: treatment.confirmation_dependency ? "dependency" : "supported",
      working_scenario: treatment.working_scenario,
      contingency: treatment.contingency,
      confirmation_dependency: treatment.confirmation_dependency,
    },
    interaction: null,
    revision: state.revision + 1,
  };
}

export function buildDecisionRecord(
  state: BlueprintState,
  response: WithGeneratedResponse<RecommendationResponse>,
): DecisionRecord {
  if (state.interaction?.kind !== "recommendation") {
    throw new Error("A Blueprint recommendation is not active.");
  }
  if (response.outcome !== "accepted" || !response.disposition) {
    throw new Error("A recommendation response requires a disposition.");
  }
  return DecisionRecordSchema.parse({
    decision_id: state.interaction.decision_id,
    domain: state.interaction.domain,
    recommendation: state.interaction.content.starting_point,
    principal_response: response.disposition,
    modification: response.modification,
    open_confirmation:
      response.open_confirmation ?? state.interaction.content.open_confirmation,
    implementation_evidence:
      state.interaction.domain === "beneficiary"
        ? "Confirm final beneficiary provisions in executed documents."
        : state.interaction.domain === "fiduciary_continuity"
          ? "Confirm fiduciary appointments, acceptance, successor provisions, and continuity responsibilities in executed documents and operating records."
          : state.interaction.domain === "special_asset"
            ? "Confirm the approved special-asset treatment in governing documents and applicable operating records."
            : "Confirm the approved readiness progression in governing documents and family-readiness records.",
    resolved: true,
    recommendation_generation:
      state.interaction.generation_metadata ?? null,
    response_interpretation_generation:
      generatedResponseMetadata(response),
  });
}

export function applyRecommendationClarification(
  state: BlueprintState,
  response: RecommendationResponse,
) {
  if (response.outcome !== "clarification" || !response.clarification_question) {
    throw new Error("A clarification response requires a question.");
  }
  return {
    state: {
      ...state,
      interaction: {
        kind: "question" as const,
        key: "clarification" as const,
        prompt: response.clarification_question,
        helper: "Clarify only the outcome you want handled differently.",
      },
    },
    assistantMessage: response.clarification_question,
  };
}

export function applyRecommendationResponse(
  state: BlueprintState,
  response: WithGeneratedResponse<RecommendationResponse>,
): {
  state: BlueprintState;
  assistantMessage: string;
  decision: DecisionRecord | null;
} {
  if (state.interaction?.kind !== "recommendation") {
    throw new Error("A Blueprint recommendation is not active.");
  }
  const stateWithGeneration = appendGeneratedResponse(
    state,
    generatedResponseMetadata(response),
  );
  if (response.outcome === "stop") {
    if (!response.stop) {
      throw new Error("A Blueprint stop outcome requires stop details.");
    }
    const stopped = applyBlueprintStop(stateWithGeneration, response.stop);
    return { ...stopped, decision: null };
  }
  if (response.outcome === "clarification") {
    const clarified = applyRecommendationClarification(
      stateWithGeneration,
      response,
    );
    return { ...clarified, decision: null };
  }
  const decision = buildDecisionRecord(stateWithGeneration, response);
  return {
    state: {
      ...stateWithGeneration,
      interaction: null,
      revision: state.revision + 1,
    },
    assistantMessage: response.acknowledgement,
    decision,
  };
}

export function phaseLabel(phase: BlueprintPhase) {
  return phase === "PLANNING_FOUNDATION"
    ? "Planning Foundation"
    : "Blueprint Decisions";
}

export function phaseProgress(phase: BlueprintPhase) {
  return phase === "PLANNING_FOUNDATION"
    ? USER_JOURNEY_PROGRESS.planningFoundation
    : USER_JOURNEY_PROGRESS.blueprintDecisions;
}
