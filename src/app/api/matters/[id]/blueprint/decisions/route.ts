import { NextResponse } from "next/server";
import { z } from "zod";

import { RecommendationDecisionSubmissionSchema } from "@/lib/domain/blueprint";
import { getCurrentUser } from "@/lib/server/auth";
import { submitBlueprintDecisions } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

const DecisionsSchema = z.object({
  operationId: z.string().uuid(),
  decisions: z.array(RecommendationDecisionSubmissionSchema).min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const { id } = await context.params;
    const body = DecisionsSchema.parse(await request.json());
    const matter = await submitBlueprintDecisions({
      userId: user.id,
      matterId: id,
      operationId: body.operationId,
      decisions: body.decisions,
    });
    return NextResponse.json({ matter });
  } catch (error) {
    return errorResponse(error);
  }
}
