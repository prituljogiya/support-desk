"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ONBOARDING_STEPS,
  onboardingComplete,
  type OnboardingState,
} from "@/lib/onboarding";

export function OnboardingChecklist({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [completed, setCompleted] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/org/onboarding");
    const data = await res.json();
    if (res.ok) {
      setState(data.state);
      setCompleted(Boolean(data.completed));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function dismiss() {
    await fetch("/api/org/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissed: true }),
    });
    setCompleted(true);
  }

  async function mark(key: keyof OnboardingState) {
    await fetch("/api/org/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: true }),
    });
    await load();
  }

  if (!state || completed || onboardingComplete(state)) return null;

  const doneCount = ONBOARDING_STEPS.filter((s) => state[s.key]).length;

  return (
    <div
      className={`rounded-2xl border border-teal-200 bg-teal-50/80 ${compact ? "p-4" : "p-5"} shadow-sm`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Getting started
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {doneCount}/{ONBOARDING_STEPS.length} complete — invite team, brand
            the portal, then open your first ticket.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void dismiss()}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          Dismiss
        </button>
      </div>
      <ol className="mt-4 space-y-3">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = state[step.key];
          return (
            <li
              key={step.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white bg-white px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    done
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <div>
                  <div className="font-medium text-slate-900">{step.title}</div>
                  <p className="text-sm text-slate-500">{step.body}</p>
                </div>
              </div>
              {!done ? (
                <div className="flex gap-2">
                  <Link
                    href={step.href}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    {step.cta}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void mark(step.key)}
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                  >
                    Mark done
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
