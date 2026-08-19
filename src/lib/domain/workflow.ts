import {
  DiscoveryPathSchema,
  Interpretation,
  MatterOpeningRecord,
  MatterOpeningRecordSchema,
  OpeningStep,
  OUTCOME_FOLLOW_UPS,
  OUTCOME_LABELS,
  OutcomeCode,
  WorkflowState,
  WorkflowStateSchema,
} from "./matter-opening";

export type WorkflowResult = {
  record: MatterOpeningRecord;
  state: WorkflowState;
  assistantMessage: string;
};

const OUTCOME_LIST = Object.entries(OUTCOME_LABELS)
  .map(([, label], index) => `${index + 1}. ${label}`)
  .join("\n");

const DISCOVERY_PATH_BY_PRIORITY: Record<
  OutcomeCode,
  ReturnType<typeof DiscoveryPathSchema.parse>
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

const MATTER_OPENING_NEXT_ACTION =
  "Open Your Estate Blueprint and move into planning recommendations and profile review.";

export function prepareMatterOpeningForConfirmation(
  record: MatterOpeningRecord,
): MatterOpeningRecord {
  const firstPriority = record.top_three_priorities[0];
  return MatterOpeningRecordSchema.parse({
    ...record,
    selected_discovery_path:
      record.selected_discovery_path === "unknown"
        ? firstPriority
          ? DISCOVERY_PATH_BY_PRIORITY[firstPriority]
          : "goals, values, and distribution intentions"
        : record.selected_discovery_path,
    single_next_action:
      record.single_next_action === "unknown"
        ? MATTER_OPENING_NEXT_ACTION
        : record.single_next_action,
  });
}

export function getCanonicalQuestion(
  state: WorkflowState,
  record: MatterOpeningRecord,
): string {
  switch (state.step) {
    case "MO01_OUTCOMES":
      return `If this estate-planning process worked exactly as you hope, what would it accomplish for you?\n\nPlease include your top priorities in order of importance if you can.\n\nIf helpful, consider:\n${OUTCOME_LIST}`;
    case "MO01_PRIORITIES":
      return "Which three of these outcomes matter most to you? Put them in priority order.";
    case "MO01_GOAL_FOLLOWUP":
      return state.active_goal_followup
        ? OUTCOME_FOLLOW_UPS[state.active_goal_followup]
        : "What would success look like in practical terms?";
    case "MO02_PEOPLE":
      return "At a high level, who do you expect should benefit from or be protected by your estate plan?";
    case "MO02_CIRCUMSTANCES":
      return "Are there any circumstances involving these people that the planning process must understand?";
    case "MO03_CURRENT_PLAN":
      return "Do you already have estate-planning documents or arrangements in place?";
    case "MO03_PLAN_DETAILS":
      return "What documents or arrangements do you know exist, approximately when were they completed, and where are they kept?";
    case "MO03_CHANGES":
      return "What important changes have occurred since they were completed?";
    case "MO04_TIMING":
      return "Why are you addressing this now, and is there an event or deadline affecting the timing?";
    case "MO05_FOOTPRINT":
      return "Where is your primary home, and do you have important property, businesses, trusts, citizenship, residence, or other connections in another state or country?";
    case "MO05_COMPLEXITIES":
      return "Are there any trusts, businesses, foreign connections, digital assets, major charitable plans, or other complexities you already know should be considered?";
    case "MO06_CONTACTS":
      return "Who should be involved or available to help with your estate plan now or in the future? This might include attorneys, tax or financial professionals, assistants, trusted family members, or anyone else who should know what to do.";
    case "MO06_CONTACTS_MORE":
      return "Is there another person or professional to add, or are you ready to continue?";
    case "MO08_HOUSE_IN_ORDER":
      return "What would you need to see, understand, or have confirmed to feel confident your plan is complete, current, and working as intended?";
    case "MO08_CONFIRM":
      return "Is this an accurate statement of what you want us to accomplish and where we should begin?";
    case "STOPPED":
      return state.stop?.immediate_action ?? "Please contact the appropriate professional before continuing.";
    case "CONFIRMED":
      return "Planning summary is confirmed.";
    default:
      return record.principal_definition_of_success;
  }
}

