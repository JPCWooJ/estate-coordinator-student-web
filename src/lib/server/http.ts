import "server-only";

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
  const status =
    message === "Unauthorized."
      ? 401
      : message === "Matter not found."
        ? 404
        : message === "Invalid request origin."
          ? 403
          : 400;
  return NextResponse.json({ error: message }, { status });
}
