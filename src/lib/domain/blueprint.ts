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
  "FINAL_REVIEW",
  "ESTATE_BLUEPRINT",
]);
export type BlueprintPhase = z.infer<typeof BlueprintPhaseSchema>;

export const BlueprintGateSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
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
  "tax_transfer_strategy",
  "administration_liquidity",
  "asset_transfer_strategy",
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
  objective: NullableText.optional(),
  recommendation: z.string().min(1),
  rationale: NullableText.optional(),
  alternative_or_tradeoff: NullableText.optional(),
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

export const EstateTeamMemberSchema = z.object({
  name: z.string().min(1),
  firm_or_relationship: z.string().min(1),
  role: z.string().min(1),
  contact: z.string().min(1),
});
export type EstateTeamMember = z.infer<typeof EstateTeamMemberSchema>;

export const BlueprintSourceContextSchema = z.object({
  goals_and_priorities: z.array(z.string().min(1)),
  definition_of_success: NullableText,
  current_plan_context: NullableText,
  complexity_flags: z.array(z.string().min(1)),
  estate_team: z.array(EstateTeamMemberSchema),
});
export type BlueprintSourceContext = z.infer<
  typeof BlueprintSourceContextSchema
>;

export const FinalReviewProfileSchema = z.object({
  goals_and_priorities: z.string().min(1),
  planning_baseline: z.string().min(1),
  beneficiary_architecture: z.string().min(1),
  fiduciary_and_continuity_design: z.string().min(1),
  tax_and_transfer_direction: z.string().min(1),
  asset_and_liquidity_treatment: z.string().min(1),
  family_readiness_design: z.string().min(1),
  material_open_confirmations: z.array(z.string().min(1)),
});
export type FinalReviewProfile = z.infer<typeof FinalReviewProfileSchema>;

export const FinalReviewSectionSchema = z.enum([
  "goals_and_priorities",
  "planning_baseline",
  "beneficiary_architecture",
  "fiduciary_and_continuity_design",
  "tax_and_transfer_direction",
  "asset_and_liquidity_treatment",
  "family_readiness_design",
  "material_open_confirmations",
]);
export type FinalReviewSection = z.infer<typeof FinalReviewSectionSchema>;

export const FinalReviewCorrectionSchema = z.object({
  section: FinalReviewSectionSchema,
  replacement: z.string().min(1),
  acknowledgement: z.string().min(1),
});
export type FinalReviewCorrection = z.infer<
  typeof FinalReviewCorrectionSchema
>;

export const BlueprintGenerationInputSchema = z.object({
  blueprint_id: z.string().uuid(),
  matter_id: z.string().uuid(),
  client_label: z.string().min(1),
  workflow_version: z.literal(BLUEPRINT_WORKFLOW_VERSION),
  frozen_at: z.string().datetime(),
  profile: FinalReviewProfileSchema,
  planning_synthesis: PlanningSynthesisSchema,
  evidence: EvidenceStateSchema,
  decisions: z.array(DecisionRecordSchema),
  estate_team: z.array(EstateTeamMemberSchema),
  developed_before_existing_plan_review: z.literal(true),
});
export type BlueprintGenerationInput = z.infer<
  typeof BlueprintGenerationInputSchema
>;

const BlueprintAtAGlanceSectionSchema = z.object({
  key: z.literal("at_a_glance"),
  title: z.literal("Your Estate Blueprint - At a Glance"),
  overview: z.array(z.string().min(1)).min(1),
  objectives: z.array(z.string().min(1)),
  governing_constraints: z.array(z.string().min(1)),
  planning_baseline: z.array(
    z.object({ label: z.string().min(1), value: z.string().min(1) }),
  ),
  schematic: z.object({
    nodes: z.array(z.string().min(1)).min(2),
    flows: z.array(z.string().min(1)).min(1),
  }),
});

