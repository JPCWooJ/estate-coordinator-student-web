import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { confirmMatterOpening } from "@/lib/server/data";
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
    const matter = await confirmMatterOpening({ userId: user.id, matterId: id });
    return NextResponse.json({ matter });
  } catch (error) {
    return errorResponse(error);
  }
}
