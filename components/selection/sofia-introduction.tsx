"use client";

import { useState } from "react";

export function SofiaIntroduction() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 max-w-lg">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="sofia-introduction"
        onClick={() => setOpen((current) => !current)}
        className="group flex min-h-12 items-center gap-3 rounded-full border border-stone-200 bg-white py-1.5 pl-1.5 pr-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-emerald-700"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800"
        >
          S
        </span>
        <span className="font-semibold text-stone-900">Meet Sofia</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`ml-1 size-4 text-stone-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          id="sofia-introduction"
          className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-sm leading-6 text-stone-700"
        >
          Sofia is a warm, thoughtful 32-year-old Colombian-American restaurant
          manager in Chicago. She spent two years working in cafés and
          restaurants abroad before returning home, and now she is quietly
          wondering what she wants to build next. She talks with you like a
          familiar friend—kind, curious, honest, and not afraid to disagree.
        </div>
      ) : null}
    </div>
  );
}
