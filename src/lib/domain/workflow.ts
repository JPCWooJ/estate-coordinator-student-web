import {
  Interpretation,
  InterpretationPatch,
  MatterOpeningRecord,
  OpeningStep,
  OUTCOME_LABELS,
  PlanningSummaryCorrection,
  WorkflowState,
} from "./matter-opening";

const STEP_LABELS: Record<OpeningStep, string> = {
  MO01_OUTCOMES: "Your estate-planning priorities",
  MO01_PRIORITIES: "Your top three priorities",
  MO01_GOAL_FOLLOWUP: "What success looks like",
  MO02_PEOPLE: "People and interests",
  MO02_CIRCUMSTANCES: "Important circumstances",
  MO03_CURRENT_PLAN: "Current planning context",
  MO03_PLAN_DETAILS: "Current plan details",
  MO03_CHANGES: "Important changes",
  MO04_TIMING: "Timing",
  MO05_FOOTPRINT: "Property and locations",
  MO05_COMPLEXITY: "Material complexity",
  MO06_CONTACTS: "People who should help",
  MO08_HOUSE_IN_ORDER: "Anything else to organize",
  MO08_CONFIRM: "Confirm Planning Summary",
  BLUEPRINT_READY: "Ready to build your Estate Blueprint",
  STOPPED: "Immediate attention required",
};

const STEP_PROGRESS: Record<OpeningStep, number> = {
  MO01_OUTCOMES: 12,
  MO01_PRIORITIES: 18,
  MO01_GOAL_FOLLOWUP: 24,
  MO02_PEOPLE: 34,
  MO02_CIRCUMSTANCES: 40,
  MO03_CURRENT_PLAN: 48,
  MO03_PLAN_DETAILS: 54,
  MO03_CHANGES: 60,
  MO04_TIMING: 68,
  MO05_FOOTPRINT: 76,
  MO05_COMPLEXITY: 84,
  MO06_CONTACTS: 90,
  MO08_HOUSE_IN_ORDER: 94,
  MO08_CONFIRM: 95,
  BLUEPRINT_READY: 100,
  STOPPED: 100,
};

function nextPriority(record: MatterOpeningRecord) {
  return record.top_three_priorities.find(
    (priority) =>
      !record.priority_details.some((detail) => detail.outcome === priority),
  );
}

export function getStepLabel(step: OpeningStep) {
  return STEP_LABELS[step];
}

export function getProgress(step: OpeningStep) {
  return STEP_PROGRESS[step];
}

export function getCanonicalQuestion(
  record: MatterOpeningRecord,
  state: WorkflowState,
) {
  if (state.clarification) return state.clarification.question;

  switch (state.step) {
    case "MO01_OUTCOMES":
      return "What would you most like your estate plan to accomplish, and which three outcomes matter most?";
    case "MO01_PRIORITIES":
      return "Which three of those outcomes are your highest priorities, in order?";
    case "MO01_GOAL_FOLLOWUP": {
      const priority = nextPriority(record);
      return priority
        ? `For ${OUTCOME_LABELS[priority].toLowerCase()}, what would a good result look like?`
        : "What would a successful estate plan look like to you?";
    }
    case "MO02_PEOPLE":
      return "Who should benefit from or be protected by your estate plan, and what interests matter most?";
    case "MO02_CIRCUMSTANCES":
      return "What should we understand about those circumstances before building your plan?";
    case "MO03_CURRENT_PLAN":
      return "Do you have an existing estate plan, and does it still reflect what you want?";
    case "MO03_PLAN_DETAILS":
      return "What documents or planning arrangements do you already have, and when were they completed?";
    case "MO03_CHANGES":
      return "What important changes have occurred since that plan was completed?";
    case "MO04_TIMING":
      return "Why are you planning now, and is there any event or deadline we should account for?";
    case "MO05_FOOTPRINT":
      return "Where are your important property, business, or family interests located?";
    case "MO05_COMPLEXITY":
      return "Are there business, tax, digital-asset, family, or other complexities the plan should account for?";
    case "MO06_CONTACTS":
      return "Who should be involved or available to help with your estate plan now or in the future?";
    case "MO08_HOUSE_IN_ORDER":
      return "Is there anything else that would help you feel your affairs are in order?";
    case "MO08_CONFIRM":
      return "Review your Planning Summary and confirm it, or describe one correction.";
    case "BLUEPRINT_READY":
      return "Your confirmed planning baseline is ready for the Estate Blueprint.";
    case "STOPPED":
      return state.stop?.immediate_action ?? "This work requires immediate attention.";
  }
}

