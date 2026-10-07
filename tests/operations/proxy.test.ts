import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { enforceRequestLimit, RateLimitExceeded } from "@/lib/operations/rate-limit";
vi.mock("@/lib/operations/rate-limit", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/operations/rate-limit")>();
  return { ...original, enforceRequestLimit: vi.fn() };
});
beforeEach(() => { vi.mocked(enforceRequestLimit).mockReset(); });
describe("API admission", () => {
  it("returns Retry-After instead of forwarding a limited request", async () => {
    vi.mocked(enforceRequestLimit).mockRejectedValue(new RateLimitExceeded(30));
    const response = await proxy(new NextRequest("https://example.com/api/story-practices/id/audio", { method: "POST" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });
  it("fails closed on database/configuration failure", async () => {
    vi.mocked(enforceRequestLimit).mockRejectedValue(new Error("private database details"));
    const response = await proxy(new NextRequest("https://example.com/api/episodes", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database details");
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });
  it("keeps deletion and read access available while rate limited", async () => {
    vi.mocked(enforceRequestLimit).mockRejectedValue(new RateLimitExceeded(30));
    for (const method of ["GET", "DELETE"]) {
      const response = await proxy(new NextRequest("https://example.com/api/story-practices/id", { method }));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
    expect(enforceRequestLimit).not.toHaveBeenCalled();
  });
});
