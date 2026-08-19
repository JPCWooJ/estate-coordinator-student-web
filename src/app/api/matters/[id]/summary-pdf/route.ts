import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/server/auth";
import { buildPlanningSummaryPdf } from "@/lib/server/planning-summary-pdf";
import { getMatter } from "@/lib/server/data";
import { errorResponse } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const { id } = await context.params;
    const matter = await getMatter(user.id, id);
    if (!matter) {
      return NextResponse.json({ error: "Matter not found." }, { status: 404 });
    }
    if (matter.workflowState.step !== "CONFIRMED") {
      return NextResponse.json(
        { error: "The planning summary is not available for download until confirmation." },
        { status: 409 },
      );
    }
    const pdf = buildPlanningSummaryPdf(matter.record);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="planning-summary.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
