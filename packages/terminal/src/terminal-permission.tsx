"use client";

import {
  APPROVAL_SCOPE_DESCRIPTION_KEYS,
  Collapsible,
  CollapsibleContent,
  Kbd,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  useLocale,
  type ApprovalOption,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useId, useMemo, useState } from "react";
import { TerminalRow } from "./terminal-row";
import { TerminalSurface, useTerminalVariant, type TerminalVariant } from "./terminal-surface";

/**
 * TerminalPermission — the per-call scoped approval prompt for the
 * agent-session family (#117, work unit T10).
 *
 * Before an agent does something consequential, the person sees exactly what
 * it wants to run and answers with a SCOPE — just this once, for the rest of
 * this session, or not at all — using only the keyboard. This is the
 * console skin of the same interaction `ApprovalCardOptions` renders for the
 * chat surface (`@elabs-ai/components-ai`'s `confirmation.tsx`, #103); both
 * are built on the SAME promoted, vendor-free model — `ApprovalScope` /
 * `ApprovalOption` / `APPROVAL_SCOPE_DESCRIPTION_KEYS`, all
 * `@elabs-ai/components-ui` — rather than two copies that structurally agree
 * today and drift tomorrow, because `@elabs-ai/components-terminal` and
 * `@elabs-ai/components-ai` are layer-2 DAG siblings that may not import
 * each other (`.claude/rules/terminal-components.md` § Reuse means
 * promotion).
 *
 * **Derived from:** `claude-permission.tsx`, Claude Code v2.1.207 — see
 * `packages/terminal/references/agent-session-family.md` for the full
 * checked/diverges note. Ground truth, verified live against the upstream
 * source on 2026-09-01: the anatomy is title → command preview → question →
 * numbered options, with NO footer; the default title is "Bash command",
 * the default question is "Do you want to proceed?"; the three scoped
 * options read verbatim "Yes", "Yes, and don't ask again this session", and
 * a third that declines and redirects the agent; the active option carries
 * a `❯` glyph.
 *
 * ## Where this diverges from upstream (by design, not oversight)
 *
 * - **No vendor name.** The upstream third option names its own product in
 *   the label; ours reads "…tell the agent what to do differently" — the
 *   vendor-free `ApprovalScope` vocabulary (`once` / `session` / `deny`),
 *   never a product name (#117 acceptance criterion).
 * - **Roving focus is a real Radix `RadioGroup`, never a `parentElement
 *   .children[i]` walk.** Upstream's own radiogroup moves focus by walking
 *   the parent container's children — the exact anti-pattern this whole
 *   component family exists to improve on (`.claude/rules/terminal-
 *   components.md`, the fidelity axis's "Focus" row).
 * - **The `❯` glyph is decorative, never the accessible channel.** The
 *   checked option is already announced through the native radio's
 *   `aria-checked`, and its scope is stated in the option's own LABEL TEXT
 *   — colour and glyph never carry the meaning alone (WCAG 1.4.1). The
 *   glyph only reinforces, in greyscale, what the radio's filled/empty
 *   circle already shows.
 * - **The reason field is CONDITIONAL, not always-visible.**
 *   `ApprovalCardOptions`' sibling part `ApprovalCardReason` is a single
 *   field that sits beside every scope; here it only reveals — through
 *   Radix `Collapsible`, never `<details>` or a manual show/hide — once the
 *   `deny`-scoped option is the one selected, because only that option
 *   redirects the agent and needs an explanation of what to do instead.
 *   Choosing it fires `onConfirm` immediately (matching
 *   `ApprovalCardOptions` — there is no separate highlight-vs-commit step);
 *   editing the reason afterward fires `onConfirm` again with the latest
 *   text, since the field did not exist yet at the moment of selection.
 *
 * ## `boxed` frames the PROMPT as one block, not three (cross-theme sweep fix)
 *
 * A browser sweep of `terminal-terminalpermission--boxed` found the title,
 * the command preview and the question each drawing their OWN
 * `border-terminal-border` box — three disconnected frames for what is
 * conceptually one sentence — while the options list already read
 * correctly, as one shared frame with internal hairlines. That inversion is
 * the "redundant border" case `.claude/rules/styling-and-tokens.md` § Surface
 * separation names: every row independently applying its own hairline on the
 * same ground, rather than the dialog owning one outer frame. The options
 * list is unchanged (it is the reviewer's own reference for "correct"); the
 * fix scopes to the title/preview/question group only:
 *
 * - `promptRowVariant` forces those three rows to `"marker"` (no border, the
 *   row's default) whenever the EFFECTIVE variant — `variant` prop, or the
 *   ambient `TerminalSurface` context via `useTerminalVariant()` when the
 *   prop is omitted — resolves to `"boxed"`. `"rail"` is left untouched: its
 *   vertical rule down the shared gutter track was never the reported bug.
 * - The three rows are wrapped in one `terminal-permission-prompt` container
 *   that draws the SINGLE outer frame instead — the same
 *   `rounded-md border-terminal-border` weight the option rows already use,
 *   so the two groups (prompt, options) read as one matched visual language,
 *   only one frame per conceptual block. Outside `boxed` the wrapper adds no
 *   border and keeps the exact prior spacing, so `marker`/`rail` are
 *   byte-for-byte unchanged.
 *
 * ## What this is not
 *
 * A presentation-only decision surface (D5): it reports the chosen
 * `ApprovalOption` (plus any typed reason) through `onConfirm` and owns no
 * transport of its own — the caller decides what happens with the answer.
 */

