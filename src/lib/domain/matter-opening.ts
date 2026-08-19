import { z } from "zod";

export const WORKFLOW_VERSION = "EC_MATTER_OPENING_0.2";

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
  "legacy",
  "other",
]);

export type OutcomeCode = z.infer<typeof OutcomeCodeSchema>;

export const OUTCOME_LABELS: Record<OutcomeCode, string> = {
  intended_transfer: "Intended transfer",
  tax_minimization: "Tax and expense minimization",
  asset_protection: "Asset protection",
  support_for_others: "Support for spouse, children, or dependents",
  distribution_control: "Distribution timing and control",
  incapacity_readiness: "Incapacity readiness",
  conflict_prevention: "Conflict and delay prevention",
  heir_readiness: "Heir readiness",
  plan_alignment: "Documents, ownership, beneficiaries, and instructions aligned",
  house_in_order_assurance: "Evidence the estate-planning house is in order",
  legacy: "Business, charitable, or family legacy",
  other: "Another outcome",
};

export const OUTCOME_FOLLOW_UPS: Record<OutcomeCode, string> = {
  intended_transfer:
    "Who or what do you most want to benefit, and what transfer outcome do you most want to prevent?",
  tax_minimization:
    "If tax minimization requires tradeoffs, how would you balance it against simplicity, flexibility, access, and control?",
  asset_protection:
    "Which risks concern you most—creditors, divorce, litigation, financial immaturity, outside influence, or something else?",
  support_for_others:
    "Who may need continuing financial support, care, management, or oversight?",
  distribution_control:
    "Are there circumstances in which a beneficiary should not receive assets outright or immediately?",
  incapacity_readiness:
    "If you could not manage your affairs, what must continue without disruption?",
  conflict_prevention:
    "Where do you foresee disagreement, interference, delay, or confusion?",
  heir_readiness: "What should your heirs know or be able to find immediately?",
  plan_alignment:
    "What are you least certain is coordinated correctly—documents, ownership, beneficiaries, trusts, or instructions?",
  house_in_order_assurance:
    "What evidence would give you confidence that the plan is complete, implemented, and current?",
  legacy: "What should continue or be preserved beyond the transfer of money?",
  other: "What would success look like in practical terms?",
};

export const DiscoveryPathSchema = z.enum([
  "family, beneficiaries, and dependents",
  "goals, values, and distribution intentions",
  "existing documents and arrangements",
  "assets, liabilities, ownership, and beneficiaries",
  "tax-minimization considerations",
  "asset-protection considerations",
  "incapacity and continuity",
  "business, charitable, and legacy planning",
  "professional contacts and heir readiness",
  "implementation and plan-alignment verification",
]);

export const ContactSchema = z.object({
  name: z.string().min(1),
  firm: z.string().min(1),
  expertise: z.string().min(1),
  estate_role: z.string().min(1),
  email: z.string().min(1),
  telephone: z.string().min(1),
  contact_trigger: z.string().min(1),
  priority: z.enum(["primary", "backup", "unknown"]),
  missing_information: z.array(z.string()),
});

export type Contact = z.infer<typeof ContactSchema>;

export const ParticipantSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  intended_role: z.string().min(1),
  involvement_timing: z.string().min(1),
});

export type Participant = z.infer<typeof ParticipantSchema>;

export const MatterOpeningRecordSchema = z.object({
  matter_id: z.string().uuid(),
  opened_on: z.string(),
  matter_status: z.enum(["OPEN", "EXPEDITED_EVENT"]),
  matter_classification: z.enum([
    "NEW_PLAN",
    "PLAN_REVIEW",
    "PLAN_UPDATE",
    "IMPLEMENTATION_ORGANIZATION",
  ]),
  desired_outcomes: z.array(OutcomeCodeSchema),
  top_three_priorities: z.array(OutcomeCodeSchema).max(3),
  principal_definition_of_success: z.string(),
  priority_details: z.array(
    z.object({ outcome: OutcomeCodeSchema, detail: z.string().min(1) }),
  ),
  people_and_interests_snapshot: z.string(),
  people_circumstance_flags: z.array(z.string()),
  current_plan_snapshot: z.string(),
  current_plan_status: z.enum([
    "no_existing_plan",
    "unsure_what_exists",
    "review_requested",
    "update_needed",
    "implementation_or_organization_needed",
  ]),
  changes_since_current_plan: z.array(z.string()),
  timing_event_or_deadline: z.object({
    reason: z.string(),
    event: z.string(),
    date: z.string(),
    importance: z.string(),
  }),
  geographic_and_complexity_flags: z.array(z.string()),
  professional_and_family_contacts: z.array(ContactSchema),
  missing_contacts: z.array(z.string()),
  other_participants: z.array(ParticipantSchema),
  house_in_order_concern: z.string(),
  selected_discovery_path: DiscoveryPathSchema.or(z.literal("unknown")),
  single_next_action: z.string(),
  principal_confirmed: z.enum(["yes", "no"]),
  confirmation_date: z.string(),
});

