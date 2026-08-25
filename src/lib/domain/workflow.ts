import {
  Interpretation,
  InterpretationPatch,
  MatterOpeningRecord,
  OpeningStep,
  OutcomeCode,
  PlanningSummaryCorrection,
  WorkflowState,
} from "./matter-opening";
import { USER_JOURNEY_PROGRESS } from "./progress";

const OUTCOME_FOLLOWUP_QUESTIONS: Record<OutcomeCode, string> = {
  intended_transfer:
    "Who or what do you most want to benefit, and what transfer outcome do you most want to prevent?",
  tax_minimization:
    "If tax minimization requires tradeoffs, how would you balance it against simplicity, flexibility, access, and control?",
  asset_protection:
    "Which risks concern you most - creditors, divorce, litigation, financial immaturity, outside influence, or something else?",
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
    "What are you least certain is coordinated correctly - documents, ownership, beneficiaries, trusts, or instructions?",
  house_in_order_assurance:
    "What evidence would give you confidence that the plan is complete, implemented, and current?",
  business_charitable_family_legacy:
    "What should continue or be preserved beyond the transfer of money?",
  other: "What would success look like in practical terms?",
};

const STEP_LABELS: Record<OpeningStep, string> = {
  INTAKE_GOALS_FAMILY: "Goals, family, and beneficiary intent",
  INTAKE_PLANNING_CONTEXT: "Current plan and planning context",
  INTAKE_TEAM_CONTINUITY: "Team and continuity",
  INTAKE_FINANCIAL_RANGE: "Financial foundation",
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
  INTAKE_GOALS_FAMILY: USER_JOURNEY_PROGRESS.estatePlanningPriorities.outcomes,
  INTAKE_PLANNING_CONTEXT: USER_JOURNEY_PROGRESS.estatePlanningPriorities.currentPlan,
  INTAKE_TEAM_CONTINUITY: USER_JOURNEY_PROGRESS.estatePlanningPriorities.contacts,
  INTAKE_FINANCIAL_RANGE: USER_JOURNEY_PROGRESS.planningFoundation,
  MO01_OUTCOMES: USER_JOURNEY_PROGRESS.estatePlanningPriorities.outcomes,
  MO01_PRIORITIES: USER_JOURNEY_PROGRESS.estatePlanningPriorities.priorities,
  MO01_GOAL_FOLLOWUP:
    USER_JOURNEY_PROGRESS.estatePlanningPriorities.goalFollowup,
  MO02_PEOPLE: USER_JOURNEY_PROGRESS.estatePlanningPriorities.people,
  MO02_CIRCUMSTANCES:
    USER_JOURNEY_PROGRESS.estatePlanningPriorities.circumstances,
  MO03_CURRENT_PLAN: USER_JOURNEY_PROGRESS.estatePlanningPriorities.currentPlan,
  MO03_PLAN_DETAILS: USER_JOURNEY_PROGRESS.estatePlanningPriorities.planDetails,
  MO03_CHANGES: USER_JOURNEY_PROGRESS.estatePlanningPriorities.changes,
  MO04_TIMING: USER_JOURNEY_PROGRESS.estatePlanningPriorities.timing,
  MO05_FOOTPRINT: USER_JOURNEY_PROGRESS.estatePlanningPriorities.footprint,
  MO05_COMPLEXITY: USER_JOURNEY_PROGRESS.estatePlanningPriorities.complexity,
  MO06_CONTACTS: USER_JOURNEY_PROGRESS.estatePlanningPriorities.contacts,
  MO08_HOUSE_IN_ORDER:
    USER_JOURNEY_PROGRESS.estatePlanningPriorities.houseInOrder,
  MO08_CONFIRM: USER_JOURNEY_PROGRESS.planningSummary,
  BLUEPRINT_READY: USER_JOURNEY_PROGRESS.planningFoundation,
  STOPPED: USER_JOURNEY_PROGRESS.estatePlanningPriorities.outcomes,
};

function hasAnsweredDefinitionOfSuccess(record: MatterOpeningRecord) {
  const canonicalStatus =
    record.canonical_intake?.fieldMeta["goals.success"]?.status;
  if (canonicalStatus && canonicalStatus !== "missing") return true;

  const value = record.principal_definition_of_success.trim().toLowerCase();
  return Boolean(value) && value !== "unknown";
}

