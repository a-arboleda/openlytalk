import type {
  PracticeSpeechProvider,
  PracticeSpeechRequest,
  PracticeSpeechRole,
} from "@/lib/coaching/provider-contracts";
import type { SpeechResult } from "@/lib/providers/contracts";

export class RoleBasedPracticeSpeechProvider
  implements PracticeSpeechProvider
{
  constructor(
    private readonly providers: Record<
      PracticeSpeechRole,
      PracticeSpeechProvider
    >,
  ) {}

  synthesize(request: PracticeSpeechRequest): Promise<SpeechResult> {
    return this.providers[request.role].synthesize(request);
  }
}
