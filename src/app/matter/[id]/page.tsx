import { MatterExperience } from "@/components/matter-experience";

export default async function MatterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatterExperience matterId={id} />;
}
