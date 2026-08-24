import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new Error("Invalid request origin.");
  }
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed.";
  const correlationId = randomUUID();
  const status =
    message === "Unauthorized."
      ? 401
      : message === "Matter not found."
        ? 404
        : message === "Invalid request origin."
          ? 403
          : 400;
  const category =
    status === 401
      ? "authentication"
      : status === 403
        ? "authorization"
        : status === 404
          ? "not_found"
          : /stale/i.test(message)
            ? "revision_conflict"
            : /configured|upstream|timeout|fetch/i.test(message)
              ? "upstream"
              : "validation_or_save";
  console.error("Estate Coordinator request failed", {
    correlationId,
    category,
    message,
  });
  return NextResponse.json(
    { error: message, category, correlationId },
    { status },
  );
}
