import { LoginExperience } from "@/components/login-experience";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <LoginExperience
      syntheticMode={process.env.EC_SYNTHETIC_TEST_MODE === "true"}
    />
  );
}
