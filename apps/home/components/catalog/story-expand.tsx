"use client";
/**
 * StoryExpand — the enlarge control on a live example, and what it opens: the library's
 * `ExpandDialog`. The story fills the view pane (Storybook's own `layout` parameter does the
 * rest: a full-screen story fills it, a small component sits centred), and the detail pane
 * carries what the example is, how to import or install it, and where to go next. When the page
 * has several examples, the header steps through them without closing the dialog.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2 } from "lucide-react";
import {
  Button,
  CommandChip,
  Dialog,
  DialogTrigger,
  ExpandDialog,
  Heading,
  IconButton,
  Skeleton,
  Text,
} from "@elabs-ai/components-ui";
import { useTheme } from "@elabs-ai/components-tokens";
import { catalogCopy, heroCopy } from "../../content/copy";
import { useStoryId } from "../../lib/story-alias";
import { reportStoryTheme, useStoryTheme } from "../../lib/story-theme";

const copy = catalogCopy.frame;

export interface StoryExpandStory {
  id: string;
  name: string;
  description?: string;
}

/** What the detail pane says about the page the example belongs to. Plain data (server → client). */
export interface StoryExpandDetail {
  /** The component / chart / block / template the example belongs to. */
  pageName: string;
  /** The page's one-line purpose. */
  summary?: string;
  /** Group and package, shown as quiet labels. */
  labels?: string[];
  /** Copyable lines, e.g. the import statement or a block's install command. */
  commands?: { label: string; command: string }[];
  /** Where to go next: the detail page, Storybook docs, the source. */
  links?: { label: string; href: string }[];
  /** Every example on the page, in order — enables previous / next inside the dialog. */
  stories?: StoryExpandStory[];
}

const storySrc = (id: string, theme: string) =>
  `/storybook/iframe.html?id=${encodeURIComponent(id)}&viewMode=story${
    theme ? `&globals=theme:${encodeURIComponent(theme)}` : ""
  }`;

/**
 * Fill or centre, decided from what the story actually rendered (the frame is same-origin, so
 * its document is readable). A story that already fills its viewport — an app shell, a canvas, a
 * `layout: "fullscreen"` template — or one Storybook already centres is left alone. A smaller,
 * top-left-anchored story (Storybook's default `padded` layout) is centred in the pane: vertically
 * when it is shorter than the pane, horizontally when it is narrower. Each child's measured width
 * is pinned first, so centring never shrinks a block that sizes itself from its container.
 */
function fitStory(doc: Document): boolean {
  const root = doc.getElementById("storybook-root");
  const view = doc.defaultView;
  if (!root || !view || root.childElementCount === 0) return false;
  const body = doc.body;
  if (body.classList.contains("sb-main-fullscreen") || body.classList.contains("sb-main-centered"))
    return true;
  const children = Array.from(root.children).filter(
    (el): el is HTMLElement => el instanceof view.HTMLElement,
  );
  const rects = children.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
  if (rects.length === 0) return false;
  const width = Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left));
  const height = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top));
  const pad = parseFloat(view.getComputedStyle(body).paddingTop) || 0;
  const roomX = root.clientWidth;
  const roomY = view.innerHeight - pad * 2;
  const narrow = width < roomX * 0.9;
  const short = height < roomY * 0.9;
  if (!narrow && !short) return true;
  if (narrow) {
    children.forEach((el, i) => {
      const rect = rects[i];
      if (rect) el.style.width = `${Math.ceil(rect.width)}px`;
    });
  }
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.boxSizing = "border-box";
  root.style.minHeight = `${roomY}px`;
  if (short) root.style.justifyContent = "center";
  if (narrow) root.style.alignItems = "center";
  return true;
}

export function StoryExpand({
  id,
  name,
  detail,
}: {
  id: string;
  name: string;
  detail?: StoryExpandDetail;
}) {
  const { theme: siteTheme } = useTheme();
  const theme = useStoryTheme(siteTheme);
  const [open, setOpen] = useState(false);
  const stories = detail?.stories?.length ? detail.stories : [{ id, name }];
  const startAt = Math.max(
    0,
    stories.findIndex((s) => s.id === id),
  );
  const [index, setIndex] = useState(startAt);
  const [loaded, setLoaded] = useState(false);
  const story = stories[index] ?? stories[0]!;
  const liveId = useStoryId(story.id) ?? story.id;

  // Each opening starts on the example whose button was pressed.
  useEffect(() => {
    if (open) setIndex(startAt);
  }, [open, startAt]);
  useEffect(() => setLoaded(false), [story.id, theme, open]);

  const chip = heroCopy.chip;
  const title = detail ? `${detail.pageName} — ${story.name}` : story.name;
  const step = (delta: number) => setIndex((i) => (i + delta + stories.length) % stories.length);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <IconButton variant="outline" size="icon-sm" label={copy.expand} icon={<Maximize2 />} />
      </DialogTrigger>
      <ExpandDialog
        title={title}
        description={story.description || detail?.summary || undefined}
        detailLabel={copy.details}
        viewClassName="p-0"
        actions={
          <>
            {stories.length > 1 ? (
              <>
                <span className="text-meta text-muted-foreground tabular-nums">
                  {copy.position(index + 1, stories.length)}
                </span>
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label={copy.previous}
                  icon={<ChevronLeft />}
                  onClick={() => step(-1)}
                />
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label={copy.next}
                  icon={<ChevronRight />}
                  onClick={() => step(1)}
                />
              </>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <a href={`/storybook/?path=/story/${liveId}`}>
                <ExternalLink aria-hidden="true" />
                {copy.openStory}
              </a>
            </Button>
          </>
        }
        detail={
          <div className="flex flex-col gap-5 p-4">
            <div className="flex flex-col gap-2">
              <Heading level={3} size="subtitle">
                {story.name}
              </Heading>
              {story.description ? (
                <Text variant="caption" tone="muted">
                  {story.description}
                </Text>
              ) : null}
            </div>
            {detail ? (
              <div className="flex flex-col gap-2">
                <Heading level={4} size="subtitle">
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
            ) : null}
            {detail?.commands?.map((item) => (
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
              {[
                ...(detail?.links ?? []),
                { label: copy.openFull, href: storySrc(liveId, theme) },
              ].map((link) => (
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
        <div className="relative size-full min-h-96 overflow-hidden rounded-md bg-background">
          {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
          {open ? (
            <iframe
              key={liveId}
              src={storySrc(liveId, theme)}
              title={copy.previewOf(title)}
              onLoad={(event) => {
                const frame = event.currentTarget;
                let tries = 0;
                // The story mounts after the frame's load event; poll until it has rendered,
                // then fit it and reveal — so the visitor never sees it jump from the corner.
                const settle = () => {
                  const doc = frame.contentDocument;
                  if (!frame.isConnected) return;
                  const mounted =
                    (doc?.getElementById("storybook-root")?.childElementCount ?? 0) > 0;
                  if (!mounted && tries++ < 40) return void window.setTimeout(settle, 120);
                  // One more beat so self-measuring content (charts) has taken its size.
                  window.setTimeout(() => {
                    if (reportStoryTheme(theme, frame.contentDocument)) return;
                    if (frame.contentDocument) fitStory(frame.contentDocument);
                    setLoaded(true);
                  }, 250);
                };
                settle();
              }}
              className={`absolute inset-0 size-full border-0 ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          ) : null}
        </div>
      </ExpandDialog>
    </Dialog>
  );
}
