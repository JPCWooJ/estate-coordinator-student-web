import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  correctFinalReview,
  finalizeBlueprint,
  getBlueprintPdf,
  resetSyntheticStoreForTests,
  seedSyntheticBlueprintScenario,
  startBlueprint,
  submitBlueprintEvidence,
  submitBlueprintTurn,
} from "./data";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ syntheticModeEnabled: () => true }));
vi.mock("./blueprint-pdf", () => ({
  renderBlueprintPdf: vi.fn(async () =>
    Uint8Array.from(Buffer.from("%PDF-1.7\nsynthetic Estate Blueprint")),
  ),
}));

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

async function reachFinalReview() {
  const matterId = await seedSyntheticBlueprintScenario({
    userId: OWNER_ID,
    scenario: "zero_turn",
  });
  let matter = await startBlueprint({ userId: OWNER_ID, matterId });

  for (let turns = 0; turns < 20; turns += 1) {
    if (matter.blueprintState?.interaction?.kind === "final_review") {
      return { matterId, matter };
    }
    if (matter.blueprintState?.interaction?.kind === "evidence") {
      matter = await submitBlueprintEvidence({
        userId: OWNER_ID,
        matterId,
        turnKey: randomUUID(),
        file: null,
      });
      continue;
    }
    matter = await submitBlueprintTurn({
      userId: OWNER_ID,
      matterId,
      turnKey: randomUUID(),
      answer:
        matter.blueprintState?.interaction?.kind === "recommendation"
          ? "I accept this recommendation."
          : "Use the confirmed family and professional roles.",
    });
  }

  throw new Error("Final Review was not reached within the bounded journey.");
}

describe("Estate Blueprint finalization persistence", () => {
  beforeEach(() => resetSyntheticStoreForTests());

  it("applies a local Final Review correction and freezes one immutable generation", async () => {
    const { matterId, matter } = await reachFinalReview();
    const before = matter.blueprintState?.final_review_profile;

    const corrected = await correctFinalReview({
      userId: OWNER_ID,
      matterId,
      turnKey: randomUUID(),
      correction: "Change the lifetime-security floor to $6 million.",
    });

    expect(corrected.blueprintState?.final_review_profile).toEqual({
      ...before,
      planning_baseline: "Preserve $6 million.",
    });
    expect(corrected.blueprintState?.final_review_corrections).toHaveLength(1);

    const finalized = await finalizeBlueprint({
      userId: OWNER_ID,
      matterId,
    });
    const retry = await finalizeBlueprint({ userId: OWNER_ID, matterId });

    expect(finalized.blueprintState?.interaction?.kind).toBe("blueprint");
    expect(finalized.blueprint?.status).toBe("ready");
    expect(finalized.blueprint?.document?.sections).toHaveLength(4);
    expect(retry.blueprint).toEqual(finalized.blueprint);
    expect(retry.blueprintState?.generation_snapshot_id).toBe(
      finalized.blueprintState?.generation_snapshot_id,
    );
  });

  it("returns PDF bytes only to the matter owner", async () => {
    const { matterId } = await reachFinalReview();
    const finalized = await finalizeBlueprint({ userId: OWNER_ID, matterId });

    const owned = await getBlueprintPdf({ userId: OWNER_ID, matterId });
    await expect(
      getBlueprintPdf({ userId: OTHER_USER_ID, matterId }),
    ).rejects.toThrow("Matter not found.");
    expect(owned.filename).toBe(finalized.blueprint?.downloadFilename);
    expect(new TextDecoder().decode(owned.bytes)).toContain("%PDF-1.7");
  });
});
