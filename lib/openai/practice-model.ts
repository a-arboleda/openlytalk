import "server-only";

import OpenAI from "openai";

import { getPracticeProviderConfig } from "@/lib/coaching/provider-config";
import { parseServerEnv } from "@/lib/env";
import { OpenAIPracticeModel } from "@/lib/openai/openai-practice-model";

let practiceModel: OpenAIPracticeModel | undefined;

export function getPracticeModel(): OpenAIPracticeModel {
  if (practiceModel) return practiceModel;

  const { OPENAI_API_KEY } = parseServerEnv();
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required for adaptive practice sessions.",
    );
  }

  practiceModel = new OpenAIPracticeModel(
    new OpenAI({ apiKey: OPENAI_API_KEY }),
    getPracticeProviderConfig(),
  );
  return practiceModel;
}
