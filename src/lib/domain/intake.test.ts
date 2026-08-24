import { describe, expect, it } from "vitest";

import { createInitialRecord } from "./matter-opening";
import {
  applyStructuredIntake,
  createCanonicalIntakeState,
  intakeSectionForRecord,
  type StructuredIntakeSubmission,
} from "./intake";

const MATTER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = "2026-08-24T18:00:00.000Z";

function submission(
  value: Omit<StructuredIntakeSubmission, "operationId">,
): StructuredIntakeSubmission {
  return { ...value, operationId: crypto.randomUUID() } as StructuredIntakeSubmission;
}

describe("canonical grouped intake", () => {
  it("starts every new matter at the goals, family, and beneficiary section", () => {
    const state = createCanonicalIntakeState();

    expect(state.currentSection).toBe("goals_family");
    expect(state.completedSections).toEqual([]);
    expect(intakeSectionForRecord(createInitialRecord(MATTER_ID))).toBe(
      "goals_family",
    );
  });

  it("records goals and beneficiary intent once and advances to planning context", () => {
    const record = createInitialRecord(MATTER_ID);
    const result = applyStructuredIntake(
      record,
      submission({
        section: "goals_family",
        values: {
          desiredOutcomes: [
            "intended_transfer",
            "incapacity_readiness",
            "asset_protection",
          ],
          topPriorities: [
            "intended_transfer",
            "incapacity_readiness",
            "asset_protection",
          ],
          successDefinition: "Protect the family and keep decisions practical.",
          beneficiaries: [
            {
              nameOrGroup: "Spouse",
              relationship: "spouse",
              role: "primary",
              treatment: "specific",
              protectionNeeds: ["lifetime support"],
              readinessNotes: "not applicable",
            },
            {
              nameOrGroup: "Children",
              relationship: "children",
              role: "primary",
              treatment: "equal",
              protectionNeeds: ["creditor protection"],
              readinessNotes: "increasing participation with readiness",
            },
            {
              nameOrGroup: "Descendants",
              relationship: "descendants",
              role: "substitute",
              treatment: "by family branch",
              protectionNeeds: [],
              readinessNotes: "not decided",
            },
          ],
          materialCircumstances: "One child may need continuing protection.",
        },
      }),
      NOW,
    );

    expect(result.record.desired_outcomes).toEqual([
      "intended_transfer",
      "incapacity_readiness",
      "asset_protection",
    ]);
    expect(result.record.top_three_priorities).toHaveLength(3);
    expect(result.record.people_and_interests_snapshot).toContain("Spouse");
    expect(result.record.people_and_interests_snapshot).toContain("Children");
    expect(result.record.canonical_intake!.currentSection).toBe(
      "planning_context",
    );
    expect(
      result.record.canonical_intake!.fieldMeta["beneficiaries.intent"]?.status,
    ).toBe("answered");
    expect(
      result.record.canonical_intake!.fieldMeta["beneficiaries.intent"]
        ?.decisionSupport,
    ).toContain("beneficiary_architecture");
  });

  it("preserves earlier answers while later grouped sections populate Blueprint inputs", () => {
    let record = createInitialRecord(MATTER_ID);
    record = applyStructuredIntake(
      record,
      submission({
        section: "goals_family",
        values: {
          desiredOutcomes: ["intended_transfer", "incapacity_readiness"],
          topPriorities: ["intended_transfer", "incapacity_readiness"],
          successDefinition: "Protect my spouse and children.",
          beneficiaries: [
            {
              nameOrGroup: "Spouse and children",
              relationship: "family",
              role: "primary",
              treatment: "equal",
              protectionNeeds: ["creditor protection"],
              readinessNotes: "increasing participation with readiness",
            },
            {
              nameOrGroup: "Descendants",
              relationship: "descendants",
              role: "substitute",
              treatment: "by family branch",
              protectionNeeds: [],
              readinessNotes: "not applicable",
            },
          ],
          materialCircumstances: "No conflict is expected.",
        },
      }),
      NOW,
    ).record;
    const peopleSnapshot = record.people_and_interests_snapshot;

    record = applyStructuredIntake(
      record,
      submission({
        section: "planning_context",
        values: {
          currentPlanStatus: "update_needed",
          documentTypes: ["revocable trust", "will"],
          approximatePlanDate: "2018",
          materialChanges: ["moved to Florida"],
          planningReason: "The plan is overdue for review.",
          deadline: "none",
          primaryResidence: "Florida",
          otherJurisdictions: ["Georgia rental property"],
          complexityFlags: ["family business", "digital assets"],
          complexityDetails: "No foreign connections.",
        },
      }),
      NOW,
    ).record;

    record = applyStructuredIntake(
      record,
      submission({
        section: "team_continuity",
        values: {
          contacts: [
            {
              name: "Jordan Lee",
              firmOrRelationship: "Harbor Counsel",
              role: "estate-planning counsel",
              email: "jordan@example.com",
              phone: "555-555-1111",
              primaryOrBackup: "primary",
              responsibilities: "Coordinate legal implementation.",
            },
            {
              name: "Casey Lee",
              firmOrRelationship: "spouse",
              role: "trusted decision-maker",
              email: "",
              phone: "",
              primaryOrBackup: "backup",
              responsibilities: "Keep household decisions moving.",
            },
          ],
          missingProfessionalRoles: ["tax adviser"],
          continuityResponsibilities: [
            "household administration",
            "family business oversight",
          ],
          specialAssetsOrPurposes: ["family business", "digital assets"],
          readinessPlan: "Children gain responsibility with experience.",
        },
      }),
      NOW,
    ).record;

    const final = applyStructuredIntake(
      record,
      submission({
        section: "financial_range",
        values: {
          materialAssetsRange: "$8 million to $10 million",
          liabilitiesRange: "$500,000 to $750,000",
          expectedInheritanceRange: "none",
          lifetimeSecurityFloor: "$5 million",
          assetsCountedTowardFloor: "home and liquid investments",
          retainedControlRequirement: "retain the home and liquid investments",
          extraordinaryFutureObligations: "education support for grandchildren",
        },
      }),
      NOW,
    ).record;

    expect(final.people_and_interests_snapshot).toBe(peopleSnapshot);
    expect(final.current_plan_snapshot).toContain("2018");
    expect(final.geographic_and_complexity_flags).toContain("family business");
    expect(final.professional_and_family_contacts[0]?.name).toBe("Jordan Lee");
    expect(final.canonical_intake!.financialRange!.materialAssetsRange).toBe(
      "$8 million to $10 million",
    );
    expect(final.canonical_intake!.currentSection).toBe("planning_summary");
    expect(final.canonical_intake!.completedSections).toEqual([
      "goals_family",
      "planning_context",
      "team_continuity",
      "financial_range",
    ]);
  });

  it("treats explicit unknown and not-decided values as answered statuses", () => {
    const result = applyStructuredIntake(
      createInitialRecord(MATTER_ID),
      submission({
        section: "financial_range",
        values: {
          materialAssetsRange: "unknown",
          liabilitiesRange: "none",
          expectedInheritanceRange: "not applicable",
          lifetimeSecurityFloor: "not decided",
          assetsCountedTowardFloor: "not decided",
          retainedControlRequirement: "not decided",
          extraordinaryFutureObligations: "none",
        },
      }),
      NOW,
    );

    expect(
      result.record.canonical_intake!.fieldMeta[
        "financial.lifetime_security_floor"
      ]?.status,
    ).toBe("not_decided");
    expect(
      result.record.canonical_intake!.fieldMeta["financial.liabilities"]?.status,
    ).toBe("answered");
    expect(intakeSectionForRecord(result.record)).not.toBe("financial_range");
  });
});