function classificationFor(status: MatterOpeningRecord["current_plan_status"]) {
  if (status === "no_existing_plan") return "NEW_PLAN";
  if (status === "current" || status === "update_needed") return "PLAN_UPDATE";
  return "UNCLASSIFIED";
}

function replacePriorityDetail(
  record: MatterOpeningRecord,
  detail: NonNullable<InterpretationPatch["priority_detail"]>,
) {
  return [
    ...record.priority_details.filter((item) => item.outcome !== detail.outcome),
    detail,
  ];
}

function mergeFlags(current: string[], incoming: string[] | null) {
  return incoming ? [...new Set([...current, ...incoming])] : current;
}

function applyStepPatch(
  record: MatterOpeningRecord,
  step: OpeningStep,
  patch: InterpretationPatch,
): MatterOpeningRecord {
  switch (step) {
    case "MO01_OUTCOMES":
      return {
        ...record,
        desired_outcomes: patch.desired_outcomes ?? record.desired_outcomes,
        top_three_priorities:
          patch.top_three_priorities ?? record.top_three_priorities,
        principal_definition_of_success:
          patch.principal_definition_of_success ??
          record.principal_definition_of_success,
      };
    case "MO01_PRIORITIES":
      return {
        ...record,
        top_three_priorities:
          patch.top_three_priorities ?? record.top_three_priorities,
      };
    case "MO01_GOAL_FOLLOWUP":
      return patch.priority_detail
        ? {
            ...record,
            priority_details: replacePriorityDetail(record, patch.priority_detail),
          }
        : record;
    case "MO02_PEOPLE":
    case "MO02_CIRCUMSTANCES":
      return {
        ...record,
        people_and_interests_snapshot:
          patch.people_and_interests_snapshot ??
          record.people_and_interests_snapshot,
        people_circumstance_flags:
          patch.people_circumstance_flags ?? record.people_circumstance_flags,
      };
    case "MO03_CURRENT_PLAN": {
      const status = patch.current_plan_status ?? record.current_plan_status;
      return {
        ...record,
        current_plan_status: status,
        current_plan_snapshot:
          patch.current_plan_snapshot ?? record.current_plan_snapshot,
        matter_classification: classificationFor(status),
      };
    }
    case "MO03_PLAN_DETAILS":
      return {
        ...record,
        current_plan_snapshot:
          patch.current_plan_snapshot ?? record.current_plan_snapshot,
      };
    case "MO03_CHANGES":
      return {
        ...record,
        changes_since_current_plan:
          patch.changes_since_current_plan ?? record.changes_since_current_plan,
      };
    case "MO04_TIMING":
      return {
        ...record,
        timing_event_or_deadline: {
          reason: patch.timing_reason ?? record.timing_event_or_deadline.reason,
          event: patch.timing_event ?? record.timing_event_or_deadline.event,
          date: patch.timing_date ?? record.timing_event_or_deadline.date,
          importance:
            patch.timing_importance ??
            record.timing_event_or_deadline.importance,
        },
      };
    case "MO05_FOOTPRINT":
    case "MO05_COMPLEXITY":
      return {
        ...record,
        geographic_and_complexity_flags: mergeFlags(
          record.geographic_and_complexity_flags,
          patch.geographic_and_complexity_flags,
        ),
      };
    case "MO06_CONTACTS":
      return {
        ...record,
        professional_and_family_contacts:
          patch.professional_and_family_contacts ??
          record.professional_and_family_contacts,
        missing_contacts: patch.missing_contacts ?? record.missing_contacts,
        other_participants:
          patch.other_participants ?? record.other_participants,
      };
    case "MO08_HOUSE_IN_ORDER":
      return {
        ...record,
        house_in_order_concern:
          patch.house_in_order_concern ?? record.house_in_order_concern,
      };
    default:
      return record;
  }
}