function nextPriority(record: MatterOpeningRecord) {
  return record.top_three_priorities.find(
    (priority) => {
      const detail = record.priority_details.find(
        (item) => item.outcome === priority,
      );
      const definitionAlreadyAnswersPriority =
        priority === "other" && hasAnsweredDefinitionOfSuccess(record);
      return (!detail || !detail.detail.trim()) && !definitionAlreadyAnswersPriority;
    },
  );
}

function priorityFollowupQuestion(priority: OutcomeCode) {
  return OUTCOME_FOLLOWUP_QUESTIONS[priority];
}

export function getStepLabel(step: OpeningStep) {
  return STEP_LABELS[step];
}

export function getProgress(step: OpeningStep) {
  return STEP_PROGRESS[step];
}

export function getWorkflowProgress(state: WorkflowState) {
  return state.step === "STOPPED"
    ? (state.progressBeforeStop ?? STEP_PROGRESS.STOPPED)
    : STEP_PROGRESS[state.step];
}

export function getCanonicalQuestion(
  record: MatterOpeningRecord,
  state: WorkflowState,
) {
  if (state.clarification) return state.clarification.question;

  switch (state.step) {
    case "INTAKE_GOALS_FAMILY":
      return "Tell us what matters most and who your plan should benefit or protect.";
    case "INTAKE_PLANNING_CONTEXT":
      return "Tell us about your current plan, timing, location, and material complexity.";
    case "INTAKE_TEAM_CONTINUITY":
      return "Provide the key people and responsibilities involved in your estate planning.";
    case "INTAKE_FINANCIAL_RANGE":
      return "Provide approximate planning ranges and the boundaries your plan should preserve.";
    case "MO01_OUTCOMES":
      return "If this estate-planning process works exactly as you hope, what will it accomplish for you? Tell me what matters most, and if you can, put your top three priorities in order.";
    case "MO01_PRIORITIES":
      return "Of those outcomes, which three matter most to you, in priority order?";
    case "MO01_GOAL_FOLLOWUP": {
      const priority = nextPriority(record);
      if (!priority) throw new Error("No priority follow-up is available.");
      return priorityFollowupQuestion(priority);
    }
    case "MO02_PEOPLE":
      return "At a high level, who do you expect should benefit from or be protected by your estate plan?";
    case "MO02_CIRCUMSTANCES":
      return "Are there any circumstances involving these people that the planning process must understand?";
    case "MO03_CURRENT_PLAN":
      return "Do you already have estate-planning documents or arrangements in place?";
    case "MO03_PLAN_DETAILS":
      return "What documents or arrangements do you know exist, and approximately when were they completed?";
    case "MO03_CHANGES":
      return "What important changes have occurred since they were completed?";
    case "MO04_TIMING":
      return "Why are you addressing this now, and is there an event or deadline affecting the timing?";
    case "MO05_FOOTPRINT":
      return "Where is your primary home, and do you have important property, businesses, trusts, citizenship, residence, or other connections in another state or country?";
    case "MO05_COMPLEXITY":
      return "Are there any trusts, businesses, foreign connections, digital assets, major charitable plans, or other complexities you already know should be considered?";
    case "MO06_CONTACTS":
      return "Who should be involved or available to help with your estate plan now or in the future? This might include attorneys, tax or financial professionals, assistants, trusted family members, or anyone else who should know what to do.";
    case "MO08_HOUSE_IN_ORDER":
      return "What would you need to see, understand, or have confirmed to feel confident that your estate plan is complete, current, and working the way you intend?";
    case "MO08_CONFIRM":
      return "Does this accurately capture what you want your estate-planning process to accomplish and what matters most to you?";
    case "BLUEPRINT_READY":
      return "Your confirmed planning baseline is ready for the Estate Blueprint.";
    case "STOPPED":
      return state.stop?.immediate_action ?? "This work requires immediate attention.";
  }
}

