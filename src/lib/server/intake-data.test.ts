import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StructuredIntakeSubmission } from "@/lib/domain/intake";

import {
  acknowledgeBeta,
  createMatter,
  getMatter,
  resetSyntheticStoreForTests,
  submitStructuredIntake,
} from "./data";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ syntheticModeEnabled: () => true }));

const OWNER_ID = "11111111-1111-4111-8111-111111111111";

function goalsSubmission(
  operationId = randomUUID(),
): StructuredIntakeSubmission {
  return {
    operationId,
    section: "goals_family" as const,
    values: {
      desiredOutcomes: ["intended_transfer", "asset_protection"],
      topPriorities: ["intended_transfer", "asset_protection"],
      successDefinition: "Protect my spouse, then benefit our children fairly.",
      beneficiaries: [
        {
          nameOrGroup: "Spouse",
          relationship: "spouse",
          role: "primary" as const,
          treatment: "lifetime security first",
          protectionNeeds: ["creditor protection"],
          readinessNotes: "Ready to participate.",
        },
      ],
      materialCircumstances: "No current family conflict.",
    },
  };
}

describe("structured intake persistence", () => {
  beforeEach(() => resetSyntheticStoreForTests());

  it("commits the first Continue directly and returns an authoritative receipt", async () => {
    await acknowledgeBeta(OWNER_ID);
    const matterId = await createMatter(OWNER_ID);

    const result = await submitStructuredIntake({
      userId: OWNER_ID,
      matterId,
      submission: goalsSubmission(),
    });

    expect(result.receipt).toMatchObject({
      matterId,
      revision: 1,
      status: "committed",
    });
    expect(result.matter.record.canonical_intake?.goalsFamily?.successDefinition)
      .toBe("Protect my spouse, then benefit our children fairly.");
    expect(result.matter.workflowState.step).toBe("INTAKE_PLANNING_CONTEXT");
    expect(result.matter.messages).toEqual([]);
  });

  it("reconciles an idempotent retry without changing the revision", async () => {
    await acknowledgeBeta(OWNER_ID);
    const matterId = await createMatter(OWNER_ID);
    const submission = goalsSubmission();

    const first = await submitStructuredIntake({
      userId: OWNER_ID,
      matterId,
      submission,
    });
    const retry = await submitStructuredIntake({
      userId: OWNER_ID,
      matterId,
      submission,
    });

    expect(retry.receipt.operationId).toBe(first.receipt.operationId);
    expect(retry.receipt.revision).toBe(1);
    expect(retry.matter.record).toEqual(first.matter.record);
  });

  it("restores every structured financial input and calculated result after save and resume", async () => {
    await acknowledgeBeta(OWNER_ID);
    const matterId = await createMatter(OWNER_ID);
    await submitStructuredIntake({
      userId: OWNER_ID,
      matterId,
      submission: {
        operationId: randomUUID(),
        section: "financial_range",
        values: {
          assets: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              category: "private_credit",
              approximateValue: 3_000_000,
              description: "Income fund",
              ownershipControl: "controlled_entity_or_trust",
              note: "Quarterly distributions",
            },
          ],
          liabilities: [
            {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              category: "business_liabilities",
              approximateValue: 250_000,
              description: "Line of credit",
              ownershipControl: "direct_control",
              note: "",
            },
          ],
          lifestyle: {
            monthlyExpenses: 25_000,
            incomeSources: [
              {
                id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                source: "Private credit distributions",
                monthlyAmount: 5_000,
                linkedAssetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              },
            ],
            safetyBufferPercent: 40,
            federalEffectiveTaxRatePercent: 25,
          },
          planning: {
            materialAssetsStatus: "provided",
            liabilitiesStatus: "provided",
            expectedInheritanceRange: "unknown",
            lifetimeSecurityFloor: {
              selection: "calculated",
              customAmount: null,
            },
            assetsCountedTowardFloor: "linked_income_producing_assets",
            retainedControlRequirement: {
              selection: "provided",
              detail: "retain control of the income fund",
            },
            extraordinaryFutureObligations: {
              selection: "not_decided",
              detail: "",
              approximateValue: null,
            },
          },
        },
      },
    });

    const resumed = await getMatter(OWNER_ID, matterId);

    expect(resumed?.record.canonical_intake?.financialProfile).toMatchObject({
      assets: [
        {
          category: "private_credit",
          description: "Income fund",
          note: "Quarterly distributions",
        },
      ],
      liabilities: [
        {
          category: "business_liabilities",
          approximateValue: 250_000,
        },
      ],
      lifestyle: {
        monthlyExpenses: 25_000,
        safetyBufferPercent: 40,
        federalEffectiveTaxRatePercent: 25,
      },
      planning: {
        expectedInheritanceRange: "unknown",
        retainedControlRequirement: {
          selection: "provided",
          detail: "retain control of the income fund",
        },
        extraordinaryFutureObligations: {
          selection: "not_decided",
        },
      },
      calculations: {
        totalAssets: 3_000_000,
        totalLiabilities: 250_000,
        estimatedNetEstate: 2_750_000,
        annualShortfall: 240_000,
        taxAdjustedAnnualPortfolioIncomeRequired: 320_000,
        minimumLiquidAssetsRequired: 8_000_000,
        retainedIncomeProducingAssets: 3_000_000,
        recommendedControllableEstateFloor: 14_200_000,
      },
    });
  });
});