function nextStep(record: MatterOpeningRecord, step: OpeningStep): OpeningStep {
  switch (step) {
    case "MO01_OUTCOMES":
      return record.top_three_priorities.length === 3
        ? "MO01_GOAL_FOLLOWUP"
        : "MO01_PRIORITIES";
    case "MO01_PRIORITIES":
      return "MO01_GOAL_FOLLOWUP";
    case "MO01_GOAL_FOLLOWUP":
      return nextPriority(record) ? "MO01_GOAL_FOLLOWUP" : "MO02_PEOPLE";
    case "MO02_PEOPLE":
      return record.people_circumstance_flags.length
        ? "MO02_CIRCUMSTANCES"
        : "MO03_CURRENT_PLAN";
    case "MO02_CIRCUMSTANCES":
      return "MO03_CURRENT_PLAN";
    case "MO03_CURRENT_PLAN":
      return record.current_plan_status === "no_existing_plan"
        ? "MO04_TIMING"
        : "MO03_PLAN_DETAILS";
    case "MO03_PLAN_DETAILS":
      return "MO03_CHANGES";
    case "MO03_CHANGES":
      return "MO04_TIMING";
    case "MO04_TIMING":
      return "MO05_FOOTPRINT";
    case "MO05_FOOTPRINT":
      return "MO05_COMPLEXITY";
    case "MO05_COMPLEXITY":
      return "MO06_CONTACTS";
    case "MO06_CONTACTS":
      return "MO08_HOUSE_IN_ORDER";
    case "MO08_HOUSE_IN_ORDER":
      return "MO08_CONFIRM";
    default:
      return step;
  }
}

export function applyAcceptedInterpretation(
  record: MatterOpeningRecord,
  state: WorkflowState,
  interpretation: Interpretation,
) {
  if (state.step === "MO08_CONFIRM") {
    throw new Error("Planning Summary corrections require the correction operation.");
  }
  if (state.step === "BLUEPRINT_READY" || state.step === "STOPPED") {
    throw new Error("This Matter Opening cannot accept another turn.");
  }

  if (interpretation.outcome === "clarification") {
    if (!interpretation.clarification_question) {
      throw new Error("A clarification outcome requires a question.");
    }
    return {
      record,
      state: {
        ...state,
        clarification: { question: interpretation.clarification_question },
      },
      assistantMessage: interpretation.clarification_question,
    };
  }

  if (interpretation.outcome === "stop") {
    if (!interpretation.stop) throw new Error("A stop outcome requires stop details.");
    const expedited = interpretation.stop.category === "expedited_event";
    return {
      record: {
        ...record,
        matter_status: expedited
          ? ("EXPEDITED_EVENT" as const)
          : ("MANDATORY_STOP" as const),
      },
      state: {
        step: "STOPPED" as const,
        clarification: null,
        stop: interpretation.stop,
      },
      assistantMessage: interpretation.stop.immediate_action,
    };
  }

  const updatedRecord = applyStepPatch(record, state.step, interpretation.patch);
  const updatedState: WorkflowState = {
    step: nextStep(updatedRecord, state.step),
    clarification: null,
    stop: null,
  };
  return {
    record: updatedRecord,
    state: updatedState,
    assistantMessage: interpretation.acknowledgement,
  };
}