export interface TerminalPermissionProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "title"
> {
  /** @default the localized "Bash command" */
  title?: ReactNode;
  /**
   * What will actually run — a command string today, a diff hunk tomorrow.
   * Arbitrary content: never typed as a string. Omitted, no preview row
   * renders.
   */
  preview?: ReactNode;
  /** @default the localized "Do you want to proceed?" */
  question?: ReactNode;
  /**
   * The scoped choices. Defaults to the three verbatim upstream options —
   * "Yes" (`once`), "Yes, and don't ask again this session" (`session`),
   * and the vendor-free decline-and-redirect option (`deny`).
   */
  options?: ApprovalOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /**
   * Fires when an option is chosen — by click or by ANY keyboard move
   * within the radio group (arrow keys/Home/End select immediately, per
   * the native/ARIA radiogroup pattern Radix implements, matching
   * `ApprovalCardOptions` — there is no separate highlight-vs-commit step)
   * — and again on every edit of the reason field while a `deny`-scoped
   * option is selected, so the caller always has the latest pair.
   */
  onConfirm?: (option: ApprovalOption, reason?: string) => void;
  /** Controlled text for the deny scope's optional "what to do instead" explanation. */
  reason?: string;
  defaultReason?: string;
  onReasonChange?: (reason: string) => void;
  reasonPlaceholder?: string;
  /**
   * Gutter grammar for every row this prompt renders. Omitted, it inherits
   * the surrounding `TerminalSurface`; passed, it overrides it — the same
   * override contract `TerminalRow` itself exposes.
   */
  variant?: TerminalVariant;
}

/** The active-option cursor, verified live against Claude Code v2.1.207. Decorative only — see the module doc. */
const ACTIVE_OPTION_GLYPH = "❯";

