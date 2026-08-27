import { NextResponse, type NextRequest } from "next/server";

import {
  SYNTHETIC_SESSION_COOKIE,
  SYNTHETIC_USERS,
  syntheticModeEnabled,
} from "@/lib/server/auth";
import { createUserSupabaseClient } from "@/lib/server/supabase";

const SYNTHETIC_INVITE_TOKENS = new Map([
  ["synthetic-invite-profile-a", SYNTHETIC_USERS[0].id],
]);

function failedInviteResponse(request: NextRequest) {
  return NextResponse.redirect(new URL("/?auth=invite_failed", request.url));
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!tokenHash || type !== "invite") return failedInviteResponse(request);

  if (syntheticModeEnabled()) {
    const userId = SYNTHETIC_INVITE_TOKENS.get(tokenHash);
    if (!userId) return failedInviteResponse(request);
    const response = NextResponse.redirect(new URL("/home", request.url));
    response.cookies.set(SYNTHETIC_SESSION_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
    return response;
  }

  const supabase = await createUserSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });
  if (error || !data.session || !data.user) return failedInviteResponse(request);

  return NextResponse.redirect(new URL("/home", request.url));
}
