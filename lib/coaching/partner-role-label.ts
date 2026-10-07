const PERSONAL_RELATIONSHIP_ROLE =
  /\b(?:brother|classmate|client|colleague|cousin|coworker|father|family member|friend|manager|mother|neighbor|parent|partner|relative|sibling|sister|supervisor|team lead|teammate)\b/i;

const DEFINITE_ROLE = /^(?:interviewer|recruiter)\b/i;

/**
 * Turns a terse generated role label into a natural phrase for headings while
 * preserving an explicit determiner supplied by the validated plan.
 */
export function partnerRolePhrase(roleLabel: string): string {
  const normalized = roleLabel.trim().replace(/\s+/g, " ").toLowerCase();
  if (/^(?:your|the|a|an)\b/.test(normalized)) return normalized;
  if (PERSONAL_RELATIONSHIP_ROLE.test(normalized)) {
    return `your ${normalized}`;
  }
  if (DEFINITE_ROLE.test(normalized)) return `the ${normalized}`;
  const article = /^[aeiou]/.test(normalized) ? "an" : "a";
  return `${article} ${normalized}`;
}
