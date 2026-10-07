import type { PartnerVoiceProfile } from "@/lib/coaching/provider-contracts";

const MASCULINE_RELATIONSHIPS = [
  "boyfriend",
  "husband",
  "father",
  "dad",
  "brother",
  "son",
  "uncle",
  "grandfather",
  "grandpa",
] as const;

const FEMININE_RELATIONSHIPS = [
  "girlfriend",
  "wife",
  "mother",
  "mom",
  "sister",
  "daughter",
  "aunt",
  "grandmother",
  "grandma",
] as const;

function includesRelationship(
  text: string,
  relationships: readonly string[],
): boolean {
  const normalized = text.trim().toLowerCase();
  return relationships.some((relationship) =>
    new RegExp(`\\b${relationship}\\b`, "u").test(normalized),
  );
}

function explicitVoiceProfile(text: string): PartnerVoiceProfile {
  const masculine = includesRelationship(text, MASCULINE_RELATIONSHIPS);
  const feminine = includesRelationship(text, FEMININE_RELATIONSHIPS);
  if (masculine === feminine) return "neutral";
  return masculine ? "masculine" : "feminine";
}

export function partnerVoiceProfile(
  roleLabel: string,
  explicitRelationshipContext: readonly string[] = [],
): PartnerVoiceProfile {
  const roleProfile = explicitVoiceProfile(roleLabel);
  return roleProfile === "neutral"
    ? explicitVoiceProfile(explicitRelationshipContext.join(" "))
    : roleProfile;
}
