"use client";

import { Avatar, AvatarFallback, AvatarImage, Button } from "@elabs-ai/components-ui";
import { ButtonGroup, ButtonGroupText, Skeleton } from "@elabs-ai/components-ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { stripSanitizerOverrides } from "./_streamdown-safety";
import { useStreamdownPlugins, useStreamdownTranslations } from "./_streamdown-i18n";
import type { UIMessage } from "ai";
import { BotIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      // NOTE `is-user` / `is-assistant` are LOAD-BEARING, not decorative: they
      // are what `MessageContent`'s `group-[.is-user]:…` selectors compile
      // against (`.group.is-user &`). `data-role` below is their semantic twin
      // for querying/testing — don't dedupe the two, removing the class would
      // silently kill the `--chat-user` fill in every theme.
      from === "user" ? "is-user ms-auto justify-end" : "is-assistant",
      className,
    )}
    data-role={from}
    data-slot="message"
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({ children, className, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-body",
      // The user turn is the 08 fill channel: the revalued `--chat-user` tint +
      // its AA-validated foreground (research 11 §B.1 MSG-1). The assistant
      // branch stays bare — its separation is the AgentMessage rail.
      "group-[.is-user]:ms-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-chat-user group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-chat-user-foreground",
      "group-[.is-assistant]:text-foreground",
      className,
    )}
    data-slot="message-content"
    {...props}
  >
    {children}
  </div>
);

export type MessageHeaderProps = HTMLAttributes<HTMLDivElement>;

/**
 * Optional identity row above the bubble — avatar + name + timestamp
 * (research 11 §B.1 MSG-2). A slot, not baked structure.
 */
export const MessageHeader = ({ className, ...props }: MessageHeaderProps) => (
  <div
    className={cn("flex items-center gap-2 text-meta text-muted-foreground", className)}
    data-slot="message-header"
    {...props}
  />
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  /** Image source for the participant. */
  src?: string;
  /** Participant name — drives the image alt + the fallback initial, and the accessible label. */
  name?: string;
  /**
   * Visual identity role.
   * - `"user"` (default): shows the initial letter as a fallback.
   * - `"agent"`: shows a branded Bot icon on a primary (green) ground instead
   *   of a text initial, matching the agent identity convention.
   */
  role?: "user" | "agent";
};

/**
 * Thin preset over the `@elabs-ai/components-ui` Avatar sized for inline chat (NOT a new
 * avatar primitive — research 11 §B.1 MSG-2).
 *
 * When `role="agent"`, renders a filled primary-green circle with a centered
 * Bot icon (lucide-react `BotIcon`) and an accessible label derived from
 * `name`. The primary/primary-foreground token pair is the agent identity
 * colour across both themes (green on light/dark; theme-adapted
 * on others).
 */
