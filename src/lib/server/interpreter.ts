import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  Interpretation,
  InterpretationSchema,
  MatterOpeningRecord,
  OpeningStep,
  WorkflowState,
  WORKFLOW_VERSION,
} from "@/lib/domain/matter-opening";
import { getCanonicalQuestion } from "@/lib/domain/workflow";
import { interpretSyntheticTurn } from "./synthetic-interpreter";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.6-sol";

export async function interpretMatterOpeningTurn(args: {
  step: OpeningStep;
  answer: string;
  record: MatterOpeningRecord;
  state: WorkflowState;
}): Promise<Interpretation> {
  if (process.env.EC_SYNTHETIC_TEST_MODE === "true") {
    return interpretSyntheticTurn(
      args.step,
      args.answer,
      args.record,
      args.state,
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for conversational interpretation.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const question = getCanonicalQuestion(args.state, args.record);
  const input = [
    {
      role: "system" as const,
      content: `You are the interpretation component for the Estate Coordinator Matter Opening workflow ${WORKFLOW_VERSION}. Interpret only the student's answer to the current approved question. Propose structured updates; do not decide workflow progression, write data, provide legal or tax conclusions, invent missing facts, or ask more than one clarification question. Preserve unknown, not decided, and not applicable. Use null for every patch field not directly supported by the answer. Contact email and phone fields are structured but must never be repeated in the acknowledgement. A death, incapacity, suspected coercion or exploitation, uncertain authority, imminent consequential deadline, or comparable mandatory-stop condition must set stop.triggered. proposed_next_step is advisory only and is ignored by the application.`,
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        current_step: args.step,
        approved_question: question,
        answer: args.answer,
        confirmed_record: args.record,
        workflow_state: args.state,
      }),
    },
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.responses.parse({
        model: MODEL,
        reasoning: { effort: "xhigh" },
        store: false,
        input,
        text: {
          format: zodTextFormat(
            InterpretationSchema,
            "matter_opening_interpretation",
          ),
        },
      });
      if (!response.output_parsed) {
        throw new Error("The model did not return a structured interpretation.");
      }
      return InterpretationSchema.parse(response.output_parsed);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error("The response could not be interpreted safely.", {
    cause: lastError,
  });
}
