import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUserSupabaseClient: vi.fn(),
  syntheticModeEnabled: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth", () => ({
  SYNTHETIC_SESSION_COOKIE: "ec-synthetic-session",
  SYNTHETIC_USERS: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "student-a@example.test",
    },
  ],
  syntheticModeEnabled: mocks.syntheticModeEnabled,
}));
vi.mock("@/lib/server/supabase", () => ({
  createUserSupabaseClient: mocks.createUserSupabaseClient,
}));

import { GET } from "./route";

const VALID_URL =
  "https://estate.example/auth/confirm?token_hash=valid-invite-token&type=invite";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.syntheticModeEnabled.mockReturnValue(false);
  mocks.createUserSupabaseClient.mockResolvedValue({
    auth: { verifyOtp: mocks.verifyOtp },
  });
});

describe("GET /auth/confirm", () => {
  it("verifies an invite token and redirects the established session to home", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: "access", refresh_token: "refresh" },
        user: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          email: "invited@example.test",
        },
      },
      error: null,
    });

    const response = await GET(new NextRequest(VALID_URL));

    expect(response.headers.get("location")).toBe("https://estate.example/home");
    expect(mocks.verifyOtp).toHaveBeenCalledOnce();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-invite-token",
      type: "invite",
    });
  });

  it.each([
    "https://estate.example/auth/confirm?type=invite",
    "https://estate.example/auth/confirm?token_hash=token&type=email",
    "https://estate.example/auth/confirm?token_hash=token",
  ])("rejects a malformed or non-invite confirmation URL: %s", async (url) => {
    const response = await GET(new NextRequest(url));

    expect(response.headers.get("location")).toBe(
      "https://estate.example/?auth=invite_failed",
    );
    expect(mocks.createUserSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });

  it("fails safely when Supabase rejects an expired invite token", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error("Token has expired or is invalid"),
    });

    const response = await GET(new NextRequest(VALID_URL));

    expect(response.headers.get("location")).toBe(
      "https://estate.example/?auth=invite_failed",
    );
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-invite-token",
      type: "invite",
    });
  });

  it("does not continue without both an authenticated user and session", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    const response = await GET(new NextRequest(VALID_URL));

    expect(response.headers.get("location")).toBe(
      "https://estate.example/?auth=invite_failed",
    );
  });
});