const BlueprintPlanWorksSectionSchema = z.object({
  key: z.literal("plan_works"),
  title: z.literal("How Your Plan Works"),
  components: z.array(
    z.object({
      title: z.string().min(1),
      what_it_does: z.string().min(1),
      why_it_fits: z.string().min(1),
      tradeoff_or_dependency: z.string().min(1),
    }),
  ),
  operating_detail_note: z.string().min(1),
});

const BlueprintConfirmationsSectionSchema = z.object({
  key: z.literal("confirmations"),
  title: z.literal("What Still Needs to Be Confirmed"),
  items: z.array(
    z.object({
      question: z.string().min(1),
      why_it_matters: z.string().min(1),
      owner: z.string().min(1),
    }),
  ),
  approval_boundary: z.string().min(1),
  existing_plan_boundary: z.string().min(1),
});

const BlueprintNextStepsSectionSchema = z.object({
  key: z.literal("next_steps"),
  title: z.literal("What Happens Next"),
  steps: z.array(z.string().min(1)).min(1),
  decisions_already_made: z.array(z.string().min(1)),
  concrete_next_action: z.string().min(1),
});

export const BlueprintDocumentSchema = z.object({
  source_snapshot_id: z.string().uuid(),
  title: z.literal("Estate Blueprint"),
  report_type: z.literal("Estate Planning Report"),
  subtitle: z.string().min(1),
  organization_name: z.literal("Estate Coordinator"),
  prepared_by: z.literal("Estate Coordinator"),
  version_status: z.literal("Principal-confirmed target-state design"),
  date: z.string().min(1),
  confidentiality_line: z.string().min(1),
  advice_boundary: z.string().min(1),
  estate_team: z.array(EstateTeamMemberSchema),
  sections: z.tuple([
    BlueprintAtAGlanceSectionSchema,
    BlueprintPlanWorksSectionSchema,
    BlueprintConfirmationsSectionSchema,
    BlueprintNextStepsSectionSchema,
  ]),
});
export type BlueprintDocument = z.infer<typeof BlueprintDocumentSchema>;

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

const FinalReviewInteractionSchema = z.object({
  kind: z.literal("final_review"),
  profile: FinalReviewProfileSchema,
});

const GeneratingInteractionSchema = z.object({
  kind: z.literal("generating"),
  blueprint_id: z.string().uuid(),
});

const BlueprintPreviewInteractionSchema = z.object({
  kind: z.literal("blueprint"),
  blueprint_id: z.string().uuid(),
});

export const BlueprintInteractionSchema = z.discriminatedUnion("kind", [
  QuestionInteractionSchema,
  EvidenceInteractionSchema,
  RecommendationInteractionSchema,
  StopInteractionSchema,
  CompleteInteractionSchema,
  FinalReviewInteractionSchema,
  GeneratingInteractionSchema,
  BlueprintPreviewInteractionSchema,
]);
export type BlueprintInteraction = z.infer<typeof BlueprintInteractionSchema>;

