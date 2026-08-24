import { NextResponse } from "next/server";

import { StructuredIntakeSubmissionSchema } from "@/lib/domain/intake";
import { getCurrentUser } from "@/lib/server/auth";
import { submitStructuredIntake } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const { id } = await context.params;
    const submission = StructuredIntakeSubmissionSchema.parse(
      await request.json(),
    );
    const result = await submitStructuredIntake({
      userId: user.id,
      matterId: id,
      submission,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
