import { NextResponse, type NextRequest } from "next/server";

import { refreshSupabaseSession } from "@/lib/server/supabase-proxy";

export function shouldRefreshSupabaseSession(pathname: string) {
  return !["/auth/callback", "/auth/confirm"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  if (!shouldRefreshSupabaseSession(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }
  return refreshSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
