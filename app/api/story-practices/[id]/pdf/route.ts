import { publicStory } from "@/lib/story-practice/contracts";
import { requireStory, StoryError } from "@/lib/story-practice/engine";
import { createPracticePdf } from "@/lib/story-practice/pdf";
import { getStoryRepository } from "@/lib/story-practice/repository";
import { privateHeaders, storyOwner, storyFailure } from "@/lib/story-practice/route-utils";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const owner = await storyOwner(id);
    const state = await requireStory(getStoryRepository(), id, owner);
    if (state.status !== "completed") throw new StoryError(409, "Complete your practice before downloading your feedback.");
    const pdf = await createPracticePdf(publicStory(state));
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="openlytalk-practice.pdf"',
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return storyFailure(error); }
}
