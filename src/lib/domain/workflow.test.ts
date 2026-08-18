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
  it("asks follow-ups only for the three ranked outcomes and ignores model stage proposals", () => {
    const matterId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    let record = createInitialRecord(matterId);
    let state = createInitialWorkflowState();

    let result = advance(
      record,
      state,
      interpretation(
        "CONFIRMED",
        {
          desired_outcomes: [
            "intended_transfer",
            "incapacity_readiness",
            "tax_minimization",
            "legacy",
          ],
          principal_definition_of_success: "Protect the family and keep the plan simple.",
        },
      ),
    );
    expect(result.state.step).toBe("MO01_PRIORITIES");
    ({ record, state } = result);

    result = advance(
      record,
      state,
      interpretation("MO01_PRIORITIES", {
        top_three_priorities: [
          "intended_transfer",
          "incapacity_readiness",
          "tax_minimization",
        ],
      }),
    );
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

  it("runs only the triggered people and contact follow-up branches", () => {
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
      interpretation("MO06_CONTACTS", {
        professional_and_family_contacts: [
          {
            name: "Synthetic Attorney",
            firm: "Example Firm",
            expertise: "estate planning",
            estate_role: "planning counsel",
            email: "unknown",
            telephone: "unknown",
            contact_trigger: "planning update",
            priority: "primary",
            missing_information: ["email", "telephone"],
          },
        ],
      }),
    );
    expect(contact.state.step).toBe("MO06_CONTACTS_MORE");
    expect(contact.record.professional_and_family_contacts).toHaveLength(1);

    const contactComplete = advance(
      contact.record,
      contact.state,
      interpretation(
        "MO06_CONTACTS_MORE",
        { missing_contacts: ["CONTACT_NEEDED"] },
        { contacts_complete: true },
      ),
    );
    expect(contactComplete.state.step).toBe("MO07_PARTICIPANTS");
    expect(contactComplete.record.missing_contacts).toEqual(["CONTACT_NEEDED"]);
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
      "The Matter Opening exit gate is not complete.",
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
      "Begin the first selected discovery module using only the confirmed Matter Opening information.",
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
});
