import { redirect } from "next/navigation";

import { LoginExperience } from "@/components/login-experience";
import { getCurrentUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  if (await getCurrentUser()) redirect("/home");

  const { auth } = await searchParams;
  return (
    <LoginExperience
      syntheticMode={process.env.EC_SYNTHETIC_TEST_MODE === "true"}
      initialStatus={
        auth === "failed"
          ? "That sign-in link could not be used. Request a new link below."
          : ""
      }
    />
  );
}
