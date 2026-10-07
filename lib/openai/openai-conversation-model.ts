import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type {
  ConversationModel,
  GenerateTurnRequest,
} from "@/lib/providers/contracts";
import {
  nextTurnOutputSchema,
} from "@/lib/validation/conversation";
import { buildSofiaTurnPrompt } from "@/prompts/sofia-turn";

export class OpenAIConversationModel implements ConversationModel {
  constructor(
    private readonly client: OpenAI,
    private readonly turnModel: string,
  ) {}

  async generateTurn(request: GenerateTurnRequest): Promise<unknown> {
    const prompt = buildSofiaTurnPrompt(request);
    const response = await this.client.responses.create({
      model: this.turnModel,
      instructions: prompt.instructions,
      input: prompt.input,
      reasoning: { effort: "none" },
      max_output_tokens: 2_200,
      store: false,
      text: {
        format: zodTextFormat(nextTurnOutputSchema, "openlytalk_sofia_turn"),
        verbosity: "low",
      },
    });

    try {
      return JSON.parse(response.output_text) as unknown;
    } catch {
      return null;
    }
  }

  async generateDebrief(): Promise<unknown> {
    throw new Error("Debrief generation is not implemented in this vertical slice.");
  }
}
