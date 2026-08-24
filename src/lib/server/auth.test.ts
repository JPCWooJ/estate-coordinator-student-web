import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createUserSupabaseClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("./supabase", () => ({
  createUserSupabaseClient: mocks.createUserSupabaseClient,
}));

import { getCurrentUser } from "./auth";

const originalSyntheticTestMode = process.env.EC_SYNTHETIC_TEST_MODE;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EC_SYNTHETIC_TEST_MODE = "false";
  mocks.createUserSupabaseClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
  });
});

afterAll(() => {
  if (originalSyntheticTestMode === undefined) {
    delete process.env.EC_SYNTHETIC_TEST_MODE;
  } else {
    process.env.EC_SYNTHETIC_TEST_MODE = originalSyntheticTestMode;
  }
});

describe("authenticated identity", () => {
  it("returns the identity validated by the Supabase Auth server", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          email: "authenticated@example.test",
        },
      },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      email: "authenticated@example.test",
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it("does not expose an identity when server validation fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid session"),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
