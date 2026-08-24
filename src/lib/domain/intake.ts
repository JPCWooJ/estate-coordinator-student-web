import { z } from "zod";

import type { MatterOpeningRecord } from "./matter-opening";

export const OutcomeCodeSchema = z.enum([
  "intended_transfer",
  "tax_minimization",
  "asset_protection",
  "support_for_others",
  "distribution_control",
  "incapacity_readiness",
  "conflict_prevention",
  "heir_readiness",
  "plan_alignment",
  "house_in_order_assurance",
  "business_charitable_family_legacy",
  "other",
]);
export type OutcomeCode = z.infer<typeof OutcomeCodeSchema>;

export const IntakeSectionSchema = z.enum([
  "goals_family",
  "planning_context",
  "team_continuity",
  "financial_range",
  "planning_summary",
]);
export type IntakeSection = z.infer<typeof IntakeSectionSchema>;

export const IntakeFieldStatusSchema = z.enum([
  "answered",
  "unknown",
  "not_decided",
  "not_applicable",
  "missing",
]);
export type IntakeFieldStatus = z.infer<typeof IntakeFieldStatusSchema>;

const FieldMetadataSchema = z.object({
  status: IntakeFieldStatusSchema,
  source: z.string().min(1),
  confirmed: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  lastUpdatedAt: z.string().datetime(),
  revision: z.number().int().positive(),
  decisionSupport: z.array(z.string().min(1)),
});

export const BeneficiaryEntrySchema = z.object({
  nameOrGroup: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(120),
  role: z.enum(["primary", "substitute", "protected_person", "other"]),
  treatment: z.string().trim().min(1).max(240),
  protectionNeeds: z.array(z.string().trim().min(1).max(240)).max(8),
  readinessNotes: z.string().trim().max(500),
});
export type BeneficiaryEntry = z.infer<typeof BeneficiaryEntrySchema>;

export const TeamContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  firmOrRelationship: z.string().trim().max(160),
  role: z.string().trim().min(1).max(160),
  email: z.union([z.string().trim().email(), z.literal("")]),
  phone: z.string().trim().max(80),
  primaryOrBackup: z.enum(["primary", "backup", "adviser", "participant"]),
  responsibilities: z.string().trim().max(600),
});
export type TeamContact = z.infer<typeof TeamContactSchema>;

const GoalsFamilyValuesSchema = z.object({
  desiredOutcomes: z.array(OutcomeCodeSchema).min(1).max(12),
  topPriorities: z.array(OutcomeCodeSchema).min(1).max(3),
  successDefinition: z.string().trim().min(1).max(1000),
  beneficiaries: z.array(BeneficiaryEntrySchema).min(1).max(20),
  materialCircumstances: z.string().trim().min(1).max(1000),
});

const CurrentPlanStatusSchema = z.enum([
  "no_existing_plan",
  "unsure_what_exists",
  "review_requested",
  "implementation_or_organization_needed",
  "current",
  "update_needed",
  "unknown",
]);

const PlanningContextValuesSchema = z.object({
  currentPlanStatus: CurrentPlanStatusSchema,
  documentTypes: z.array(z.string().trim().min(1).max(120)).max(12),
  approximatePlanDate: z.string().trim().min(1).max(120),
  materialChanges: z.array(z.string().trim().min(1).max(300)).max(12),
  planningReason: z.string().trim().min(1).max(1000),
  deadline: z.string().trim().min(1).max(160),
  primaryResidence: z.string().trim().min(1).max(160),
  otherJurisdictions: z.array(z.string().trim().min(1).max(240)).max(12),
  complexityFlags: z.array(z.string().trim().min(1).max(160)).max(12),
  complexityDetails: z.string().trim().min(1).max(1000),
});

const TeamContinuityValuesSchema = z.object({
  contacts: z.array(TeamContactSchema).min(1).max(20),
  missingProfessionalRoles: z.array(z.string().trim().min(1).max(160)).max(12),
  continuityResponsibilities: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
  specialAssetsOrPurposes: z.array(z.string().trim().min(1).max(240)).max(12),
  readinessPlan: z.string().trim().min(1).max(1000),
});

