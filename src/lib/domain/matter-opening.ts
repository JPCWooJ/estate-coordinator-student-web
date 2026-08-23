import { z } from "zod";

import { GeneratedResponseMetadataSchema } from "./generated-response";

export const WORKFLOW_VERSION = "EC_MATTER_OPENING_0.4";

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

export const OUTCOME_LABELS: Record<OutcomeCode, string> = {
  intended_transfer: "Intended transfer",
  tax_minimization: "Tax minimization",
  asset_protection: "Asset protection",
  support_for_others: "Support for others",
  distribution_control: "Distribution control",
  incapacity_readiness: "Incapacity readiness",
  conflict_prevention: "Conflict prevention",
  heir_readiness: "Heir readiness",
  plan_alignment: "Plan alignment",
  house_in_order_assurance: "House-in-order assurance",
  business_charitable_family_legacy: "Business, charitable, or family legacy",
  other: "Other",
};

export const MatterClassificationSchema = z.enum([
  "NEW_PLAN",
  "PLAN_REVIEW",
  "PLAN_UPDATE",
  "IMPLEMENTATION_ORGANIZATION",
]);

export const OpeningStepSchema = z.enum([
  "MO01_OUTCOMES",
  "MO01_PRIORITIES",
  "MO01_GOAL_FOLLOWUP",
  "MO02_PEOPLE",
  "MO02_CIRCUMSTANCES",
  "MO03_CURRENT_PLAN",
  "MO03_PLAN_DETAILS",
  "MO03_CHANGES",
  "MO04_TIMING",
  "MO05_FOOTPRINT",
  "MO05_COMPLEXITY",
  "MO06_CONTACTS",
  "MO08_HOUSE_IN_ORDER",
  "MO08_CONFIRM",
  "BLUEPRINT_READY",
  "STOPPED",
]);
export type OpeningStep = z.infer<typeof OpeningStepSchema>;

const ContactSchema = z.object({
  name: z.string(),
  firm: z.string(),
  expertise: z.string(),
  estate_role: z.string(),
  email: z.string(),
  telephone: z.string(),
  contact_trigger: z.string(),
  priority: z.string(),
  missing_information: z.array(z.string()),
});

const ParticipantSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  intended_role: z.string(),
  involvement_timing: z.string(),
});

const TimingSchema = z.object({
  reason: z.string(),
  event: z.string(),
  date: z.string(),
  importance: z.string(),
});

const PriorityDetailSchema = z.object({
  outcome: OutcomeCodeSchema,
  detail: z.string(),
});

export const MatterOpeningRecordSchema = z.object({
  matter_id: z.string().uuid(),
  opened_on: z.string(),
  matter_status: z.enum([
    "OPEN",
    "EXPEDITED_EVENT",
    "MANDATORY_STOP",
    "BLUEPRINT_READY",
  ]),
  matter_classification: MatterClassificationSchema,
  desired_outcomes: z.array(OutcomeCodeSchema),
  top_three_priorities: z.array(OutcomeCodeSchema).max(3),
  principal_definition_of_success: z.string(),
  priority_details: z.array(PriorityDetailSchema),
  people_and_interests_snapshot: z.string(),
  people_circumstance_flags: z.array(z.string()),
  current_plan_snapshot: z.string(),
  current_plan_status: z.enum([
    "no_existing_plan",
    "unsure_what_exists",
    "review_requested",
    "implementation_or_organization_needed",
    "current",
    "update_needed",
    "unknown",
  ]),
  changes_since_current_plan: z.array(z.string()),
  timing_event_or_deadline: TimingSchema,
  geographic_and_complexity_flags: z.array(z.string()),
  professional_and_family_contacts: z.array(ContactSchema),
  missing_contacts: z.array(z.string()),
  other_participants: z.array(ParticipantSchema),
  house_in_order_concern: z.string(),
  principal_confirmed: z.enum(["yes", "no"]),
  confirmation_date: z.string(),
  generated_responses: z.array(GeneratedResponseMetadataSchema).optional(),
});
export type MatterOpeningRecord = z.infer<typeof MatterOpeningRecordSchema>;

