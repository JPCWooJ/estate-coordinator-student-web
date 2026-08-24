import { getCurrentUser } from "@/lib/server/auth";
import { getBlueprintPdf } from "@/lib/server/data";
import { errorResponse } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized.");
    const { id } = await context.params;
    const pdf = await getBlueprintPdf({ userId: user.id, matterId: id });
    const body = Uint8Array.from(pdf.bytes).buffer;
    return new Response(body, {
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": `attachment; filename="${pdf.filename}"`,
        "content-type": "application/pdf",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