export const FinancialRangeValuesSchema = z.object({
  materialAssetsRange: z.string().trim().min(1).max(240),
  liabilitiesRange: z.string().trim().min(1).max(240),
  expectedInheritanceRange: z.string().trim().min(1).max(240),
  lifetimeSecurityFloor: z.string().trim().min(1).max(240),
  assetsCountedTowardFloor: z.string().trim().min(1).max(500),
  retainedControlRequirement: z.string().trim().min(1).max(500),
  extraordinaryFutureObligations: z.string().trim().min(1).max(500),
});
export type FinancialRangeValues = z.infer<typeof FinancialRangeValuesSchema>;

export const StructuredIntakeSubmissionSchema = z.discriminatedUnion("section", [
  z.object({
    operationId: z.string().uuid(),
    section: z.literal("goals_family"),
    values: GoalsFamilyValuesSchema,
  }),
  z.object({
    operationId: z.string().uuid(),
    section: z.literal("planning_context"),
    values: PlanningContextValuesSchema,
  }),
  z.object({
    operationId: z.string().uuid(),
    section: z.literal("team_continuity"),
    values: TeamContinuityValuesSchema,
  }),
  z.object({
    operationId: z.string().uuid(),
    section: z.literal("financial_range"),
    values: FinancialRangeValuesSchema,
  }),
]);
export type StructuredIntakeSubmission = z.infer<
  typeof StructuredIntakeSubmissionSchema
>;

export const CanonicalIntakeStateSchema = z.object({
  currentSection: IntakeSectionSchema,
  completedSections: z.array(IntakeSectionSchema),
  goalsFamily: GoalsFamilyValuesSchema.nullable(),
  planningContext: PlanningContextValuesSchema.nullable(),
  teamContinuity: TeamContinuityValuesSchema.nullable(),
  financialRange: FinancialRangeValuesSchema.nullable(),
  fieldMeta: z.record(z.string(), FieldMetadataSchema),
  revision: z.number().int().nonnegative(),
  processedOperationIds: z.array(z.string().uuid()).max(100),
});
export type CanonicalIntakeState = z.infer<typeof CanonicalIntakeStateSchema>;

const SECTION_ORDER = [
  "goals_family",
  "planning_context",
  "team_continuity",
  "financial_range",
] as const;

type EditableSection = (typeof SECTION_ORDER)[number];

const DECISION_SUPPORT: Record<EditableSection, Record<string, string[]>> = {
  goals_family: {
    "goals.ranked_outcomes": ["recommendation_applicability", "final_profile"],
    "goals.success": ["recommendation_constraints", "final_profile"],
    "beneficiaries.intent": ["beneficiary_architecture"],
    "beneficiaries.circumstances": [
      "beneficiary_protection",
      "fiduciary_independence",
      "family_readiness",
    ],
  },
  planning_context: {
    "plan.status_and_documents": ["administration_liquidity", "plan_review"],
    "plan.material_changes": ["planning_urgency", "plan_review"],
    "timing.reason_and_deadline": ["planning_urgency", "professional_stop"],
    "jurisdiction.footprint": ["jurisdiction_routing", "asset_transfer_strategy"],
    "complexity.flags": ["evidence_checkpoint", "special_asset_strategy"],
  },
  team_continuity: {
    "team.contacts": ["estate_team", "fiduciary_continuity"],
    "continuity.responsibilities": ["fiduciary_continuity"],
    "continuity.special_assets": ["special_asset_strategy"],
    "continuity.readiness": ["family_readiness"],
  },
  financial_range: {
    "financial.material_assets": ["planning_exposure", "transfer_capacity"],
    "financial.liabilities": ["transfer_capacity", "estate_liquidity"],
    "financial.expected_inheritance": ["planning_exposure", "evidence_checkpoint"],
    "financial.lifetime_security_floor": ["lifetime_security", "transfer_capacity"],
    "financial.assets_counted_toward_floor": ["lifetime_security"],
    "financial.retained_control": ["lifetime_security", "transfer_strategy"],
    "financial.extraordinary_obligations": ["transfer_capacity", "estate_liquidity"],
  },
};

function statusFor(value: string | string[]): IntakeFieldStatus {
  if (Array.isArray(value)) return "answered";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "missing";
  if (normalized === "unknown" || normalized === "not sure") return "unknown";
  if (normalized === "not decided") return "not_decided";
  if (normalized === "not applicable" || normalized === "n/a") {
    return "not_applicable";
  }
  return "answered";
}

