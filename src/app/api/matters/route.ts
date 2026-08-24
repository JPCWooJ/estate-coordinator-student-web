import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import {
  betaAcknowledged,
  createMatter,
  listMatters,
} from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ matters: await listMatters(user.id) });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    if (!(await betaAcknowledged(user.id))) {
      return NextResponse.json(
        { error: "Acknowledge the privacy and professional-boundary notice before starting." },
        { status: 403 },
      );
    }
    const id = await createMatter(user.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
