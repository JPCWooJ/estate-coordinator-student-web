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
        assets: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            category: "brokerage_accounts",
            approximateValue: 8_000_000,
            description: "Taxable portfolio",
            ownershipControl: "direct_control",
            note: "",
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            category: "primary_residence",
            approximateValue: 2_000_000,
            description: "Miami home",
            ownershipControl: "shared_control",
            note: "",
          },
        ],
        liabilities: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            category: "mortgages",
            approximateValue: 500_000,
            description: "Home mortgage",
            ownershipControl: "shared_control",
            note: "",
          },
        ],
        lifestyle: {
          monthlyExpenses: 20_000,
          incomeSources: [
            {
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              source: "Portfolio distributions",
              monthlyAmount: 10_000,
              linkedAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
            {
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              source: "Pension",
              monthlyAmount: 5_000,
              linkedAssetId: null,
            },
          ],
          safetyBufferPercent: 30,
          federalEffectiveTaxRatePercent: 25,
        },
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
      material_assets_range: "$10,000,000 total assets (structured estimate)",
      liabilities_range: "$500,000 total liabilities (structured estimate)",
      expected_inheritance_range:
        "not assessed in this structured planning-level security calculation",
      lifetime_security_floor:
        "$10,600,000 recommended controllable-estate floor",
      assets_counted_toward_floor:
        "Taxable portfolio ($8,000,000)",
      retained_control_requirement:
        "retain the recommended controllable-estate floor, including $8,000,000 of user-identified income-producing assets",
      extraordinary_future_obligations:
        "reflected only when entered in structured liabilities or recurring monthly expenses",
    });
    expect(matter.record.canonical_intake?.financialProfile?.calculations)
      .toMatchObject({
        totalAssets: 10_000_000,
        totalLiabilities: 500_000,
        annualShortfall: 60_000,
        minimumLiquidAssetsRequired: 2_000_000,
        retainedIncomeProducingAssets: 8_000_000,
        recommendedControllableEstateFloor: 10_600_000,
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
