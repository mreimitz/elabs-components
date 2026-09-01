"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Kbd,
  cn,
  type OperatingMode,
} from "@elabs-ai/components-ui";

import { PromptInputButton } from "./prompt-input";

// `OperatingMode` moved to `@elabs-ai/components-ui` (`lib/operating-mode.ts`)
// — the terminal CLI look-alike family's own composer chips (issue #117) reuse
// the same vocabulary shape, and `@elabs-ai/components-ai`/
// `@elabs-ai/components-terminal` are layer-2 DAG siblings that may not import
// each other (T0; see
// docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Imported
// above; NOT re-exported from here — `@elabs-ai/components-ai` never
// re-exports from `@elabs-ai/components-ui`. A consumer imports
// `OperatingMode` from `@elabs-ai/components-ui`.

export type PromptInputModeProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  /** The app's own operating modes, low to high ceremony or however it orders them. */
  modes: OperatingMode[];
  /** Controlled selected mode id. Omit for the uncontrolled default (`modes[0]`). */
  value?: string;
  /** Fires with the chosen mode's id. */
  onValueChange?: (id: string) => void;
  /**
   * Accessible name for the trigger control, read alongside the current
   * mode's label. Optional — the trigger already carries the current mode's
   * visible text as its name, so this only adds context (e.g. "Operating
   * mode: Auto" instead of just "Auto").
   */
  "aria-label"?: string;
};

/**
 * PromptInputMode — a composer control for an app-defined operating mode
 * (how autonomously the agent may act on the next turn).
 *
 * A `DropdownMenu` of `modes`, radio-selected so exactly one is active at a
 * time; the trigger shows the current mode's icon + label. Ships no mode
 * vocabulary — `modes` is entirely prop-driven, so `auto`/`plan`/whatever a
 * given agent calls its modes lives in the consuming app, not here.
 *
 * Built on Radix (`DropdownMenu` + `DropdownMenuRadioGroup`/`RadioItem` from
 * `@elabs-ai/components-ui`) for keyboard navigation, roving focus and a
 * `menuitemradio` role whose `aria-checked` announces the current selection —
 * no hand-rolled key handling.
 */
export const PromptInputMode = forwardRef<HTMLDivElement, PromptInputModeProps>(
  function PromptInputMode(
    { modes, value, onValueChange, className, "aria-label": ariaLabel, ...props },
    ref,
  ) {
    const [selected, setSelected] = useControllableState<string>({
      defaultProp: modes[0]?.id ?? "",
      onChange: onValueChange,
      prop: value,
    });

    const handleChange = (next: string) => {
      // Radix would otherwise allow an empty-string commit if a caller wires
      // a deselectable radio group elsewhere — a mode picker always has an
      // active mode, so an empty commit is ignored.
      if (!next) return;
      setSelected(next);
    };

    const current = modes.find((mode) => mode.id === selected) ?? modes[0];

    return (
      <div
        ref={ref}
        data-slot="prompt-input-mode"
        className={cn("inline-flex", className)}
        {...props}
      >
        {/*
         * `modal={false}` is load-bearing, not a preference. Radix's modal
         * dropdown marks the rest of the document `aria-hidden` while the menu
         * is open — including this component's own trigger — which axe flags as
         * `aria-hidden-focus` ("ARIA hidden element must not be focusable")
         * and which drops the trigger out of the accessibility tree entirely.
         * A composer toolbar chip has no business hiding the page or locking
         * its scroll, so the non-modal layer is both the accessible answer and
         * the semantically correct one.
         */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <PromptInputButton
              variant="ghost"
              className="gap-1.5 rounded-full"
              disabled={modes.length === 0}
              aria-label={
                ariaLabel && current ? `${ariaLabel}: ${current.label}` : (ariaLabel ?? undefined)
              }
              data-slot="prompt-input-mode-trigger"
            >
              {current?.icon}
              <span>{current?.label}</span>
              <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
            </PromptInputButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" data-slot="prompt-input-mode-content" className="w-72">
            <DropdownMenuRadioGroup value={selected} onValueChange={handleChange}>
              {modes.map((mode) => (
                <DropdownMenuRadioItem
                  key={mode.id}
                  value={mode.id}
                  data-slot="prompt-input-mode-item"
                  className="gap-2"
                >
                  {mode.icon}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body">{mode.label}</span>
                    {mode.description === undefined ? null : (
                      <span className="truncate text-meta text-muted-foreground">
                        {mode.description}
                      </span>
                    )}
                  </span>
                  {mode.keyHint === undefined ? null : (
                    <Kbd className="shrink-0">{mode.keyHint}</Kbd>
                  )}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  },
);
