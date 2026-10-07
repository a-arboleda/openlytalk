import { AudioRequestTooLarge } from "@/lib/audio/request";
import { COACHING_BETA_RULES } from "@/lib/coaching/product-rules";
import { cookies } from "next/headers";
import { z } from "zod";
import { AudioValidationError } from "@/lib/audio/recording";
import { ANONYMOUS_SESSION_COOKIE_NAME } from "@/lib/session/anonymous-session";
import { StoryError } from "@/lib/story-practice/engine";
export const privateHeaders = { "Cache-Control": "no-store, private" };
export function storyJson(value: unknown, status = 200) { return Response.json(value, { status, headers: privateHeaders }); }
export async function storyOwner(id: string) {
  const owner = (await cookies()).get(ANONYMOUS_SESSION_COOKIE_NAME)?.value;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(owner).success) throw new StoryError(404, "This practice is no longer available.");
  return owner!;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new StoryError(403, "Please open Practice on this website.");
}
export function storyFailure(error: unknown) {
  if (error instanceof AudioRequestTooLarge) return storyJson({ error: { message: "That recording is too large. Please record it again." } }, 413);
  if (error instanceof StoryError) return storyJson({ error: { message: error.message } }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return storyJson({ error: { message: "Check your request and try again." } }, 400);
  if (error instanceof AudioValidationError) return storyJson({ error: { message: `Record a clear response in English, up to ${COACHING_BETA_RULES.maxRecordingSeconds} seconds.` } }, 422);
  return storyJson({ error: { message: "Practice is temporarily unavailable. Please try again." } }, 503);
}