export function getStepLabel(step: OpeningStep): string {
  if (step === "MO01_OUTCOMES" || step === "MO01_PRIORITIES") {
    return "Estate Planning Priorities";
  }
  if (step === "MO01_GOAL_FOLLOWUP") return "Priorities Clarification";
  if (step.startsWith("MO02")) return "People and support";
  if (step.startsWith("MO03")) return "Current planning context";
  if (step === "MO04_TIMING") return "Timing and urgency";
  if (step.startsWith("MO05")) return "Footprint and complexity";
  if (step.startsWith("MO06")) return "People who should help";
  if (step.startsWith("MO08")) return "Planning Summary";
  if (step === "STOPPED") return "Professional follow-up required";
  return "Planning Summary confirmed";
}

export function getProgress(step: OpeningStep): number {
  if (step.startsWith("MO01")) return 12;
  if (step.startsWith("MO02")) return 25;
  if (step.startsWith("MO03")) return 38;
  if (step === "MO04_TIMING") return 50;
  if (step.startsWith("MO05")) return 62;
  if (step.startsWith("MO06")) return 82;
  if (step.startsWith("MO08")) return 95;
  if (step === "CONFIRMED") return 100;
  return 50;
}

function mergePriorityDetail(
  existing: MatterOpeningRecord["priority_details"],
  detail: { outcome: OutcomeCode; detail: string },
) {
  return [...existing.filter((item) => item.outcome !== detail.outcome), detail];
}

function classificationFromStatus(
  status: MatterOpeningRecord["current_plan_status"],
): MatterOpeningRecord["matter_classification"] {
  if (status === "no_existing_plan") return "NEW_PLAN";
  if (status === "update_needed") return "PLAN_UPDATE";
  if (status === "implementation_or_organization_needed") {
    return "IMPLEMENTATION_ORGANIZATION";
  }
  return "PLAN_REVIEW";
}

function appendUnique<T>(left: T[], right: T[] | null): T[] {
  if (!right) return left;
  return Array.from(new Set([...left, ...right]));
}

