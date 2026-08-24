import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StructuredIntakeSubmission } from "@/lib/domain/intake";

import {
  acknowledgeBeta,
  createMatter,
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
});
