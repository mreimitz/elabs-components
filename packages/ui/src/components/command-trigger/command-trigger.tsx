import { forwardRef, type ComponentProps } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { Kbd } from "../kbd";

export interface CommandTriggerProps extends ComponentProps<"button"> {
  /** The visible and announced label. Defaults to "Search". */
  label?: string;
  /** The shortcut hint. Defaults to the platform-correct ⌘ K / Ctrl K. */
  shortcut?: string;
}

function platformShortcut(): string {
  if (typeof navigator === "undefined") return "Ctrl K";
  // `userAgentData.platform` where available, else the legacy string. Both are
  // hints, not guarantees — the trigger is a hint too, so a wrong guess is cosmetic.
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    "";
  return /mac|iphone|ipad/i.test(platform) ? "⌘ K" : "Ctrl K";
}

/**
 * The command-palette opener, shaped like a search field: label left, shortcut
 * pinned right, collapsing to the icon alone under `sm`. The visible label and the
 * Kbd are BOTH aria-hidden and the name is authored on the button — a Kbd inside a
 * control otherwise concatenates into its accessible name (#117).
 *
 * `shortcut` reads `navigator` at render time when omitted, which can differ
 * between server and client — a consumer that server-renders this component
 * should pass `shortcut` explicitly to avoid a hydration mismatch.
 */
export const CommandTrigger = forwardRef<HTMLButtonElement, CommandTriggerProps>(
  function CommandTrigger({ label = "Search", shortcut, className, ...props }, ref) {
    const hint = shortcut ?? platformShortcut();
    return (
      <button
        ref={ref}
        type="button"
        data-slot="command-trigger"
        aria-label={label}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-body text-muted-foreground",
          "hover:bg-accent hover:text-accent-foreground focus-ring",
          "sm:w-56 sm:justify-between sm:ps-2 sm:pe-1.5",
          className,
        )}
        {...props}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span aria-hidden="true" className="hidden truncate sm:inline">
            {label}
          </span>
        </span>
        <Kbd aria-hidden="true" className="hidden sm:inline-flex">
          {hint}
        </Kbd>
      </button>
    );
  },
);
