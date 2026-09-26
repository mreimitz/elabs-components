"use client";

import { useId, useState, type ReactNode } from "react";
import { Cookie, Lock, SlidersHorizontal } from "lucide-react";
import {
  Button,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ProseLink,
  Switch,
} from "@elabs-ai/components-ui";

export type CookieCategoryId = "essential" | "analytics" | "marketing" | "preferences";

export interface CookieCategory {
  id: CookieCategoryId;
  label: string;
  /** What the visitor gives up or gains — one honest sentence. */
  description: string;
  /** Always on; the switch is shown but cannot be turned off. */
  locked?: boolean;
  /** Where the switch starts when the visitor opens “Manage”. */
  defaultOn?: boolean;
}

export type CookieChoices = Record<CookieCategoryId, boolean>;

/** How the visitor decided — the banner hides after any of the three. */
export type CookieDecision = "accept-all" | "reject-non-essential" | "custom";

export interface MarketingCookieBannerProps {
  title?: ReactNode;
  description?: ReactNode;
  /** The categories the visitor can decide on; `essential` should be locked. */
  categories?: CookieCategory[];
  /** Link to the full cookie policy. */
  policyHref?: string;
  policyLabel?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  manageLabel?: string;
  saveLabel?: string;
  /** `compact`: one line of text and the buttons, no icon or heading. */
  variant?: "default" | "compact";
  /**
   * `fixed` pins the banner to the bottom of the viewport (the production default);
   * `inline` makes it sticky inside its own scrolling container, for previews and pages
   * that own their layout.
   */
  placement?: "fixed" | "inline";
  /** Open the preferences dialog straight away. */
  defaultPreferencesOpen?: boolean;
  /** Fires every time a switch in the preferences dialog moves. */
  onChange?: (choices: CookieChoices) => void;
  /** Fires once, when the visitor decides; the banner hides afterwards. */
  onDecision?: (decision: CookieDecision, choices: CookieChoices) => void;
  className?: string;
}

export const DEFAULT_COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: "essential",
    label: "Essential",
    description: "Sign-in, your cart and fraud checks. The site does not work without these.",
    locked: true,
    defaultOn: true,
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Which pages are read and where people give up, so we fix the right things.",
    defaultOn: true,
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Lets our ads on other sites know you already visited, so you see fewer of them.",
    defaultOn: false,
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Remembers your language, currency and the theme you picked.",
    defaultOn: true,
  },
];

const choicesFrom = (categories: CookieCategory[], on: (c: CookieCategory) => boolean) =>
  Object.fromEntries(
    categories.map((category) => [category.id, category.locked ? true : on(category)]),
  ) as CookieChoices;

/**
 * Cookie consent — a banner that says what it wants in two sentences and offers the
 * three honest answers side by side: accept everything, keep only what the site needs,
 * or decide per category in a dialog where “Essential” is visibly locked on. The block
 * reports the decision and hides; storing it is the app’s job.
 */
