import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import {
  coachingBreakSchema,
  continuousFinalSessionTakeawaySchema,
  generatedPracticePlanSchema,
  helpResponseSchema,
  inferredPracticeSetupSchema,
  partnerTurnOutputSchema,
  retryFinalSessionTakeawaySchema,
} from "@/lib/coaching/schemas";
import {
  type GenerateCoachingBreakRequest,
  type GeneratePartnerTurnRequest,
  type InferPracticeSetupRequest,
  type GeneratePracticeHelpRequest,
  type GeneratePracticePlanRequest,
  type GeneratePracticeTakeawayRequest,
  type PracticeModel,
} from "@/lib/coaching/provider-contracts";
import {
  type PracticeProviderConfig,
  type PracticeTextStage,
} from "@/lib/coaching/provider-config";
import { buildCoachingBreakPrompt } from "@/prompts/coaching/coaching-break";
import { buildFinalTakeawayPrompt } from "@/prompts/coaching/final-takeaway";
import { buildPartnerTurnPrompt } from "@/prompts/coaching/partner-turn";
import { buildPracticeHelpPrompt } from "@/prompts/coaching/practice-help";
import { buildPracticePlanPrompt } from "@/prompts/coaching/practice-plan";
import { buildPracticeSetupPrompt } from "@/prompts/coaching/practice-setup";
import type { StructuredPrompt } from "@/prompts/coaching/shared";

const MAX_OUTPUT_TOKENS = {
  setupInference: 900,
  plan: 3_200,
  partnerTurn: 1_400,
  coachingBreak: 1_800,
  help: 700,
  takeaway: 2_400,
} as const satisfies Record<PracticeTextStage, number>;

const OUTPUT_NAMES = {
  setupInference: "openlytalk_practice_setup",
  plan: "openlytalk_practice_plan",
  partnerTurn: "openlytalk_partner_turn",
  coachingBreak: "openlytalk_coaching_break",
  help: "openlytalk_practice_help",
  takeaway: "openlytalk_final_takeaway",
} as const satisfies Record<PracticeTextStage, string>;

export class OpenAIPracticeModel implements PracticeModel {
  constructor(
    private readonly client: OpenAI,
    private readonly config: PracticeProviderConfig,
  ) {}

  private async generateStructured<Schema extends z.ZodType>(
    stage: PracticeTextStage,
    prompt: StructuredPrompt,
    schema: Schema,
  ): Promise<unknown> {
    const stageConfig = this.config.responses.stages[stage];
    const response = await this.client.responses.parse({
      model: stageConfig.model,
      instructions: prompt.instructions,
      input: prompt.input,
      reasoning: { effort: stageConfig.reasoningEffort },
      max_output_tokens: MAX_OUTPUT_TOKENS[stage],
      store: this.config.responses.store,
      text: {
        format: zodTextFormat(schema, OUTPUT_NAMES[stage]),
        verbosity: this.config.responses.verbosity,
      },
    });

    return response.output_parsed;
  }

  inferSetup(request: InferPracticeSetupRequest): Promise<unknown> {
    return this.generateStructured(
      "setupInference",
      buildPracticeSetupPrompt(request),
      inferredPracticeSetupSchema,
    );
  }

  generatePlan(request: GeneratePracticePlanRequest): Promise<unknown> {
    return this.generateStructured(
      "plan",
      buildPracticePlanPrompt(request),
      generatedPracticePlanSchema,
    );
  }

  generatePartnerTurn(
    request: GeneratePartnerTurnRequest,
  ): Promise<unknown> {
    return this.generateStructured(
      "partnerTurn",
      buildPartnerTurnPrompt(request),
      partnerTurnOutputSchema,
    );
  }

  generateCoachingBreak(
    request: GenerateCoachingBreakRequest,
  ): Promise<unknown> {
    return this.generateStructured(
      "coachingBreak",
      buildCoachingBreakPrompt(request),
      coachingBreakSchema,
    );
  }

  generateHelp(request: GeneratePracticeHelpRequest): Promise<unknown> {
    return this.generateStructured(
      "help",
      buildPracticeHelpPrompt(request),
      helpResponseSchema,
    );
  }

  generateTakeaway(
    request: GeneratePracticeTakeawayRequest,
  ): Promise<unknown> {
    return this.generateStructured(
      "takeaway",
      buildFinalTakeawayPrompt(request),
      request.state.responseLimit < COACHING_BETA_RULES.maxAcceptedResponses
        ? continuousFinalSessionTakeawaySchema
        : retryFinalSessionTakeawaySchema,
    );
  }
}
