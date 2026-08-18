import "server-only";

import { cookies } from "next/headers";

import { createUserSupabaseClient } from "./supabase";

export type SessionUser = { id: string; email: string };

export const SYNTHETIC_USERS: SessionUser[] = [
  { id: "11111111-1111-4111-8111-111111111111", email: "student-a@example.test" },
  { id: "22222222-2222-4222-8222-222222222222", email: "student-b@example.test" },
];

export const SYNTHETIC_SESSION_COOKIE = "ec-synthetic-session";

export function syntheticModeEnabled() {
  return process.env.EC_SYNTHETIC_TEST_MODE === "true";
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (syntheticModeEnabled()) {
    const value = (await cookies()).get(SYNTHETIC_SESSION_COOKIE)?.value;
    return SYNTHETIC_USERS.find((user) => user.id === value) ?? null;
  }

  const supabase = await createUserSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}
