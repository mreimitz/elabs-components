const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const TEN_SECONDS = 10;

/**
 * Human-readable elapsed time — one formatter for every "how long did this take"
 * surface in the system: `TurnStatus`'s running turn (#105), `ChangeReview`'s check
 * rows (#112), `AgentEvent`'s hook durations (#109).
 *
 * Exported so a consumer's own elapsed-time surfaces agree with ours.
 * Adapted from `brainless`'s turn-status elapsed formatter (MIT, see `ATTRIBUTION.md`).
 *
 * Rungs: sub-second → "420ms" · under ten seconds → "8.0s" · under a minute → "45s" ·
 * beyond → "2m05s".
 */
export function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < MS_PER_SECOND) {
    return `${Math.round(elapsedMs)}ms`;
  }

  const totalSeconds = elapsedMs / MS_PER_SECOND;

  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${totalSeconds.toFixed(totalSeconds < TEN_SECONDS ? 1 : 0)}s`;
  }

  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = Math.round(totalSeconds % SECONDS_PER_MINUTE);
  return `${minutes}m${String(seconds).padStart(2, "0")}s`;
}