export const MessageAvatar = ({
  src,
  name,
  role = "user",
  className,
  children,
  ...props
}: MessageAvatarProps) => {
  if (role === "agent") {
    return (
      <Avatar
        aria-label={name ? `${name} (agent)` : "Agent"}
        // `role="img"` is LOAD-BEARING, not decoration (#386). Radix's
        // `Avatar.Root` renders a plain `<span>`, whose implicit role is
        // `generic` — and ARIA PROHIBITS `aria-label` on `generic`, so axe's
        // `aria-prohibited-attr` reds the story AND assistive tech never
        // announces the name. `img` is the role permitted to carry a name for a
        // graphic whose contents (the Bot glyph) are not text — the same
        // precedent a titled `@elabs-ai/components-icons` `Icon`
        // uses (.claude/rules/icons.md). Only the agent branch takes it: the
        // user branch's fallback initial is real text content, so naming it too
        // would add an `img` per message for no gain.
        role="img"
        className={cn("size-6 bg-primary text-primary-foreground", className)}
        data-role="agent"
        data-slot="message-avatar"
        {...props}
      >
        {src ? <AvatarImage alt={name ?? ""} src={src} /> : null}
        <AvatarFallback className="bg-primary text-primary-foreground">
          <BotIcon aria-hidden="true" size={14} />
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Avatar
      className={cn("size-6", className)}
      data-role={role}
      data-slot="message-avatar"
      {...props}
    >
      {src ? <AvatarImage alt={name ?? ""} src={src} /> : null}
      <AvatarFallback className="text-meta">
        {children ?? name?.slice(0, 1).toUpperCase() ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
};

export type UserMessageProps = Omit<MessageProps, "from">;

/**
 * Named front door for a user turn (research 11 §B.2) — a thin preset over
 * `Message from="user"`; the chat-user fill comes from `MessageContent`.
 */
export const UserMessage = (props: UserMessageProps) => <Message from="user" {...props} />;

export const agentMessageVariants = cva("", {
  variants: {
    /**
     * "Final answer" is a VISUAL axis, not a behavioural mode (research 11
     * §B.2): `answer` applies the 08 green left rail. It sits on the message
     * wrapper — never on `MessageContent`, whose `overflow-hidden` would clip
     * it (research 11 §G.1).
     */
    emphasis: {
      default: "",
      answer: "border-s-4 border-s-primary ps-4",
    },
  },
  defaultVariants: { emphasis: "default" },
});

export type AgentMessageEmphasis = NonNullable<
  VariantProps<typeof agentMessageVariants>["emphasis"]
>;

export type AgentMessageProps = Omit<MessageProps, "from"> &
  VariantProps<typeof agentMessageVariants>;

/**
 * Named front door for an assistant turn (research 11 §B.2). KPI band / prose /
 * footer are COMPOSED children (`MetricGrid` + `MessageResponse` +
 * `SourceList`), not baked-in layout.
 */
export const AgentMessage = ({ className, emphasis, ...props }: AgentMessageProps) => (
  <Message
    from="assistant"
    className={cn(agentMessageVariants({ emphasis }), className)}
    {...props}
  />
);

export const messageActionsVariants = cva(
  [
    "flex items-center gap-1",
    // Follow the bubble to the right on a user turn — the SAME selector
    // `MessageContent` uses for the `--chat-user` fill above. Without it the row
    // sits at the flex-column's cross-start (left) edge while the bubble it acts
    // on is `ms-auto`'d to the right, so a `bar` pill renders under the PREVIOUS
    // (assistant) message: "Edit" appears to edit the agent's answer. It was
    // invisible before only because a `plain` row stretched full-width and had
    // no drawn box; `w-fit` is what made the misplacement visible.
    "group-[.is-user]:ms-auto",
  ],
  {
    variants: {
      /**
       * How the row presents itself. Two VISUAL values, per `cva`'s remit — no
       * behaviour forks on this axis.
       * - `plain` (default): a bare inline row, the pre-#existing shape. Unchanged
       *   for every consumer that never sets the prop.
       * - `bar`: a floating pill that reads as chrome sitting ABOVE the transcript
       *   rather than as more message content. Per ADR 0020 a floating surface
       *   takes `shadow-ring-*` and NO border — the ring bakes the 1px edge in as
       *   the shadow's last layer, so there is no second crisp stroke beside it,
       *   and because the hairline sits OUTSIDE `--shadow-strength` the pill keeps
       *   a drawn edge at high decoration / `data-decoration="8|9|10"` where the lift
       *   is zeroed.
       */
      appearance: {
        plain: "",
        bar: "w-fit rounded-full bg-popover p-0.5 shadow-ring-sm",
      },
      /**
       * When the row is visible.
       * - `always` (default): in flow, always shown.
       * - `hover`: faded out at rest, revealed when the pointer is anywhere over
       *   the parent `Message`, when focus lands inside the row, or while a menu
       *   inside it is open.
       */
      reveal: {
        always: "",
        hover: [
          "transition-opacity duration-fast ease-standard motion-reduce:transition-none",
          // Hover-reveal is gated on the POINTER, not on a breakpoint: a touch
          // device has no hover state at all, so hiding the row there would make
          // it unreachable (you cannot tap what you cannot see, and there is no
          // gesture that reveals it first). `pointer-coarse` therefore never
          // takes the `opacity-0` at all and the row stays visible. Note this is
          // a stronger guarantee than the `md:` breakpoint proxy used by the
          // `@elabs-ai/components-ui` Sidebar — a ≥md tablet is
          // exactly the case that proxy gets wrong.
          "pointer-fine:opacity-0",
          // Reveal on: the parent Message (`Message` sets the bare `group` class
          // — see the load-bearing note there), the row itself, keyboard focus
          // landing inside it, and an open menu launched from it (a `⋯ more`
          // trigger carries `data-state="open"`; without this the row fades out
          // from under the menu the moment the pointer travels to it).
          "pointer-fine:group-hover:opacity-100",
          "pointer-fine:hover:opacity-100",
          "pointer-fine:focus-within:opacity-100",
          "pointer-fine:has-[[data-state=open]]:opacity-100",
        ],
      },
    },
    defaultVariants: { appearance: "plain", reveal: "always" },
  },
);

export type MessageActionsProps = ComponentProps<"div"> &
  VariantProps<typeof messageActionsVariants> & {
    /**
     * Accessible name for the group. Defaults to the `ai.message.actions`
     * microcopy key. Naming matters more here than on an always-visible row:
     * assistive tech reaches these controls whether or not a pointer ever
     * revealed them, so the group has to say what they act on.
     */
    label?: string;
  };

/**
 * A row of per-message controls (copy, pin, retry, a `⋯` menu, …).
 *
 * **Presentational only** — it lays the controls out and decides when they are
 * visible; it ships no clipboard call, no pin state and no persistence. Every
 * `MessageAction` inside it is a bare `Button`: give it an `onClick`, and for a
 * toggle (pin, bookmark) an `aria-pressed` the host owns. That is the D5
 * boundary (`docs/DECISIONS.md` §D5) — brand-ui renders, the app acts.
 *
 * `reveal="hover"` reads the parent `Message`'s `group` class, so the row must
 * be rendered INSIDE a `Message` for pointer-reveal to fire. Standing alone it
 * still reveals on its own hover and on focus-within, but not from the bubble.
 */
export const MessageActions = ({
  appearance,
  className,
  children,
  label,
  reveal,
  ...props
}: MessageActionsProps) => {
  const { t } = useLocale();

  return (
    <div
      aria-label={label ?? t("ai.message.actions")}
      className={cn(messageActionsVariants({ appearance, reveal }), className)}
      data-slot="message-actions"
      role="group"
      {...props}
    >
      {children}
    </div>
  );
};

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button data-slot="message-action" size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(null);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error("MessageBranch components must be used within MessageBranch");
  }

  return context;
};

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  /**
   * Controlled current branch index. When set, `MessageBranch` no longer
   * tracks its own state — the host owns it and must update `branch` from
   * `onBranchChange` (or elsewhere) to move the selection. Omit for the
   * uncontrolled default (see `defaultBranch`).
   */
  branch?: number;
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
  branch: branchProp,
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  // Derived once and never flipped, per the repo's controlled/uncontrolled
  // convention (component-api.md) — mirrors MessageFeedback/MessageEdit.
  const isControlled = branchProp !== undefined;
  const [internalBranch, setInternalBranch] = useState(defaultBranch);
  const currentBranch = isControlled ? branchProp : internalBranch;
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = useCallback(
    (newBranch: number) => {
      if (!isControlled) setInternalBranch(newBranch);
      onBranchChange?.(newBranch);
    },
    [isControlled, onBranchChange],
  );

  const goToPrevious = useCallback(() => {
    const newBranch = currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch = currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  }, [currentBranch, branches.length, handleBranchChange]);

  const contextValue = useMemo<MessageBranchContextType>(
    () => ({
      branches,
      currentBranch,
      goToNext,
      goToPrevious,
      setBranches,
      totalBranches: branches.length,
    }),
    [branches, currentBranch, goToNext, goToPrevious],
  );

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        data-slot="message-branch"
        {...props}
      />
    </MessageBranchContext.Provider>
  );
};

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({ children, ...props }: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children],
  );

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden",
      )}
      data-slot="message-branch-content"
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

