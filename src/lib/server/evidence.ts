import "server-only";

import { extractText, getDocumentProxy } from "unpdf";
import { selectStageRelevantEvidence } from "@/lib/domain/evidence-selection";

const MAX_PAGES = 75;
const EXTRACTION_TIMEOUT_MS = 12_000;

function withTimeout<T>(work: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("PDF extraction timed out.")), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function extractStageRelevantEvidence(
  bytes: Uint8Array,
  planningQuestion: string,
) {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  try {
    pdf = await withTimeout(
      getDocumentProxy(bytes, { maxImageSize: 16_777_216 }),
      EXTRACTION_TIMEOUT_MS,
    );
    if (pdf.numPages < 1 || pdf.numPages > MAX_PAGES) return null;
    const extracted = await withTimeout(
      extractText(pdf, { mergePages: true }),
      EXTRACTION_TIMEOUT_MS,
    );
    if (typeof extracted.text !== "string") return null;
    return selectStageRelevantEvidence(extracted.text, planningQuestion);
  } catch {
    return null;
  } finally {
    if (pdf) {
      const destroy = (pdf as unknown as { destroy?: () => Promise<void> }).destroy;
      if (typeof destroy === "function") {
        await destroy.call(pdf).catch(() => undefined);
      }
    }
  }
}
