"use client";

import { useId, useState } from "react";

export function TechniqueExampleDisclosure({
  example,
  compact = false,
}: {
  example: string;
  compact?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const contentId = useId();

  return (
    <div
      className={
        compact
          ? "mt-4 border-t border-stone-100 pt-3"
          : "mt-5 overflow-hidden rounded-2xl bg-white"
      }
    >
      <button
        type="button"
        aria-expanded={visible}
        aria-controls={contentId}
        onClick={() => setVisible((current) => !current)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 text-left font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
          compact
            ? "rounded-xl text-xs text-stone-600 hover:text-violet-800"
            : "px-4 text-sm text-stone-700 hover:bg-emerald-50 hover:text-emerald-800"
        }`}
      >
        <span>{visible ? "Hide example" : "Show example"}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
            visible ? "rotate-180" : ""
          }`}
          fill="none"
        >
          <path
            d="m5.5 7.5 4.5 4.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {visible ? (
        <p
          id={contentId}
          className={
            compact
              ? "pb-1 text-xs leading-5 text-stone-600"
              : "border-t border-stone-100 px-4 pb-4 pt-3 text-sm leading-6 text-stone-700"
          }
        >
          “{example}”
        </p>
      ) : null}
    </div>
  );
}