function fieldMetadata(
  section: EditableSection,
  values: Record<string, string | string[]>,
  revision: number,
  now: string,
) {
  return Object.fromEntries(
    Object.entries(DECISION_SUPPORT[section]).map(([fieldId, decisionSupport]) => {
      const value = values[fieldId] ?? "";
      return [
        fieldId,
        {
          status: statusFor(value),
          source: `structured:${section}`,
          confirmed: false,
          confidence: "high" as const,
          lastUpdatedAt: now,
          revision,
          decisionSupport,
        },
      ];
    }),
  );
}

export function createCanonicalIntakeState(
  _now = new Date().toISOString(),
): CanonicalIntakeState {
  return {
    currentSection: "goals_family",
    completedSections: [],
    goalsFamily: null,
    planningContext: null,
    teamContinuity: null,
    financialRange: null,
    fieldMeta: {},
    revision: 0,
    processedOperationIds: [],
  };
}

function nextSection(completed: IntakeSection[]): IntakeSection {
  return SECTION_ORDER.find((section) => !completed.includes(section)) ?? "planning_summary";
}

function classifyPlan(
  status: z.infer<typeof CurrentPlanStatusSchema>,
): MatterOpeningRecord["matter_classification"] {
  if (status === "no_existing_plan") return "NEW_PLAN";
  if (status === "update_needed") return "PLAN_UPDATE";
  if (status === "implementation_or_organization_needed") {
    return "IMPLEMENTATION_ORGANIZATION";
  }
  return "PLAN_REVIEW";
}

function priorityDetail(
  outcome: OutcomeCode,
  values: z.infer<typeof GoalsFamilyValuesSchema>,
) {
  const primary = values.beneficiaries
    .filter((beneficiary) => beneficiary.role === "primary")
    .map((beneficiary) => beneficiary.nameOrGroup)
    .join(", ");
  const protections = values.beneficiaries
    .flatMap((beneficiary) => beneficiary.protectionNeeds)
    .join(", ");
  if (outcome === "intended_transfer" || outcome === "support_for_others") {
    return primary || values.successDefinition;
  }
  if (outcome === "asset_protection" || outcome === "distribution_control") {
    return protections || values.materialCircumstances;
  }
  return values.successDefinition;
}

function sectionMetaValues(
  submission: StructuredIntakeSubmission,
): Record<string, string | string[]> {
  if (submission.section === "goals_family") {
    return {
      "goals.ranked_outcomes": submission.values.topPriorities,
      "goals.success": submission.values.successDefinition,
      "beneficiaries.intent": submission.values.beneficiaries.map(
        (beneficiary) => beneficiary.nameOrGroup,
      ),
      "beneficiaries.circumstances": submission.values.materialCircumstances,
    } as Record<string, string | string[]>;
  }
  if (submission.section === "planning_context") {
    return {
      "plan.status_and_documents": [
        submission.values.currentPlanStatus,
        ...submission.values.documentTypes,
        submission.values.approximatePlanDate,
      ],
      "plan.material_changes": submission.values.materialChanges,
      "timing.reason_and_deadline": [
        submission.values.planningReason,
        submission.values.deadline,
      ],
      "jurisdiction.footprint": [
        submission.values.primaryResidence,
        ...submission.values.otherJurisdictions,
      ],
      "complexity.flags": [
        ...submission.values.complexityFlags,
        submission.values.complexityDetails,
      ],
    } as Record<string, string | string[]>;
  }
  if (submission.section === "team_continuity") {
    return {
      "team.contacts": submission.values.contacts.map((contact) => contact.name),
      "continuity.responsibilities": submission.values.continuityResponsibilities,
      "continuity.special_assets": submission.values.specialAssetsOrPurposes,
      "continuity.readiness": submission.values.readinessPlan,
    } as Record<string, string | string[]>;
  }
  return {
    "financial.material_assets": submission.values.materialAssetsRange,
    "financial.liabilities": submission.values.liabilitiesRange,
    "financial.expected_inheritance": submission.values.expectedInheritanceRange,
    "financial.lifetime_security_floor": submission.values.lifetimeSecurityFloor,
    "financial.assets_counted_toward_floor": submission.values.assetsCountedTowardFloor,
    "financial.retained_control": submission.values.retainedControlRequirement,
    "financial.extraordinary_obligations": submission.values.extraordinaryFutureObligations,
  } as Record<string, string | string[]>;
}

