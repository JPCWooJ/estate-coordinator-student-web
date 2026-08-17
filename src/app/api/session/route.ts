import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getCurrentUser,
  SYNTHETIC_SESSION_COOKIE,
  SYNTHETIC_USERS,
  syntheticModeEnabled,
} from "@/lib/server/auth";
import { betaAcknowledged } from "@/lib/server/data";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";
import { createUserSupabaseClient } from "@/lib/server/supabase";

const SyntheticLoginSchema = z.object({ userId: z.string().uuid() });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null, betaAcknowledged: false });
  return NextResponse.json({
    user,
    betaAcknowledged: await betaAcknowledged(user.id),
  });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!syntheticModeEnabled()) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const { userId } = SyntheticLoginSchema.parse(await request.json());
    if (!SYNTHETIC_USERS.some((user) => user.id === userId)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    (await cookies()).set(SYNTHETIC_SESSION_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    if (syntheticModeEnabled()) {
      (await cookies()).delete(SYNTHETIC_SESSION_COOKIE);
    } else {
      const supabase = await createUserSupabaseClient();
      await supabase.auth.signOut();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