export const TerminalPermission = forwardRef<HTMLDivElement, TerminalPermissionProps>(
  function TerminalPermission(
    {
      title,
      preview,
      question,
      options,
      value,
      defaultValue,
      onValueChange,
      onConfirm,
      reason,
      defaultReason,
      onReasonChange,
      reasonPlaceholder,
      variant,
      className,
      dir,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const baseId = useId();
    const titleId = `${baseId}-title`;
    const reasonId = `${baseId}-reason`;

    // The EFFECTIVE gutter grammar — `variant` prop if set, else whatever the
    // surrounding `TerminalSurface` published — mirrors exactly what each
    // `TerminalRow` below would resolve on its own (`variant ?? inherited`).
    // TerminalPermission needs this value itself (not just its rows) to
    // decide whether the prompt group draws its own single frame. See the
    // module doc, "`boxed` frames the PROMPT as one block, not three".
    const inheritedVariant = useTerminalVariant();
    const resolvedVariant = variant ?? inheritedVariant;
    const isBoxed = resolvedVariant === "boxed";
    // Force the title/preview/question rows to the borderless row grammar
    // whenever the dialog is boxed, so they stop drawing three independent
    // frames — `terminal-permission-prompt` below draws the one frame
    // instead. `"rail"` and `"marker"` pass straight through unchanged.
    const promptRowVariant: TerminalVariant | undefined = isBoxed ? "marker" : variant;

    const [uncontrolledReason, setUncontrolledReason] = useState(defaultReason ?? "");
    const reasonValue = reason ?? uncontrolledReason;

    // Translated at render time (never baked at module scope) so a
    // consumer's own `LocaleProvider` messages/`translate` resolver reaches
    // every default label, exactly like `TerminalTodoList`'s state words.
    const defaultOptions = useMemo<ApprovalOption[]>(
      () => [
        { id: "once", label: t("terminal.permission.optionOnce"), scope: "once", keyHint: "1" },
        {
          id: "session",
          label: t("terminal.permission.optionSession"),
          scope: "session",
          keyHint: "2",
        },
        { id: "deny", label: t("terminal.permission.optionDeny"), scope: "deny", keyHint: "3" },
      ],
      [t],
    );
    const resolvedOptions = options ?? defaultOptions;

    // Controlled/uncontrolled mirrors the platform, exactly like
    // `ApprovalCardOptions`/`PermissionModeSelect`: `uncontrolledId` is our
    // OWN bookkeeping for deciding when to reveal the reason field, never
    // fed back into `RadioGroup`'s own `value` prop below — that stays
    // exactly `value` (or `undefined`), so Radix's controllable-state hook
    // never sees a spurious uncontrolled-to-controlled transition.
    const [uncontrolledId, setUncontrolledId] = useState<string | undefined>(
      value ?? defaultValue ?? resolvedOptions[0]?.id,
    );
    const selectedId = value ?? uncontrolledId;
    const selectedOption = resolvedOptions.find((option) => option.id === selectedId);
    const showReason = selectedOption?.scope === "deny";

    const handleValueChange = (id: string) => {
      setUncontrolledId(id);
      onValueChange?.(id);
      const option = resolvedOptions.find((candidate) => candidate.id === id);
      if (option) {
        onConfirm?.(
          option,
          option.scope === "deny" && reasonValue.trim() ? reasonValue : undefined,
        );
      }
    };

    const handleReasonChange = (next: string) => {
      setUncontrolledReason(next);
      onReasonChange?.(next);
      if (selectedOption?.scope === "deny") {
        onConfirm?.(selectedOption, next.trim() ? next : undefined);
      }
    };

    return (
      <TerminalSurface
        ref={ref}
        dir={dir}
        variant={variant}
        role="group"
        aria-labelledby={titleId}
        data-slot="terminal-permission"
        className={cn("gap-2", className)}
        {...props}
      >
        <div
          data-slot="terminal-permission-prompt"
          data-variant={resolvedVariant}
          className={cn(
            "flex flex-col",
            // Only `boxed` needs a wrapper frame at all — `marker`/`rail`
            // keep the exact prior spacing (the original top-level `gap-2`),
            // so those two variants render byte-for-byte unchanged.
            isBoxed ? "gap-1 rounded-md border border-terminal-border p-2" : "gap-2",
          )}
        >
          <TerminalRow variant={promptRowVariant} data-slot="terminal-permission-title">
            <span id={titleId} className="font-semibold">
              {title ?? t("terminal.permission.title")}
            </span>
          </TerminalRow>

          {preview !== undefined ? (
            <TerminalRow variant={promptRowVariant} data-slot="terminal-permission-preview">
              {preview}
            </TerminalRow>
          ) : null}

          <TerminalRow variant={promptRowVariant} data-slot="terminal-permission-question">
            {question ?? t("terminal.permission.question")}
          </TerminalRow>
        </div>

        <RadioGroup
          // `dir` on a plain <div> is a free-form HTML string; Radix's
          // RadioGroup narrows it to "ltr" | "rtl". Cast at this single call
          // site, matching `ApprovalCardOptions`/`PermissionModeSelect`,
          // rather than widening (and so weakening) the public prop type.
          dir={dir as "ltr" | "rtl" | undefined}
          defaultValue={defaultValue ?? resolvedOptions[0]?.id}
          value={value}
          onValueChange={handleValueChange}
          aria-labelledby={titleId}
          data-slot="terminal-permission-options"
          className="grid gap-0.5"
        >
          {resolvedOptions.map((option) => {
            const itemId = `${baseId}-${option.id}`;
            const descriptionId = `${itemId}-description`;
            const isChecked = option.id === selectedId;
            const description =
              option.description ?? t(APPROVAL_SCOPE_DESCRIPTION_KEYS[option.scope]);

            return (
              <TerminalRow
                key={option.id}
                variant={variant}
                data-slot="terminal-permission-option"
                data-scope={option.scope}
                // Decorative only (`TerminalRow` hides a bare gutter glyph
                // from assistive tech) — the checked state itself reaches a
                // screen reader through the radio's own `aria-checked`.
                gutter={isChecked ? ACTIVE_OPTION_GLYPH : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      aria-describedby={descriptionId}
                      id={itemId}
                      data-slot="terminal-permission-option-input"
                      value={option.id}
                    />
                    <Label
                      htmlFor={itemId}
                      data-slot="terminal-permission-option-label"
                      className="text-code font-mono font-normal text-terminal-foreground"
                    >
                      {option.label}
                    </Label>
                  </div>
                  {/*
                   * A sibling of the Label, never a child of it — a key hint
                   * INSIDE the label would join the control's accessible
                   * name ("Yes 1" instead of "Yes"), exactly like
                   * `PermissionModeSelect`'s own `keyHint` placement.
                   */}
                  {option.keyHint ? (
                    <Kbd data-slot="terminal-permission-option-key-hint">{option.keyHint}</Kbd>
                  ) : null}
                </div>
                <p
                  id={descriptionId}
                  data-slot="terminal-permission-option-description"
                  className="ps-6 text-meta text-terminal-muted"
                >
                  {description}
                </p>
                {option.scope === "deny" ? (
                  <Collapsible open={showReason} data-slot="terminal-permission-reason">
                    <CollapsibleContent>
                      <div className="grid gap-1.5 py-2 ps-6">
                        <Label
                          htmlFor={reasonId}
                          data-slot="terminal-permission-reason-label"
                          className="text-meta text-terminal-muted"
                        >
                          {t("ai.approvalCard.reasonLabel")}
                        </Label>
                        <Textarea
                          id={reasonId}
                          value={reasonValue}
                          onChange={(event) => handleReasonChange(event.target.value)}
                          placeholder={reasonPlaceholder ?? t("ai.approvalCard.reasonPlaceholder")}
                          data-slot="terminal-permission-reason-input"
                          // `Textarea` paints its OWN opaque `bg-background` box — an
                          // ordinary app surface, not the terminal ground — so the
                          // ambient `text-terminal-foreground` (light ink tuned for the
                          // dark terminal ground) must be overridden with the ordinary
                          // app ink here, or it renders as near-invisible light-on-light
                          // (caught live in Chromium: axe measured 1.2:1, see
                          // terminal-components.md § "the app's status ink tokens do not
                          // hold here").
                          className="min-h-16 text-code font-mono text-foreground"
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </TerminalRow>
            );
          })}
        </RadioGroup>
      </TerminalSurface>
    );
  },
);

TerminalPermission.displayName = "TerminalPermission";
