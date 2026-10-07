import { publicStory } from "@/lib/story-practice/contracts";
import { actOnStory, requireStory } from "@/lib/story-practice/engine";
import { getStoryRepository } from "@/lib/story-practice/repository";
import { checkOrigin, storyOwner, storyFailure, storyJson } from "@/lib/story-practice/route-utils";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    return storyJson({ session: publicStory(await requireStory(getStoryRepository(), id, await storyOwner(id))) });
  } catch (error) { return storyFailure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    const owner = await storyOwner(id);
    return storyJson({ session: publicStory(await actOnStory(getStoryRepository(), id, owner, await request.json())) });
  } catch (error) { return storyFailure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    await getStoryRepository().delete(id, await storyOwner(id));
    return storyJson({ deleted: true });
  } catch (error) { return storyFailure(error); }
}
