import type { IntakeSection } from "@/lib/domain/intake";
import {
  MatterOpeningRecord,
  OUTCOME_LABELS,
} from "@/lib/domain/matter-opening";

type EditableIntakeSection = Exclude<IntakeSection, "planning_summary">;

export type PlanningSummaryDetail = {
  label: string;
  value: string;
};

export type PlanningSummaryContact = {
  name: string;
  affiliation: string;
  contact: string;
  role: string;
  responsibilities: string;
};

export type PlanningSummarySection = {
  key:
    | "priorities"
    | "family"
    | "current_plan"
    | "timing_context"
    | "planning_range"
    | "team"
    | "uncertainties";
  title: string;
  details: PlanningSummaryDetail[];
  contacts?: PlanningSummaryContact[];
  editSection: EditableIntakeSection | null;
};

export type PlanningSummaryProjection = {
  sections: PlanningSummarySection[];
  boundaryNote: string;
};

const UNKNOWN = "Not yet known";

const PROFESSIONAL_BOUNDARY =
  "This summary reflects information you provided and is not legal or tax advice. Qualified legal, tax, and financial professionals must confirm the planning conclusions and implementation details.";

const CURRENT_PLAN_STATUS_LABEL: Record<
  MatterOpeningRecord["current_plan_status"],
  string
> = {
  no_existing_plan: "No confirmed plan exists yet",
  unsure_what_exists: "Plan status is uncertain",
  review_requested: "Review by another professional may be helpful",
  update_needed: "The current plan may need updates",
  implementation_or_organization_needed:
    "Implementation or organization help is still needed",
  current: "The current plan is believed to remain current",
  unknown: "Plan status is not yet known",
};

const FIELD_LABELS: Record<string, string> = {
  "goals.ranked_outcomes": "Ranked planning outcomes",
  "goals.success": "Definition of success",
  "beneficiaries.intent": "Beneficiary intent",
  "beneficiaries.circumstances": "Family circumstances",
  "plan.status_and_documents": "Current plan and documents",
  "plan.material_changes": "Material changes",
  "timing.reason_and_deadline": "Planning timing or deadline",
  "jurisdiction.footprint": "Jurisdiction footprint",
  "complexity.flags": "Material complexity",
  "team.contacts": "Planning team contacts",
  "continuity.responsibilities": "Continuity responsibilities",
  "continuity.special_assets": "Special assets or purposes",
  "continuity.readiness": "Family readiness",
  "financial.assets": "Material assets",
  "financial.liabilities": "Liabilities",
  "financial.monthly_expenses": "Recurring expenses",
  "financial.recurring_income": "Recurring income",
  "financial.planning_assumptions": "Planning assumptions",
  "financial.security_floor": "Lifetime-security range",
};

const NONE_VALUES = new Set([
  "n/a",
  "none",
  "none identified",
  "none known",
  "not applicable",
]);

function compact(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(
    (value): value is string => Boolean(value),
  ))];
}

function meaningful(values: Array<string | null | undefined>) {
  return compact(values).filter((value) => !NONE_VALUES.has(value.toLowerCase()));
}

function valueOrUnknown(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.toLowerCase() !== "unknown"
    ? normalized
    : UNKNOWN;
}

function listOr(values: string[], emptyValue: string) {
  const entries = meaningful(values);
  return entries.length ? entries.join("; ") : emptyValue;
}

