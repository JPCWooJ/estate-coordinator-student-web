import {
  MatterOpeningRecord,
  OUTCOME_LABELS,
} from "@/lib/domain/matter-opening";

export type PlanningSummaryProjection = {
  sections: Array<{
    key:
      | "priorities"
      | "family"
      | "planning_context"
      | "planning_range"
      | "team_continuity"
      | "uncertainties";
    title: string;
    items: string[];
  }>;
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
  "Confirming this summary carries your priorities directly into the Estate Blueprint's Planning Foundation without asking you to repeat them.";

function compact(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(
    (value): value is string => Boolean(value),
  ))];
}

function canonicalSections(
  record: MatterOpeningRecord,
): PlanningSummaryProjection["sections"] {
  const intake = record.canonical_intake;
  if (!intake) {
    return [
      {
        key: "priorities",
        title: "Planning outcomes and definition of success",
        items: compact([
          record.top_three_priorities
            .map((outcome, index) => `${index + 1}. ${OUTCOME_LABELS[outcome]}`)
            .join("; "),
          valueOrUnknown(record.principal_definition_of_success),
        ]),
      },
      {
        key: "family",
        title: "Family and beneficiary intent",
        items: [valueOrUnknown(record.people_and_interests_snapshot)],
      },
      {
        key: "planning_context",
        title: "Current plan, timing, and material context",
        items: compact([
          CURRENT_PLAN_STATUS_LABEL[record.current_plan_status],
          valueOrUnknown(record.current_plan_snapshot),
          ...record.changes_since_current_plan,
          record.timing_event_or_deadline.reason,
          ...record.geographic_and_complexity_flags,
        ]),
      },
      { key: "planning_range", title: "Planning range and governing constraints", items: [UNKNOWN] },
      {
        key: "team_continuity",
        title: "Estate team and continuity",
        items: compact(record.professional_and_family_contacts.map(
          (contact) => `${contact.name} — ${contact.estate_role || contact.expertise}`,
        )),
      },
      { key: "uncertainties", title: "Material uncertainties and open roles", items: compact(record.missing_contacts) },
    ];
  }

  const goals = intake.goalsFamily;
  const context = intake.planningContext;
  const team = intake.teamContinuity;
  const financial = intake.financialRange;
  const unresolved = Object.entries(intake.fieldMeta)
    .filter(([, metadata]) => metadata.status !== "answered" && metadata.status !== "not_applicable")
    .map(([fieldId, metadata]) => `${fieldId}: ${metadata.status.replaceAll("_", " ")}`);

  return [
    {
      key: "priorities",
      title: "Planning outcomes and definition of success",
      items: goals
        ? compact([
            goals.topPriorities
              .map((outcome, index) => `${index + 1}. ${OUTCOME_LABELS[outcome]}`)
              .join("; "),
            goals.successDefinition,
          ])
        : [UNKNOWN],
    },
    {
      key: "family",
      title: "Family and beneficiary intent",
      items: goals
        ? compact([
            ...goals.beneficiaries.map((beneficiary) =>
              compact([
                `${beneficiary.nameOrGroup} — ${beneficiary.relationship}, ${beneficiary.role.replaceAll("_", " ")}; ${beneficiary.treatment}`,
                beneficiary.protectionNeeds.length
                  ? `Protections: ${beneficiary.protectionNeeds.join(", ")}`
                  : null,
                beneficiary.readinessNotes
                  ? `Readiness: ${beneficiary.readinessNotes}`
                  : null,
              ]).join(". "),
            ),
            goals.materialCircumstances,
          ])
        : [UNKNOWN],
    },
    {
      key: "planning_context",
      title: "Current plan, timing, and material context",
      items: context
        ? compact([
            `Current plan: ${CURRENT_PLAN_STATUS_LABEL[context.currentPlanStatus]}; ${context.documentTypes.length ? context.documentTypes.join(", ") : "no known documents"}; approximately ${context.approximatePlanDate}.`,
            context.materialChanges.length
              ? `Material changes: ${context.materialChanges.join("; ")}.`
              : "No material changes identified.",
            `Planning now: ${context.planningReason}; deadline: ${context.deadline}.`,
            `Primary residence: ${context.primaryResidence}; other jurisdictions: ${context.otherJurisdictions.length ? context.otherJurisdictions.join(", ") : "none"}.`,
            context.complexityFlags.length || context.complexityDetails
              ? `Material complexity: ${compact([...context.complexityFlags, context.complexityDetails]).join("; ")}.`
              : "No material complexity identified.",
          ])
        : [UNKNOWN],
    },
    {
      key: "planning_range",
      title: "Planning range and governing constraints",
      items: financial
        ? [
            `Material assets: ${financial.materialAssetsRange}; liabilities: ${financial.liabilitiesRange}; expected inheritance: ${financial.expectedInheritanceRange}.`,
            `Lifetime-security floor: ${financial.lifetimeSecurityFloor}; counted assets: ${financial.assetsCountedTowardFloor}.`,
            `Retained control: ${financial.retainedControlRequirement}; extraordinary obligations: ${financial.extraordinaryFutureObligations}.`,
          ]
        : [UNKNOWN],
    },
    {
      key: "team_continuity",
      title: "Estate team and continuity",
      items: team
        ? compact([
            ...team.contacts.map(
              (contact) =>
                `${contact.name} — ${contact.role}, ${contact.firmOrRelationship || "relationship not supplied"}, ${contact.primaryOrBackup}; ${contact.responsibilities || "responsibilities to confirm"}; ${compact([contact.email, contact.phone]).join(" / ") || "contact details needed"}.`,
            ),
            `Continuity responsibilities: ${team.continuityResponsibilities.join("; ")}.`,
            team.specialAssetsOrPurposes.length
              ? `Special assets or purposes: ${team.specialAssetsOrPurposes.join("; ")}.`
              : null,
            `Readiness plan: ${team.readinessPlan}.`,
          ])
        : [UNKNOWN],
    },
    {
      key: "uncertainties",
      title: "Material uncertainties and open roles",
      items: compact([
        ...(team?.missingProfessionalRoles.map((role) => `Open role: ${role}.`) ?? []),
        ...unresolved,
      ]).length
        ? compact([
            ...(team?.missingProfessionalRoles.map((role) => `Open role: ${role}.`) ?? []),
            ...unresolved,
          ])
        : ["No material uncertainty is hidden; professional confirmation remains required before implementation."],
    },
  ];
}

export function buildPrincipalPlanningSummary(
  record: MatterOpeningRecord,
): PlanningSummaryProjection {
  return {
    sections: canonicalSections(record),
    desiredOutcomes: record.desired_outcomes.map((outcome) => OUTCOME_LABELS[outcome]),
    topPriorities: record.top_three_priorities.map(
      (outcome) => OUTCOME_LABELS[outcome],
    ),
    successDefinition: valueOrUnknown(record.principal_definition_of_success),
    priorityContext: formatPriorityContext(record),
    peopleAndInterests: valueOrUnknown(record.people_and_interests_snapshot),
    peopleFlags: record.people_circumstance_flags,
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
