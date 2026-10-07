import { parseServerEnv } from "@/lib/env";

export const PRACTICE_TEXT_STAGES = [
  "setupInference",
  "plan",
  "partnerTurn",
  "coachingBreak",
  "help",
  "takeaway",
] as const;

export type PracticeTextStage = (typeof PRACTICE_TEXT_STAGES)[number];
export type PracticeReasoningEffort = "none" | "low";

export interface PracticeProviderConfig {
  responses: {
    store: false;
    verbosity: "low";
    stages: Record<
      PracticeTextStage,
      {
        model: string;
        reasoningEffort: PracticeReasoningEffort;
      }
    >;
  };
  transcription: {
    model: string;
    language: "en";
  };
  speech: {
    model: string;
    format: "mp3";
    elevenLabsPartner: {
      model: string;
      defaultVoiceId: string;
      masculineVoiceId: string;
      outputFormat: "mp3_44100_128";
    };
    roles: {
      coach: {
        voice: string;
        instructions: string;
        autoplay: false;
      };
      partner: {
        voice: string;
        instructions: string;
        autoplay: true;
      };
    };
  };
}

export function getPracticeProviderConfig(
  source: Record<string, string | undefined> = process.env,
): PracticeProviderConfig {
  const env = parseServerEnv(source);

  return {
    responses: {
      store: false,
      verbosity: "low",
      stages: {
        setupInference: {
          model: env.OPENAI_PRACTICE_FAST_MODEL,
          reasoningEffort: "none",
        },
        plan: {
          model: env.OPENAI_PRACTICE_FAST_MODEL,
          reasoningEffort: "none",
        },
        partnerTurn: {
          model: env.OPENAI_PRACTICE_FAST_MODEL,
          reasoningEffort: "none",
        },
        coachingBreak: {
          model: env.OPENAI_PRACTICE_REFLECTION_MODEL,
          reasoningEffort: "low",
        },
        help: {
          model: env.OPENAI_PRACTICE_FAST_MODEL,
          reasoningEffort: "none",
        },
        takeaway: {
          model: env.OPENAI_PRACTICE_REFLECTION_MODEL,
          reasoningEffort: "low",
        },
      },
    },
    transcription: {
      model: env.OPENAI_PRACTICE_TRANSCRIPTION_MODEL,
      language: "en",
    },
    speech: {
      model: env.OPENAI_PRACTICE_SPEECH_MODEL,
      format: "mp3",
      elevenLabsPartner: {
        model: env.ELEVENLABS_TTS_MODEL,
        defaultVoiceId: env.ELEVENLABS_PARTNER_VOICE_ID,
        masculineVoiceId: env.ELEVENLABS_PARTNER_MASCULINE_VOICE_ID,
        outputFormat: env.ELEVENLABS_OUTPUT_FORMAT,
      },
      roles: {
        coach: {
          voice: env.OPENAI_PRACTICE_COACH_VOICE,
          instructions:
            "Speak warmly, calmly, and clearly. Sound supportive, concise, and grounded, not theatrical or overly cheerful.",
          autoplay: false,
        },
        partner: {
          voice: env.OPENAI_PRACTICE_PARTNER_VOICE,
          instructions:
            "Speak naturally in clear conversational English at a comfortable pace. Stay in role and sound like a real person, not a teacher or announcer.",
          autoplay: true,
        },
      },
    },
  };
}