export const BlueprintStateSchema = z.object({
  workflow_version: z.literal(BLUEPRINT_WORKFLOW_VERSION),
  phase: BlueprintPhaseSchema,
  current_gate: BlueprintGateSchema,
  completed_gates: z.array(z.number().int().min(1).max(7)),
  planning_baseline: PlanningBaselineSchema,
  planning_synthesis: PlanningSynthesisSchema.nullable(),
  evidence: EvidenceStateSchema,
  beneficiary_outcomes: BeneficiaryOutcomesSchema,
  fiduciary_continuity_outcomes: FiduciaryContinuityOutcomesSchema,
  source_context: BlueprintSourceContextSchema.default({
    goals_and_priorities: [],
    definition_of_success: null,
    current_plan_context: null,
    complexity_flags: [],
    estate_team: [],
  }),
  final_review_profile: FinalReviewProfileSchema.nullable().default(null),
  final_review_corrections: z.array(FinalReviewCorrectionSchema).default([]),
  generation_snapshot_id: z.string().uuid().nullable().default(null),
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

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function estateTeam(record: MatterOpeningRecord): EstateTeamMember[] {
  const professionals = record.professional_and_family_contacts.map(
    (contact) => ({
      name: contact.name,
      firm_or_relationship: contact.firm || "Professional adviser",
      role: contact.estate_role || contact.expertise || "Estate team member",
      contact:
        [contact.email, contact.telephone].filter(Boolean).join(" / ") ||
        "Missing",
    }),
  );
  const participants = record.other_participants.map((participant) => ({
    name: participant.name,
    firm_or_relationship: participant.relationship || "Family participant",
    role: participant.intended_role || "Planning participant",
    contact: "Missing",
  }));
  return EstateTeamMemberSchema.array().parse([
    ...professionals,
    ...participants,
  ]);
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
    source_context: {
      goals_and_priorities: record.top_three_priorities.map(humanize),
      definition_of_success: record.principal_definition_of_success,
      current_plan_context: record.current_plan_snapshot,
      complexity_flags: record.geographic_and_complexity_flags,
      estate_team: estateTeam(record),
    },
    final_review_profile: null,
    final_review_corrections: [],
    generation_snapshot_id: null,
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
    case "tax_transfer_strategy":
      return "BR-006-TAX-TRANSFER";
    case "administration_liquidity":
      return "BR-006-ADMINISTRATION-LIQUIDITY";
    case "asset_transfer_strategy":
      return "BR-006-ASSET-TRANSFER";
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

function unresolvedStage6RecommendationDomains(
  state: BlueprintState,
  decisions: DecisionRecord[],
): RecommendationDomain[] {
  const resolvedIds = new Set(decisions.map((decision) => decision.decision_id));
  const priorities = state.source_context.goals_and_priorities.join(" ");
  const assetContext = [
    state.planning_baseline.material_assets_range,
    state.planning_baseline.expected_inheritance_range,
    ...state.source_context.complexity_flags,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const applicable: RecommendationDomain[] = [];

  if (
    /tax|minimi[sz]|million|billion|inherit|transfer/i.test(
      `${priorities} ${assetContext}`,
    )
  ) {
    applicable.push("tax_transfer_strategy");
  }
  if (
    state.source_context.current_plan_context ||
    /(real estate|property|home|business|private|illiquid|insurance)/i.test(
      assetContext,
    )
  ) {
    applicable.push("administration_liquidity");
  }

  const stage5SpecialAssetResolved = resolvedIds.has(
    recommendationDecisionId("special_asset"),
  );
  if (
    !stage5SpecialAssetResolved &&
    /(real estate|business|private|digital|charit|retirement|insurance)/i.test(
      assetContext,
    )
  ) {
    applicable.push("asset_transfer_strategy");
  }

  return applicable.filter(
    (domain) => !resolvedIds.has(recommendationDecisionId(domain)),
  );
}

function decisionDirection(
  decisions: DecisionRecord[],
  domains: RecommendationDomain[],
  fallback: string,
) {
  const selected = decisions.filter((decision) =>
    domains.includes(decision.domain),
  );
  if (!selected.length) return fallback;
  return selected
    .map((decision) => {
      if (decision.principal_response === "modify" && decision.modification) {
        return decision.modification;
      }
      if (
        decision.principal_response === "alternative_requested" ||
        decision.principal_response === "defer" ||
        decision.principal_response === "reject"
      ) {
        return `${decision.recommendation} The principal recorded the direction as ${humanize(
          decision.principal_response,
        ).toLowerCase()}.`;
      }
      return decision.recommendation;
    })
    .join(" ");
}

function uniqueNonempty(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

export function buildFinalReviewProfile(
  state: BlueprintState,
  decisions: DecisionRecord[],
): FinalReviewProfile {
  const synthesis = state.planning_synthesis;
  if (!synthesis) {
    throw new Error("The planning synthesis is required for Final Review.");
  }
  const goals = uniqueNonempty([
    ...state.source_context.goals_and_priorities,
    state.source_context.definition_of_success,
  ]).join("; ");
  const openConfirmations = uniqueNonempty([
    ...synthesis.confirmation_dependencies,
    state.evidence.confirmation_dependency,
    ...decisions.map((decision) => decision.open_confirmation),
    ...decisions
      .filter((decision) =>
        ["alternative_requested", "defer", "reject"].includes(
          decision.principal_response,
        ),
      )
      .map(
        (decision) =>
          `${decision.objective ?? humanize(decision.domain)} remains open because the principal recorded ${humanize(
            decision.principal_response,
          ).toLowerCase()}.`,
      ),
  ]);

  return FinalReviewProfileSchema.parse({
    goals_and_priorities:
      goals || "Preserve the confirmed planning direction and family outcomes.",
    planning_baseline: `${synthesis.current_and_projected_estate_range} ${synthesis.lifetime_security_boundary}`,
    beneficiary_architecture: decisionDirection(
      decisions,
      ["beneficiary"],
      "Beneficiary architecture remains subject to the confirmed beneficiary outcomes and professional drafting.",
    ),
    fiduciary_and_continuity_design: decisionDirection(
      decisions,
      ["fiduciary_continuity", "special_asset"],
      "Fiduciary and continuity design remains subject to confirmed appointments and professional drafting.",
    ),
    tax_and_transfer_direction: decisionDirection(
      decisions,
      ["tax_transfer_strategy"],
      "No separate tax or lifetime-transfer recommendation is materially required beyond professional confirmation of the planning baseline.",
    ),
    asset_and_liquidity_treatment: decisionDirection(
      decisions,
      ["administration_liquidity", "asset_transfer_strategy"],
      synthesis.liquidity_and_concentration_considerations,
    ),
    family_readiness_design: decisionDirection(
      decisions,
      ["readiness"],
      state.beneficiary_outcomes.stewardship_objectives ??
        "Readiness expectations remain tied to the confirmed beneficiary outcomes.",
    ),
    material_open_confirmations: openConfirmations,
  });
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

    if (state.current_gate === 5) {
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
        const stillPending = unresolvedStage5RecommendationDomains(
          state,
          decisions,
        ).some(
          (domain) => recommendationDecisionId(domain) === activeDecisionId,
        );
        if (stillPending) return { state, recommendationNeeded: null };
      }

      const [nextRecommendation] = unresolvedStage5RecommendationDomains(
        state,
        decisions,
      );
      if (nextRecommendation) {
        return {
          state: { ...state, interaction: null },
          recommendationNeeded: nextRecommendation,
        };
      }
      state = {
        ...state,
        current_gate: 6,
        completed_gates: [...new Set([...state.completed_gates, 5])],
        interaction: null,
      };
      continue;
    }

    if (state.current_gate === 6) {
      if (state.interaction?.kind === "recommendation") {
        const activeDecisionId = state.interaction.decision_id;
        const stillPending = unresolvedStage6RecommendationDomains(
          state,
          decisions,
        ).some(
          (domain) => recommendationDecisionId(domain) === activeDecisionId,
        );
        if (stillPending) return { state, recommendationNeeded: null };
      }
      const [nextRecommendation] = unresolvedStage6RecommendationDomains(
        state,
        decisions,
      );
      if (nextRecommendation) {
        return {
          state: { ...state, interaction: null },
          recommendationNeeded: nextRecommendation,
        };
      }
      const profile = buildFinalReviewProfile(state, decisions);
      state = {
        ...state,
        current_gate: 7,
        phase: "FINAL_REVIEW",
        completed_gates: [...new Set([...state.completed_gates, 6])],
        final_review_profile: profile,
        interaction: { kind: "final_review", profile },
      };
      continue;
    }

    if (state.current_gate === 7) {
      if (state.generation_snapshot_id) return { state, recommendationNeeded: null };
      const profile = state.final_review_profile ?? buildFinalReviewProfile(state, decisions);
      return {
        state: {
          ...state,
          phase: "FINAL_REVIEW",
          final_review_profile: profile,
          interaction: { kind: "final_review", profile },
        },
        recommendationNeeded: null,
      };
    }
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
  const implementationEvidence = (() => {
    switch (state.interaction.domain) {
      case "beneficiary":
        return "Confirm final beneficiary provisions in executed documents.";
      case "fiduciary_continuity":
        return "Confirm fiduciary appointments, acceptance, successor provisions, and continuity responsibilities in executed documents and operating records.";
      case "special_asset":
        return "Confirm the approved special-asset treatment in governing documents and applicable operating records.";
      case "readiness":
        return "Confirm the approved readiness progression in governing documents and family-readiness records.";
      case "tax_transfer_strategy":
        return "Confirm professional modeling, valuation, tax assumptions, liquidity, and approved transfer terms before implementation.";
      case "administration_liquidity":
        return "Confirm ownership, beneficiary designations, administrative transfer paths, and available estate liquidity.";
      case "asset_transfer_strategy":
        return "Confirm asset-specific ownership, transfer restrictions, valuation, liquidity, and professional implementation requirements.";
    }
  })();
  return DecisionRecordSchema.parse({
    decision_id: state.interaction.decision_id,
    domain: state.interaction.domain,
    objective: state.interaction.content.objective,
    recommendation: state.interaction.content.starting_point,
    rationale: state.interaction.content.rationale,
    alternative_or_tradeoff:
      state.interaction.content.alternative_or_tradeoff,
    principal_response: response.disposition,
    modification: response.modification,
    open_confirmation:
      response.open_confirmation ?? state.interaction.content.open_confirmation,
    implementation_evidence: implementationEvidence,
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

export function applyFinalReviewCorrection(
  state: BlueprintState,
  input: FinalReviewCorrection,
): { state: BlueprintState; assistantMessage: string } {
  if (
    state.current_gate !== 7 ||
    state.interaction?.kind !== "final_review" ||
    !state.final_review_profile
  ) {
    throw new Error("Final Review is not active.");
  }
  const correction = FinalReviewCorrectionSchema.parse(input);
  const profile: FinalReviewProfile = {
    ...state.final_review_profile,
    [correction.section]:
      correction.section === "material_open_confirmations"
        ? correction.replacement
            .split(/\r?\n|;/)
            .map((value) => value.trim())
            .filter(Boolean)
        : correction.replacement,
  };
  const parsedProfile = FinalReviewProfileSchema.parse(profile);
  return {
    state: BlueprintStateSchema.parse({
      ...state,
      final_review_profile: parsedProfile,
      final_review_corrections: [
        ...state.final_review_corrections,
        correction,
      ],
      interaction: { kind: "final_review", profile: parsedProfile },
      revision: state.revision + 1,
    }),
    assistantMessage: correction.acknowledgement,
  };
}

export function freezeBlueprintGeneration(
  state: BlueprintState,
  decisions: DecisionRecord[],
  input: {
    blueprintId: string;
    matterId: string;
    clientLabel: string;
    frozenAt: string;
  },
): { state: BlueprintState; generationInput: BlueprintGenerationInput } {
  if (
    state.current_gate !== 7 ||
    state.interaction?.kind !== "final_review" ||
    !state.final_review_profile ||
    !state.planning_synthesis
  ) {
    throw new Error("A complete Final Review is required before generation.");
  }
  if (state.generation_snapshot_id) {
    throw new Error("The Blueprint generation input is already frozen.");
  }
  const generationInput = BlueprintGenerationInputSchema.parse(
    structuredClone({
      blueprint_id: input.blueprintId,
      matter_id: input.matterId,
      client_label: input.clientLabel,
      workflow_version: state.workflow_version,
      frozen_at: input.frozenAt,
      profile: state.final_review_profile,
      planning_synthesis: state.planning_synthesis,
      evidence: state.evidence,
      decisions,
      estate_team: state.source_context.estate_team,
      developed_before_existing_plan_review: true,
    }),
  );
  return {
    state: BlueprintStateSchema.parse({
      ...state,
      phase: "ESTATE_BLUEPRINT",
      completed_gates: [...new Set([...state.completed_gates, 7])],
      generation_snapshot_id: input.blueprintId,
      interaction: {
        kind: "generating",
        blueprint_id: input.blueprintId,
      },
      revision: state.revision + 1,
    }),
    generationInput,
  };
}

export function publishBlueprint(
  state: BlueprintState,
  blueprintId: string,
): BlueprintState {
  if (
    state.phase !== "ESTATE_BLUEPRINT" ||
    state.generation_snapshot_id !== blueprintId
  ) {
    throw new Error("The frozen Blueprint generation input does not match.");
  }
  return BlueprintStateSchema.parse({
    ...state,
    interaction: { kind: "blueprint", blueprint_id: blueprintId },
  });
}

function domainTitle(domain: RecommendationDomain) {
  switch (domain) {
    case "beneficiary":
      return "Beneficiary structure";
    case "fiduciary_continuity":
      return "Fiduciary and continuity structure";
    case "special_asset":
      return "Special-asset continuity";
    case "readiness":
      return "Family-readiness design";
    case "tax_transfer_strategy":
      return "Tax and lifetime-transfer direction";
    case "administration_liquidity":
      return "Administration and estate liquidity";
    case "asset_transfer_strategy":
      return "Material-asset transfer treatment";
  }
}

function confirmationOwner(item: string) {
  if (/counsel|attorney|legal/i.test(item)) return "Estate-planning counsel";
  if (/tax|CPA|GST|exemption/i.test(item)) return "CPA or tax adviser";
  if (/valuation|value/i.test(item)) return "Valuation professional";
  if (/insurance/i.test(item)) return "Insurance adviser";
  if (/investment|liquidity|concentration/i.test(item)) {
    return "Investment or financial adviser";
  }
  return "Principal and appropriate professional";
}

function asSentence(value: string) {
  return `${value.trim().replace(/[.!?]+$/, "")}.`;
}

export function buildBlueprintDocument(
  input: BlueprintGenerationInput,
): BlueprintDocument {
  const generationInput = BlueprintGenerationInputSchema.parse(input);
  const activeDecisions = generationInput.decisions.filter((decision) =>
    ["accept", "modify", "confirmation_required"].includes(
      decision.principal_response,
    ),
  );
  const components = activeDecisions.map((decision) => ({
    title: domainTitle(decision.domain),
    what_it_does:
      decision.principal_response === "modify" && decision.modification
        ? decision.modification
        : decision.recommendation,
    why_it_fits:
      decision.rationale ??
      `This direction supports the confirmed priorities: ${generationInput.profile.goals_and_priorities}.`,
    tradeoff_or_dependency:
      decision.alternative_or_tradeoff ??
      decision.open_confirmation ??
      "The final design and implementation details remain subject to professional confirmation.",
  }));
  const confirmations = uniqueNonempty([
    ...generationInput.profile.material_open_confirmations,
    ...generationInput.decisions
      .filter((decision) =>
        ["alternative_requested", "defer", "reject"].includes(
          decision.principal_response,
        ),
      )
      .map(
        (decision) =>
          `${decision.objective ?? domainTitle(decision.domain)} remains unresolved.`,
      ),
  ]).map((item) => ({
    question: item,
    why_it_matters:
      "This could affect final drafting, tax treatment, valuation, liquidity, or implementation.",
    owner: confirmationOwner(item),
  }));
  const date = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(generationInput.frozen_at));

  return BlueprintDocumentSchema.parse({
    source_snapshot_id: generationInput.blueprint_id,
    title: "Estate Blueprint",
    report_type: "Estate Planning Report",
    subtitle: `Target-State Design for ${generationInput.client_label}`,
    organization_name: "Estate Coordinator",
    prepared_by: "Estate Coordinator",
    version_status: "Principal-confirmed target-state design",
    date,
    confidentiality_line: `Confidential. ${generationInput.client_label}.`,
    advice_boundary:
      "This Estate Blueprint organizes planning direction. It is not legal, tax, valuation, GST, or other professional advice.",
    estate_team: generationInput.estate_team,
    sections: [
      {
        key: "at_a_glance",
        title: "Your Estate Blueprint - At a Glance",
        overview: [
          `Your Blueprint is organized around these priorities: ${asSentence(generationInput.profile.goals_and_priorities)}`,
          `The recommended target state combines ${generationInput.profile.beneficiary_architecture} ${generationInput.profile.fiduciary_and_continuity_design}`,
        ],
        objectives: uniqueNonempty(
          generationInput.profile.goals_and_priorities.split(";"),
        ),
        governing_constraints: [
          generationInput.profile.planning_baseline,
          generationInput.profile.asset_and_liquidity_treatment,
        ],
        planning_baseline: [
          {
            label: "Principal-confirmed planning baseline",
            value: generationInput.profile.planning_baseline,
          },
          {
            label: "Current and projected estate range",
            value:
              generationInput.planning_synthesis
                .current_and_projected_estate_range,
          },
          {
            label: "Transfer-planning direction",
            value: generationInput.profile.tax_and_transfer_direction,
          },
        ],
        schematic: {
          nodes: [
            "Your planning base and lifetime-security boundary",
            "Protected beneficiary structure",
            "Fiduciary, continuity, and liquidity support",
            "Professional drafting and implementation",
          ],
          flows: [
            "Confirmed priorities guide the target-state structure",
            "Professional confirmation converts the Blueprint into final implementation",
          ],
        },
      },
      {
        key: "plan_works",
        title: "How Your Plan Works",
        components,
        operating_detail_note:
          "Detailed continuity instructions, family action guides, digital recovery procedures, and asset-level operating records should be maintained separately from this Blueprint.",
      },
      {
        key: "confirmations",
        title: "What Still Needs to Be Confirmed",
        items: confirmations,
        approval_boundary:
          "Principal approval confirms that this Blueprint is understandable and accurately reflects the intended planning direction. It does not verify legal, tax, valuation, GST, or other professional conclusions.",
        existing_plan_boundary:
          "This Blueprint was developed before review of your existing estate-planning documents.",
      },
      {
        key: "next_steps",
        title: "What Happens Next",
        steps: [
          "Confirm the material open assumptions with the named professionals.",
          "Compare the existing estate plan with this frozen target state.",
          "Have counsel and tax professionals finalize the design.",
          "Implement approved ownership, beneficiary, fiduciary, tax, funding, and liquidity actions.",
          "Verify implementation evidence and maintain the separate operating records.",
        ],
        decisions_already_made: activeDecisions.map(
          (decision) =>
            decision.modification ?? decision.recommendation,
        ),
        concrete_next_action:
          "Schedule one working session with estate-planning counsel to confirm the open items and compare the existing plan with this Blueprint.",
      },
    ],
  });
}

export function phaseLabel(phase: BlueprintPhase) {
  if (phase === "PLANNING_FOUNDATION") return "Planning Foundation";
  if (phase === "BLUEPRINT_DECISIONS") return "Blueprint Decisions";
  if (phase === "FINAL_REVIEW") return "Final Review";
  return "Your Estate Blueprint";
}

export function phaseProgress(phase: BlueprintPhase) {
  if (phase === "PLANNING_FOUNDATION") {
    return USER_JOURNEY_PROGRESS.planningFoundation;
  }
  if (phase === "BLUEPRINT_DECISIONS") {
    return USER_JOURNEY_PROGRESS.blueprintDecisions;
  }
  if (phase === "FINAL_REVIEW") return USER_JOURNEY_PROGRESS.finalReview;
  return USER_JOURNEY_PROGRESS.estateBlueprint;
}