function detail(label: string, value: string): PlanningSummaryDetail {
  return { label, value };
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function sentenceCase(value: string) {
  const humanized = humanize(value);
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function sectionForField(fieldId: string): EditableIntakeSection | null {
  if (/^(goals|beneficiaries)\./.test(fieldId)) return "goals_family";
  if (/^(plan|timing|jurisdiction|complexity)\./.test(fieldId)) {
    return "planning_context";
  }
  if (/^(team|continuity)\./.test(fieldId)) return "team_continuity";
  if (fieldId.startsWith("financial.")) return "financial_range";
  return null;
}

function unresolvedDetails(record: MatterOpeningRecord) {
  const intake = record.canonical_intake;
  if (!intake) return [];
  return Object.entries(intake.fieldMeta)
    .filter(([, metadata]) =>
      metadata.status !== "answered" && metadata.status !== "not_applicable"
    )
    .map(([fieldId, metadata]) => detail(
      FIELD_LABELS[fieldId] ?? sentenceCase(fieldId.replaceAll(".", " ")),
      metadata.status === "not_decided"
        ? "Not decided"
        : metadata.status === "missing"
          ? "Still needed"
          : UNKNOWN,
    ));
}

function financialDetails(
  record: MatterOpeningRecord,
): PlanningSummaryDetail[] {
  const intake = record.canonical_intake;
  const profile = intake?.financialProfile;
  if (profile) {
    const calculations = profile.calculations;
    return [
      ...profile.assets.map((asset) => detail(
        `Asset — ${asset.description || sentenceCase(asset.category)}`,
        compact([
          currency(asset.approximateValue),
          humanize(asset.category),
          humanize(asset.ownershipControl),
          asset.note,
        ]).join(" · "),
      )),
      ...profile.liabilities.map((liability) => detail(
        `Liability — ${liability.description || sentenceCase(liability.category)}`,
        compact([
          currency(liability.approximateValue),
          humanize(liability.category),
          humanize(liability.ownershipControl),
          liability.note,
        ]).join(" · "),
      )),
      detail(
        "Balance-sheet totals",
        `Assets ${currency(calculations.totalAssets)} · Liabilities ${currency(calculations.totalLiabilities)} · Estimated net estate ${currency(calculations.estimatedNetEstate)}`,
      ),
      detail(
        "Monthly lifestyle",
        `Recurring expenses ${currency(profile.lifestyle.monthlyExpenses)} · Recurring income ${currency(calculations.monthlyRecurringIncome)}`,
      ),
      ...profile.lifestyle.incomeSources.map((source) => detail(
        `Recurring income — ${source.source}`,
        `${currency(source.monthlyAmount)} per month${
          source.linkedAssetId ? " · Linked to a retained balance-sheet asset" : ""
        }`,
      )),
      detail(
        "Governing assumptions",
        `${profile.lifestyle.federalEffectiveTaxRatePercent}% federal-only effective income-tax planning assumption · ${profile.lifestyle.safetyBufferPercent}% safety buffer · 4% planning withdrawal rate · No state tax included`,
      ),
      calculations.annualShortfall > 0
        ? detail(
            "Cash-flow requirement",
            `Annual shortfall ${currency(calculations.annualShortfall)} · Tax-adjusted annual portfolio income required ${currency(calculations.taxAdjustedAnnualPortfolioIncomeRequired)}`,
          )
        : detail(
            "Cash-flow position",
            `Annual surplus ${currency(calculations.annualSurplus)} · No additional portfolio income required by this calculation`,
          ),
      detail(
        "Lifetime-security range",
        `Minimum liquid assets ${currency(calculations.minimumLiquidAssetsRequired)} · Retained income-producing assets ${currency(calculations.retainedIncomeProducingAssets)} · Recommended controllable-estate floor ${currency(calculations.recommendedControllableEstateFloor)}`,
      ),
    ];
  }

  const range = intake?.financialRange;
  if (!range) return [detail("Status", UNKNOWN)];
  return [
    detail("Material assets", valueOrUnknown(range.materialAssetsRange)),
    detail("Liabilities", valueOrUnknown(range.liabilitiesRange)),
    detail(
      "Expected inheritance",
      valueOrUnknown(range.expectedInheritanceRange),
    ),
    detail(
      "Lifetime-security floor",
      valueOrUnknown(range.lifetimeSecurityFloor),
    ),
    detail(
      "Assets counted toward the floor",
      valueOrUnknown(range.assetsCountedTowardFloor),
    ),
    detail(
      "Retained-control requirement",
      valueOrUnknown(range.retainedControlRequirement),
    ),
    detail(
      "Extraordinary future obligations",
      valueOrUnknown(range.extraordinaryFutureObligations),
    ),
  ];
}

function canonicalSections(
  record: MatterOpeningRecord,
): PlanningSummarySection[] {
  const intake = record.canonical_intake!;
  const goals = intake.goalsFamily;
  const context = intake.planningContext;
  const team = intake.teamContinuity;
  const unresolved = unresolvedDetails(record);
  const isUnresolved = (fieldId: string) => {
    const status = intake.fieldMeta[fieldId]?.status;
    return Boolean(status && status !== "answered" && status !== "not_applicable");
  };
  const firstUnresolvedField = Object.entries(intake.fieldMeta).find(
    ([, metadata]) =>
      metadata.status !== "answered" && metadata.status !== "not_applicable",
  )?.[0];

  const rankedOutcomes = goals?.topPriorities ?? [];
  const additionalOutcomes = goals?.desiredOutcomes.filter(
    (outcome) => !rankedOutcomes.includes(outcome),
  ) ?? [];
  const jurisdictionEntries = meaningful(context?.otherJurisdictions ?? []);
  const complexityEntries = meaningful([
    ...(context?.complexityFlags ?? []),
    context?.complexityDetails,
  ]);

  return [
    {
      key: "priorities",
      title: "Planning priorities and success",
      details: goals
        ? [
            ...(isUnresolved("goals.ranked_outcomes")
              ? []
              : rankedOutcomes.map((outcome, index) =>
                  detail(`Priority ${index + 1}`, OUTCOME_LABELS[outcome])
                )),
            ...(isUnresolved("goals.ranked_outcomes")
              ? []
              : additionalOutcomes.map((outcome) =>
                  detail("Additional outcome", OUTCOME_LABELS[outcome])
                )),
            ...(isUnresolved("goals.success")
              ? []
              : [
                  detail(
                    "What success means",
                    valueOrUnknown(goals.successDefinition),
                  ),
                ]),
          ]
        : [detail("Status", UNKNOWN)],
      editSection: "goals_family",
    },
    {
      key: "family",
      title: "Family and beneficiary intent",
      details: goals
        ? [
            ...(isUnresolved("beneficiaries.intent")
              ? []
              : goals.beneficiaries.map((beneficiary) => detail(
                  `${sentenceCase(beneficiary.role)} beneficiary`,
                  compact([
                    `${beneficiary.nameOrGroup} — ${beneficiary.relationship}`,
                    beneficiary.treatment,
                    beneficiary.protectionNeeds.length
                      ? `Protections: ${beneficiary.protectionNeeds.join(", ")}`
                      : null,
                    beneficiary.readinessNotes
                      ? `Readiness: ${beneficiary.readinessNotes}`
                      : null,
                  ]).join(" · "),
                ))),
            ...(isUnresolved("beneficiaries.circumstances")
              ? []
              : [
                  detail(
                    "Material family circumstances",
                    listOr([goals.materialCircumstances], "None identified"),
                  ),
                ]),
          ]
        : [detail("Status", UNKNOWN)],
      editSection: "goals_family",
    },
    {
      key: "current_plan",
      title: "Current plan and material changes",
      details: context
        ? [
            ...(isUnresolved("plan.status_and_documents")
              ? []
              : [
                  detail(
                    "Current plan status",
                    CURRENT_PLAN_STATUS_LABEL[context.currentPlanStatus],
                  ),
                  detail(
                    "Known documents or arrangements",
                    listOr(context.documentTypes, "None known"),
                  ),
                  detail(
                    "Approximate plan date",
                    valueOrUnknown(context.approximatePlanDate),
                  ),
                ]),
            ...(isUnresolved("plan.material_changes")
              ? []
              : [
                  detail(
                    "Material changes",
                    listOr(context.materialChanges, "None identified"),
                  ),
                ]),
          ]
        : [detail("Status", UNKNOWN)],
      editSection: "planning_context",
    },
    {
      key: "timing_context",
      title: "Timing, jurisdiction, and complexity",
      details: context
        ? [
            ...(isUnresolved("timing.reason_and_deadline")
              ? []
              : [
                  detail(
                    "Planning now",
                    valueOrUnknown(context.planningReason),
                  ),
                  detail(
                    "Deadline or event",
                    listOr([context.deadline], "None"),
                  ),
                ]),
            ...(isUnresolved("jurisdiction.footprint")
              ? []
              : [
                  detail(
                    "Primary residence",
                    valueOrUnknown(context.primaryResidence),
                  ),
                  detail(
                    "Other jurisdictions",
                    jurisdictionEntries.length
                      ? jurisdictionEntries.join("; ")
                      : "None identified",
                  ),
                ]),
            ...(isUnresolved("complexity.flags")
              ? []
              : [
                  detail(
                    "Material complexity",
                    complexityEntries.length
                      ? complexityEntries.join("; ")
                      : "None identified",
                  ),
                ]),
          ]
        : [detail("Status", UNKNOWN)],
      editSection: "planning_context",
    },
    {
      key: "planning_range",
      title: "Planning range and governing constraints",
      details: financialDetails(record),
      editSection: "financial_range",
    },
    {
      key: "team",
      title: "Planning team and open roles",
      contacts: team && !isUnresolved("team.contacts")
        ? team.contacts.map((contact) => ({
            name: contact.name,
            affiliation:
              contact.firmOrRelationship || "Affiliation not supplied",
            contact:
              compact([contact.email, contact.phone]).join(" / ") ||
              "Contact details needed",
            role: `${contact.role} · ${sentenceCase(contact.primaryOrBackup)}`,
            responsibilities:
              contact.responsibilities || "Responsibilities to confirm",
          }))
        : [],
      details: team
        ? [
            detail(
              "Open professional roles",
              listOr(team.missingProfessionalRoles, "None identified"),
            ),
            ...(isUnresolved("continuity.responsibilities")
              ? []
              : [
                  detail(
                    "Continuity responsibilities",
                    listOr(team.continuityResponsibilities, "None identified"),
                  ),
                ]),
            ...(isUnresolved("continuity.special_assets")
              ? []
              : [
                  detail(
                    "Special assets or purposes",
                    listOr(team.specialAssetsOrPurposes, "None identified"),
                  ),
                ]),
            ...(isUnresolved("continuity.readiness")
              ? []
              : [
                  detail(
                    "Readiness plan",
                    valueOrUnknown(team.readinessPlan),
                  ),
                ]),
          ]
        : [detail("Status", UNKNOWN)],
      editSection: "team_continuity",
    },
    {
      key: "uncertainties",
      title: "Material uncertainties",
      details: unresolved.length
        ? unresolved
        : [detail("Current status", "No material uncertainties identified")],
      editSection: firstUnresolvedField
        ? sectionForField(firstUnresolvedField)
        : null,
    },
  ];
}

function legacyContacts(record: MatterOpeningRecord): PlanningSummaryContact[] {
  const contacts = record.professional_and_family_contacts.map((contact) => ({
    name: contact.name || UNKNOWN,
    affiliation: contact.firm || "Affiliation not supplied",
    contact:
      compact([contact.email, contact.telephone]).join(" / ") ||
      "Contact details needed",
    role: contact.estate_role || contact.expertise || "Role to confirm",
    responsibilities: contact.contact_trigger || "Responsibilities to confirm",
  }));
  const knownNames = new Set(contacts.map((contact) => contact.name.toLowerCase()));
  for (const participant of record.other_participants) {
    if (knownNames.has(participant.name.toLowerCase())) continue;
    contacts.push({
      name: participant.name || UNKNOWN,
      affiliation: participant.relationship || "Relationship not supplied",
      contact: "Contact details needed",
      role: participant.intended_role || "Role to confirm",
      responsibilities:
        participant.involvement_timing || "Responsibilities to confirm",
    });
  }
  return contacts;
}

function legacySections(record: MatterOpeningRecord): PlanningSummarySection[] {
  return [
    {
      key: "priorities",
      title: "Planning priorities and success",
      details: [
        ...record.top_three_priorities.map((outcome, index) => {
          const context = record.priority_details.find(
            (item) => item.outcome === outcome,
          )?.detail;
          return detail(
            `Priority ${index + 1}`,
            compact([OUTCOME_LABELS[outcome], context]).join(" — "),
          );
        }),
        detail(
          "What success means",
          valueOrUnknown(record.principal_definition_of_success),
        ),
      ],
      editSection: "goals_family",
    },
    {
      key: "family",
      title: "Family and beneficiary intent",
      details: [
        detail(
          "People and interests to protect",
          valueOrUnknown(record.people_and_interests_snapshot),
        ),
        detail(
          "Material family circumstances",
          listOr(record.people_circumstance_flags, "None identified"),
        ),
      ],
      editSection: "goals_family",
    },
    {
      key: "current_plan",
      title: "Current plan and material changes",
      details: [
        detail(
          "Current plan status",
          CURRENT_PLAN_STATUS_LABEL[record.current_plan_status],
        ),
        detail(
          "Known plan information",
          valueOrUnknown(record.current_plan_snapshot),
        ),
        detail(
          "Material changes",
          listOr(record.changes_since_current_plan, "None identified"),
        ),
      ],
      editSection: "planning_context",
    },
    {
      key: "timing_context",
      title: "Timing, jurisdiction, and complexity",
      details: [
        detail(
          "Planning now",
          valueOrUnknown(record.timing_event_or_deadline.reason),
        ),
        detail(
          "Event",
          valueOrUnknown(record.timing_event_or_deadline.event),
        ),
        detail("Date", valueOrUnknown(record.timing_event_or_deadline.date)),
        detail(
          "Importance",
          valueOrUnknown(record.timing_event_or_deadline.importance),
        ),
        detail(
          "Jurisdiction and complexity",
          listOr(record.geographic_and_complexity_flags, "None identified"),
        ),
      ],
      editSection: "planning_context",
    },
    {
      key: "planning_range",
      title: "Planning range and governing constraints",
      details: [detail("Status", UNKNOWN)],
      editSection: "financial_range",
    },
    {
      key: "team",
      title: "Planning team and open roles",
      contacts: legacyContacts(record),
      details: [
        detail(
          "Open professional roles",
          listOr(record.missing_contacts, "None identified"),
        ),
      ],
      editSection: "team_continuity",
    },
    {
      key: "uncertainties",
      title: "Material uncertainties",
      details: [
        detail(
          "Current status",
          "Review any item marked not yet known before confirmation",
        ),
      ],
      editSection: null,
    },
  ];
}

export function buildPrincipalPlanningSummary(
  record: MatterOpeningRecord,
): PlanningSummaryProjection {
  const intake = record.canonical_intake;
  const hasCanonicalFacts = Boolean(
    intake?.goalsFamily ||
    intake?.planningContext ||
    intake?.teamContinuity ||
    intake?.financialProfile ||
    intake?.financialRange ||
    Object.keys(intake?.fieldMeta ?? {}).length,
  );
  return {
    sections: hasCanonicalFacts
      ? canonicalSections(record)
      : legacySections(record),
    boundaryNote: PROFESSIONAL_BOUNDARY,
  };
}
