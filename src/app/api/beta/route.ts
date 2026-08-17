import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { acknowledgeBeta } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const acknowledgedAt = await acknowledgeBeta(user.id);
    return NextResponse.json({ acknowledgedAt });
  } catch (error) {
    return errorResponse(error);
  }
}
