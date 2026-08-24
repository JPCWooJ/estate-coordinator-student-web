import { z } from "zod";

export const GeneratedResponseOperationSchema = z.enum([
  "matter_opening_interpretation",
  "planning_summary_correction",
  "blueprint_answer_interpretation",
  "blueprint_recommendation",
  "blueprint_recommendation_response",
  "blueprint_evidence_treatment",
  "final_review_correction",
]);
export type GeneratedResponseOperation = z.infer<
  typeof GeneratedResponseOperationSchema
>;

export const GeneratedResponseMetadataSchema = z.object({
  operation: GeneratedResponseOperationSchema,
  configured_model: z.string().min(1),
  returned_model: z.string().min(1),
  response_id: z.string().min(1),
});
export type GeneratedResponseMetadata = z.infer<
  typeof GeneratedResponseMetadataSchema
>;

export type WithGeneratedResponse<T> = T & {
  generation_metadata?: GeneratedResponseMetadata;
};

export function generatedResponseMetadata(
  value: unknown,
): GeneratedResponseMetadata | null {
  if (!value || typeof value !== "object" || !("generation_metadata" in value)) {
    return null;
  }
  const parsed = GeneratedResponseMetadataSchema.safeParse(
    value.generation_metadata,
  );
  return parsed.success ? parsed.data : null;
}

export function appendGeneratedResponse<
  T extends { generated_responses?: GeneratedResponseMetadata[] },
>(value: T, metadata: GeneratedResponseMetadata | null | undefined): T {
  if (!metadata) return value;
  return {
    ...value,
    generated_responses: [...(value.generated_responses ?? []), metadata],
  };
}
