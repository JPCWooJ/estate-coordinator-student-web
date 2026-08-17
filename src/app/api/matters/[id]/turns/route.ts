import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/server/auth";
import { submitMatterTurn } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

const TurnSchema = z.object({
  turnKey: z.string().uuid(),
  answer: z.string().trim().min(1).max(5000),
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
    const body = TurnSchema.parse(await request.json());
    const matter = await submitMatterTurn({
      userId: user.id,
      matterId: id,
      turnKey: body.turnKey,
      answer: body.answer,
    });
    return NextResponse.json({ matter });
  } catch (error) {
    return errorResponse(error);
  }
}
