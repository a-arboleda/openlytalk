import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_AUDIO_BYTES, MAX_AUDIO_REQUEST_BYTES } from "@/lib/audio/limits";
import { readAudioForm } from "@/lib/audio/request";
import { validateRecording } from "@/lib/audio/recording";
import { wavFixture } from "@/tests/helpers/audio";
import { needsRequestLimit, requestBudgets } from "@/lib/operations/rate-limit";
import { GET } from "@/app/api/cron/retention/route";

afterEach(() => vi.unstubAllEnvs());
describe("launch guards", () => {
  it("accepts a complete 60-second 24 kHz recording including multipart overhead", async () => {
    const audio = wavFixture(60, 24_000);
    expect(audio.length).toBeLessThan(MAX_AUDIO_BYTES);
    await expect(validateRecording({ audio, mimeType: "audio/wav" })).resolves.toMatchObject({ durationSeconds: 60 });
    const form = new FormData();
    form.set("audio", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "response.wav");
    form.set("transcript", "a".repeat(4000));
    const request = new Request("https://example.com/api/story-practices/id/audio", { method: "POST", body: form });
    expect((await request.clone().arrayBuffer()).byteLength).toBeLessThan(MAX_AUDIO_REQUEST_BYTES);
    expect(((await readAudioForm(request)).get("audio") as File).size).toBe(audio.length);
  });
  it("rejects oversized audio and bodies even with a false Content-Length", async () => {
    await expect(validateRecording({ audio: new Uint8Array(MAX_AUDIO_BYTES + 1), mimeType: "audio/wav" })).rejects.toMatchObject({ code: "too_large" });
    await expect(readAudioForm(new Request("https://example.com", { method: "POST", headers: { "content-length": "1" }, body: new Uint8Array(MAX_AUDIO_REQUEST_BYTES + 1) }))).rejects.toThrow();
  });
  it("covers current and retained paid routes, leaving reads, deletes and cron available", () => {
    for (const path of ["/api/story-practices", "/api/story-practices/id/audio", "/api/episodes", "/api/practice-sessions/id/turn", "/api/conversations/id/end"]) expect(needsRequestLimit("POST", path)).toBe(true);
    for (const path of ["/api/practice-sessions/id/prompt-speech", "/api/conversations/id/messages/id/speech"]) expect(needsRequestLimit("GET", path)).toBe(true);
    expect(needsRequestLimit("GET", "/api/cron/retention")).toBe(false);
    expect(needsRequestLimit("GET", "/api/story-practices/id")).toBe(false);
    expect(needsRequestLimit("DELETE", "/api/story-practices/id")).toBe(false);
  });
  it("hashes identifiers and does not trust a caller's forwarded header outside Vercel", () => {
    const env = { RATE_LIMIT_SECRET: "x".repeat(32), NODE_ENV: "test" as const };
    const request = new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "1.2.3.4" } });
    expect(requestBudgets(request, env)).toEqual(requestBudgets(new Request("https://example.com"), env));
    expect(requestBudgets(request, { ...env, VERCEL: "1" })).not.toEqual(requestBudgets(request, env));
    expect(requestBudgets(request, env).every(b => /^[a-f0-9]{64}$/.test(b.key))).toBe(true);
    expect(() => requestBudgets(request, { NODE_ENV: "test" })).toThrow();
    expect(() => requestBudgets(new Request("https://example.com"), { ...env, VERCEL: "1" })).toThrow();
  });
  it("rejects unauthorized cron requests without touching the database", async () => {
    vi.stubEnv("CRON_SECRET", "x".repeat(32));
    expect((await GET(new Request("https://example.com/api/cron/retention"))).status).toBe(401);
    expect((await GET(new Request("https://example.com/api/cron/retention", { headers: { authorization: `Bearer ${"y".repeat(32)}` } }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://example.com/api/cron/retention"))).status).toBe(503);
  });
});
