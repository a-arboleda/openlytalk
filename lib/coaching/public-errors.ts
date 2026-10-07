const MAX_FIELD_ERROR_LENGTH = 200;
const MAX_ERRORS_PER_FIELD = 3;

type ValidationIssue = {
  path: PropertyKey[];
  message: string;
};

function boundedMessage(message: string): string {
  const normalized = message.trim() || "Check this value and try again.";
  return normalized.slice(0, MAX_FIELD_ERROR_LENGTH);
}

/**
 * Converts validator output into the deliberately small learner-facing error
 * contract. Validator messages can include every accepted enum value and may
 * otherwise exceed the public schema's limit.
 */
export function buildPracticeFieldErrors(
  issues: ValidationIssue[],
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    const key =
      typeof field === "string" || typeof field === "number"
        ? String(field)
        : "setup";
    const existing = errors[key] ?? [];
    if (existing.length >= MAX_ERRORS_PER_FIELD) continue;
    errors[key] = [...existing, boundedMessage(issue.message)];
  }

  return errors;
}
