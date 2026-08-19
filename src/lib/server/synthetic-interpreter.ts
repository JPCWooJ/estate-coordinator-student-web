import "server-only";

import {
  emptyInterpretationPatch,
  Interpretation,
  MatterOpeningRecord,
  PlanningSummaryCorrection,
  WorkflowState,
} from "@/lib/domain/matter-opening";

const OUTCOMES_ANSWER =
  "My top priorities are intended transfer, incapacity readiness, and tax minimization; keep things practical and simple.";

function accepted(
  patch: Partial<Interpretation["patch"]>,
  acknowledgement = "Thank you. I saved that.",
): Interpretation {
  return {
    outcome: "accepted",
    acknowledgement,
    clarification_question: null,
    patch: { ...emptyInterpretationPatch(), ...patch },
    stop: null,
  };
}

function clarification(question: string): Interpretation {
  return {
    outcome: "clarification",
    acknowledgement: "",
    clarification_question: question,
    patch: emptyInterpretationPatch(),
    stop: null,
  };
}

export function interpretSyntheticAnswer(input: {
  question: string;
  answer: string;
  record: MatterOpeningRecord;
  state: WorkflowState;
}): Interpretation {
  const { answer, record, state } = input;

  if (answer === "A death occurred yesterday.") {
    return {
      outcome: "stop",
      acknowledgement: "",
      clarification_question: null,
      patch: emptyInterpretationPatch(),
      stop: {
        category: "expedited_event",
        reason: answer,
        immediate_action: "Contact the estate attorney before continuing planning.",
      },
    };
  }

  if (answer === "I need help framing this.") {
    return clarification(
      "In ordinary language, what are the three most important results you want from your estate plan?",
    );
  }

  switch (state.step) {
    case "MO01_OUTCOMES":
      return answer === OUTCOMES_ANSWER
        ? accepted({
            desired_outcomes: [
              "intended_transfer",
              "incapacity_readiness",
              "tax_minimization",
            ],
            top_three_priorities: [
              "intended_transfer",
              "incapacity_readiness",
              "tax_minimization",
            ],
            principal_definition_of_success:
              "Protect the family while keeping the plan practical and simple.",
          })
        : clarification(
            "Please identify the three most important results you want from your estate plan.",
          );
    case "MO01_PRIORITIES":
      return accepted({
        top_three_priorities: [
          "intended_transfer",
          "incapacity_readiness",
          "tax_minimization",
        ],
      });
    case "MO01_GOAL_FOLLOWUP": {
      const outcome = record.top_three_priorities.find(
        (priority) =>
          !record.priority_details.some((detail) => detail.outcome === priority),
      );
      return outcome
        ? accepted({ priority_detail: { outcome, detail: answer } })
        : clarification("Please describe what a good result would look like.");
    }
    case "MO02_PEOPLE":
      return accepted({
        people_and_interests_snapshot: answer,
        people_circumstance_flags: [],
      });
    case "MO02_CIRCUMSTANCES":
      return accepted({ people_circumstance_flags: [answer] });
    case "MO03_CURRENT_PLAN":
      return accepted({
        current_plan_status: "update_needed",
        current_plan_snapshot: answer,
      });
    case "MO03_PLAN_DETAILS":
      return accepted({ current_plan_snapshot: answer });
    case "MO03_CHANGES":
      return accepted({ changes_since_current_plan: [answer] });
    case "MO04_TIMING":
      return accepted({
        timing_reason: answer,
        timing_event: "none identified",
        timing_date: "none identified",
        timing_importance: "normal",
      });
    case "MO05_FOOTPRINT":
      return accepted({
        geographic_and_complexity_flags: [
          "Primary home in Florida",
          "Rental property in Georgia",
        ],
      });
    case "MO05_COMPLEXITY":
      return accepted({
        geographic_and_complexity_flags: ["Family business", "Digital assets"],
      });
    case "MO06_CONTACTS":
      return accepted({
        professional_and_family_contacts: [
          {
            name: "Jordan Lee",
            firm: "Harbor Counsel",
            expertise: "estate planning",
            estate_role: "planning counsel",
            email: "contact@harborcounsel.com",
            telephone: "555-555-1111",
            contact_trigger: "planning update",
            priority: "primary",
            missing_information: [],
          },
        ],
        missing_contacts: [],
        other_participants: [
          {
            name: "Spouse",
            relationship: "family",
            intended_role: "participate",
            involvement_timing: "initial planning and future reviews",
          },
        ],
      });
    case "MO08_HOUSE_IN_ORDER":
      return accepted({ house_in_order_concern: answer });
    default:
      return clarification("Please answer the active planning question.");
  }
}

export function interpretSyntheticCorrection(input: {
  correction: string;
  activeQuestion: string | null;
  record: MatterOpeningRecord;
}): PlanningSummaryCorrection {
  if (input.correction === "The rental property is in Alabama, not Georgia.") {
    return {
      outcome: "accepted",
      acknowledgement: "The Planning Summary now shows the rental property in Alabama.",
      clarification_question: null,
      patch: {
        ...emptyInterpretationPatch(),
        geographic_and_complexity_flags: [
          "Primary home in Florida",
          "Rental property in Alabama",
          "Family business",
          "Digital assets",
        ],
      },
    };
  }

  return {
    outcome: "clarification",
    acknowledgement: "",
    clarification_question:
      "What exact Planning Summary fact should change, and what should it say instead?",
    patch: emptyInterpretationPatch(),
  };
}
