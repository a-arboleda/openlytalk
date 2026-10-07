"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PracticeSetup } from "@/components/selection/practice-setup";
import {
  practiceApiErrorSchema,
  practiceSessionResponseSchema,
} from "@/lib/coaching/public-contracts";
import type { PracticeSetup as PracticeSetupValue } from "@/lib/coaching/schemas";
import {
  PRACTICE_SETUP_DRAFT_KEY,
  parsePracticeSetupDraft,
  serializePracticeSetupDraft,
} from "@/lib/coaching/setup-draft";

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function PracticeSetupLauncher({
  restoreLatest = false,
}: {
  restoreLatest?: boolean;
}) {
  const router = useRouter();
  const [restoredSetup, setRestoredSetup] = useState<
    PracticeSetupValue | null | undefined
  >(restoreLatest ? undefined : null);

  useEffect(() => {
    if (!restoreLatest) return;

    const timeoutId = window.setTimeout(() => {
      let draft: PracticeSetupValue | null = null;
      try {
        draft = parsePracticeSetupDraft(
          window.sessionStorage.getItem(PRACTICE_SETUP_DRAFT_KEY),
        );
        window.sessionStorage.removeItem(PRACTICE_SETUP_DRAFT_KEY);
      } catch {
        // Browsers may disable session storage. A fresh setup is still usable.
      }
      setRestoredSetup(draft);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [restoreLatest]);

  async function createPractice(setup: PracticeSetupValue) {
    const response = await fetch("/api/practice-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(setup),
    });
    const body = await responseBody(response);

    if (!response.ok) {
      const error = practiceApiErrorSchema.safeParse(body);
      throw new Error(
        error.success
          ? error.data.error.message
          : "We could not create your practice. Please try again.",
      );
    }

    const result = practiceSessionResponseSchema.safeParse(body);
    if (!result.success) {
      throw new Error(
        "Your practice was created, but we could not open it. Please try again.",
      );
    }

    try {
      window.sessionStorage.setItem(
        PRACTICE_SETUP_DRAFT_KEY,
        serializePracticeSetupDraft(setup),
      );
    } catch {
      // Do not block a successfully created practice if storage is unavailable.
    }

    router.push(
      `/practice/${encodeURIComponent(
        result.data.session.practiceSessionId,
      )}`,
    );
  }

  if (restoredSetup === undefined) {
    return (
      <div
        className="flex min-h-[60dvh] items-center justify-center"
        role="status"
      >
        <span className="text-sm font-medium text-stone-500">
          Opening your setup…
        </span>
      </div>
    );
  }

  return (
    <PracticeSetup
      initialSetup={restoredSetup ?? undefined}
      initialStep={restoredSetup ? 6 : 1}
      onCreate={createPractice}
    />
  );
}
