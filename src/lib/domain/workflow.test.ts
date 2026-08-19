import { describe, expect, it } from "vitest";

import {
  createInitialRecord,
  createInitialWorkflowState,
  Interpretation,
  MatterOpeningRecord,
  OpeningStep,
  OutcomeCode,
  WorkflowState,
} from "./matter-opening";
import {
  applyAcceptedInterpretation,
  confirmOpening,
  prepareMatterOpeningForConfirmation,
} from "./workflow";
import { buildPlanningSummaryPdf } from "../server/planning-summary-pdf";
import { buildPrincipalPlanningSummary } from "./planning-summary";

function interpretation(
  step: OpeningStep,
  patch: Partial<Interpretation["patch"]> = {},
  signals: Partial<Interpretation["signals"]> = {},
): Interpretation {
  return {
    accepted: true,
    acknowledgement: "Saved.",
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
      ...patch,
    },
    signals: {
      people_followup_required: false,
      current_plan_exists: false,
      contacts_complete: false,
      ...signals,
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

function advance(
  record: MatterOpeningRecord,
  state: WorkflowState,
  nextInterpretation: Interpretation,
) {
  return applyAcceptedInterpretation(record, state, nextInterpretation);
}

describe("Matter Opening deterministic workflow", () => {
  it("accepts priorities in outcomes step and asks follow-ups only for the ranked three", () => {
    const matterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    let record = createInitialRecord(matterId);
    let state = createInitialWorkflowState();

    let result = advance(
      record,
      state,
      interpretation(
        "MO01_OUTCOMES",
        {
          desired_outcomes: [
            "intended_transfer",
            "incapacity_readiness",
            "tax_minimization",
            "legacy",
          ],
          top_three_priorities: [
            "intended_transfer",
            "incapacity_readiness",
            "tax_minimization",
          ],
          principal_definition_of_success: "Protect the family and keep the plan simple.",
        },
      ),
    );
    expect(result.state.step).toBe("MO01_GOAL_FOLLOWUP");
    expect(result.record.top_three_priorities).toEqual([
      "intended_transfer",
      "incapacity_readiness",
      "tax_minimization",
    ]);
    expect(result.state.active_goal_followup).toBe("intended_transfer");
    ({ record, state } = result);

    for (const outcome of [
      "intended_transfer",
      "incapacity_readiness",
      "tax_minimization",
    ] as OutcomeCode[]) {
      result = advance(
        record,
        state,
        interpretation("MO01_GOAL_FOLLOWUP", {
          priority_detail: { outcome, detail: `Synthetic detail for ${outcome}` },
        }),
      );
      ({ record, state } = result);
    }

    expect(state.step).toBe("MO02_PEOPLE");
    expect(record.priority_details.map((item) => item.outcome)).toEqual([
      "intended_transfer",
      "incapacity_readiness",
      "tax_minimization",
    ]);
    expect(record.priority_details.some((item) => item.outcome === "legacy")).toBe(false);
  });

  it("uses the approved conditional current-plan branches", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state = { ...createInitialWorkflowState(), step: "MO03_CURRENT_PLAN" as const };

    const noPlan = advance(
      record,
      state,
      interpretation(
        "MO03_CURRENT_PLAN",
        {
          current_plan_status: "no_existing_plan",
          current_plan_snapshot: "No existing plan.",
        },
        { current_plan_exists: false },
      ),
    );
    expect(noPlan.state.step).toBe("MO04_TIMING");
    expect(noPlan.record.matter_classification).toBe("NEW_PLAN");

    const existingPlan = advance(
      record,
      state,
      interpretation(
        "MO03_CURRENT_PLAN",
        {
          current_plan_status: "update_needed",
          current_plan_snapshot: "A will and trust need updating.",
        },
        { current_plan_exists: true },
      ),
    );
    expect(existingPlan.state.step).toBe("MO03_PLAN_DETAILS");
    expect(existingPlan.record.matter_classification).toBe("PLAN_UPDATE");

    const planDetails = advance(
      existingPlan.record,
      existingPlan.state,
      interpretation("MO03_PLAN_DETAILS", {
        current_plan_snapshot: "Synthetic will and trust completed in 2020.",
      }, { current_plan_exists: true }),
    );
    expect(planDetails.state.step).toBe("MO03_CHANGES");

    const changes = advance(
      planDetails.record,
      planDetails.state,
      interpretation("MO03_CHANGES", {
        changes_since_current_plan: ["Synthetic relocation"],
      }, { current_plan_exists: true }),
    );
    expect(changes.state.step).toBe("MO04_TIMING");
  });

  it("runs the people and contact branches with single-step contacts", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const peopleState = {
      ...createInitialWorkflowState(),
      step: "MO02_PEOPLE" as const,
    };
    const people = advance(
      record,
      peopleState,
      interpretation(
        "MO02_PEOPLE",
        {
          people_and_interests_snapshot: "A synthetic minor beneficiary.",
          people_circumstance_flags: ["minor"],
        },
        { people_followup_required: true },
      ),
    );
    expect(people.state.step).toBe("MO02_CIRCUMSTANCES");

    const circumstances = advance(
      people.record,
      people.state,
      interpretation("MO02_CIRCUMSTANCES", {
        people_circumstance_flags: ["continuing management needed"],
      }),
    );
    expect(circumstances.state.step).toBe("MO03_CURRENT_PLAN");

    const contactState = {
      ...createInitialWorkflowState(),
      step: "MO06_CONTACTS" as const,
    };
    const contact = advance(
      record,
      contactState,
      interpretation(
        "MO06_CONTACTS",
        {
          professional_and_family_contacts: [
            {
              name: "Synthetic Attorney",
              firm: "Example Firm",
              expertise: "estate planning",
              estate_role: "planning counsel",
              email: "attorney@example.com",
              telephone: "555-555-1212",
              contact_trigger: "planning update",
              priority: "primary",
              missing_information: [],
            },
          ],
        },
        { contacts_complete: true },
      ),
    );
    expect(contact.state.step).toBe("MO08_HOUSE_IN_ORDER");
    expect(contact.record.professional_and_family_contacts).toHaveLength(1);
  });

  it("stops the affected lane for an expedited or mandatory-stop event", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state = { ...createInitialWorkflowState(), step: "MO04_TIMING" as const };
    const candidate = interpretation("MO04_TIMING", {
      timing_reason: "A death occurred yesterday.",
      timing_event: "death",
      timing_importance: "critical",
    });
    candidate.stop = {
      triggered: true,
      category: "expedited_event",
      reason: "A death occurred yesterday.",
      immediate_action: "Contact the estate attorney.",
    };

    const result = advance(record, state, candidate);
    expect(result.state.step).toBe("STOPPED");
    expect(result.record.matter_status).toBe("EXPEDITED_EVENT");
    expect(result.state.stop?.immediate_action).toBe("Contact the estate attorney.");
  });

  it("derives the discovery recommendation before review and passes the unchanged exit gate", () => {
    const base = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const record: MatterOpeningRecord = {
      ...base,
      desired_outcomes: ["intended_transfer"],
      top_three_priorities: [
        "incapacity_readiness",
        "intended_transfer",
        "tax_minimization",
      ],
      principal_definition_of_success: "A coordinated synthetic plan.",
      current_plan_snapshot: "No existing plan.",
    };
    const confirmState = {
      ...createInitialWorkflowState(),
      step: "MO08_CONFIRM" as const,
    };
    expect(() => confirmOpening(record, confirmState)).toThrow(
      "The planning summary exit gate is not complete.",
    );

    const recovered = prepareMatterOpeningForConfirmation(record);
    expect(recovered.selected_discovery_path).toBe("incapacity and continuity");
    expect(confirmOpening(recovered, confirmState).state.step).toBe("CONFIRMED");

    const prepared = advance(
      record,
      { ...createInitialWorkflowState(), step: "MO08_HOUSE_IN_ORDER" as const },
      interpretation("MO08_HOUSE_IN_ORDER", {
        house_in_order_concern: "none identified",
      }),
    );
    expect(prepared.state.step).toBe("MO08_CONFIRM");
    expect(prepared.record.selected_discovery_path).toBe(
      "incapacity and continuity",
    );
    expect(prepared.record.single_next_action).toBe(
      "Open Your Estate Blueprint and move into planning recommendations and profile review.",
    );

    const result = confirmOpening(
      prepared.record,
      prepared.state,
      "2026-08-17T20:00:00.000Z",
    );

    expect(result.state.step).toBe("CONFIRMED");
    expect(result.record.principal_confirmed).toBe("yes");
    expect(result.record.confirmation_date).toBe("2026-08-17T20:00:00.000Z");
  });

  it("creates a planning summary PDF for confirmed Matter Opening records", () => {
    const record = prepareMatterOpeningForConfirmation({
      ...createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      desired_outcomes: ["intended_transfer", "tax_minimization", "incapacity_readiness"],
      top_three_priorities: [
        "intended_transfer",
        "incapacity_readiness",
        "tax_minimization",
      ],
      principal_definition_of_success: "Protect the family and keep outcomes practical.",
      people_and_interests_snapshot: "Spouse and adult children.",
      current_plan_snapshot: "No existing plan.",
      changes_since_current_plan: ["none"],
      timing_event_or_deadline: {
        reason: "Estate planning is overdue.",
        event: "none identified",
        date: "2026-12-01",
        importance: "high",
      },
      selected_discovery_path: "implementation and plan-alignment verification",
      single_next_action:
        "Open Your Estate Blueprint and move into planning recommendations and profile review.",
      house_in_order_concern:
        "Need to verify whether my current documents still match my assets and priorities.",
      geographic_and_complexity_flags: [
        "Florida property",
        ...Array.from({ length: 120 }, (_, index) => `Complexity note ${index + 1}`),
      ],
      professional_and_family_contacts: [
        {
          name: "Jordan Lee",
          firm: "Harbor Counsel",
          expertise: "Estate planning",
          estate_role: "Planning counsel",
          email: "jordan@harborcounsel.com",
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
    });

    const pdf = buildPlanningSummaryPdf(record);
    const text = pdf.toString("utf8");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(text).toContain("Estate Planning Summary");
    expect(text).toContain("/Type /Pages");
    expect(text).toContain("/Count");
    expect(text).toContain("People who should help");
    expect(text).not.toContain("implementation and plan-alignment verification");
    expect(text).not.toContain(
      "Open Your Estate Blueprint and move into planning recommendations and profile review.",
    );
    expect(text).not.toContain("house in order");
    expect(text).toContain("%%EOF");
    const pagesMatch = text.match(/\/Count (\d+)/);
    expect(pagesMatch).not.toBeNull();
    if (!pagesMatch) return;
    expect(Number.parseInt(pagesMatch[1], 10)).toBeGreaterThanOrEqual(2);
  });

  it("uses the shared principal-facing Planning Summary projection in the PDF output", () => {
    const record = prepareMatterOpeningForConfirmation({
      ...createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      desired_outcomes: [
        "intended_transfer",
        "tax_minimization",
        "incapacity_readiness",
      ],
      top_three_priorities: [
        "intended_transfer",
        "incapacity_readiness",
        "tax_minimization",
      ],
      principal_definition_of_success:
        "Protect the family and maintain flexibility.",
      people_and_interests_snapshot: "Spouse and adult children.",
      current_plan_snapshot: "Living trust and will drafted in 2022.",
      current_plan_status: "update_needed",
      changes_since_current_plan: [
        "Renovated estate plan documents in 2022",
      ],
      timing_event_or_deadline: {
        reason: "Family needs coordination after a move.",
        event: "Potential relocation discussion.",
        date: "2026-12-01",
        importance: "medium",
      },
      selected_discovery_path: "implementation and plan-alignment verification",
      single_next_action:
        "Open the Estate Blueprint and make a practical first edit pass.",
      house_in_order_concern: "Needs confirmation of beneficiary details.",
      geographic_and_complexity_flags: ["Florida property", "Digital assets"],
      professional_and_family_contacts: [
        {
          name: "Jordan Lee",
          firm: "Harbor Counsel",
          expertise: "Estate planning",
          estate_role: "Planning counsel",
          email: "jordan@harborcounsel.com",
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
    });
    const summary = buildPrincipalPlanningSummary(record);
    const pdf = buildPlanningSummaryPdf(record).toString("utf8");

    for (const item of summary.desiredOutcomes) {
      expect(pdf).toContain(item);
    }
    expect(pdf).toContain(summary.successDefinition);
    expect(pdf).toContain(summary.currentPlanStatus);
    expect(pdf).toContain(summary.currentPlanSnapshot);
    for (const change of summary.knownChanges) {
      expect(pdf).toContain(change);
    }
    expect(pdf).toContain(summary.timing.reason);
    expect(pdf).toContain("After confirming this summary");
    expect(pdf).toContain("build recommendations.");
    expect(pdf).not.toContain("house in order");
    expect(pdf).not.toContain(record.house_in_order_concern);
    expect(pdf).not.toContain(record.selected_discovery_path);
    expect(pdf).not.toContain(record.single_next_action);
  });

  it("returns clarification as the next question without advancing", () => {
    const record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const state = { ...createInitialWorkflowState(), step: "MO01_PRIORITIES" as const };
    const clarification = interpretation("MO01_PRIORITIES");
    clarification.accepted = false;
    clarification.needs_clarification = true;
    clarification.clarification_question = "Please identify all three priorities.";
    const result = advance(record, state, clarification);
    expect(result.state.step).toBe("MO01_PRIORITIES");
    expect(result.record).toBe(record);
    expect(result.assistantMessage).toContain("Please identify all three priorities.");

    const followUp = interpretation("MO01_PRIORITIES", {
      top_three_priorities: [
        "intended_transfer",
        "incapacity_readiness",
        "tax_minimization",
      ],
    });
    const recovered = advance(record, result.state, followUp);
    expect(recovered.state.step).toBe("MO01_GOAL_FOLLOWUP");
    expect(recovered.record.top_three_priorities).toEqual([
      "intended_transfer",
      "incapacity_readiness",
      "tax_minimization",
    ]);
  });
});

