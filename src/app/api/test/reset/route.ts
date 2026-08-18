import { NextResponse } from "next/server";

import { resetSyntheticStoreForTests } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    resetSyntheticStoreForTests();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
