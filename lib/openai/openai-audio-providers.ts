import OpenAI, { toFile } from "openai";

import type {
  SpeechProvider,
  SpeechRequest,
  SpeechResult,
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
} from "@/lib/providers/contracts";

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const file = await toFile(request.audio, request.filename, {
      type: request.mimeType,
    });
    const result = await this.client.audio.transcriptions.create({
      file,
      model: this.model,
      language: request.language,
      response_format: "json",
    });

    return {
      text: result.text,
      detectedLanguage: null,
    };
  }
}

export class OpenAISpeechProvider implements SpeechProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly sofiaVoice: string,
  ) {}

  async synthesize(request: SpeechRequest): Promise<SpeechResult> {
    const response = await this.client.audio.speech.create({
      model: this.model,
      voice: this.sofiaVoice,
      input: request.text,
      response_format: request.format,
    });
    const audio = new Uint8Array(await response.arrayBuffer());

    return {
      audio,
      contentType: request.format === "wav" ? "audio/wav" : "audio/mpeg",
    };
  }
}