function applyPatchForStep(
  record: MatterOpeningRecord,
  state: WorkflowState,
  interpretation: Interpretation,
): MatterOpeningRecord {
  const patch = interpretation.patch;
  const next = structuredClone(record);

  if (state.step === "MO01_OUTCOMES") {
    if (patch.desired_outcomes) next.desired_outcomes = patch.desired_outcomes;
    if (patch.top_three_priorities && patch.top_three_priorities.length === 3) {
      next.top_three_priorities = patch.top_three_priorities;
    }
    if (patch.principal_definition_of_success) {
      next.principal_definition_of_success = patch.principal_definition_of_success;
    }
  } else if (state.step === "MO01_PRIORITIES") {
    if (patch.top_three_priorities) {
      next.top_three_priorities = patch.top_three_priorities;
    }
  } else if (state.step === "MO01_GOAL_FOLLOWUP") {
    if (patch.priority_detail) {
      next.priority_details = mergePriorityDetail(
        next.priority_details,
        patch.priority_detail,
      );
    }
  } else if (state.step === "MO02_PEOPLE") {
    if (patch.people_and_interests_snapshot) {
      next.people_and_interests_snapshot = patch.people_and_interests_snapshot;
    }
    next.people_circumstance_flags = appendUnique(
      next.people_circumstance_flags,
      patch.people_circumstance_flags,
    );
  } else if (state.step === "MO02_CIRCUMSTANCES") {
    next.people_circumstance_flags = appendUnique(
      next.people_circumstance_flags,
      patch.people_circumstance_flags,
    );
  } else if (state.step === "MO03_CURRENT_PLAN") {
    if (patch.current_plan_status) {
      next.current_plan_status = patch.current_plan_status;
      next.matter_classification = classificationFromStatus(
        patch.current_plan_status,
      );
    }
    if (patch.current_plan_snapshot) {
      next.current_plan_snapshot = patch.current_plan_snapshot;
    }
  } else if (state.step === "MO03_PLAN_DETAILS") {
    if (patch.current_plan_snapshot) {
      next.current_plan_snapshot = patch.current_plan_snapshot;
    }
  } else if (state.step === "MO03_CHANGES") {
    if (patch.changes_since_current_plan) {
      next.changes_since_current_plan = patch.changes_since_current_plan;
    }
  } else if (state.step === "MO04_TIMING") {
    next.timing_event_or_deadline = {
      reason: patch.timing_reason ?? next.timing_event_or_deadline.reason,
      event: patch.timing_event ?? next.timing_event_or_deadline.event,
      date: patch.timing_date ?? next.timing_event_or_deadline.date,
      importance:
        patch.timing_importance ?? next.timing_event_or_deadline.importance,
    };
  } else if (
    state.step === "MO05_FOOTPRINT" ||
    state.step === "MO05_COMPLEXITIES"
  ) {
    next.geographic_and_complexity_flags = appendUnique(
      next.geographic_and_complexity_flags,
      patch.geographic_and_complexity_flags,
    );
  } else if (
    state.step === "MO06_CONTACTS" ||
    state.step === "MO06_CONTACTS_MORE"
  ) {
    if (patch.professional_and_family_contacts) {
      next.professional_and_family_contacts = [
        ...next.professional_and_family_contacts,
        ...patch.professional_and_family_contacts,
      ];
    }
    next.missing_contacts = appendUnique(
      next.missing_contacts,
      patch.missing_contacts,
    );
    if (patch.other_participants) {
      next.other_participants = [
        ...next.other_participants,
        ...patch.other_participants,
      ];
    }
  } else if (state.step === "MO08_HOUSE_IN_ORDER") {
    if (patch.house_in_order_concern) {
      next.house_in_order_concern = patch.house_in_order_concern;
    }
  } else if (state.step === "MO08_CONFIRM") {
    if (patch.geographic_and_complexity_flags) {
      next.geographic_and_complexity_flags =
        patch.geographic_and_complexity_flags;
    }
    if (patch.house_in_order_concern) {
      next.house_in_order_concern = patch.house_in_order_concern;
    }
    if (patch.people_and_interests_snapshot) {
      next.people_and_interests_snapshot = patch.people_and_interests_snapshot;
    }
    if (patch.current_plan_snapshot) {
      next.current_plan_snapshot = patch.current_plan_snapshot;
    }
    if (patch.single_next_action) {
      next.single_next_action = patch.single_next_action;
    }
  }

  if (interpretation.stop.triggered) {
    next.matter_status = "EXPEDITED_EVENT";
  }

  const validated = MatterOpeningRecordSchema.parse(next);
  return state.step === "MO08_HOUSE_IN_ORDER"
    ? prepareMatterOpeningForConfirmation(validated)
    : validated;
}

