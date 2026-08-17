import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { getMatter } from "@/lib/server/data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await context.params;
  const matter = await getMatter(user.id, id);
  if (!matter) return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  return NextResponse.json({ matter });
}
