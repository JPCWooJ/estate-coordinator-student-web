import { describe, expect, it } from "vitest";

import {
  createInitialRecord,
  createInitialWorkflowState,
  emptyInterpretationPatch,
  Interpretation,
  MatterOpeningRecord,
  OutcomeCodeSchema,
  OpeningStep,
  PlanningSummaryCorrection,
  WorkflowState,
} from "./matter-opening";
import { phaseProgress } from "./blueprint";
import { buildPrincipalPlanningSummary } from "./planning-summary";
import {
  applyAcceptedInterpretation,
  applyPlanningSummaryCorrection,
  confirmOpening,
  getCanonicalQuestion,
  getProgress,
  getWorkflowProgress,
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

describe("Matter Opening v0.4 workflow", () => {
  it("keeps user-facing progress continuous through Blueprint Decisions", () => {
    const progress = [
      getProgress("MO01_OUTCOMES"),
      getProgress("MO01_PRIORITIES"),
      getProgress("MO01_GOAL_FOLLOWUP"),
      getProgress("MO02_PEOPLE"),
      getProgress("MO02_CIRCUMSTANCES"),
      getProgress("MO03_CURRENT_PLAN"),
      getProgress("MO03_PLAN_DETAILS"),
      getProgress("MO03_CHANGES"),
      getProgress("MO04_TIMING"),
      getProgress("MO05_FOOTPRINT"),
      getProgress("MO05_COMPLEXITY"),
      getProgress("MO06_CONTACTS"),
      getProgress("MO08_HOUSE_IN_ORDER"),
      getProgress("MO08_CONFIRM"),
      getProgress("BLUEPRINT_READY"),
      phaseProgress("PLANNING_FOUNDATION"),
      phaseProgress("BLUEPRINT_DECISIONS"),
    ];

    expect(progress).toEqual([5, 10, 15, 20, 23, 27, 31, 35, 39, 42, 45, 47, 49, 50, 55, 55, 75]);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1]!)).toBe(
      true,
    );
  });

  it("preserves meaningful non-complete progress when Matter Opening stops", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state: WorkflowState = {
      step: "MO05_COMPLEXITY",
      clarification: null,
      stop: null,
    };
    const result = advance(record, state, {
      outcome: "stop",
      acknowledgement: "",
      clarification_question: null,
      patch: emptyInterpretationPatch(),
      stop: {
        category: "expedited_event",
        reason: "A death occurred yesterday.",
        immediate_action: "Contact the estate attorney before continuing planning.",
      },
    });

    expect(result.state.step).toBe("STOPPED");
    expect(result.state.progressBeforeStop).toBe(getProgress("MO05_COMPLEXITY"));
    expect(getWorkflowProgress(result.state)).toBe(getProgress("MO05_COMPLEXITY"));
    expect(getWorkflowProgress(result.state)).toBeLessThan(100);
    expect(
      getWorkflowProgress({
        step: "STOPPED",
        clarification: null,
        stop: result.state.stop,
      }),
    ).toBe(getProgress("MO01_OUTCOMES"));
  });

  it("uses the approved outcome taxonomy", () => {
    expect(OutcomeCodeSchema.options).toEqual([
      "intended_transfer",
      "tax_minimization",
      "asset_protection",
      "support_for_others",
      "distribution_control",
      "incapacity_readiness",
      "conflict_prevention",
      "heir_readiness",
      "plan_alignment",
      "house_in_order_assurance",
      "business_charitable_family_legacy",
      "other",
    ]);
  });

  it.each([
    [
      "MO01_OUTCOMES",
      "If this estate-planning process works exactly as you hope, what will it accomplish for you? Tell me what matters most, and if you can, put your top three priorities in order.",
    ],
    [
      "MO01_PRIORITIES",
      "Of those outcomes, which three matter most to you, in priority order?",
    ],
    [
      "MO02_PEOPLE",
      "At a high level, who do you expect should benefit from or be protected by your estate plan?",
    ],
    [
      "MO02_CIRCUMSTANCES",
      "Are there any circumstances involving these people that the planning process must understand?",
    ],
    [
      "MO03_CURRENT_PLAN",
      "Do you already have estate-planning documents or arrangements in place?",
    ],
    [
      "MO03_PLAN_DETAILS",
      "What documents or arrangements do you know exist, and approximately when were they completed?",
    ],
    [
      "MO03_CHANGES",
      "What important changes have occurred since they were completed?",
    ],
    [
      "MO04_TIMING",
      "Why are you addressing this now, and is there an event or deadline affecting the timing?",
    ],
    [
      "MO05_FOOTPRINT",
      "Where is your primary home, and do you have important property, businesses, trusts, citizenship, residence, or other connections in another state or country?",
    ],
    [
      "MO05_COMPLEXITY",
      "Are there any trusts, businesses, foreign connections, digital assets, major charitable plans, or other complexities you already know should be considered?",
    ],
    [
      "MO06_CONTACTS",
      "Who should be involved or available to help with your estate plan now or in the future? This might include attorneys, tax or financial professionals, assistants, trusted family members, or anyone else who should know what to do.",
    ],
    [
      "MO08_HOUSE_IN_ORDER",
      "What would you need to see, understand, or have confirmed to feel confident that your estate plan is complete, current, and working the way you intend?",
    ],
    [
      "MO08_CONFIRM",
      "Does this accurately capture what you want your estate-planning process to accomplish and what matters most to you?",
    ],
  ] as const)("keeps the %s question aligned to canon", (step, question) => {
    expect(
      getCanonicalQuestion(confirmationReadyRecord(), {
        step,
        clarification: null,
        stop: null,
      }),
    ).toBe(question);
  });

  it("derives priority follow-ups from the record without queue state", () => {
    let record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    let state: WorkflowState = {
      step: "MO01_OUTCOMES",
      clarification: null,
      stop: null,
    };
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
    const expectedQuestions = [
      "Who or what do you most want to benefit, and what transfer outcome do you most want to prevent?",
      "If you could not manage your affairs, what must continue without disruption?",
      "If tax minimization requires tradeoffs, how would you balance it against simplicity, flexibility, access, and control?",
    ];
    for (const [index, outcome] of record.top_three_priorities.entries()) {
      expect(getCanonicalQuestion(record, state)).toBe(expectedQuestions[index]);
      ({ record, state } = advance(
        record,
        state,
        accepted({ priority_detail: { outcome, detail: `Detail for ${outcome}.` } }),
      ));
    }
    expect(state.step).toBe("MO02_PEOPLE");
    expect(record.priority_details).toHaveLength(3);
  });

  it("asks MO-02 circumstances only when the circumstance state remains unresolved", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state: WorkflowState = {
      step: "MO02_PEOPLE",
      clarification: null,
      stop: null,
    };

    const previouslyCaptured = advance(
      {
        ...record,
        people_circumstance_flags: ["blended family"],
      },
      state,
      accepted({
        people_and_interests_snapshot: "A spouse and children from prior relationships.",
      }),
    );
    expect(previouslyCaptured.state.step).toBe("MO03_CURRENT_PLAN");

    const captured = advance(
      record,
      state,
      accepted({
        people_and_interests_snapshot: "A spouse and a child with special needs.",
        people_circumstance_flags: ["special needs"],
      }),
    );
    expect(captured.state.step).toBe("MO03_CURRENT_PLAN");

    const explicitlyNone = advance(
      record,
      state,
      accepted({
        people_and_interests_snapshot: "A spouse and two adult children.",
        people_circumstance_flags: [],
      }),
    );
    expect(explicitlyNone.state.step).toBe("MO03_CURRENT_PLAN");

    const unresolved = advance(
      record,
      state,
      accepted({
        people_and_interests_snapshot: "A spouse and two children.",
      }),
    );
    expect(unresolved.state.step).toBe("MO02_CIRCUMSTANCES");
  });

  it("persists clarification as the active question without advancing or mutating the record", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state: WorkflowState = {
      step: "MO01_OUTCOMES",
      clarification: null,
      stop: null,
    };
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

  it.each([
    ["no_existing_plan", "NEW_PLAN"],
    ["unsure_what_exists", "PLAN_REVIEW"],
    ["review_requested", "PLAN_REVIEW"],
    ["current", "PLAN_REVIEW"],
    ["update_needed", "PLAN_UPDATE"],
    ["implementation_or_organization_needed", "IMPLEMENTATION_ORGANIZATION"],
    ["unknown", "PLAN_REVIEW"],
  ] as const)("classifies %s with the approved provisional value", (status, classification) => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state = {
      ...createInitialWorkflowState(),
      step: "MO03_CURRENT_PLAN" as OpeningStep,
    };
    const result = advance(
      record,
      state,
      accepted({
        current_plan_status: status,
        current_plan_snapshot: "A living trust and will from 2018.",
      }),
    );
    expect(result.record.matter_classification).toBe(classification);
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

  it("applies a supported priority-context correction to the Planning Summary", () => {
    const record = confirmationReadyRecord();
    const result = applyPlanningSummaryCorrection(
      record,
      { step: "MO08_CONFIRM", clarification: null, stop: null },
      {
        outcome: "accepted",
        acknowledgement: "Updated.",
        clarification_question: null,
        patch: {
          ...emptyInterpretationPatch(),
          priority_detail: {
            outcome: "intended_transfer",
            detail: "Transfer equally to the adult children.",
          },
        },
      },
    );

    expect(
      buildPrincipalPlanningSummary(result.record).priorityContext,
    ).toContainEqual({
      outcome: "Intended transfer",
      detail: "Transfer equally to the adult children.",
    });
  });

  it("requires canonical context for a changed top priority before confirmation", () => {
    const state: WorkflowState = {
      step: "MO08_CONFIRM",
      clarification: null,
      stop: null,
    };
    const changed = applyPlanningSummaryCorrection(
      confirmationReadyRecord(),
      state,
      {
        outcome: "accepted",
        acknowledgement: "Priorities updated.",
        clarification_question: null,
        patch: {
          ...emptyInterpretationPatch(),
          top_three_priorities: [
            "intended_transfer",
            "incapacity_readiness",
            "asset_protection",
          ],
        },
      },
    );

    expect(changed.record.priority_details).not.toContainEqual(
      expect.objectContaining({ outcome: "tax_minimization" }),
    );
    expect(changed.state.clarification?.question).toBe(
      "Which risks concern you most - creditors, divorce, litigation, financial immaturity, outside influence, or something else?",
    );
    expect(() => confirmOpening(changed.record, changed.state)).toThrow(
      "The Planning Summary confirmation gate is not complete.",
    );

    const completed = applyPlanningSummaryCorrection(
      changed.record,
      changed.state,
      {
        outcome: "accepted",
        acknowledgement: "Priority context updated.",
        clarification_question: null,
        patch: {
          ...emptyInterpretationPatch(),
          priority_detail: {
            outcome: "asset_protection",
            detail: "Protection from creditor and litigation risk.",
          },
        },
      },
    );

    expect(completed.state.clarification).toBeNull();
    expect(
      buildPrincipalPlanningSummary(completed.record).priorityContext,
    ).toContainEqual({
      outcome: "Asset protection",
      detail: "Protection from creditor and litigation risk.",
    });
    expect(confirmOpening(completed.record, completed.state).state.step).toBe(
      "BLUEPRINT_READY",
    );
  });

  it("builds the complete principal-facing summary without internal fields", () => {
    const record = confirmationReadyRecord();
    const summary = buildPrincipalPlanningSummary(record);
    const serialized = JSON.stringify(summary);

    expect(summary.currentPlanSnapshot).toContain("2018");
    expect(summary.peopleFlags).toEqual([]);
    expect(summary.knownChanges).toContain("Moved primary residence to Florida.");
    expect(summary.complexityFlags).toContain("Georgia rental");
    expect(summary.contacts[0]?.name).toBe("Jordan Lee");
    expect(summary.participants).toContain("Spouse");
    expect(summary.topPriorities).toEqual([
      "Intended transfer",
      "Incapacity readiness",
      "Tax minimization",
    ]);
    expect(summary.topPriorities.every((priority) => !/^\d+\./.test(priority))).toBe(
      true,
    );
    expect(summary.recommendedNextStep).toContain("Estate Blueprint");
    expect(summary.recommendedNextStep).not.toMatch(/Stage\s+[1-7]/i);
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

  it.each(["unknown", "not decided", "not applicable"])(
    "allows the permitted '%s' response through confirmation",
    (permittedAnswer) => {
      const record: MatterOpeningRecord = {
        ...confirmationReadyRecord(),
        matter_classification: "PLAN_REVIEW",
        principal_definition_of_success: permittedAnswer,
        people_and_interests_snapshot: permittedAnswer,
        current_plan_status: "unknown",
        current_plan_snapshot: permittedAnswer,
        timing_event_or_deadline: {
          reason: permittedAnswer,
          event: permittedAnswer,
          date: permittedAnswer,
          importance: permittedAnswer,
        },
      };
      const result = confirmOpening(
        record,
        { step: "MO08_CONFIRM", clarification: null, stop: null },
        "2026-08-19T12:00:00.000Z",
      );
      expect(result.state.step).toBe("BLUEPRINT_READY");
    },
  );
});
