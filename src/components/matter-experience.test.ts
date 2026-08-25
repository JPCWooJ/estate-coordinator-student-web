import { describe, expect, it, vi } from "vitest";

import type { StructuredIntakeSubmission } from "@/lib/domain/intake";
import * as MatterExperienceModule from "./matter-experience";

type ReconciledSave = (
  url: string,
  submission: StructuredIntakeSubmission,
  request?: typeof fetch,
) => Promise<Response>;

const submission: StructuredIntakeSubmission = {
  operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  section: "financial_range",
  values: {
    assets: [],
    liabilities: [],
    lifestyle: {
      monthlyExpenses: 8_000,
      incomeSources: [],
      safetyBufferPercent: 30,
      federalEffectiveTaxRatePercent: 25,
    },
    planning: {
      materialAssetsStatus: "none",
      liabilitiesStatus: "none",
      expectedInheritanceRange: "none",
      lifetimeSecurityFloor: {
        selection: "calculated",
        customAmount: null,
      },
      assetsCountedTowardFloor: "linked_income_producing_assets",
      retainedControlRequirement: {
        selection: "none",
        detail: "",
      },
      extraordinaryFutureObligations: {
        selection: "none",
        detail: "",
        approximateValue: null,
      },
    },
  },
};

function reconciledSave() {
  return (MatterExperienceModule as unknown as {
    postStructuredIntakeWithReconciliation?: ReconciledSave;
  }).postStructuredIntakeWithReconciliation;
}

describe("structured financial save reconciliation", () => {
  it("automatically replays an ambiguous transport failure with the identical operation", async () => {
    const save = reconciledSave();
    expect(save).toBeTypeOf("function");
    if (!save) return;
    const bodies: string[] = [];
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      if (bodies.length === 1) throw new TypeError("Failed to fetch");
      return new Response("{}", { status: 200 });
    });

    const response = await save("/api/matters/1/intake", submission, request);

    expect(response.ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(new Set(bodies)).toEqual(new Set([JSON.stringify(submission)]));
  });

  it("automatically reconciles one ambiguous server response without user resubmission", async () => {
    const save = reconciledSave();
    expect(save).toBeTypeOf("function");
    if (!save) return;
    const bodies: string[] = [];
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return new Response("{}", { status: bodies.length === 1 ? 502 : 200 });
    });

    const response = await save("/api/matters/1/intake", submission, request);

    expect(response.ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(bodies[0]).toBe(bodies[1]);
  });
});
