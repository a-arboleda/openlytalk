import { createStorySchema, publicStory } from "@/lib/story-practice/contracts";
import { createStory } from "@/lib/story-practice/engine";
import { getStoryRepository } from "@/lib/story-practice/repository";
import { checkOrigin, storyFailure, storyJson } from "@/lib/story-practice/route-utils";
import { getOrCreateAnonymousRouteSession } from "@/lib/session/route-session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = createStorySchema.parse(await request.json());
    const owner = await getOrCreateAnonymousRouteSession();
    return storyJson({ session: publicStory(await createStory(getStoryRepository(), owner.id, input)) }, 201);
  } catch (error) { return storyFailure(error); }
}