export function MarketingCookieBanner({
  title = "We use cookies, and we can explain why",
  description = "Essential ones keep you signed in. The rest tell us which pages help and which do not. You can change your mind any time from the footer.",
  categories = DEFAULT_COOKIE_CATEGORIES,
  policyHref = "#cookie-policy",
  policyLabel = "Read the cookie policy",
  acceptLabel = "Accept all",
  rejectLabel = "Reject non-essential",
  manageLabel = "Manage",
  saveLabel = "Save choices",
  variant = "default",
  placement = "fixed",
  defaultPreferencesOpen = false,
  onChange,
  onDecision,
  className,
}: MarketingCookieBannerProps) {
  const headingId = useId();
  const [decided, setDecided] = useState<CookieDecision | null>(null);
  const [open, setOpen] = useState(defaultPreferencesOpen);
  const [choices, setChoices] = useState<CookieChoices>(() =>
    choicesFrom(categories, (c) => c.defaultOn ?? false),
  );

  function decide(decision: CookieDecision, next: CookieChoices) {
    setChoices(next);
    setOpen(false);
    setDecided(decision);
    onDecision?.(decision, next);
  }

  function toggle(id: CookieCategoryId, on: boolean) {
    const next = { ...choices, [id]: on };
    setChoices(next);
    onChange?.(next);
  }

  if (decided) {
    return (
      <p className="sr-only" data-slot="marketing-cookie-banner" role="status">
        {decided === "reject-non-essential"
          ? "Only essential cookies are on."
          : decided === "accept-all"
            ? "All cookies are on."
            : "Your cookie choices are saved."}
      </p>
    );
  }

  const compact = variant === "compact";
  const onCount = Object.values(choices).filter(Boolean).length;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "@container inset-x-0 bottom-0 z-50 w-full",
        placement === "fixed" ? "fixed" : "sticky",
        className,
      )}
      data-slot="marketing-cookie-banner"
      data-variant={variant}
      role="region"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-t-xl bg-card text-card-foreground shadow-ring-lg",
          compact
            ? "p-4 @2xl:flex-row @2xl:items-center @2xl:gap-6"
            : "p-5 @3xl:flex-row @3xl:gap-8",
        )}
        data-slot="marketing-cookie-banner-panel"
      >
        <div className="flex min-w-0 flex-1 gap-3">
          {compact ? null : (
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <Cookie className="size-5" />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              className={cn(compact ? "sr-only" : "text-subtitle font-semibold text-balance")}
              id={headingId}
            >
              {title}
            </h2>
            <p className="text-body text-muted-foreground text-pretty">
              {description} <ProseLink href={policyHref}>{policyLabel}</ProseLink>
            </p>
          </div>
        </div>
        <div
          className={cn(
            "flex flex-wrap gap-2",
            compact ? "@2xl:shrink-0" : "@3xl:shrink-0 @3xl:self-center",
          )}
          data-slot="marketing-cookie-banner-actions"
        >
          <Button
            onClick={() =>
              decide(
                "reject-non-essential",
                choicesFrom(categories, () => false),
              )
            }
            size={compact ? "sm" : "default"}
            variant="outline"
          >
            {rejectLabel}
          </Button>
          <Dialog onOpenChange={setOpen} open={open}>
            <Button onClick={() => setOpen(true)} size={compact ? "sm" : "default"} variant="ghost">
              <SlidersHorizontal aria-hidden="true" />
              {manageLabel}
            </Button>
            <DialogContent className="max-w-lg" data-slot="marketing-cookie-banner-preferences">
              <DialogHeader>
                <DialogTitle>Cookie preferences</DialogTitle>
                <DialogDescription>
                  Switch each kind on or off. Essential cookies stay on because the site cannot work
                  without them.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <ul className="flex flex-col divide-y divide-border">
                  {categories.map((category) => {
                    const switchId = `${headingId}-${category.id}`;
                    const descriptionId = `${switchId}-description`;
                    return (
                      <li
                        className="flex items-start justify-between gap-4 py-3.5"
                        key={category.id}
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <label
                            className="flex items-center gap-1.5 text-body font-medium"
                            htmlFor={switchId}
                          >
                            {category.label}
                            {category.locked ? (
                              <span className="inline-flex items-center gap-1 text-meta font-normal text-muted-foreground">
                                <Lock aria-hidden="true" className="size-3" />
                                Always on
                              </span>
                            ) : null}
                          </label>
                          <p className="text-caption text-muted-foreground" id={descriptionId}>
                            {category.description}
                          </p>
                        </div>
                        <Switch
                          aria-describedby={descriptionId}
                          checked={category.locked ? true : choices[category.id]}
                          disabled={category.locked}
                          id={switchId}
                          onCheckedChange={(on) => toggle(category.id, on)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </DialogBody>
              <DialogFooter className="items-center">
                <span className="me-auto text-meta text-muted-foreground tabular-nums">
                  {onCount} of {categories.length} on
                </span>
                <Button
                  onClick={() =>
                    decide(
                      "reject-non-essential",
                      choicesFrom(categories, () => false),
                    )
                  }
                  type="button"
                  variant="ghost"
                >
                  {rejectLabel}
                </Button>
                <Button onClick={() => decide("custom", choices)} type="button">
                  {saveLabel}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            onClick={() =>
              decide(
                "accept-all",
                choicesFrom(categories, () => true),
              )
            }
            size={compact ? "sm" : "default"}
          >
            {acceptLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
