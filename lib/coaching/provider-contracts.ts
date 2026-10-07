import type {
  FinalSessionTakeaway,
  HelpType,
  PracticeEvidenceEvent,
  PracticeMessage,
  PracticeSessionState,
  PracticeSetup,
} from "@/lib/coaching/schemas";
import type {
  SpeechFormat,
  SpeechResult,
  TranscriptionProvider,
} from "@/lib/providers/contracts";

export interface GeneratePracticePlanRequest {
  setup: PracticeSetup;
  repairAttempt: boolean;
  practiceFormat?: "single_prompt" | "conversation_simulation";
  scenarioVariation: {
    seed: string;
    recentlyUsedSituations: string[];
  };
}

export interface InferPracticeSetupRequest {
  background: string;
  goal: string;
  repairAttempt: boolean;
}

export interface GeneratePartnerTurnRequest {
  state: PracticeSessionState;
  learnerMessage: PracticeMessage;
  repairAttempt: boolean;
}

export interface GenerateCoachingBreakRequest {
  state: PracticeSessionState;
  acceptedLearnerMessage: PracticeMessage;
  partnerMessage: PracticeMessage | null;
  evidenceEvents: PracticeEvidenceEvent[];
  repairAttempt: boolean;
}

export interface GeneratePracticeHelpRequest {
  state: PracticeSessionState;
  type: HelpType;
  currentPartnerMessageId: string | null;
  repairAttempt: boolean;
}

export interface GeneratePracticeTakeawayRequest {
  state: PracticeSessionState;
  kind: FinalSessionTakeaway["kind"];
  repairAttempt: boolean;
}

/**
 * Model results stay unknown until the coaching orchestrator validates them
 * with the canonical Zod schemas. Provider adapters may use their own prompt
 * assemblers, but they cannot control phase transitions or persistence.
 */
export interface PracticeModel {
  inferSetup(request: InferPracticeSetupRequest): Promise<unknown>;
  generatePlan(request: GeneratePracticePlanRequest): Promise<unknown>;
  generatePartnerTurn(
    request: GeneratePartnerTurnRequest,
  ): Promise<unknown>;
  generateCoachingBreak(
    request: GenerateCoachingBreakRequest,
  ): Promise<unknown>;
  generateHelp(request: GeneratePracticeHelpRequest): Promise<unknown>;
  generateTakeaway(
    request: GeneratePracticeTakeawayRequest,
  ): Promise<unknown>;
}

export const PRACTICE_SPEECH_ROLES = ["coach", "partner"] as const;
export type PracticeSpeechRole = (typeof PRACTICE_SPEECH_ROLES)[number];

export const PARTNER_VOICE_PROFILES = [
  "neutral",
  "masculine",
  "feminine",
] as const;
export type PartnerVoiceProfile = (typeof PARTNER_VOICE_PROFILES)[number];

export interface PracticeSpeechRequest {
  speechId: string;
  text: string;
  role: PracticeSpeechRole;
  voiceProfile?: PartnerVoiceProfile;
  format: SpeechFormat;
}

/**
 * Voice selection is deliberately provider-owned. The caller selects a stable
 * product role and, for simulation partners, a bounded voice profile—never a
 * vendor-specific voice name.
 */
export interface PracticeSpeechProvider {
  synthesize(request: PracticeSpeechRequest): Promise<SpeechResult>;
}

/**
 * The existing transcription boundary already satisfies the coaching flow:
 * English-only input and request-scoped audio with no retention.
 */
export type PracticeTranscriptionProvider = TranscriptionProvider;
