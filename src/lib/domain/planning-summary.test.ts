import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { applyStructuredIntake, StructuredIntakeSubmission } from "./intake";
import { createInitialRecord } from "./matter-opening";
import { buildPrincipalPlanningSummary } from "./planning-summary";

function apply(record: ReturnType<typeof createInitialRecord>, submission: Omit<StructuredIntakeSubmission, "operationId">) {
  return applyStructuredIntake(record, {
    ...submission,
    operationId: randomUUID(),
  } as StructuredIntakeSubmission).record;
}

describe("professional Planning Summary", () => {
  it("synthesizes each material fact once from canonical intake", () => {
    let record = createInitialRecord("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    record = apply(record, {
      section: "goals_family",
      values: {
        desiredOutcomes: ["intended_transfer", "asset_protection"],
        topPriorities: ["intended_transfer", "asset_protection"],
        successDefinition: "KEEP-SPOUSE-SECURE",
        beneficiaries: [{
          nameOrGroup: "PRIMARY-SPOUSE",
          relationship: "spouse",
          role: "primary",
          treatment: "lifetime security first",
          protectionNeeds: ["creditor protection"],
          readinessNotes: "ready now",
        }],
        materialCircumstances: "NO-FAMILY-CONFLICT",
      },
    });
    record = apply(record, {
      section: "planning_context",
      values: {
        currentPlanStatus: "update_needed",
        documentTypes: ["REVOCABLE-TRUST"],
        approximatePlanDate: "2018",
        materialChanges: ["MOVED-TO-FLORIDA"],
        planningReason: "ROUTINE-REVIEW",
        deadline: "none",
        primaryResidence: "MIAMI-FLORIDA",
        otherJurisdictions: ["GEORGIA-RENTAL"],
        complexityFlags: ["business"],
        complexityDetails: "FAMILY-BUSINESS-INTEREST",
      },
    });
    record = apply(record, {
      section: "team_continuity",
      values: {
        contacts: [{
          name: "JORDAN-LEE",
          firmOrRelationship: "Harbor Counsel",
          role: "estate attorney",
          email: "jordan@example.com",
          phone: "555-0100",
          primaryOrBackup: "adviser",
          responsibilities: "document review",
        }],
        missingProfessionalRoles: ["CPA-NEEDED"],
        continuityResponsibilities: ["BILL-PAYMENT-CONTINUES"],
        specialAssetsOrPurposes: ["BUSINESS-CONTINUITY"],
        readinessPlan: "FAMILY-MEETING-ANNUALLY",
      },
    });
    record = apply(record, {
      section: "financial_range",
      values: {
        assets: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            category: "brokerage_accounts",
            approximateValue: 8_000_000,
            description: "TAXABLE-PORTFOLIO",
            ownershipControl: "direct_control",
            note: "CORE-INCOME-ASSET",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            category: "primary_residence",
            approximateValue: 2_000_000,
            description: "MIAMI-HOME",
            ownershipControl: "shared_control",
            note: "",
          },
        ],
        liabilities: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            category: "mortgages",
            approximateValue: 500_000,
            description: "HOME-MORTGAGE",
            ownershipControl: "shared_control",
            note: "",
          },
        ],
        lifestyle: {
          monthlyExpenses: 20_000,
          incomeSources: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              source: "PORTFOLIO-DISTRIBUTIONS",
              monthlyAmount: 10_000,
              linkedAssetId: "11111111-1111-4111-8111-111111111111",
            },
            {
              id: "55555555-5555-4555-8555-555555555555",
              source: "PENSION-INCOME",
              monthlyAmount: 5_000,
              linkedAssetId: null,
            },
          ],
          safetyBufferPercent: 30,
          federalEffectiveTaxRatePercent: 25,
        },
      },
    });

    const summary = buildPrincipalPlanningSummary(record);
    const serialized = JSON.stringify(summary.sections);

    expect(summary.sections.map((section) => section.key)).toEqual([
      "priorities",
      "family",
      "planning_context",
      "planning_range",
      "team_continuity",
      "uncertainties",
    ]);
    for (const fact of [
      "KEEP-SPOUSE-SECURE",
      "PRIMARY-SPOUSE",
      "REVOCABLE-TRUST",
      "MOVED-TO-FLORIDA",
      "JORDAN-LEE",
      "TAXABLE-PORTFOLIO",
      "MIAMI-HOME",
      "HOME-MORTGAGE",
      "PORTFOLIO-DISTRIBUTIONS",
      "PENSION-INCOME",
      "$10,600,000",
    ]) {
      expect(serialized.split(fact)).toHaveLength(2);
    }
    expect(serialized.split("25% federal-only effective income-tax planning assumption"))
      .toHaveLength(2);
    expect(serialized.split("30% safety buffer")).toHaveLength(2);
    expect(serialized).not.toContain("house_in_order");
  });
});
