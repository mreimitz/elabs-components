"use client";
/**
 * block-renders — the registry blocks this site renders from its own copy. Each loads on demand
 * (a block pulls charts, maps or the flow canvas), and only in the browser: several measure
 * their box or open a WebGL context.
 */
import { useEffect, useRef, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { Maximize2 } from "lucide-react";
import {
  CommandChip,
  Dialog,
  DialogTrigger,
  ExpandDialog,
  Heading,
  IconButton,
  Skeleton,
  Text,
} from "@elabs-ai/components-ui";
import { catalogCopy, heroCopy } from "../../content/copy";
import { NATIVE_BLOCKS, type NativeBlockName } from "./block-render-meta";

/** What the enlarge dialog's detail pane says about the block. */
export interface BlockHeroDetail {
  pageName: string;
  question?: string;
  summary?: string;
  labels?: string[];
  commands?: { label: string; command: string }[];
  links?: { label: string; href: string }[];
}

const pending = () => <Skeleton className="h-96 w-full" />;

const RENDERS: Record<NativeBlockName, ComponentType> = {
  "command-center-revenue-01": dynamic(
    () =>
      import("../blocks/command-center-revenue-01/command-center-revenue").then(
        (m) => m.CommandCenterRevenue,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "command-center-live-ops-01": dynamic(
    () =>
      import("../blocks/command-center-live-ops-01/command-center-live-ops").then(
        (m) => m.CommandCenterLiveOps,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "command-center-market-tape-01": dynamic(
    () =>
      import("../blocks/command-center-market-tape-01/command-center-market-tape").then(
        (m) => m.CommandCenterMarketTape,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "command-center-launch-plan-01": dynamic(
    () =>
      import("../blocks/command-center-launch-plan-01/command-center-launch-plan").then(
        (m) => m.CommandCenterLaunchPlan,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "geo-network-map-01": dynamic(
    () => import("../blocks/geo-network-map-01/geo-network-map").then((m) => m.GeoNetworkMap),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "geo-fleet-tracker-01": dynamic(
    () => import("../blocks/geo-fleet-tracker-01/geo-fleet-tracker").then((m) => m.GeoFleetTracker),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "infographic-journey-flow-01": dynamic(
    () =>
      import("../blocks/infographic-journey-flow-01/infographic-journey-flow").then(
        (m) => m.InfographicJourneyFlow,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "infographic-profile-compare-01": dynamic(
    () =>
      import("../blocks/infographic-profile-compare-01/infographic-profile-compare").then(
        (m) => m.InfographicProfileCompare,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "infographic-dependency-web-01": dynamic(
    () =>
      import("../blocks/infographic-dependency-web-01/infographic-dependency-web").then(
        (m) => m.InfographicDependencyWeb,
      ),
    {
      ssr: false,
      loading: pending,
    },
  ),
  "agent-run-review-01": dynamic(
    () => import("../blocks/agent-run-review-01/agent-run-review").then((m) => m.AgentRunReview),
    {
      ssr: false,
      loading: pending,
    },
  ),
};

/**
 * The block at working size — a block page's lead example — with the same enlarge control the
 * story frames carry: the library's ExpandDialog, the block filling the view (a map, a wall)
 * or scrolling inside it (a desk taller than the screen), its details and links beside it.
 */
export function BlockHero({ name, detail }: { name: NativeBlockName; detail?: BlockHeroDetail }) {
  const Render = RENDERS[name];
  const fill = NATIVE_BLOCKS[name] === "fill";
  const [open, setOpen] = useState(false);
  const chip = heroCopy.chip;
  return (
    <div data-slot="block-hero" className="group/hero relative w-full min-w-0">
      <div className={fill ? "h-144 w-full min-w-0" : "w-full min-w-0"}>
        <Render />
      </div>
      {detail ? (
        <div className="absolute end-2 top-2 opacity-0 transition-opacity duration-fast ease-standard group-focus-within/hero:opacity-100 group-hover/hero:opacity-100">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <IconButton
                variant="outline"
                size="icon-sm"
                label={catalogCopy.frame.expand}
                icon={<Maximize2 />}
              />
            </DialogTrigger>
            <ExpandDialog
              title={detail.pageName}
              description={detail.question || detail.summary || undefined}
              detailLabel={catalogCopy.frame.details}
              viewClassName="p-0"
              detail={
                <div className="flex flex-col gap-5 p-4">
                  <div className="flex flex-col gap-2">
                    <Heading level={3} size="subtitle">
                      {detail.pageName}
                    </Heading>
                    {detail.labels?.length ? (
                      <Text variant="caption" tone="muted" className="capitalize">
                        {detail.labels.join(" · ")}
                      </Text>
                    ) : null}
                    {detail.summary ? (
                      <Text variant="caption" tone="muted">
                        {detail.summary}
                      </Text>
                    ) : null}
                  </div>
                  {detail.commands?.map((item) => (
                    <CommandChip
                      key={item.label}
                      aria-label={item.label}
                      hosts={[{ id: item.label, label: item.label, command: item.command }]}
                      labels={{
                        copy: chip.copy,
                        copied: chip.copied,
                        selectFallback: chip.selectFallback,
                        chooseHost: item.label,
                        menuLabel: item.label,
                      }}
                      className="w-full"
                    />
                  ))}
                  <ul className="flex flex-col gap-1.5">
                    {(detail.links ?? []).map((link) => (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className="rounded-sm text-body text-foreground underline underline-offset-4 focus-ring"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              }
            >
              <div
                className={
                  fill
                    ? "size-full min-h-96 overflow-hidden rounded-md bg-background"
                    : "size-full min-h-96 overflow-auto rounded-md bg-background p-6"
                }
              >
                {open ? <Render /> : null}
              </div>
            </ExpandDialog>
          </Dialog>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The block as a card thumbnail: rendered at a desktop width and scaled to the card, mounted
 * when near the viewport. Decorative — the card's link names the target.
 */
export function BlockThumb({
  name,
  width = 1180,
  ratio = 0.625,
}: {
  name: NativeBlockName;
  width?: number;
  ratio?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [scale, setScale] = useState(0);
  const Render = RENDERS[name];

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / width);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") setNear(true);
    else {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setNear(true);
            io?.disconnect();
          }
        },
        { rootMargin: "400px 0px" },
      );
      io.observe(el);
    }
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, [width]);

  return (
    <div
      ref={holder}
      aria-hidden="true"
      data-slot="block-thumb"
      inert
      className="pointer-events-none relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      {near && scale > 0 ? (
        <div
          className="absolute start-0 top-0 origin-top-left p-6"
          style={{ width, height: width * ratio, transform: `scale(${scale})` }}
        >
          <Render />
        </div>
      ) : (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
    </div>
  );
}
