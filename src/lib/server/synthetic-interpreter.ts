import "server-only";

import {
  BlueprintAnswerInterpretation,
  BlueprintState,
  EvidenceTreatment,
  RecommendationContent,
  RecommendationDomain,
  RecommendationResponse,
} from "@/lib/domain/blueprint";
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

export function interpretSyntheticBlueprintAnswer(input: {
  answer: string;
  state: BlueprintState;
}): BlueprintAnswerInterpretation {
  const emptyPatch = {
    planning_baseline: null,
    beneficiary_outcomes: null,
    fiduciary_continuity_outcomes: null,
  };
  if (input.answer === "I need a little help with that.") {
    return {
      outcome: "clarification",
      acknowledgement: "",
      clarification_question:
        "What part of this outcome is most important for your plan to preserve?",
      patch: emptyPatch,
    };
  }
  if (input.state.current_gate === 2) {
    return {
      outcome: "accepted",
      acknowledgement: "Thank you. The planning range is now clear enough to continue.",
      clarification_question: null,
      patch: {
        ...emptyPatch,
        planning_baseline: {
          material_assets_range: "$8 million to $10 million",
          liabilities_range: "$500,000 to $750,000",
          expected_inheritance_range: "none expected",
          lifetime_security_floor: "$5 million",
          assets_counted_toward_floor:
            "cash, marketable investments, and the primary residence",
          retained_control_requirement:
            "retain control of the primary residence and liquid investments",
          extraordinary_future_obligations:
            "education support for two grandchildren",
        },
      },
    };
  }
  if (input.state.current_gate === 4) {
    return {
      outcome: "accepted",
      acknowledgement: "Thank you. I have the beneficiary outcomes needed to recommend a starting point.",
      clarification_question: null,
      patch: {
        ...emptyPatch,
        beneficiary_outcomes: {
          intended_beneficiaries: "spouse and two adult children",
          substitute_beneficiaries: "descendants of a deceased child",
          relative_treatment: "equal treatment for the children",
          protection_needs:
            "creditor, marital-claim, and financial-immaturity protection",
          stewardship_objectives:
            "increasing participation as each beneficiary demonstrates readiness",
          special_treatment:
            "the family business should remain under coordinated management",
        },
      },
    };
  }
  return {
    outcome: "accepted",
    acknowledgement: "Thank you. The fiduciary and continuity outcomes are clear.",
    clarification_question: null,
    patch: {
      ...emptyPatch,
      fiduciary_continuity_outcomes: {
        trusted_people_or_institutions:
          "the spouse and Jordan Lee, with a professional fiduciary where independence is needed",
        backups: "an independent trust company",
        essential_responsibilities:
          "household support, investment oversight, and family-business management",
        special_assets_or_purposes:
          "the family business and digital assets need separate continuity instructions",
        beneficiary_readiness:
          "larger participation after financial education and demonstrated judgment",
      },
    },
  };
}

export function generateSyntheticRecommendation(input: {
  domain: RecommendationDomain;
}): RecommendationContent {
  if (input.domain === "beneficiary") {
    return {
      objective: "Protect beneficiaries while preserving useful access",
      starting_point:
        "We recommend a separate continuing trust for each child, with protected access for appropriate needs and increasing participation as each beneficiary is ready.",
      rationale:
        "This supports equal economic treatment while adding creditor, marital-claim, and financial-immaturity protection without forcing a full distribution at a fixed age.",
      alternative_or_tradeoff:
        "Outright distributions are simpler, but they give up the continuing protection and stewardship structure.",
      open_confirmation:
        "Estate-planning counsel should confirm the final distribution and appointment provisions.",
      response_question:
        "Does this recommended structure fit your objectives, or would it prevent a personal outcome you want?",
    };
  }
  return {
    objective: "Keep essential responsibilities and decision-making continuous",
    starting_point:
      "We recommend separating family judgment from independent administration: use trusted family participation for context, a professional or independent fiduciary where discretion or conflict protection matters, and named backups for every essential responsibility.",
    rationale:
      "This keeps household, investment, and family-business responsibilities moving while reducing dependence on one person and matching authority to readiness.",
    alternative_or_tradeoff:
      "An all-individual structure may feel more personal but can create capacity, succession, and independence risks.",
    open_confirmation:
      "Counsel should confirm appointments, powers, succession, and compensation; proposed fiduciaries should confirm willingness to serve.",
    response_question:
      "Does this starting structure fit the people you trust and the responsibilities that must continue?",
  };
}

export function interpretSyntheticRecommendationResponse(input: {
  answer: string;
  state: BlueprintState;
}): RecommendationResponse {
  if (input.answer === "Please explain the tradeoff.") {
    return {
      outcome: "clarification",
      acknowledgement: "",
      clarification_question:
        "Which outcome or tradeoff would you like the recommendation to handle differently?",
      disposition: null,
      modification: null,
      open_confirmation: null,
    };
  }
  const normalized = input.answer.toLowerCase();
  const disposition = normalized.includes("modify")
    ? "modify"
    : normalized.includes("alternative")
      ? "alternative_requested"
      : normalized.includes("defer")
        ? "defer"
        : normalized.includes("reject")
          ? "reject"
          : normalized.includes("confirm")
            ? "confirmation_required"
            : "accept";
  return {
    outcome: "accepted",
    acknowledgement: "Your response is saved.",
    clarification_question: null,
    disposition,
    modification: disposition === "modify" ? input.answer : null,
    open_confirmation:
      disposition === "confirmation_required" ? input.answer : null,
  };
}

export function interpretSyntheticEvidence(input: {
  filename: string;
  relevantText: string;
  planningQuestion: string;
}): EvidenceTreatment {
  void input.relevantText;
  void input.planningQuestion;
  return {
    working_scenario: `The relevant provisions in ${input.filename} support treating the external arrangement as a continuing third-party interest for Blueprint planning.`,
    contingency:
      "If funding or appointment provisions differ from the available evidence, the treatment may need to be revised.",
    confirmation_dependency:
      "Counsel should confirm funding, current governing terms, and any material tax allocation.",
  };
}
