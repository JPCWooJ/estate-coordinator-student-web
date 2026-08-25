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
  it("synthesizes the replacement Screen 7 baseline with each material fact once", () => {
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
    const serialized = JSON.stringify(summary);

    expect(summary.sections.map((section) => section.key)).toEqual([
      "priorities",
      "family",
      "current_plan",
      "timing_context",
      "planning_range",
      "team",
      "uncertainties",
    ]);
    expect(summary.sections.map((section) => section.title)).toEqual([
      "Planning priorities and success",
      "Family and beneficiary intent",
      "Current plan and material changes",
      "Timing, jurisdiction, and complexity",
      "Planning range and governing constraints",
      "Planning team and open roles",
      "Material uncertainties",
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

    const team = summary.sections.find((section) => section.key === "team");
    expect(team?.contacts).toEqual([
      {
        name: "JORDAN-LEE",
        affiliation: "Harbor Counsel",
        contact: "jordan@example.com / 555-0100",
        role: "estate attorney · Adviser",
        responsibilities: "document review",
      },
    ]);
    expect(summary.boundaryNote).toContain("not legal or tax advice");
  });

  it("uses canonical intake instead of contradictory legacy people fields", () => {
    let record = createInitialRecord("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    record = apply(record, {
      section: "goals_family",
      values: {
        desiredOutcomes: ["intended_transfer"],
        topPriorities: ["intended_transfer"],
        successDefinition: "CANONICAL-SUCCESS",
        beneficiaries: [{
          nameOrGroup: "CANONICAL-BENEFICIARY",
          relationship: "child",
          role: "primary",
          treatment: "equal treatment",
          protectionNeeds: [],
          readinessNotes: "ready now",
        }],
        materialCircumstances: "none identified",
      },
    });
    record = apply(record, {
      section: "team_continuity",
      values: {
        contacts: [{
          name: "CANONICAL-CONTACT",
          firmOrRelationship: "Trusted adviser",
          role: "estate attorney",
          email: "canonical@example.com",
          phone: "555-0123",
          primaryOrBackup: "adviser",
          responsibilities: "coordinate implementation",
        }],
        missingProfessionalRoles: [],
        continuityResponsibilities: ["investment oversight"],
        specialAssetsOrPurposes: [],
        readinessPlan: "annual family meeting",
      },
    });
    record = {
      ...record,
      principal_definition_of_success: "LEGACY-SUCCESS",
      people_and_interests_snapshot: "LEGACY-BENEFICIARY",
      professional_and_family_contacts: [{
        name: "LEGACY-CONTACT",
        firm: "Legacy firm",
        expertise: "legacy expertise",
        estate_role: "legacy role",
        email: "legacy@example.com",
        telephone: "555-9999",
        contact_trigger: "legacy trigger",
        priority: "legacy priority",
        missing_information: [],
      }],
      other_participants: [{
        name: "LEGACY-PARTICIPANT",
        relationship: "legacy relationship",
        intended_role: "legacy role",
        involvement_timing: "legacy timing",
      }],
    };

    const serialized = JSON.stringify(buildPrincipalPlanningSummary(record));

    expect(serialized).toContain("CANONICAL-SUCCESS");
    expect(serialized).toContain("CANONICAL-BENEFICIARY");
    expect(serialized).toContain("CANONICAL-CONTACT");
    expect(serialized).not.toContain("LEGACY-SUCCESS");
    expect(serialized).not.toContain("LEGACY-BENEFICIARY");
    expect(serialized).not.toContain("LEGACY-CONTACT");
    expect(serialized).not.toContain("LEGACY-PARTICIPANT");
  });

  it("turns canonical uncertainty metadata into human-facing language", () => {
    const record = createInitialRecord("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    record.canonical_intake = {
      ...record.canonical_intake!,
      fieldMeta: {
        "goals.success": {
          status: "unknown",
          source: "structured_intake:goals_family",
          confirmed: false,
          confidence: "high",
          lastUpdatedAt: new Date().toISOString(),
          revision: 1,
          decisionSupport: ["recommendation_constraints"],
        },
      },
    };

    const summary = buildPrincipalPlanningSummary(record);
    const uncertainties = summary.sections.find(
      (section) => section.key === "uncertainties",
    );

    expect(uncertainties?.details).toContainEqual({
      label: "Definition of success",
      value: "Not yet known",
    });
    expect(JSON.stringify(summary)).not.toContain("goals.success");
  });

  it("moves unresolved facts into Material uncertainties instead of repeating them", () => {
    let record = createInitialRecord("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    record = apply(record, {
      section: "team_continuity",
      values: {
        contacts: [{
          name: "ALEX-MORGAN",
          firmOrRelationship: "Family adviser",
          role: "trusted participant",
          email: "",
          phone: "",
          primaryOrBackup: "participant",
          responsibilities: "family coordination",
        }],
        missingProfessionalRoles: [],
        continuityResponsibilities: ["investment oversight"],
        specialAssetsOrPurposes: [],
        readinessPlan: "not decided",
      },
    });

    const summary = buildPrincipalPlanningSummary(record);
    const team = summary.sections.find((section) => section.key === "team");
    const uncertainties = summary.sections.find(
      (section) => section.key === "uncertainties",
    );

    expect(team?.details.some((item) => item.label === "Readiness plan")).toBe(
      false,
    );
    expect(uncertainties?.details).toContainEqual({
      label: "Family readiness",
      value: "Not decided",
    });
    expect(JSON.stringify(summary).toLowerCase().split("not decided")).toHaveLength(2);
  });
});