export function applyPlanningSummaryCorrection(
  record: MatterOpeningRecord,
  state: WorkflowState,
  correction: PlanningSummaryCorrection,
) {
  if (state.step !== "MO08_CONFIRM") {
    throw new Error("Planning Summary corrections are available only before confirmation.");
  }
  if (correction.outcome === "clarification") {
    if (!correction.clarification_question) {
      throw new Error("A clarification outcome requires a question.");
    }
    return {
      record,
      state: {
        ...state,
        clarification: { question: correction.clarification_question },
      },
      assistantMessage: correction.clarification_question,
      changed: false,
    };
  }

  const patch = correction.patch;
  const currentPlanStatus = patch.current_plan_status ?? record.current_plan_status;
  const corrected: MatterOpeningRecord = {
    ...record,
    desired_outcomes: patch.desired_outcomes ?? record.desired_outcomes,
    top_three_priorities:
      patch.top_three_priorities ?? record.top_three_priorities,
    principal_definition_of_success:
      patch.principal_definition_of_success ??
      record.principal_definition_of_success,
    people_and_interests_snapshot:
      patch.people_and_interests_snapshot ?? record.people_and_interests_snapshot,
    people_circumstance_flags:
      patch.people_circumstance_flags ?? record.people_circumstance_flags,
    current_plan_status: currentPlanStatus,
    current_plan_snapshot:
      patch.current_plan_snapshot ?? record.current_plan_snapshot,
    changes_since_current_plan:
      patch.changes_since_current_plan ?? record.changes_since_current_plan,
    timing_event_or_deadline: {
      reason: patch.timing_reason ?? record.timing_event_or_deadline.reason,
      event: patch.timing_event ?? record.timing_event_or_deadline.event,
      date: patch.timing_date ?? record.timing_event_or_deadline.date,
      importance:
        patch.timing_importance ?? record.timing_event_or_deadline.importance,
    },
    geographic_and_complexity_flags:
      patch.geographic_and_complexity_flags ??
      record.geographic_and_complexity_flags,
    professional_and_family_contacts:
      patch.professional_and_family_contacts ??
      record.professional_and_family_contacts,
    missing_contacts: patch.missing_contacts ?? record.missing_contacts,
    other_participants: patch.other_participants ?? record.other_participants,
    matter_classification: classificationFor(currentPlanStatus),
  };

  return {
    record: corrected,
    state: { ...state, clarification: null },
    assistantMessage: correction.acknowledgement,
    changed: true,
  };
}

function exitGateSatisfied(record: MatterOpeningRecord) {
  return (
    record.desired_outcomes.length > 0 &&
    record.top_three_priorities.length === 3 &&
    record.top_three_priorities.every((priority) =>
      record.priority_details.some((detail) => detail.outcome === priority),
    ) &&
    record.principal_definition_of_success !== "unknown" &&
    record.people_and_interests_snapshot !== "unknown" &&
    record.current_plan_status !== "unknown" &&
    record.current_plan_status !== "unsure_what_exists" &&
    record.current_plan_snapshot !== "unknown" &&
    record.timing_event_or_deadline.reason !== "unknown"
  );
}

export function confirmOpening(
  record: MatterOpeningRecord,
  state: WorkflowState,
  confirmedAt = new Date().toISOString(),
) {
  if (state.step !== "MO08_CONFIRM" || !exitGateSatisfied(record)) {
    throw new Error("The Planning Summary confirmation gate is not complete.");
  }
  return {
    record: {
      ...record,
      matter_status: "BLUEPRINT_READY" as const,
      principal_confirmed: "yes" as const,
      confirmation_date: confirmedAt,
    },
    state: {
      step: "BLUEPRINT_READY" as const,
      clarification: null,
      stop: null,
    },
    assistantMessage:
      "Your Planning Summary is confirmed. Your Estate Blueprint will begin from this planning baseline.",
  };
}
