import { NextResponse, type NextRequest } from "next/server";

import { createUserSupabaseClient } from "@/lib/server/supabase";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createUserSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/home", request.url));
  }
  return NextResponse.redirect(new URL("/?auth=failed", request.url));
}
