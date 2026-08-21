import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser, syntheticModeEnabled } from "@/lib/server/auth";
import { seedSyntheticBlueprintScenario } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

const ScenarioSchema = z.object({
  scenario: z.enum(["zero_turn", "incomplete", "triggered"]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!syntheticModeEnabled()) return new NextResponse(null, { status: 404 });
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const body = ScenarioSchema.parse(await request.json());
    const id = await seedSyntheticBlueprintScenario({
      userId: user.id,
      scenario: body.scenario,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
