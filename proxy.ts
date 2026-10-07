import { NextResponse, type NextRequest } from "next/server";
import { enforceRequestLimit, needsRequestLimit, RateLimitExceeded } from "@/lib/operations/rate-limit";
import { MAX_AUDIO_REQUEST_BYTES } from "@/lib/audio/limits";

// Covers retained paid routes too, so they cannot bypass the public beta limits.
export async function proxy(request: NextRequest) {
  if (!needsRequestLimit(request.method, request.nextUrl.pathname)) return NextResponse.next();
  const headers = { "Cache-Control": "no-store, private" };
  if (Number(request.headers.get("content-length")) > MAX_AUDIO_REQUEST_BYTES) {
    return NextResponse.json({ error: { message: "That request is too large." } }, { status: 413, headers });
  }
  try {
    await enforceRequestLimit(request);
    return NextResponse.next();
  } catch (error) {
    if (error instanceof RateLimitExceeded) {
      const minutes = Math.max(1, Math.ceil(error.retryAfter / 60));
      return NextResponse.json({ error: { code: "rate_limited", message: `Please wait about ${minutes} minute${minutes === 1 ? "" : "s"} before trying again. Your recording stays in this tab.`, retryable: true } }, {
        status: 429, headers: { ...headers, "Retry-After": String(error.retryAfter) },
      });
    }
    // Fail closed: never proceed to paid providers without working protection.
    return NextResponse.json({ error: { code: "temporarily_unavailable", message: "Practice is temporarily unavailable. Please try again.", retryable: true } }, { status: 503, headers });
  }
}

export const config = { matcher: "/api/:path*" };
