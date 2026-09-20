// registry: auth-parts — copied 2026-09-19
"use client";

import { useState } from "react";

/** What a submit handler may answer: nothing (it worked) or the message to show. */
export type AuthSubmitResult = string | void | Promise<string | void>;

/**
 * The submit lifecycle every auth form shares: pending while the handler runs, the handler's
 * message as the form error, and `done` once it answered with nothing.
 */
export function useAuthSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run(handler: (() => AuthSubmitResult) | undefined) {
    setError(null);
    setPending(true);
    try {
      const message = await handler?.();
      if (message) setError(message);
      else setDone(true);
    } catch {
      setError("Something went wrong on our side. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  return { pending, error, done, run, reset: () => setDone(false) };
}
