import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/server/auth";
import { correctFinalReview } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

const FinalReviewCorrectionRequestSchema = z.object({
  turnKey: z.string().uuid(),
  correction: z.string().trim().min(1).max(5000),
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
    const body = FinalReviewCorrectionRequestSchema.parse(await request.json());
    const matter = await correctFinalReview({
      userId: user.id,
      matterId: id,
      turnKey: body.turnKey,
      correction: body.correction,
    });
    return NextResponse.json({ matter });
  } catch (error) {
    return errorResponse(error);
  }
}
