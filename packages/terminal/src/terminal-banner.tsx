"use client";

import type { ComponentProps, ReactNode } from "react";
import { forwardRef, useId } from "react";
import {
  Button,
  Heading,
  Kbd,
  useLocale,
  type HeadingLevel,
  type SessionCapability,
  type SessionQuickAction,
  type SessionWhatsNewItem,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { TerminalRow } from "./terminal-row";
import { TerminalSurface, type TerminalVariant } from "./terminal-surface";

// `SessionCapability`, `SessionWhatsNewItem` and `SessionQuickAction` live in
// `@elabs-ai/components-ui` (`lib/session-launch.ts`) — `@elabs-ai/components-ai`'s
// `SessionHeader` (the chat-skin sibling) and this banner both reuse that one
// vocabulary rather than each declaring their own. `@elabs-ai/components-ai`
// and `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not
// import each other (`.claude/rules/terminal-components.md` § Reuse means
// promotion). Imported above; NOT re-exported — a consumer imports these
// three types from `@elabs-ai/components-ui`.

/**
 * TerminalBanner — the console-dress launch card that sits above an empty
 * transcript (#117 T7).
 *
 * Someone opening a fresh agent session should see, without asking, what
 * they are talking to, where it is pointed, what it can do for them, and how
 * to start. Every section is independently optional, so a banner given only
 * `title` still reads as a deliberate card, never a broken one.
 *
 * ## Ground truth, and what we deliberately did not take (verified 2026-09-01)
 *
 * The upstream launch cards this reproduces the GRAMMAR of share one anatomy
 * — a fact block (version/user/model/workspace), a tips list, a what's-new
 * list, then menu rows carrying key hints — but two of their mechanisms are
 * out of bounds for this family (`.claude/rules/terminal-components.md`, the
 * fidelity axis):
 *
 * - **No `<fieldset>`/`<legend>`.** Upstream sits the title in the border via
 *   a form-control grouping element, which misreports a decorative heading
 *   as a form to assistive tech. This renders a real heading
 *   (`{@link Heading}`) beside a real `border` — never a form element doing
 *   layout's job.
 * - **No vendor bitmap logo.** We ship no vendor mark, name or vocabulary in
 *   any public type (#117 acceptance criterion). `logo` is a plain
 *   caller-supplied slot; the component has no default of its own.
 *
 * ## Reuse, and where this deliberately differs from `SessionHeader`
 *
 * `title`/`model`/`workspace`/`version`/`capabilities`/`whatsNew`/
 * `quickActions`/`level` mirror `@elabs-ai/components-ai`'s `SessionHeader`
 * prop-for-prop, so a consumer swapping chat chrome for console chrome
 * renames nothing. Three things differ, each for a reason specific to this
 * package rather than a stylistic preference:
 *
 * - **No `BrandLogo` import.** `SessionHeader` renders a fixed brand mark;
 *   this takes `logo?: ReactNode` instead (see above) and never imports
 *   `@elabs-ai/components-icons` for one.
 * - **`workspace` wraps instead of truncating.** The fidelity axis prefers
 *   "wrap, clamp" over "truncate at the column" for long content — wrapping
 *   also trivially keeps the full value reachable, with no tooltip needed.
 * - **`quickActions` render as full-width menu rows on `TerminalRow`, not
 *   outlined chip buttons.** That is the literal grammar the ground truth
 *   names ("menu rows carrying key hints"), and it lets every row share the
 *   same gutter/content grid every other line in this family uses.
 *
 * ## Built from the family's own primitives, not a bespoke card
 *
 * The root is a `{@link TerminalSurface}` (ground, mono role, gutter grid,
 * `variant` context) — not a hand-rolled bordered `div` — so this banner
 * never drifts from the console ground every other component in the package
 * shares. Every list row is a `{@link TerminalRow}`, so alignment, the
 * gutter's `aria-hidden` default, and the `min-w-0`/`minmax(0,1fr)` wrapping
 * behaviour all come for free.
 */

/** Decorative gutter glyph for a capability with no caller-supplied icon. */
const CAPABILITY_GLYPH = "-";
/** Decorative gutter glyph for a what's-new entry. */
const WHATS_NEW_GLYPH = "*";
/** Decorative gutter glyph for a quick action — the shell prompt convention. */
const QUICK_ACTION_GLYPH = ">";

export interface TerminalBannerProps extends ComponentProps<"div"> {
  /**
   * Session/agent name. Anchors the card — every other section is
   * independently optional and renders nothing when omitted.
   */
  title?: string;
  /** Active model, e.g. "gpt-5.1-codex". */
  model?: string;
  /** Working directory / project path. Wraps instead of truncating (see above). */
  workspace?: string;
  /** Build/version string, e.g. "v2.4.0". */
  version?: string;
  /** What this session can reach. */
  capabilities?: SessionCapability[];
  /** Recent changes, shown as a short list. */
  whatsNew?: SessionWhatsNewItem[];
  /** Shortcut actions, rendered as real menu-row buttons with optional key hints. */
  quickActions?: SessionQuickAction[];
  /**
   * A caller-supplied mark, rendered beside `title`. This package ships no
   * vendor logo of its own — bring your own `ReactNode`, or omit it.
   */
  logo?: ReactNode;
  /**
   * Gutter grammar for the banner's internal rows. Omitted, they inherit the
   * surrounding `TerminalSurface`; passed, it overrides it for this banner —
   * the same override contract `TerminalRow` itself exposes.
   */
  variant?: TerminalVariant;
  /**
   * Semantic heading level for `title`. Default `2` (a banner typically sits
   * above a transcript inside a page that already owns its own `<h1>`).
   */
  level?: HeadingLevel;
}

export const TerminalBanner = forwardRef<HTMLDivElement, TerminalBannerProps>(
  function TerminalBanner(
    {
      title,
      model,
      workspace,
      version,
      capabilities,
      whatsNew,
      quickActions,
      logo,
      variant,
      level = 2,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const capabilitiesLabelId = useId();
    const whatsNewLabelId = useId();

    const hasMeta = model != null || version != null;
    const hasIdentity = title != null || logo != null || hasMeta || workspace != null;
    const hasCapabilities = (capabilities?.length ?? 0) > 0;
    const hasWhatsNew = (whatsNew?.length ?? 0) > 0;
    const hasQuickActions = (quickActions?.length ?? 0) > 0;

    return (
      <TerminalSurface
        ref={ref}
        data-slot="terminal-banner"
        variant={variant}
        className={cn("gap-4", className)}
        {...props}
      >
        {hasIdentity ? (
          <div data-slot="terminal-banner-identity" className="flex min-w-0 flex-col gap-1">
            {title != null || logo != null ? (
              <div className="flex min-w-0 items-center gap-2">
                {logo != null ? (
                  <span aria-hidden="true" className="shrink-0">
                    {logo}
                  </span>
                ) : null}
                {title != null ? (
                  <Heading
                    data-slot="terminal-banner-title"
                    level={level}
                    className="min-w-0 truncate text-code font-semibold text-terminal-foreground"
                  >
                    {title}
                  </Heading>
                ) : null}
              </div>
            ) : null}

            {hasMeta ? (
              <p data-slot="terminal-banner-meta" className="min-w-0 truncate text-terminal-muted">
                {model}
                {model != null && version != null ? " · " : null}
                {version}
              </p>
            ) : null}

            {workspace != null ? (
              <p
                data-slot="terminal-banner-workspace"
                className="min-w-0 break-words text-terminal-muted"
              >
                {workspace}
              </p>
            ) : null}
          </div>
        ) : null}

        {hasCapabilities ? (
          <div data-slot="terminal-banner-capabilities" className="flex min-w-0 flex-col gap-1">
            <p id={capabilitiesLabelId} className="text-terminal-muted">
              {t("terminal.banner.capabilities")}
            </p>
            <ul
              role="list"
              aria-labelledby={capabilitiesLabelId}
              className="flex list-none min-w-0 flex-col gap-1 ps-0"
            >
              {capabilities?.map((capability) => (
                <li key={capability.label} data-slot="terminal-banner-capability">
                  <TerminalRow
                    variant={variant}
                    gutter={
                      capability.icon != null ? (
                        <span className="[&>svg]:size-3.5">{capability.icon}</span>
                      ) : (
                        CAPABILITY_GLYPH
                      )
                    }
                  >
                    <p className="min-w-0 break-words">{capability.label}</p>
                    {capability.description != null ? (
                      <p className="min-w-0 break-words text-terminal-muted">
                        {capability.description}
                      </p>
                    ) : null}
                  </TerminalRow>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasWhatsNew ? (
          <div data-slot="terminal-banner-whats-new" className="flex min-w-0 flex-col gap-1">
            <p id={whatsNewLabelId} className="text-terminal-muted">
              {t("terminal.banner.whatsNew")}
            </p>
            <ul
              role="list"
              aria-labelledby={whatsNewLabelId}
              className="flex list-none min-w-0 flex-col gap-1 ps-0"
            >
              {whatsNew?.map((item) => (
                <li key={item.label} data-slot="terminal-banner-whats-new-item">
                  <TerminalRow variant={variant} gutter={WHATS_NEW_GLYPH}>
                    {item.href != null ? (
                      <a
                        href={item.href}
                        className="min-w-0 break-words text-terminal-ansi-bright-cyan underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <span className="min-w-0 break-words">{item.label}</span>
                    )}
                  </TerminalRow>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasQuickActions ? (
          <div
            data-slot="terminal-banner-quick-actions"
            role="group"
            aria-label={t("terminal.banner.quickActions")}
            className="flex min-w-0 flex-col gap-0.5"
          >
            {quickActions?.map((action) => (
              <TerminalRow key={action.label} variant={variant} gutter={QUICK_ACTION_GLYPH}>
                <Button
                  type="button"
                  data-slot="terminal-banner-quick-action"
                  variant="ghost"
                  onClick={action.onSelect}
                  className="h-auto w-full min-w-0 justify-between gap-3 rounded-sm px-2 py-1.5 text-start hover:bg-terminal-selection hover:text-terminal-foreground"
                >
                  <span className="min-w-0 truncate">{action.label}</span>
                  {/* An explicit space text node (not just flex `gap-3`) keeps
                      "New chat"/"⌘N" apart in the button's computed accessible
                      name, not only its visual layout — mirrors SessionHeader. */}
                  {action.keyHint != null ? (
                    <>
                      {" "}
                      <Kbd>{action.keyHint}</Kbd>
                    </>
                  ) : null}
                </Button>
              </TerminalRow>
            ))}
          </div>
        ) : null}
      </TerminalSurface>
    );
  },
);

TerminalBanner.displayName = "TerminalBanner";
