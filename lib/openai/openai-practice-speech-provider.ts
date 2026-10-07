import OpenAI from "openai";

import type {
  PracticeProviderConfig,
} from "@/lib/coaching/provider-config";
import type {
  PracticeSpeechProvider,
  PracticeSpeechRequest,
} from "@/lib/coaching/provider-contracts";
import type { SpeechResult } from "@/lib/providers/contracts";

export class OpenAIPracticeSpeechProvider
  implements PracticeSpeechProvider
{
  constructor(
    private readonly client: OpenAI,
    private readonly config: PracticeProviderConfig["speech"],
  ) {}

  async synthesize(
    request: PracticeSpeechRequest,
  ): Promise<SpeechResult> {
    const role = this.config.roles[request.role];
    const response = await this.client.audio.speech.create({
      model: this.config.model,
      voice: role.voice,
      input: request.text,
      instructions: role.instructions,
      response_format: request.format,
    });
    const audio = new Uint8Array(await response.arrayBuffer());

    return {
      audio,
      contentType:
        request.format === "wav" ? "audio/wav" : "audio/mpeg",
    };
  }
}
