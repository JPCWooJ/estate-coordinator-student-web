import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshSupabaseSession: vi.fn(),
}));

vi.mock("@/lib/server/supabase-proxy", () => ({
  refreshSupabaseSession: mocks.refreshSupabaseSession,
}));

import { proxy, shouldRefreshSupabaseSession } from "./proxy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Supabase session refresh boundary", () => {
  it.each([
    "/auth/callback",
    "/auth/callback/",
    "/auth/confirm",
    "/auth/confirm/",
  ])(
    "does not refresh a prior session while %s exchanges a new session",
    async (pathname) => {
      expect(shouldRefreshSupabaseSession(pathname)).toBe(false);

      await proxy(new NextRequest(`https://estate.example${pathname}?code=new-session`));

      expect(mocks.refreshSupabaseSession).not.toHaveBeenCalled();
    },
  );

  it.each(["/", "/home", "/api/session"])(
    "continues refreshing sessions on %s",
    async (pathname) => {
      const refreshedResponse = new NextResponse(null, { status: 204 });
      mocks.refreshSupabaseSession.mockResolvedValueOnce(refreshedResponse);
      const request = new NextRequest(`https://estate.example${pathname}`);

      await expect(proxy(request)).resolves.toBe(refreshedResponse);
      expect(mocks.refreshSupabaseSession).toHaveBeenCalledWith(request);
    },
  );
});