export type MessageBranchSelectorProps = ComponentProps<typeof ButtonGroup>;

export const MessageBranchSelector = ({ className, ...props }: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-s-md [&>*:not(:last-child)]:rounded-e-md",
        className,
      )}
      data-slot="message-branch-selector"
      orientation="horizontal"
      {...props}
    />
  );
};

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({ children, ...props }: MessageBranchPreviousProps) => {
  const { t } = useLocale();
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label={t("ai.message.previousBranch")}
      data-slot="message-branch-previous"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} data-rtl-flip />}
    </Button>
  );
};

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({ children, ...props }: MessageBranchNextProps) => {
  const { t } = useLocale();
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label={t("ai.message.nextBranch")}
      data-slot="message-branch-next"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} data-rtl-flip />}
    </Button>
  );
};

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({ className, ...props }: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn("border-none bg-transparent text-muted-foreground shadow-none", className)}
      data-slot="message-branch-page"
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  );
};

/**
 * `rehypePlugins` is NOT exposed on `MessageResponse` (#36, fixed). This
 * renders untrusted, streamed model output — the type-level `Omit` below plus
 * a runtime `stripSanitizerOverrides()` call before the `{...props}` spread
 * onto `<Streamdown>` keep Streamdown's default sanitiser chain (rehype-raw →
 * rehype-sanitize → rehype-harden) non-overridable, even through a JS consumer
 * or a force-cast.
 *
 * `remarkPlugins` IS supported: the remark stage runs upstream of that chain
 * and cannot bypass it (PR #74 review, round 1). See `MarkdownView`'s TSDoc and
 * `packages/ai/src/_streamdown-safety.ts` for the full security model.
 */
