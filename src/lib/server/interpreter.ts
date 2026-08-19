import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  Interpretation,
  InterpretationSchema,
  MatterOpeningRecord,
  PlanningSummaryCorrection,
  PlanningSummaryCorrectionSchema,
  WorkflowState,
} from "@/lib/domain/matter-opening";
import { syntheticModeEnabled } from "./auth";
import {
  interpretSyntheticAnswer,
  interpretSyntheticCorrection,
} from "./synthetic-interpreter";

const MODEL = "gpt-5.6";

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("The Estate Coordinator service is not configured.");
  return new OpenAI({ apiKey });
}

export async function interpretMatterOpeningAnswer(input: {
  question: string;
  answer: string;
  record: MatterOpeningRecord;
  state: WorkflowState;
}): Promise<Interpretation> {
  if (syntheticModeEnabled()) return interpretSyntheticAnswer(input);

  const response = await client().responses.parse({
    model: MODEL,
    store: false,
    input: [
      {
        role: "system",
        content:
          "You interpret one approved Estate Coordinator question. Return exactly one explicit outcome: accepted, clarification, or stop. For accepted, populate only fields supported by the current question. Accept unknown, not decided, and not applicable without forcing a different answer, preserving that answer in the supported field when applicable. For clarification, ask one concise ordinary-language question only when materially necessary and leave the patch empty. For stop, provide the category, reason, and immediate action and leave the patch empty. Do not choose workflow progression. Do not infer unsupported facts. Treat an active clarification as the question being answered.",
      },
      {
        role: "user",
        content: JSON.stringify({
          workflow_step: input.state.step,
          active_question: input.question,
          answer: input.answer,
          confirmed_record: input.record,
        }),
      },
    ],
    text: {
      format: zodTextFormat(InterpretationSchema, "matter_opening_interpretation"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The Estate Coordinator could not interpret that response.");
  }
  return response.output_parsed;
}

export async function interpretPlanningSummaryCorrection(input: {
  correction: string;
  activeQuestion: string | null;
  record: MatterOpeningRecord;
}): Promise<PlanningSummaryCorrection> {
  if (syntheticModeEnabled()) return interpretSyntheticCorrection(input);

  const response = await client().responses.parse({
    model: MODEL,
    store: false,
    input: [
      {
        role: "system",
        content:
          "Apply one constrained correction to the principal-facing Planning Summary baseline. Return accepted only when the correction is clear and supported. Populate only the baseline fields necessary for that correction and preserve every other field. When an active clarification requests context for a selected priority, populate priority_detail for that outcome. Return clarification with one concise ordinary-language question when the requested change is ambiguous. Do not set system classification, routing, confirmation, or workflow fields.",
      },
      {
        role: "user",
        content: JSON.stringify({
          active_clarification: input.activeQuestion,
          requested_correction: input.correction,
          confirmed_record: input.record,
        }),
      },
    ],
    text: {
      format: zodTextFormat(
        PlanningSummaryCorrectionSchema,
        "planning_summary_correction",
      ),
    },
  });

  if (!response.output_parsed) {
    throw new Error("The Estate Coordinator could not interpret that correction.");
  }
  return response.output_parsed;
}
