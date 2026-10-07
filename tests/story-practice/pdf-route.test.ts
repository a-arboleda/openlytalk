import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportFixture } from "@/tests/helpers/story-report";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), require: vi.fn(), pdf: vi.fn(), repo: {} }));
vi.mock("@/lib/story-practice/route-utils", () => ({
  privateHeaders: { "Cache-Control": "no-store, private" }, storyOwner: mocks.owner,
  storyFailure: (e: { status?: number }) => new Response(null, { status: e.status ?? 503 }),
}));
vi.mock("@/lib/story-practice/engine", () => ({
  requireStory: mocks.require,
  StoryError: class extends Error { constructor(readonly status: number, message: string) { super(message); } },
}));
vi.mock("@/lib/story-practice/repository", () => ({ getStoryRepository: () => mocks.repo }));
vi.mock("@/lib/story-practice/contracts", () => ({ publicStory: (s: unknown) => s }));
vi.mock("@/lib/story-practice/pdf", () => ({ createPracticePdf: mocks.pdf }));
import { GET } from "@/app/api/story-practices/[id]/pdf/route";
const context = { params: Promise.resolve({ id: reportFixture().id }) };
describe("private PDF download", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.owner.mockResolvedValue("owner"); mocks.require.mockResolvedValue(reportFixture()); mocks.pdf.mockResolvedValue(Buffer.from("%PDF-sample")); });
  it("checks ownership before generating a private attachment", async () => {
    const response = await GET(new Request("https://example.com/pdf"), context);
    expect(response.status).toBe(200);
    expect(mocks.require).toHaveBeenCalledWith(mocks.repo, reportFixture().id, "owner");
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
  });
  it("does not generate a report for a missing owner", async () => {
    mocks.owner.mockRejectedValue({ status: 404 });
    expect((await GET(new Request("https://example.com/pdf"), context)).status).toBe(404);
    expect(mocks.require).not.toHaveBeenCalled(); expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it("does not export expired, deleted or another owner's sessions", async () => {
    mocks.require.mockRejectedValue({ status: 404 });
    expect((await GET(new Request("https://example.com/pdf"), context)).status).toBe(404);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
  it("does not export unfinished sessions", async () => {
    mocks.require.mockResolvedValue({ ...reportFixture(), status: "active" });
    expect((await GET(new Request("https://example.com/pdf"), context)).status).toBe(409);
    expect(mocks.pdf).not.toHaveBeenCalled();
  });
});
