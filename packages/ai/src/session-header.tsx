"use client";

import type { ComponentProps } from "react";
import { forwardRef } from "react";
import { Folder, Sparkles } from "lucide-react";
import { BrandLogo } from "@elabs-ai/components-icons";
import {
  Button,
  cn,
  Heading,
  Kbd,
  useLocale,
  type HeadingLevel,
  type SessionCapability,
  type SessionQuickAction,
  type SessionWhatsNewItem,
} from "@elabs-ai/components-ui";

// `SessionCapability`, `SessionWhatsNewItem` and `SessionQuickAction` moved
// to `@elabs-ai/components-ui` (`lib/session-launch.ts`) — the terminal CLI
// look-alike family's own session header (issue #117) reuses the same
// vocabulary shape, and `@elabs-ai/components-ai`/
// `@elabs-ai/components-terminal` are layer-2 DAG siblings that may not
// import each other (T0; see
// docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4). Imported
// above; NOT re-exported from here — a consumer imports these from
// `@elabs-ai/components-ui`.

export interface SessionHeaderProps extends ComponentProps<"div"> {
  /**
   * Session/agent name, e.g. "Codex". Anchors the card — every other section
   * is independently optional and renders nothing when omitted.
   */
  title?: string;
  /** Active model, e.g. "gpt-5.1-codex". */
  model?: string;
  /** Working directory / project path. Truncates instead of overflowing. */
  workspace?: string;
  /** Build/version string, e.g. "v2.4.0". */
  version?: string;
  /** What this session can reach. */
  capabilities?: SessionCapability[];
  /** Recent changes, shown as a short list. */
  whatsNew?: SessionWhatsNewItem[];
  /** Shortcut actions, rendered as real buttons with optional shortcut hints. */
  quickActions?: SessionQuickAction[];
  /**
   * Semantic heading level for `title`. Default `2` (a session header
   * typically sits above a `ChatGreeting`'s level-1 headline, or inside a
   * page that already owns its own `<h1>`).
   */
  level?: HeadingLevel;
}

/**
 * SessionHeader — the launch card for an empty agent session: model,
 * workspace, version, capabilities, what's new, and quick actions with
 * shortcut hints. Pair it above `ChatGreeting` (or inside `ChatShell`'s
 * `header` slot) for the standard first-run agent session state.
 *
 * Distinct from `ChatGreeting`, which is the centered display-scale greeting
 * for a general assistant chat — `SessionHeader` answers different questions
 * (what workspace am I in, what model, what can this thing reach, what
 * changed) that a greeting has no home for.
 *
 * **Every section is independently optional.** With only `title` supplied,
 * the card renders the identity row alone — no empty section scaffolding,
 * no stray separators.
 */
export const SessionHeader = forwardRef<HTMLDivElement, SessionHeaderProps>(function SessionHeader(
  {
    title,
    model,
    workspace,
    version,
    capabilities,
    whatsNew,
    quickActions,
    level = 2,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const hasMeta = model != null || version != null;
  const hasIdentity = title != null || hasMeta || workspace != null;
  const hasCapabilities = (capabilities?.length ?? 0) > 0;
  const hasWhatsNew = (whatsNew?.length ?? 0) > 0;
  const hasQuickActions = (quickActions?.length ?? 0) > 0;

  return (
    <div
      ref={ref}
      data-slot="session-header"
      className={cn(
        "min-w-0 rounded-xl border bg-card p-5 text-card-foreground shadow-xs",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {hasIdentity ? (
          <div data-slot="session-header-identity" className="flex min-w-0 flex-col gap-1">
            {title != null ? (
              <div className="flex min-w-0 items-center gap-2">
                {/* Decorative — the visible Heading already carries the
                    accessible name, so the mark is hidden from AT rather than
                    announced a second time via BrandLogo's own `role="img"`. */}
                <span aria-hidden="true" className="shrink-0">
                  <BrandLogo variant="mark" height={24} title={title} />
                </span>
                <Heading
                  data-slot="session-header-title"
                  level={level}
                  size="subtitle"
                  className="min-w-0 truncate"
                >
                  {title}
                </Heading>
              </div>
            ) : null}

            {hasMeta ? (
              <p
                data-slot="session-header-meta"
                className="min-w-0 truncate text-meta text-muted-foreground"
              >
                {model}
                {model != null && version != null ? " · " : null}
                {version}
              </p>
            ) : null}

            {workspace != null ? (
              <div
                data-slot="session-header-workspace"
                className="flex min-w-0 items-center gap-1.5 text-body text-muted-foreground"
              >
                <Folder aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{workspace}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {hasCapabilities ? (
          <div data-slot="session-header-capabilities" className="flex min-w-0 flex-col gap-2">
            <p className="text-meta font-medium text-muted-foreground">
              {t("ai.sessionHeader.capabilities")}
            </p>
            <ul className="flex min-w-0 flex-col gap-2">
              {capabilities?.map((capability) => (
                <li
                  key={capability.label}
                  data-slot="session-header-capability"
                  className="flex min-w-0 items-start gap-2"
                >
                  {capability.icon != null ? (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-4"
                    >
                      {capability.icon}
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <p className="min-w-0 truncate text-body text-foreground">{capability.label}</p>
                    {capability.description != null ? (
                      <p className="min-w-0 truncate text-meta text-muted-foreground">
                        {capability.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasWhatsNew ? (
          <div data-slot="session-header-whats-new" className="flex min-w-0 flex-col gap-2">
            <p className="flex items-center gap-1.5 text-meta font-medium text-muted-foreground">
              <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
              {t("ai.sessionHeader.whatsNew")}
            </p>
            <ul className="flex min-w-0 flex-col gap-1">
              {whatsNew?.map((item) => (
                <li
                  key={item.label}
                  data-slot="session-header-whats-new-item"
                  className="min-w-0 truncate text-body"
                >
                  {item.href != null ? (
                    <a
                      href={item.href}
                      className="text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className="text-foreground">{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hasQuickActions ? (
          <div
            data-slot="session-header-quick-actions"
            role="group"
            aria-label={t("ai.sessionHeader.quickActions")}
            className="flex min-w-0 flex-wrap gap-2"
          >
            {quickActions?.map((action) => (
              <Button
                key={action.label}
                type="button"
                data-slot="session-header-quick-action"
                variant="outline"
                size="sm"
                onClick={action.onSelect}
              >
                <span>{action.label}</span>
                {/* An explicit space text node (not just flex `gap-2`) keeps
                    "New chat"/"⌘N" apart in the button's computed accessible
                    name, not only its visual layout. */}
                {action.keyHint != null ? (
                  <>
                    {" "}
                    <Kbd>{action.keyHint}</Kbd>
                  </>
                ) : null}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});
