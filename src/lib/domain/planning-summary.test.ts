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
        materialAssetsRange: "$8M-$10M",
        liabilitiesRange: "$500K-$750K",
        expectedInheritanceRange: "none expected",
        lifetimeSecurityFloor: "$5M-FLOOR",
        assetsCountedTowardFloor: "HOME-AND-LIQUID-ASSETS",
        retainedControlRequirement: "RETAIN-HOME-CONTROL",
        extraordinaryFutureObligations: "GRANDCHILD-EDUCATION",
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
      "$8M-$10M",
      "$5M-FLOOR",
    ]) {
      expect(serialized.split(fact)).toHaveLength(2);
    }
    expect(serialized).not.toContain("house_in_order");
  });
});
