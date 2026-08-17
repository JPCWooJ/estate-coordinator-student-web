import { NextResponse } from "next/server";
import { z } from "zod";

import { syntheticModeEnabled } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";
import { createUserSupabaseClient } from "@/lib/server/supabase";

const RequestSchema = z.object({ email: z.string().email().max(254) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (syntheticModeEnabled()) {
      return NextResponse.json(
        { error: "Use a synthetic student login in test mode." },
        { status: 400 },
      );
    }
    const { email } = RequestSchema.parse(await request.json());
    const supabase = await createUserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
      },
    });
    if (error) throw new Error("The sign-in link could not be sent.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
