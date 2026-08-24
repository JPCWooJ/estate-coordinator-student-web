import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StructuredIntakeSubmission } from "@/lib/domain/intake";
import {
  acknowledgeBeta,
  confirmMatterOpening,
  createMatter,
  resetSyntheticStoreForTests,
  startBlueprint,
  submitBlueprintDecisions,
  submitStructuredIntake,
} from "./data";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ syntheticModeEnabled: () => true }));

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

function submissions(): StructuredIntakeSubmission[] {
  return [
    {
      operationId: randomUUID(),
      section: "goals_family",
      values: {
        desiredOutcomes: ["intended_transfer", "asset_protection", "incapacity_readiness"],
        topPriorities: ["intended_transfer", "asset_protection", "incapacity_readiness"],
        successDefinition: "Protect my spouse and benefit our children fairly.",
        beneficiaries: [
          {
            nameOrGroup: "Spouse",
            relationship: "spouse",
            role: "primary",
            treatment: "lifetime security first",
            protectionNeeds: ["creditor protection"],
            readinessNotes: "ready to participate",
          },
          {
            nameOrGroup: "Children",
            relationship: "children",
            role: "substitute",
            treatment: "equal treatment",
            protectionNeeds: ["marital-claim protection"],
            readinessNotes: "increasing participation with readiness",
          },
        ],
        materialCircumstances: "No current family conflict.",
      },
    },
    {
      operationId: randomUUID(),
      section: "planning_context",
      values: {
        currentPlanStatus: "update_needed",
        documentTypes: ["will", "revocable trust", "powers of attorney"],
        approximatePlanDate: "2018",
        materialChanges: ["Moved to Florida"],
        planningReason: "Routine update after relocation",
        deadline: "none",
        primaryResidence: "Florida",
        otherJurisdictions: ["Georgia rental property"],
        complexityFlags: ["real estate"],
        complexityDetails: "No foreign connections or controlling outside agreements.",
      },
    },
    {
      operationId: randomUUID(),
      section: "team_continuity",
      values: {
        contacts: [
          {
            name: "Jordan Lee",
            firmOrRelationship: "Harbor Counsel",
            role: "estate attorney",
            email: "jordan@example.com",
            phone: "555-0100",
            primaryOrBackup: "adviser",
            responsibilities: "document review and implementation",
          },
          {
            name: "Alex Morgan",
            firmOrRelationship: "trusted family member",
            role: "backup decision-maker",
            email: "alex@example.com",
            phone: "555-0101",
            primaryOrBackup: "backup",
            responsibilities: "continuity if the spouse cannot serve",
          },
        ],
        missingProfessionalRoles: ["CPA needed"],
        continuityResponsibilities: ["household support", "investment oversight"],
        specialAssetsOrPurposes: ["Georgia rental property"],
        readinessPlan: "Annual family meeting and increasing participation.",
      },
    },
    {
      operationId: randomUUID(),
      section: "financial_range",
      values: {
        materialAssetsRange: "$8 million to $10 million",
        liabilitiesRange: "$500,000 to $750,000",
        expectedInheritanceRange: "none expected",
        lifetimeSecurityFloor: "$5 million",
        assetsCountedTowardFloor: "liquid investments and primary residence",
        retainedControlRequirement: "retain the home and liquid investments",
        extraordinaryFutureObligations: "education support for grandchildren",
      },
    },
  ];
}

async function reachDecisions() {
  await acknowledgeBeta(OWNER_ID);
  const matterId = await createMatter(OWNER_ID);
  let visibleStates = 1; // merged welcome/orientation
  let matter = null;
  for (const submission of submissions()) {
    const result = await submitStructuredIntake({
      userId: OWNER_ID,
      matterId,
      submission,
    });
    matter = result.matter;
    visibleStates += 1;
  }
  expect(matter?.workflowState.step).toBe("MO08_CONFIRM");
  visibleStates += 1; // Planning Summary
  await confirmMatterOpening({ userId: OWNER_ID, matterId });
  matter = await startBlueprint({ userId: OWNER_ID, matterId });
  visibleStates += 1; // consolidated Blueprint decisions
  return { matterId, matter, visibleStates };
}

describe("MVP rescue normal path", () => {
  beforeEach(() => resetSyntheticStoreForTests());

  it("carries prior answers into one decision surface with no planning-range loop", async () => {
    const { matter } = await reachDecisions();

    expect(matter.blueprintState?.planning_baseline).toEqual({
      material_assets_range: "$8 million to $10 million",
      liabilities_range: "$500,000 to $750,000",
      expected_inheritance_range: "none expected",
      lifetime_security_floor: "$5 million",
      assets_counted_toward_floor: "liquid investments and primary residence",
      retained_control_requirement: "retain the home and liquid investments",
      extraordinary_future_obligations: "education support for grandchildren",
    });
    expect(matter.blueprintState?.interaction?.kind).toBe("recommendations");
    expect(matter.blueprintState?.interaction?.kind).not.toBe("question");
    expect(
      Object.values(matter.record.canonical_intake?.fieldMeta ?? {}).every(
        (metadata) => metadata.confirmed,
      ),
    ).toBe(true);
    if (matter.blueprintState?.interaction?.kind === "recommendations") {
      expect(new Set(matter.blueprintState.interaction.items.map((item) => item.domain)).size)
        .toBe(matter.blueprintState.interaction.items.length);
    }
  });

  it("submits every applicable recommendation once and reaches Final Review in the audited journey", async () => {
    const { matterId, matter, visibleStates } = await reachDecisions();
    if (matter.blueprintState?.interaction?.kind !== "recommendations") {
      throw new Error("Consolidated Blueprint decisions were not prepared.");
    }
    const reviewed = await submitBlueprintDecisions({
      userId: OWNER_ID,
      matterId,
      operationId: randomUUID(),
      decisions: matter.blueprintState.interaction.items.map((item) => ({
        decisionId: item.decision_id,
        disposition: "accept",
        modification: null,
        openConfirmation: null,
      })),
    });

    expect(reviewed.blueprintState?.interaction?.kind).toBe("final_review");
    expect(reviewed.decisions).toHaveLength(
      matter.blueprintState.interaction.items.length,
    );
    expect(visibleStates + 3).toBe(10); // sign-in, final review, Blueprint preview
  });
});
