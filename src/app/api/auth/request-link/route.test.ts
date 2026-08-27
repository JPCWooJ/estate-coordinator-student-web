import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUserSupabaseClient: vi.fn(),
  signInWithOtp: vi.fn(),
  syntheticModeEnabled: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth", () => ({
  syntheticModeEnabled: mocks.syntheticModeEnabled,
}));
vi.mock("@/lib/server/supabase", () => ({
  createUserSupabaseClient: mocks.createUserSupabaseClient,
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.syntheticModeEnabled.mockReturnValue(false);
  mocks.signInWithOtp.mockResolvedValue({ error: null });
  mocks.createUserSupabaseClient.mockResolvedValue({
    auth: { signInWithOtp: mocks.signInWithOtp },
  });
});

describe("POST /api/auth/request-link", () => {
  it("keeps returning-user magic links while refusing arbitrary account creation", async () => {
    const response = await POST(
      new Request("https://estate.example/api/auth/request-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "estate.example",
          origin: "https://estate.example",
        },
        body: JSON.stringify({ email: "returning@example.test" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "returning@example.test",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://estate.example/auth/callback",
      },
    });
  });
});
