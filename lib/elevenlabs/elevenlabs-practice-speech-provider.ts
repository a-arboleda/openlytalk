import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import type { PracticeProviderConfig } from "@/lib/coaching/provider-config";
import type {
  PracticeSpeechProvider,
  PracticeSpeechRequest,
} from "@/lib/coaching/provider-contracts";
import type { SpeechResult } from "@/lib/providers/contracts";

type ElevenLabsTextToSpeechClient = Pick<ElevenLabsClient, "textToSpeech">;

async function readAudioStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    byteLength += value.byteLength;
  }

  const audio = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return audio;
}

export class ElevenLabsPracticeSpeechProvider
  implements PracticeSpeechProvider
{
  constructor(
    private readonly client: ElevenLabsTextToSpeechClient,
    private readonly config: PracticeProviderConfig["speech"]["elevenLabsPartner"],
  ) {}

  async synthesize(
    request: PracticeSpeechRequest,
  ): Promise<SpeechResult> {
    if (request.role !== "partner") {
      throw new Error("ElevenLabs practice speech is limited to partner audio.");
    }
    if (request.format !== "mp3") {
      throw new Error("ElevenLabs partner speech currently supports MP3 only.");
    }

    const voiceId =
      request.voiceProfile === "masculine"
        ? this.config.masculineVoiceId
        : this.config.defaultVoiceId;
    const stream = await this.client.textToSpeech.convert(
      voiceId,
      {
        text: request.text,
        modelId: this.config.model,
        outputFormat: this.config.outputFormat,
        languageCode: "en",
      },
    );

    return {
      audio: await readAudioStream(stream),
      contentType: "audio/mpeg",
    };
  }
}
