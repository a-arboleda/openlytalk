import { privateHeaders } from "@/lib/story-practice/route-utils";
// Retired endpoint: no synthesis, even for retained sessions or stale clients.
export async function POST() {
  return Response.json({ error: { message: "Questions are now text-only." } }, { status: 410, headers: privateHeaders });
}