export const WorkflowStateSchema = z.object({
  step: OpeningStepSchema,
  clarification: z
    .object({ question: z.string().min(1) })
    .nullable()
    .default(null),
  stop: z
    .object({
      category: z.string(),
      reason: z.string(),
      immediate_action: z.string(),
    })
    .nullable(),
});
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

const InterpretationPatchSchema = z.object({
  desired_outcomes: z.array(OutcomeCodeSchema).nullable(),
  top_three_priorities: z.array(OutcomeCodeSchema).max(3).nullable(),
  principal_definition_of_success: z.string().nullable(),
  priority_detail: PriorityDetailSchema.nullable(),
  people_and_interests_snapshot: z.string().nullable(),
  people_circumstance_flags: z.array(z.string()).nullable(),
  current_plan_status: MatterOpeningRecordSchema.shape.current_plan_status.nullable(),
  current_plan_snapshot: z.string().nullable(),
  changes_since_current_plan: z.array(z.string()).nullable(),
  timing_reason: z.string().nullable(),
  timing_event: z.string().nullable(),
  timing_date: z.string().nullable(),
  timing_importance: z.string().nullable(),
  geographic_and_complexity_flags: z.array(z.string()).nullable(),
  professional_and_family_contacts: z.array(ContactSchema).nullable(),
  missing_contacts: z.array(z.string()).nullable(),
  other_participants: z.array(ParticipantSchema).nullable(),
  house_in_order_concern: z.string().nullable(),
});
export type InterpretationPatch = z.infer<typeof InterpretationPatchSchema>;

export const InterpretationSchema = z.object({
  outcome: z.enum(["accepted", "clarification", "stop"]),
  acknowledgement: z.string(),
  clarification_question: z.string().nullable(),
  patch: InterpretationPatchSchema,
  stop: z
    .object({
      category: z.string(),
      reason: z.string(),
      immediate_action: z.string(),
    })
    .nullable(),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

export const PlanningSummaryCorrectionSchema = z.object({
  outcome: z.enum(["accepted", "clarification"]),
  acknowledgement: z.string(),
  clarification_question: z.string().nullable(),
  patch: InterpretationPatchSchema,
});
export type PlanningSummaryCorrection = z.infer<
  typeof PlanningSummaryCorrectionSchema
>;

export function emptyInterpretationPatch(): InterpretationPatch {
  return {
    desired_outcomes: null,
    top_three_priorities: null,
    principal_definition_of_success: null,
    priority_detail: null,
    people_and_interests_snapshot: null,
    people_circumstance_flags: null,
    current_plan_status: null,
    current_plan_snapshot: null,
    changes_since_current_plan: null,
    timing_reason: null,
    timing_event: null,
    timing_date: null,
    timing_importance: null,
    geographic_and_complexity_flags: null,
    professional_and_family_contacts: null,
    missing_contacts: null,
    other_participants: null,
    house_in_order_concern: null,
  };
}

export function createInitialRecord(matterId: string): MatterOpeningRecord {
  return {
    matter_id: matterId,
    opened_on: new Date().toISOString(),
    matter_status: "OPEN",
    matter_classification: "NEW_PLAN",
    desired_outcomes: [],
    top_three_priorities: [],
    principal_definition_of_success: "unknown",
    priority_details: [],
    people_and_interests_snapshot: "unknown",
    people_circumstance_flags: [],
    current_plan_snapshot: "unknown",
    current_plan_status: "unknown",
    changes_since_current_plan: [],
    timing_event_or_deadline: {
      reason: "unknown",
      event: "unknown",
      date: "unknown",
      importance: "unknown",
    },
    geographic_and_complexity_flags: [],
    professional_and_family_contacts: [],
    missing_contacts: [],
    other_participants: [],
    house_in_order_concern: "unknown",
    principal_confirmed: "no",
    confirmation_date: "unknown",
    generated_responses: [],
  };
}

export function createInitialWorkflowState(): WorkflowState {
  return { step: "MO01_OUTCOMES", clarification: null, stop: null };
}