export type MatterOpeningRecord = z.infer<typeof MatterOpeningRecordSchema>;

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
  "MO05_COMPLEXITIES",
  "MO06_CONTACTS",
  "MO08_HOUSE_IN_ORDER",
  "MO08_CONFIRM",
  "STOPPED",
  "CONFIRMED",
]);

export type OpeningStep = z.infer<typeof OpeningStepSchema>;

export const WorkflowStateSchema = z.object({
  step: OpeningStepSchema,
  goal_followup_queue: z.array(OutcomeCodeSchema),
  active_goal_followup: OutcomeCodeSchema.nullable(),
  accepted_turns: z.number().int().nonnegative(),
  stop: z
    .object({
      category: z.string(),
      reason: z.string(),
      immediate_action: z.string(),
    })
    .nullable(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

const NullableString = z.string().nullable();

export const InterpretationSchema = z.object({
  accepted: z.boolean(),
  acknowledgement: z.string(),
  needs_clarification: z.boolean(),
  clarification_question: NullableString,
  patch: z.object({
    desired_outcomes: z.array(OutcomeCodeSchema).nullable(),
    top_three_priorities: z.array(OutcomeCodeSchema).max(3).nullable(),
    principal_definition_of_success: NullableString,
    priority_detail: z
      .object({ outcome: OutcomeCodeSchema, detail: z.string() })
      .nullable(),
    people_and_interests_snapshot: NullableString,
    people_circumstance_flags: z.array(z.string()).nullable(),
    current_plan_status: z
      .enum([
        "no_existing_plan",
        "unsure_what_exists",
        "review_requested",
        "update_needed",
        "implementation_or_organization_needed",
      ])
      .nullable(),
    current_plan_snapshot: NullableString,
    changes_since_current_plan: z.array(z.string()).nullable(),
    timing_reason: NullableString,
    timing_event: NullableString,
    timing_date: NullableString,
    timing_importance: NullableString,
    geographic_and_complexity_flags: z.array(z.string()).nullable(),
    professional_and_family_contacts: z.array(ContactSchema).nullable(),
    missing_contacts: z.array(z.string()).nullable(),
    other_participants: z.array(ParticipantSchema).nullable(),
    house_in_order_concern: NullableString,
    selected_discovery_path: DiscoveryPathSchema.nullable(),
    single_next_action: NullableString,
  }),
  signals: z.object({
    people_followup_required: z.boolean(),
    current_plan_exists: z.boolean(),
    contacts_complete: z.boolean(),
  }),
  stop: z.object({
    triggered: z.boolean(),
    category: NullableString,
    reason: NullableString,
    immediate_action: NullableString,
  }),
  proposed_next_step: OpeningStepSchema,
});

export type Interpretation = z.infer<typeof InterpretationSchema>;

export function createInitialRecord(
  matterId: string,
  openedOn = new Date().toISOString(),
): MatterOpeningRecord {
  return {
    matter_id: matterId,
    opened_on: openedOn,
    matter_status: "OPEN",
    matter_classification: "NEW_PLAN",
    desired_outcomes: [],
    top_three_priorities: [],
    principal_definition_of_success: "unknown",
    priority_details: [],
    people_and_interests_snapshot: "unknown",
    people_circumstance_flags: [],
    current_plan_snapshot: "unknown",
    current_plan_status: "no_existing_plan",
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
    selected_discovery_path: "unknown",
    single_next_action: "unknown",
    principal_confirmed: "no",
    confirmation_date: "unknown",
  };
}

export function createInitialWorkflowState(): WorkflowState {
  return {
    step: "MO01_OUTCOMES",
    goal_followup_queue: [],
    active_goal_followup: null,
    accepted_turns: 0,
    stop: null,
  };
}
