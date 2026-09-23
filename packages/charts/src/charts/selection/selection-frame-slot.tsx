"use client";

/**
 * selection-frame-slot.tsx — the `ChartFrame` ↔ chart handshake for the
 * selection toolbar (RM-145).
 *
 * `ChartFrameSelectionProvider` (mounted by `ChartFrame`) publishes a slot; a
 * framed gesture-aware chart registers its session there instead of drawing
 * its own toolbar, and `ChartFrameSelectionSlot` (in the frame's action row)
 * renders `ChartSelectionToolbar` for it. No chart registers → the slot
 * renders nothing and the frame's DOM is unchanged.
 */

import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";
import { Separator } from "@elabs-ai/components-ui";
import { ChartSelectionToolbar } from "./chart-selection-toolbar";
import {
  type ChartFrameSelectionOptions,
  FrameSelectionSlotContext,
  type FrameSelectionSlot,
} from "./selection-session-context";
import type { SelectionSession } from "./use-selection-session";

const SessionSlotContext = FrameSelectionSlotContext;

/** The registered session, shared with the slot that renders it. */
const RegisteredSessionContext = createContext<SelectionSession | null>(null);

export interface ChartFrameSelectionProviderProps {
  defaults?: ChartFrameSelectionOptions;
  /** False when the frame has no action slot to render the toolbar in. */
  hasSlot?: boolean;
  children?: ReactNode;
}

export function ChartFrameSelectionProvider({
  defaults,
  hasSlot = true,
  children,
}: ChartFrameSelectionProviderProps) {
  const [session, setSession] = useState<SelectionSession | null>(null);
  const register = useCallback((next: SelectionSession) => {
    setSession(next);
    return () => setSession((current) => (current === next ? null : current));
  }, []);
  const slot = useMemo<FrameSelectionSlot>(
    () => ({ defaults, hasSlot, register }),
    [defaults, hasSlot, register],
  );
  return (
    <SessionSlotContext value={slot}>
      <RegisteredSessionContext value={session}>{children}</RegisteredSessionContext>
    </SessionSlotContext>
  );
}

/** Resets the handshake for a subtree (the expand dialog's copy of the chart draws its own toolbar). */
export function ChartFrameSelectionReset({ children }: { children?: ReactNode }) {
  return <SessionSlotContext value={null}>{children}</SessionSlotContext>;
}

export interface ChartFrameSelectionSlotProps {
  /** True when the frame draws its own actions after the slot: a hairline then separates the two groups. */
  divider?: boolean;
}

/**
 * The toolbar of the framed chart's session, in the frame's action row;
 * `null` when none registered. It never wraps mid-toolbar — the mode toggles,
 * count and ✓ / ✕ stay one row, and a narrow header drops the whole group
 * onto its own line instead.
 */
export function ChartFrameSelectionSlot({ divider = false }: ChartFrameSelectionSlotProps) {
  const session = use(RegisteredSessionContext);
  if (!session?.enabled) return null;
  return (
    <>
      <ChartSelectionToolbar className="flex-nowrap" session={session} />
      {divider ? (
        <Separator
          className="mx-1 h-auto min-h-5 self-stretch"
          data-slot="chart-frame-selection-divider"
          orientation="vertical"
        />
      ) : null}
    </>
  );
}