function classificationFor(
  status: MatterOpeningRecord["current_plan_status"],
): MatterOpeningRecord["matter_classification"] {
  if (status === "no_existing_plan") return "NEW_PLAN";
  if (status === "update_needed") return "PLAN_UPDATE";
  if (status === "implementation_or_organization_needed") {
    return "IMPLEMENTATION_ORGANIZATION";
  }
  return "PLAN_REVIEW";
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
    case "MO01_GOAL_FOLLOWUP": {
      if (patch.priority_detail) {
        return {
          ...record,
          priority_details: replacePriorityDetail(record, patch.priority_detail),
        };
      }
      const pendingPriority = nextPriority(record);
      if (
        pendingPriority === "other" &&
        patch.principal_definition_of_success !== null
      ) {
        return {
          ...record,
          principal_definition_of_success:
            patch.principal_definition_of_success,
        };
      }
      return record;
    }
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

function nextStep(
  record: MatterOpeningRecord,
  step: OpeningStep,
  patch: InterpretationPatch,
): OpeningStep {
  switch (step) {
    case "MO01_OUTCOMES":
      return record.top_three_priorities.length === 3
        ? "MO01_GOAL_FOLLOWUP"
        : "MO01_PRIORITIES";
    case "MO01_PRIORITIES":
      return nextPriority(record) ? "MO01_GOAL_FOLLOWUP" : "MO02_PEOPLE";
    case "MO01_GOAL_FOLLOWUP":
      return nextPriority(record) ? "MO01_GOAL_FOLLOWUP" : "MO02_PEOPLE";
    case "MO02_PEOPLE": {
      const circumstancesResolved =
        record.people_circumstance_flags.length > 0 ||
        patch.people_circumstance_flags !== null;
      return circumstancesResolved ? "MO03_CURRENT_PLAN" : "MO02_CIRCUMSTANCES";
    }
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
        progressBeforeStop: getProgress(state.step),
        clarification: null,
        stop: interpretation.stop,
      },
      assistantMessage: interpretation.stop.immediate_action,
    };
  }

  const updatedRecord = applyStepPatch(record, state.step, interpretation.patch);
  const updatedState: WorkflowState = {
    step: nextStep(updatedRecord, state.step, interpretation.patch),
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
    const missingPriority = nextPriority(record);
    const clarificationQuestion = missingPriority
      ? priorityFollowupQuestion(missingPriority)
      : correction.clarification_question;
    return {
      record,
      state: {
        ...state,
        clarification: { question: clarificationQuestion },
      },
      assistantMessage: clarificationQuestion,
      changed: false,
    };
  }

  const patch = correction.patch;
  const currentPlanStatus = patch.current_plan_status ?? record.current_plan_status;
  const topThreePriorities =
    patch.top_three_priorities ?? record.top_three_priorities;
  const retainedPriorityDetails = record.priority_details.filter((detail) =>
    topThreePriorities.includes(detail.outcome),
  );
  const priorityDetails =
    patch.priority_detail && topThreePriorities.includes(patch.priority_detail.outcome)
      ? replacePriorityDetail(
          { ...record, priority_details: retainedPriorityDetails },
          patch.priority_detail,
        )
      : retainedPriorityDetails;
  const corrected: MatterOpeningRecord = {
    ...record,
    desired_outcomes: patch.desired_outcomes ?? record.desired_outcomes,
    top_three_priorities: topThreePriorities,
    priority_details: priorityDetails,
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
  const missingPriority = nextPriority(corrected);
  const clarificationQuestion = missingPriority
    ? priorityFollowupQuestion(missingPriority)
    : null;

  return {
    record: corrected,
    state: {
      ...state,
      clarification: clarificationQuestion
        ? { question: clarificationQuestion }
        : null,
    },
    assistantMessage: clarificationQuestion ?? correction.acknowledgement,
    changed: true,
  };
}

export function confirmOpening(
  record: MatterOpeningRecord,
  state: WorkflowState,
  confirmedAt = new Date().toISOString(),
) {
  if (
    state.step !== "MO08_CONFIRM" ||
    state.clarification !== null ||
    nextPriority(record)
  ) {
    throw new Error("The Planning Summary confirmation gate is not complete.");
  }
  return {
    record: {
      ...record,
      matter_status: "BLUEPRINT_READY" as const,
      canonical_intake: record.canonical_intake
        ? {
            ...record.canonical_intake,
            fieldMeta: Object.fromEntries(
              Object.entries(record.canonical_intake.fieldMeta).map(
                ([fieldId, metadata]) => [
                  fieldId,
                  { ...metadata, confirmed: true },
                ],
              ),
            ),
          }
        : undefined,
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