function nextState(
  record: MatterOpeningRecord,
  state: WorkflowState,
  interpretation: Interpretation,
): WorkflowState {
  const next: WorkflowState = {
    ...state,
    accepted_turns: state.accepted_turns + 1,
  };

  if (interpretation.stop.triggered) {
    next.step = "STOPPED";
    next.stop = {
      category: interpretation.stop.category ?? "unresolved_dependency",
      reason:
        interpretation.stop.reason ??
        "A consequential event requires human or professional follow-up.",
      immediate_action:
        interpretation.stop.immediate_action ??
        "Contact the appropriate attorney or professional before continuing.",
    };
    return WorkflowStateSchema.parse(next);
  }

  switch (state.step) {
    case "MO01_OUTCOMES":
      if (record.top_three_priorities.length >= 3) {
        const queue = [...record.top_three_priorities];
        next.active_goal_followup = queue.shift() ?? null;
        next.goal_followup_queue = queue;
        next.step = next.active_goal_followup ? "MO01_GOAL_FOLLOWUP" : "MO02_PEOPLE";
      } else {
        next.step = "MO01_PRIORITIES";
      }
      break;
    case "MO01_PRIORITIES": {
      const queue = [...record.top_three_priorities];
      next.active_goal_followup = queue.shift() ?? null;
      next.goal_followup_queue = queue;
      next.step = next.active_goal_followup
        ? "MO01_GOAL_FOLLOWUP"
        : "MO02_PEOPLE";
      break;
    }
    case "MO01_GOAL_FOLLOWUP": {
      const queue = [...state.goal_followup_queue];
      next.active_goal_followup = queue.shift() ?? null;
      next.goal_followup_queue = queue;
      next.step = next.active_goal_followup
        ? "MO01_GOAL_FOLLOWUP"
        : "MO02_PEOPLE";
      break;
    }
    case "MO02_PEOPLE":
      next.step = interpretation.signals.people_followup_required
        ? "MO02_CIRCUMSTANCES"
        : "MO03_CURRENT_PLAN";
      break;
    case "MO02_CIRCUMSTANCES":
      next.step = "MO03_CURRENT_PLAN";
      break;
    case "MO03_CURRENT_PLAN":
      next.step = interpretation.signals.current_plan_exists
        ? "MO03_PLAN_DETAILS"
        : "MO04_TIMING";
      break;
    case "MO03_PLAN_DETAILS":
      next.step = "MO03_CHANGES";
      break;
    case "MO03_CHANGES":
      next.step = "MO04_TIMING";
      break;
    case "MO04_TIMING":
      next.step = "MO05_FOOTPRINT";
      break;
    case "MO05_FOOTPRINT":
      next.step = "MO05_COMPLEXITIES";
      break;
    case "MO05_COMPLEXITIES":
      next.step = "MO06_CONTACTS";
      break;
    case "MO06_CONTACTS":
    case "MO06_CONTACTS_MORE":
      next.step = interpretation.signals.contacts_complete
        ? "MO08_HOUSE_IN_ORDER"
        : "MO06_CONTACTS_MORE";
      break;
    case "MO08_HOUSE_IN_ORDER":
      next.step = "MO08_CONFIRM";
      break;
    case "MO08_CONFIRM":
      next.step = "MO08_CONFIRM";
      break;
    default:
      break;
  }

  return WorkflowStateSchema.parse(next);
}

export function applyAcceptedInterpretation(
  record: MatterOpeningRecord,
  state: WorkflowState,
  interpretation: Interpretation,
): WorkflowResult {
  if (!interpretation.accepted || interpretation.needs_clarification) {
    throw new Error(
      interpretation.clarification_question ??
        "The response needs clarification before it can be saved.",
    );
  }

  const updatedRecord = applyPatchForStep(record, state, interpretation);
  const updatedState = nextState(updatedRecord, state, interpretation);
  const nextQuestion = getCanonicalQuestion(updatedState, updatedRecord);
  const acknowledgement = interpretation.acknowledgement.trim();

  return {
    record: updatedRecord,
    state: updatedState,
    assistantMessage: acknowledgement
      ? `${acknowledgement}\n\n${nextQuestion}`
      : nextQuestion,
  };
}

export function confirmOpening(
  record: MatterOpeningRecord,
  state: WorkflowState,
  confirmedAt = new Date().toISOString(),
): WorkflowResult {
  if (state.step !== "MO08_CONFIRM") {
    throw new Error("Planning summary cannot be confirmed before the review gate.");
  }
  if (
    record.desired_outcomes.length === 0 ||
    record.top_three_priorities.length !== 3 ||
    record.principal_definition_of_success === "unknown" ||
    record.current_plan_snapshot === "unknown" ||
    record.selected_discovery_path === "unknown" ||
    record.single_next_action === "unknown"
  ) {
    throw new Error("The planning summary exit gate is not complete.");
  }

  const updatedRecord = MatterOpeningRecordSchema.parse({
    ...record,
    principal_confirmed: "yes",
    confirmation_date: confirmedAt,
  });
  const updatedState = WorkflowStateSchema.parse({ ...state, step: "CONFIRMED" });

  return {
    record: updatedRecord,
    state: updatedState,
    assistantMessage:
      "Your planning summary is confirmed and saved. Estate Blueprint is the next stage and will use the information you confirmed here.",
  };
}