export function applyStructuredIntake(
  inputRecord: MatterOpeningRecord,
  inputSubmission: StructuredIntakeSubmission,
  now = new Date().toISOString(),
) {
  const submission = StructuredIntakeSubmissionSchema.parse(inputSubmission);
  const current = inputRecord.canonical_intake ?? createCanonicalIntakeState(now);
  if (current.processedOperationIds.includes(submission.operationId)) {
    return { record: inputRecord, changed: false };
  }
  const revision = current.revision + 1;
  const completedSections = [
    ...new Set([...current.completedSections, submission.section]),
  ];
  const canonical: CanonicalIntakeState = {
    ...current,
    goalsFamily:
      submission.section === "goals_family" ? submission.values : current.goalsFamily,
    planningContext:
      submission.section === "planning_context"
        ? submission.values
        : current.planningContext,
    teamContinuity:
      submission.section === "team_continuity"
        ? submission.values
        : current.teamContinuity,
    financialRange:
      submission.section === "financial_range"
        ? submission.values
        : current.financialRange,
    completedSections,
    currentSection: nextSection(completedSections),
    fieldMeta: {
      ...current.fieldMeta,
      ...fieldMetadata(
        submission.section,
        sectionMetaValues(submission),
        revision,
        now,
      ),
    },
    revision,
    processedOperationIds: [
      ...current.processedOperationIds.slice(-98),
      submission.operationId,
    ],
  };

  let record: MatterOpeningRecord = {
    ...inputRecord,
    canonical_intake: CanonicalIntakeStateSchema.parse(canonical),
  };

  if (submission.section === "goals_family") {
    const primaryPeople = submission.values.beneficiaries
      .map(
        (beneficiary) =>
          `${beneficiary.nameOrGroup} (${beneficiary.relationship}; ${beneficiary.role})`,
      )
      .join("; ");
    const peopleFlags = [
      ...submission.values.beneficiaries.flatMap(
        (beneficiary) => beneficiary.protectionNeeds,
      ),
      submission.values.materialCircumstances,
    ].filter((value) => !/^(none|not applicable)$/i.test(value));
    record = {
      ...record,
      desired_outcomes: submission.values.desiredOutcomes,
      top_three_priorities: submission.values.topPriorities,
      principal_definition_of_success: submission.values.successDefinition,
      priority_details: submission.values.topPriorities.map((outcome) => ({
        outcome,
        detail: priorityDetail(outcome, submission.values),
      })),
      people_and_interests_snapshot: primaryPeople,
      people_circumstance_flags: [...new Set(peopleFlags)],
    };
  } else if (submission.section === "planning_context") {
    const planParts = [
      submission.values.documentTypes.length
        ? submission.values.documentTypes.join(", ")
        : "No known documents",
      `approximately ${submission.values.approximatePlanDate}`,
    ];
    record = {
      ...record,
      current_plan_status: submission.values.currentPlanStatus,
      current_plan_snapshot: planParts.join("; "),
      matter_classification: classifyPlan(submission.values.currentPlanStatus),
      changes_since_current_plan: submission.values.materialChanges,
      timing_event_or_deadline: {
        reason: submission.values.planningReason,
        event: submission.values.deadline === "none" ? "none" : "deadline",
        date: submission.values.deadline,
        importance: submission.values.deadline === "none" ? "normal" : "time-sensitive",
      },
      geographic_and_complexity_flags: [
        submission.values.primaryResidence,
        ...submission.values.otherJurisdictions,
        ...submission.values.complexityFlags,
        submission.values.complexityDetails,
      ].filter((value) => !/^(none|not applicable)$/i.test(value)),
    };
  } else if (submission.section === "team_continuity") {
    record = {
      ...record,
      professional_and_family_contacts: submission.values.contacts.map(
        (contact) => ({
          name: contact.name,
          firm: contact.firmOrRelationship,
          expertise: contact.role,
          estate_role: contact.role,
          email: contact.email,
          telephone: contact.phone,
          contact_trigger: contact.responsibilities,
          priority: contact.primaryOrBackup,
          missing_information: [contact.email, contact.phone].every(Boolean)
            ? []
            : ["contact details"],
        }),
      ),
      missing_contacts: submission.values.missingProfessionalRoles,
      other_participants: [],
    };
  }

  return { record, changed: true };
}

export function intakeSectionForRecord(record: MatterOpeningRecord): IntakeSection {
  const canonical = record.canonical_intake;
  if (canonical) return canonical.currentSection;
  if (!record.desired_outcomes.length || !record.top_three_priorities.length) {
    return "goals_family";
  }
  if (record.current_plan_status === "unknown") return "planning_context";
  if (!record.professional_and_family_contacts.length) return "team_continuity";
  return "financial_range";
}
