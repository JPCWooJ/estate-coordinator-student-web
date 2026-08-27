import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUserSupabaseClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase", () => ({
  createUserSupabaseClient: mocks.createUserSupabaseClient,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createUserSupabaseClient.mockResolvedValue({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  });
});

describe("GET /auth/callback", () => {
  it("continues exchanging returning-user PKCE codes before redirecting home", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest("https://estate.example/auth/callback?code=returning-code"),
    );

    expect(response.headers.get("location")).toBe("https://estate.example/home");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("returning-code");
  });

  it("keeps the existing safe failure path for an invalid PKCE code", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error("invalid code"),
    });

    const response = await GET(
      new NextRequest("https://estate.example/auth/callback?code=invalid-code"),
    );

    expect(response.headers.get("location")).toBe(
      "https://estate.example/?auth=failed",
    );
  });
});