export type MessageResponseProps = Omit<ComponentProps<typeof Streamdown>, "rehypePlugins"> & {
  /**
   * No content has arrived yet (loading-states.md `loading`) — renders
   * skeleton lines at the body line-height instead of `<Streamdown>`, so the
   * bubble reserves its space before the first token.
   * @default false
   */
  loading?: boolean;
  /**
   * Custom renderers for markdown elements. **Semantics differ from
   * `MarkdownView`:** `components` here REPLACES (not merges) per key against
   * Streamdown's own defaults, since `MessageResponse` has no internal
   * component map to merge with. See `MarkdownView` for merge-over-defaults
   * semantics and `#10` for details.
   */
  components?: ComponentProps<typeof Streamdown>["components"];
  /**
   * Custom plugins for markdown processing. **Merges** per key with the
   * internal defaults (`math`, `code`, `mermaid`, `renderers`), so a
   * consumer's entry wins for its key; every key the consumer does not set
   * keeps the reactive, i18n-aware internal default. This is the same
   * semantics as `MarkdownView` (#10 fix round). The `math.rehypePlugin`
   * runs after sanitisation; see `MarkdownView` TSDoc for the full security
   * model.
   */
  plugins?: ComponentProps<typeof Streamdown>["plugins"];
};

export const MessageResponse = memo(
  ({ className, loading = false, plugins: pluginOverrides, ...props }: MessageResponseProps) => {
    // Streamdown installs [rehypeRaw, rehypeSanitize, harden] as the DEFAULT VALUE of
    // `rehypePlugins`; a supplied array REPLACES it. This component renders untrusted,
    // streamed model output, so the chain is not overridable. Widen with `allowedTags` /
    // `literalTagContent`, which merge into the sanitize schema. See issue #36.
    // `remarkPlugins` is deliberately left alone — it runs upstream of the rehype
    // chain and cannot bypass it (PR #74 review; see `_streamdown-safety.ts`).
    stripSanitizerOverrides(props);
    // Streamdown renders its own chrome (code copy, table menus, Mermaid
    // toolbar); route its labels through the locale seam (#310). Spread AFTER
    // so an explicit `translations` prop still wins (ADR 0017 override chain).
    const translations = useStreamdownTranslations();
    const { t } = useLocale();
    // Brand-token-derived `code` plugin, not the package's static github-*
    // default (#315 follow-up) — re-derives when the active theme changes.
    const internalPlugins = useStreamdownPlugins();
    // MERGED per key over the internal defaults — the same semantics as
    // `MarkdownView`'s `plugins` prop (#10 fix round, M4): a consumer entry
    // wins for its key; every key the consumer does not set keeps the
    // reactive, i18n-aware internal default. Previously this component
    // REPLACED `plugins` wholesale (`{...props}` spread after `plugins=`),
    // the opposite of `MarkdownView` for the same prop on a sibling
    // Streamdown surface — aligned so both components mean the same thing by
    // "override a plugin slot".
    const plugins = useMemo(
      () => ({ ...internalPlugins, ...pluginOverrides }),
      [internalPlugins, pluginOverrides],
    );

    if (loading) {
      return (
        <div
          className={cn("space-y-2", className)}
          data-slot="message-response"
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">{t("loading")}</span>
          {/* Fixed (not percentage) widths: MessageContent is `w-fit`, so a
              skeleton row sized in `%` has nothing definite to shrink-wrap
              around and collapses to zero width. */}
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-5 w-40" />
        </div>
      );
    }

    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          // Brand prose scale (research 11 §B.1 MSG-3): map the streamed markdown
          // element tree onto the 07 type roles. Descendant-selector className —
          // NOT a `components` map — so streaming stays cheap.
          "[&_h1]:text-title [&_h2]:text-subtitle [&_h3]:text-subtitle",
          "[&_p]:text-body [&_li]:text-body [&_code]:text-code",
          className,
        )}
        data-slot="message-response"
        plugins={plugins}
        translations={translations}
        {...props}
      />
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    nextProps.isAnimating === prevProps.isAnimating &&
    nextProps.loading === prevProps.loading,
);

MessageResponse.displayName = "MessageResponse";

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({ className, children, ...props }: MessageToolbarProps) => (
  <div
    className={cn("mt-4 flex w-full items-center justify-between gap-4", className)}
    data-slot="message-toolbar"
    {...props}
  >
    {children}
  </div>
);
