import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/server/auth";
import { submitBlueprintEvidence } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

const TurnKeySchema = z.string().uuid();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const { id } = await context.params;
    const form = await request.formData();
    const turnKey = TurnKeySchema.parse(form.get("turnKey"));
    const candidate = form.get("file");
    const file = candidate instanceof File && candidate.size > 0 ? candidate : null;
    const matter = await submitBlueprintEvidence({
      userId: user.id,
      matterId: id,
      turnKey,
      file,
    });
    return NextResponse.json({ matter });
  } catch (error) {
    return errorResponse(error);
  }
}
