import {
  Card,
  CardMedia,
  Heading,
  Image,
  Text,
  formatLastOpened,
  useLocale,
} from "@elabs-ai/components-ui";
import { Workflow } from "lucide-react";
import { toHash } from "../routes/use-hash";
import { folderOf } from "../workspace/workspace-store";
import { thumbSrc } from "./thumbnail";

/** The card's strings, in one place (`conventions/i18n-strings`). */
export const RECENT_LABELS = {
  root: "Workspace",
  edited: (when: string) => `Edited ${when}`,
  noPreview: "No preview yet",
} as const;

export interface RecentCardProps {
  path: string;
  title: string;
  /** ms since the epoch (`WorkspaceFile.mtime`). */
  mtime: number;
  /** A thumbnail sits beside the file (`WorkspaceFile.hasThumb`; its path is `thumbPathOf`). */
  hasThumb: boolean;
  /** Heading level inside Home's outline (Home's section headings are h2). */
  level?: 3 | 4;
}

/** The well a card shows when no thumbnail exists yet: the ground, a glyph, a word. */
function NoPreview() {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <Workflow aria-hidden="true" className="size-6" />
      <Text variant="meta" tone="muted" as="span">
        {RECENT_LABELS.noPreview}
      </Text>
    </span>
  );
}

/**
 * DG-23 — one recent diagram: the saved light thumbnail (DG-21, 480×270), title, folder, when
 * it was last edited. The whole card is one link (stretched-link pattern, `verified-apis.md`):
 * Tab reaches it once, Enter opens it. Kept from the R1 scope box; the broken-references chip
 * was cut with the search index it depended on.
 */
export function RecentCard({ path, title, mtime, hasThumb, level = 3 }: RecentCardProps) {
  const { locale } = useLocale();
  const folder = folderOf(path);
  const thumb = thumbSrc(path, hasThumb, mtime);
  return (
    <Card
      interactive
      // No overflow clip on the card: it would cut the focus ring drawn outside the ::after.
      className="relative flex min-w-0 flex-col"
    >
      <CardMedia
        ground="dots"
        className="block min-h-0 overflow-hidden rounded-t-lg border-b border-border p-0"
      >
        <Image
          src={thumb}
          alt=""
          aspectRatio={16 / 9}
          fit="contain"
          loading="lazy"
          decoding="async"
          fallback={<NoPreview />}
        />
      </CardMedia>
      <div className="flex min-w-0 flex-col gap-1 p-4">
        <Heading level={level} size="subtitle" className="line-clamp-2 break-words">
          <a
            href={toHash({ kind: "doc", path })}
            // Stretched link: the ::after covers the card, and the ring is drawn on it.
            className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:focus-ring-static"
          >
            {title}
          </a>
        </Heading>
        <Text variant="meta" tone="muted" className="truncate" translate="no">
          {folder === "" ? RECENT_LABELS.root : folder}
        </Text>
        <Text variant="meta" tone="muted">
          {RECENT_LABELS.edited(formatLastOpened(new Date(mtime), locale))}
        </Text>
      </div>
    </Card>
  );
}
