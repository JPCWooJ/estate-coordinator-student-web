import "server-only";

import {
  DiscoveryPathSchema,
  Interpretation,
  InterpretationSchema,
  MatterOpeningRecord,
  OpeningStep,
  OutcomeCode,
  WorkflowState,
} from "@/lib/domain/matter-opening";

const outcomePatterns: Array<[OutcomeCode, RegExp]> = [
  ["intended_transfer", /inherit|pass|transfer|children|organizations?/i],
  ["tax_minimization", /tax|expense/i],
  ["asset_protection", /creditor|divorce|litigation|protect/i],
  ["support_for_others", /support|dependent|provide for/i],
  ["distribution_control", /control|when .* receive|outright/i],
  ["incapacity_readiness", /incapacit|manage my affairs|could not manage/i],
  ["conflict_prevention", /conflict|delay|confusion|disagreement/i],
  ["heir_readiness", /heirs?.*(know|find|contact)/i],
  ["plan_alignment", /align|coordinate|documents?.*beneficiar/i],
  ["house_in_order_assurance", /house.*order|evidence.*complete/i],
  ["legacy", /legacy|business|charit|family value/i],
  ["other", /other/i],
];

function findOutcomes(text: string): OutcomeCode[] {
  const ranked = outcomePatterns
    .map(([code, pattern]) => ({ code, index: text.search(pattern) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.code);
  return Array.from(new Set(ranked));
}

function baseInterpretation(step: OpeningStep): Interpretation {
  return {
    accepted: true,
    acknowledgement: "Thank you. I’ve saved that.",
    needs_clarification: false,
    clarification_question: null,
    patch: {
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
      selected_discovery_path: null,
      single_next_action: null,
    },
    signals: {
      people_followup_required: false,
      current_plan_exists: false,
      contacts_complete: false,
    },
    stop: {
      triggered: false,
      category: null,
      reason: null,
      immediate_action: null,
    },
    proposed_next_step: step,
  };
}

function prioritiesFromText(text: string, outcomes: OutcomeCode[]): OutcomeCode[] {
  const ordered = findOutcomes(text).filter((outcome) =>
    outcomes.includes(outcome),
  );
  const ranked = Array.from(new Set(ordered));
  return ranked.slice(0, 3);
}

function pathFromPriorities(record: MatterOpeningRecord) {
  const first = record.top_three_priorities[0];
  const mapping: Partial<
    Record<OutcomeCode, ReturnType<typeof DiscoveryPathSchema.parse>>
  > = {
    intended_transfer: "goals, values, and distribution intentions",
    tax_minimization: "tax-minimization considerations",
    asset_protection: "asset-protection considerations",
    support_for_others: "family, beneficiaries, and dependents",
    distribution_control: "goals, values, and distribution intentions",
    incapacity_readiness: "incapacity and continuity",
    conflict_prevention: "family, beneficiaries, and dependents",
    heir_readiness: "professional contacts and heir readiness",
    plan_alignment: "implementation and plan-alignment verification",
    house_in_order_assurance: "implementation and plan-alignment verification",
    legacy: "business, charitable, and legacy planning",
    other: "goals, values, and distribution intentions",
  };
  return mapping[first] ?? "goals, values, and distribution intentions";
}

function parseContact(text: string) {
  const parts = text.split("|").map((value) => value.trim());
  if (parts.length < 2) return null;
  const values = Array.from({ length: 8 }, (_, index) => parts[index] || "unknown");
  const missing = values
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value === "unknown")
    .map(({ index }) =>
      [
        "name",
        "firm",
        "expertise",
        "estate role",
        "email",
        "telephone",
        "contact trigger",
        "priority",
      ][index] ?? "field",
    );
  return {
    name: values[0],
    firm: values[1],
    expertise: values[2],
    estate_role: values[3],
    email: values[4],
    telephone: values[5],
    contact_trigger: values[6],
    priority:
      values[7].toLowerCase() === "backup"
        ? ("backup" as const)
        : values[7].toLowerCase() === "primary"
          ? ("primary" as const)
          : ("unknown" as const),
    missing_information: missing,
  };
}

function parsePeopleWhoHelp(text: string) {
  const entries = text.split(/[;\n]/).map((value) => value.trim()).filter(Boolean);
  const contacts: NonNullable<Interpretation["patch"]["professional_and_family_contacts"]> = [];
  const participants: NonNullable<Interpretation["patch"]["other_participants"]> = [];

  for (const entry of entries) {
    if (/contact needed|no contact|none/i.test(entry)) {
      return { contacts: null, participants, missing: ["CONTACT_NEEDED"], invalid: false };
    }

    if (entry.includes("|")) {
      const contact = parseContact(entry);
      if (!contact) {
        return {
          contacts: null,
          participants,
          missing: [],
          invalid: true,
        };
      }
      contacts.push(contact);
      continue;
    }

    participants.push({
      name: entry,
      relationship: "principal-provided",
      intended_role: "participate in the estate-planning process",
      involvement_timing: "principal-provided",
    });
  }

  return {
    contacts,
    participants,
    missing: [],
    invalid: false,
  };
}

export function interpretSyntheticTurn(
  step: OpeningStep,
  answer: string,
  record: MatterOpeningRecord,
  state: WorkflowState,
): Interpretation {
  const text = answer.trim();
  const lower = text.toLowerCase();
  const result = baseInterpretation(step);

  if (!text) {
    return InterpretationSchema.parse({
      ...result,
      accepted: false,
      needs_clarification: true,
      clarification_question: "Please share a response before continuing.",
    });
  }

  switch (step) {
    case "MO01_OUTCOMES": {
      const outcomes = findOutcomes(text);
      result.patch.desired_outcomes = outcomes.length ? outcomes : ["other"];
      result.patch.principal_definition_of_success = text;
      const priorities = prioritiesFromText(text, outcomes);
      if (priorities.length === 3) {
        result.patch.top_three_priorities = priorities;
      }
      break;
    }
    case "MO01_PRIORITIES": {
      const outcomes = findOutcomes(text).filter((outcome) =>
        record.desired_outcomes.includes(outcome),
      );
      const priorities = Array.from(new Set(outcomes)).slice(0, 3);
      if (priorities.length < 3) {
        priorities.push(
          ...record.desired_outcomes.filter(
            (outcome) => !priorities.includes(outcome),
          ),
        );
      }
      result.patch.top_three_priorities = priorities.slice(0, 3);
      if (result.patch.top_three_priorities.length !== 3) {
        result.accepted = false;
        result.needs_clarification = true;
        result.clarification_question =
          "Please identify three priorities in order so I can ask only the relevant follow-ups.";
      }
      break;
    }
    case "MO01_GOAL_FOLLOWUP":
      result.patch.priority_detail = {
        outcome: state.active_goal_followup ?? "other",
        detail: text,
      };
      break;
    case "MO02_PEOPLE": {
      result.patch.people_and_interests_snapshot = text;
      const flags = [
        "special needs",
        "dependent adult",
        "minor",
        "blended family",
        "unequal treatment",
        "family conflict",
        "financial immaturity",
        "business involvement",
      ].filter((flag) => lower.includes(flag));
      result.patch.people_circumstance_flags = flags;
      result.signals.people_followup_required = flags.length > 0;
      break;
    }
    case "MO02_CIRCUMSTANCES":
      result.patch.people_circumstance_flags =
        /none|not applicable|no additional/i.test(text) ? [] : [text];
      break;
    case "MO03_CURRENT_PLAN": {
      const noPlan = /\bno\b|no existing|nothing in place/i.test(text);
      result.signals.current_plan_exists = !noPlan;
      if (noPlan) {
        result.patch.current_plan_status = "no_existing_plan";
      } else if (/implement|organize/i.test(text)) {
        result.patch.current_plan_status =
          "implementation_or_organization_needed";
      } else if (/update/i.test(text)) {
        result.patch.current_plan_status = "update_needed";
      } else if (/not sure|unsure/i.test(text)) {
        result.patch.current_plan_status = "unsure_what_exists";
      } else {
        result.patch.current_plan_status = "review_requested";
      }
      result.patch.current_plan_snapshot = text;
      break;
    }
    case "MO03_PLAN_DETAILS":
      result.signals.current_plan_exists = true;
      result.patch.current_plan_snapshot = text;
      break;
    case "MO03_CHANGES":
      result.signals.current_plan_exists = true;
      result.patch.changes_since_current_plan = /none|no known/i.test(text)
        ? ["no known material change"]
        : text.split(/[;,]/).map((value) => value.trim()).filter(Boolean);
      break;
    case "MO04_TIMING": {
      const noDeadline = /no (specific )?deadline|not urgent/i.test(text);
      const stop =
        !noDeadline &&
        /death|died|incapacit|coerc|exploit|court|imminent|signing|tomorrow|urgent deadline/i.test(
          text,
        );
      result.patch.timing_reason = text;
      result.patch.timing_event = noDeadline ? "none identified" : text;
      result.patch.timing_date = "unknown";
      result.patch.timing_importance = stop ? "critical" : "ordinary";
      if (stop) {
        result.stop = {
          triggered: true,
          category: /coerc|exploit/i.test(text)
            ? "capacity_or_voluntariness"
            : "expedited_event",
          reason: text,
          immediate_action:
            "Pause self-service work and contact the appropriate estate attorney or qualified professional about this event.",
        };
      }
      break;
    }
    case "MO05_FOOTPRINT":
    case "MO05_COMPLEXITIES":
      result.patch.geographic_and_complexity_flags = /none|not applicable/i.test(
        text,
      )
        ? ["not applicable"]
        : text.split(/[;\n]/).map((value) => value.trim()).filter(Boolean);
      break;
    case "MO06_CONTACTS": {
      const parsed = parsePeopleWhoHelp(text);
      if (parsed.invalid) {
        result.accepted = false;
        result.needs_clarification = true;
        result.clarification_question =
          "Please provide each contact as name | firm | expertise | estate role | email | phone | contact trigger | primary or backup, or include only people you want to participate.";
        break;
      }
      if (parsed.missing.length > 0) {
        result.patch.missing_contacts = parsed.missing;
        result.signals.contacts_complete = true;
        break;
      }
      if (parsed.contacts && parsed.contacts.length > 0) {
        result.patch.professional_and_family_contacts = parsed.contacts;
      }
      if (parsed.participants.length > 0) {
        result.patch.other_participants = parsed.participants;
      }
      result.signals.contacts_complete =
        parsed.contacts?.some((contact) => contact.missing_information.length > 0) === false;
      if (!result.signals.contacts_complete) {
        result.acknowledgement =
          "That contact is captured, but I am still missing some information.";
        result.accepted = false;
        result.needs_clarification = true;
        result.clarification_question =
          "Please provide a complete contact line for the person including name, firm, expertise, estate role, email, phone, and when to contact them.";
      }
      break;
    }
    case "MO08_HOUSE_IN_ORDER":
      result.patch.house_in_order_concern = /^(no|none)/i.test(text)
        ? "none identified"
        : text;
      result.patch.selected_discovery_path = pathFromPriorities(record);
      result.patch.single_next_action =
        "Open your Estate Blueprint and move into planning recommendations and profile review.";
      break;
    case "MO08_CONFIRM":
      if (/primary home.*florida|florida.*primary home/i.test(text)) {
        result.patch.geographic_and_complexity_flags = [
          "Primary home: Florida",
        ];
        result.acknowledgement =
          "I corrected the geographic footprint and saved a revision.";
      } else if (/house.*order/i.test(text)) {
        result.patch.house_in_order_concern = text;
      } else {
        result.patch.single_next_action = text;
      }
      break;
    default:
      result.accepted = false;
      result.needs_clarification = true;
      result.clarification_question = "No further response is accepted in this state.";
  }

  return InterpretationSchema.parse(result);
}
