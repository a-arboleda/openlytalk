import type {
  ConversationState,
  TranscriptMessage,
} from "@/lib/validation/conversation";
import type { Debrief } from "@/lib/validation/debrief";

export interface TranscriptionRequest {
  audio: Uint8Array;
  mimeType: string;
  language: "en";
  filename: string;
}

export interface TranscriptionResult {
  text: string;
  detectedLanguage: string | null;
}

/**
 * Implementations must not retain the supplied audio after the request ends.
 */
export interface TranscriptionProvider {
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export interface GenerateTurnRequest {
  state: ConversationState;
  learnerMessage: TranscriptMessage;
  repairAttempt: boolean;
}

export interface GenerateDebriefRequest {
  state: ConversationState;
  kind: Debrief["kind"];
}

/**
 * Structured generation results remain unknown until the orchestrator validates
 * them with the canonical runtime schemas. The concrete adapter may use a
 * separate prompt assembler without coupling orchestration to provider SDKs.
 */
export interface ConversationModel {
  generateTurn(request: GenerateTurnRequest): Promise<unknown>;
  generateDebrief(request: GenerateDebriefRequest): Promise<unknown>;
}

export const SPEECH_FORMATS = ["mp3", "wav"] as const;
export type SpeechFormat = (typeof SPEECH_FORMATS)[number];

export interface SpeechRequest {
  messageId: string;
  text: string;
  voice: "sofia";
  format: SpeechFormat;
}

export interface SpeechResult {
  audio: Uint8Array;
  contentType: "audio/mpeg" | "audio/wav";
}

/**
 * Speech bytes are response-scoped and must never be written to persistence.
 */
export interface SpeechProvider {
  synthesize(request: SpeechRequest): Promise<SpeechResult>;
}
