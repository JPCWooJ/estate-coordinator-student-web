import { describe, expect, it } from "vitest";

import {
  createInitialRecord,
  createInitialWorkflowState,
  emptyInterpretationPatch,
  Interpretation,
  MatterOpeningRecord,
  OpeningStep,
  PlanningSummaryCorrection,
  WorkflowState,
} from "./matter-opening";
import { buildPrincipalPlanningSummary } from "./planning-summary";
import {
  applyAcceptedInterpretation,
  applyPlanningSummaryCorrection,
  confirmOpening,
  getCanonicalQuestion,
} from "./workflow";

function accepted(
  patch: Partial<Interpretation["patch"]> = {},
): Interpretation {
  return {
    outcome: "accepted",
    acknowledgement: "Saved.",
    clarification_question: null,
    patch: { ...emptyInterpretationPatch(), ...patch },
    stop: null,
  };
}

function advance(
  record: MatterOpeningRecord,
  state: WorkflowState,
  interpretation: Interpretation,
) {
  return applyAcceptedInterpretation(record, state, interpretation);
}

function confirmationReadyRecord(): MatterOpeningRecord {
  return {
    ...createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
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
    principal_definition_of_success: "Protect the family and keep the plan simple.",
    priority_details: [
      { outcome: "intended_transfer", detail: "Transfer to adult children." },
      { outcome: "incapacity_readiness", detail: "Maintain family continuity." },
      { outcome: "tax_minimization", detail: "Avoid unnecessary complexity." },
    ],
    people_and_interests_snapshot: "Spouse and adult children.",
    current_plan_status: "update_needed",
    current_plan_snapshot: "Living trust and will completed in 2018.",
    changes_since_current_plan: ["Moved primary residence to Florida."],
    timing_event_or_deadline: {
      reason: "The plan is overdue for review.",
      event: "none identified",
      date: "none identified",
      importance: "normal",
    },
    geographic_and_complexity_flags: ["Florida home", "Georgia rental"],
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
    other_participants: [
      {
        name: "Spouse",
        relationship: "family",
        intended_role: "participate",
        involvement_timing: "initial planning",
      },
    ],
  };
}

describe("Matter Opening v0.3 workflow", () => {
  it("derives priority follow-ups from the record without queue state", () => {
    let record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    let state = createInitialWorkflowState();
    ({ record, state } = advance(
      record,
      state,
      accepted({
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
        principal_definition_of_success: "A practical family plan.",
      }),
    ));

    expect(state).toEqual({
      step: "MO01_GOAL_FOLLOWUP",
      clarification: null,
      stop: null,
    });
    expect(getCanonicalQuestion(record, state)).toContain("intended transfer");

    for (const outcome of record.top_three_priorities) {
      ({ record, state } = advance(
        record,
        state,
        accepted({ priority_detail: { outcome, detail: `Detail for ${outcome}.` } }),
      ));
    }
    expect(state.step).toBe("MO02_PEOPLE");
    expect(record.priority_details).toHaveLength(3);
  });

  it("persists clarification as the active question without advancing or mutating the record", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state = createInitialWorkflowState();
    const result = advance(record, state, {
      outcome: "clarification",
      acknowledgement: "",
      clarification_question: "Which three results matter most?",
      patch: emptyInterpretationPatch(),
      stop: null,
    });

    expect(result.record).toBe(record);
    expect(result.state.step).toBe("MO01_OUTCOMES");
    expect(result.state.clarification?.question).toBe(
      "Which three results matter most?",
    );
    expect(getCanonicalQuestion(result.record, result.state)).toBe(
      "Which three results matter most?",
    );

    const recovered = advance(
      result.record,
      result.state,
      accepted({
        desired_outcomes: ["intended_transfer"],
        top_three_priorities: [
          "intended_transfer",
          "incapacity_readiness",
          "tax_minimization",
        ],
        principal_definition_of_success: "A practical plan.",
      }),
    );
    expect(recovered.state.step).toBe("MO01_GOAL_FOLLOWUP");
    expect(recovered.state.clarification).toBeNull();
  });

  it("uses current-plan status to own deterministic branch progression", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state = {
      ...createInitialWorkflowState(),
      step: "MO03_CURRENT_PLAN" as OpeningStep,
    };
    const result = advance(
      record,
      state,
      accepted({
        current_plan_status: "update_needed",
        current_plan_snapshot: "A living trust and will from 2018.",
      }),
    );
    expect(result.state.step).toBe("MO03_PLAN_DETAILS");
    expect(result.record.matter_classification).toBe("PLAN_UPDATE");
  });

  it("applies one constrained Planning Summary correction and clears clarification", () => {
    const record = confirmationReadyRecord();
    const state: WorkflowState = {
      step: "MO08_CONFIRM",
      clarification: { question: "Which property location should change?" },
      stop: null,
    };
    const correction: PlanningSummaryCorrection = {
      outcome: "accepted",
      acknowledgement: "Updated.",
      clarification_question: null,
      patch: {
        ...emptyInterpretationPatch(),
        geographic_and_complexity_flags: ["Florida home", "Alabama rental"],
      },
    };
    const result = applyPlanningSummaryCorrection(record, state, correction);
    expect(result.changed).toBe(true);
    expect(result.state.clarification).toBeNull();
    expect(result.record.geographic_and_complexity_flags).toEqual([
      "Florida home",
      "Alabama rental",
    ]);
    expect(result.record.current_plan_snapshot).toBe(record.current_plan_snapshot);
  });

  it("builds the complete principal-facing summary without internal fields", () => {
    const record = confirmationReadyRecord();
    const summary = buildPrincipalPlanningSummary(record);
    const serialized = JSON.stringify(summary);

    expect(summary.currentPlanSnapshot).toContain("2018");
    expect(summary.knownChanges).toContain("Moved primary residence to Florida.");
    expect(summary.complexityFlags).toContain("Georgia rental");
    expect(summary.contacts[0]?.name).toBe("Jordan Lee");
    expect(summary.participants).toContain("Spouse");
    expect(summary.recommendedNextStep).toContain("Estate Blueprint");
    expect(serialized).not.toContain("PLAN_UPDATE");
    expect(serialized).not.toContain("house_in_order");
    expect(serialized).not.toContain(record.house_in_order_concern);
  });

  it("confirms the baseline directly into BLUEPRINT_READY", () => {
    const result = confirmOpening(confirmationReadyRecord(), {
      step: "MO08_CONFIRM",
      clarification: null,
      stop: null,
    }, "2026-08-19T12:00:00.000Z");

    expect(result.state.step).toBe("BLUEPRINT_READY");
    expect(result.record.matter_status).toBe("BLUEPRINT_READY");
    expect(result.record.principal_confirmed).toBe("yes");
    expect(result.record.confirmation_date).toBe("2026-08-19T12:00:00.000Z");
  });
});
