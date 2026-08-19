import {
  MatterOpeningRecord,
  OUTCOME_LABELS,
} from "@/lib/domain/matter-opening";

export type PlanningSummaryProjection = {
  desiredOutcomes: string[];
  topPriorities: string[];
  successDefinition: string;
  priorityContext: Array<{ outcome: string; detail: string }>;
  peopleAndInterests: string;
  peopleFlags: string[];
  currentPlanSnapshot: string;
  currentPlanStatus: string;
  knownChanges: string[];
  timing: {
    reason: string;
    event: string;
    date: string;
    importance: string;
  };
  complexityFlags: string[];
  contacts: Array<{ name: string; firm: string; role: string }>;
  missingContacts: string[];
  participants: string[];
  recommendedNextStep: string;
};

const UNKNOWN = "Not yet known";

const CURRENT_PLAN_STATUS_LABEL: Record<
  MatterOpeningRecord["current_plan_status"],
  string
> = {
  no_existing_plan: "No confirmed plan exists yet",
  unsure_what_exists: "Plan status is uncertain",
  review_requested: "Review by another professional may be helpful",
  update_needed: "Your plan may need updates",
  implementation_or_organization_needed: "Implementation or organization help is still needed",
  current: "Your current plan is believed to remain current",
  unknown: "Plan status is not yet known",
};

function valueOrUnknown(value: string) {
  return value && value !== "unknown" ? value : UNKNOWN;
}

function listOrUnknown(values: string[]) {
  return values.length === 0 ? [UNKNOWN] : values;
}

function formatPriorityContext(record: MatterOpeningRecord) {
  const context = record.priority_details.map((item) => ({
    outcome: OUTCOME_LABELS[item.outcome],
    detail: item.detail || UNKNOWN,
  }));
  if (context.length > 0) return context;
  return [{ outcome: "No priority detail captured", detail: UNKNOWN }];
}

const DEFAULT_NEXT_STEP =
  "Confirming this summary enters the Estate Blueprint with Stage 1 complete; Stage 2 continues from this planning baseline.";

export function buildPrincipalPlanningSummary(
  record: MatterOpeningRecord,
): PlanningSummaryProjection {
  return {
    desiredOutcomes: record.desired_outcomes.map((outcome) => OUTCOME_LABELS[outcome]),
    topPriorities: record.top_three_priorities.map(
      (outcome, index) => `${index + 1}. ${OUTCOME_LABELS[outcome]}`,
    ),
    successDefinition: valueOrUnknown(record.principal_definition_of_success),
    priorityContext: formatPriorityContext(record),
    peopleAndInterests: valueOrUnknown(record.people_and_interests_snapshot),
    peopleFlags: listOrUnknown(record.people_circumstance_flags),
    currentPlanSnapshot: valueOrUnknown(record.current_plan_snapshot),
    currentPlanStatus: CURRENT_PLAN_STATUS_LABEL[record.current_plan_status],
    knownChanges: listOrUnknown(
      record.changes_since_current_plan.filter((change) => change.trim()),
    ),
    timing: {
      reason: valueOrUnknown(record.timing_event_or_deadline.reason),
      event: valueOrUnknown(record.timing_event_or_deadline.event),
      date: valueOrUnknown(record.timing_event_or_deadline.date),
      importance: valueOrUnknown(record.timing_event_or_deadline.importance),
    },
    complexityFlags: listOrUnknown(record.geographic_and_complexity_flags),
    contacts: record.professional_and_family_contacts.map((contact) => ({
      name: contact.name || UNKNOWN,
      firm: contact.firm || UNKNOWN,
      role: contact.estate_role || UNKNOWN,
    })),
    missingContacts: record.missing_contacts,
    participants: record.other_participants.map((participant) => participant.name),
    recommendedNextStep: DEFAULT_NEXT_STEP,
  };
}
