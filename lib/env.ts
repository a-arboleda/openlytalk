import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_TURN_MODEL: z.string().trim().min(1).default("gpt-5.4-mini"),
  OPENAI_TRANSCRIPTION_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("gpt-4o-mini-transcribe"),
  OPENAI_TTS_MODEL: z.string().trim().min(1).default("tts-1"),
  OPENAI_TTS_VOICE: z.string().trim().min(1).default("nova"),
  OPENAI_PRACTICE_FAST_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("gpt-5.6-luna"),
  OPENAI_PRACTICE_REFLECTION_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("gpt-5.6-terra"),
  OPENAI_PRACTICE_TRANSCRIPTION_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("gpt-4o-mini-transcribe"),
  OPENAI_PRACTICE_SPEECH_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("gpt-4o-mini-tts-2025-12-15"),
  OPENAI_PRACTICE_COACH_VOICE: z
    .string()
    .trim()
    .min(1)
    .default("cedar"),
  OPENAI_PRACTICE_PARTNER_VOICE: z
    .string()
    .trim()
    .min(1)
    .default("marin"),
  ELEVENLABS_API_KEY: z.string().trim().min(1).optional(),
  ELEVENLABS_PARTNER_VOICE_ID: z
    .string()
    .trim()
    .min(1)
    .default("DODLEQrClDo8wCz460ld"),
  ELEVENLABS_PARTNER_MASCULINE_VOICE_ID: z
    .string()
    .trim()
    .min(1)
    .default("pNInz6obpgDQGcFmaJgB"),
  ELEVENLABS_TTS_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("eleven_flash_v2_5"),
  ELEVENLABS_OUTPUT_FORMAT: z
    .literal("mp3_44100_128")
    .default("mp3_44100_128"),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_MIGRATION_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse(source);
}
