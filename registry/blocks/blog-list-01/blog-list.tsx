"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AspectRatio,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Image,
  SectionHeader,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { ArrowRight, Clock } from "lucide-react";
import { POSTS, type BlogPost } from "./data";

export type { BlogAuthor, BlogPost } from "./data";

export interface BlogListProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Newest first. The first post flagged `featured` (else the first post) is shown large. */
  posts?: BlogPost[];
  /** How many grid posts show before “Load more”. */
  pageSize?: number;
  /** The label of the filter chip that clears the tag filter. */
  allLabel?: string;
  loadMoreLabel?: string;
  /** BCP 47 locale for the dates; the viewer's default when unset. */
  locale?: string;
  className?: string;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

/**
 * A blog index: the featured post large at the top, tag chips that filter the grid,
 * and cards with the cover, tag, title, excerpt, author, date and reading time.
 * “Load more” reveals the next page from the data; the count is announced.
 */
export function BlogList({
  eyebrow = "Blog",
  title = "Notes from the ops desk",
  description = "Engineering, customs and product writing from the people building Harbourline.",
  posts = POSTS,
  pageSize = 6,
  allLabel = "All",
  loadMoreLabel = "Load more",
  locale,
  className,
}: BlogListProps) {
  const [tag, setTag] = useState(allLabel);
  const [visible, setVisible] = useState(pageSize);

  const tags = useMemo(() => [allLabel, ...new Set(posts.map((p) => p.tag))], [allLabel, posts]);
  const featured = posts.find((p) => p.featured) ?? posts[0];
  const rest = posts.filter((p) => p !== featured);
  const matching = tag === allLabel ? rest : rest.filter((p) => p.tag === tag);
  const shown = matching.slice(0, visible);
  const remaining = matching.length - shown.length;

  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }),
    [locale],
  );
  const date = (iso: string) => formatDate.format(new Date(`${iso}T00:00:00Z`));
  const byline = (post: BlogPost) => ({
    author: post.author,
    date: date(post.date),
    dateTime: post.date,
    minutes: post.readMinutes,
  });

  const selectTag = (next: string) => {
    if (!next) return;
    setTag(next);
    setVisible(pageSize);
  };

  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16",
        className,
      )}
      data-slot="blog-list"
    >
      <SectionHeader as="h1" description={description} eyebrow={eyebrow} size="lg" title={title} />

      {featured ? (
        <article
          className="grid overflow-hidden rounded-xl border bg-card shadow-sm @3xl:grid-cols-5"
          data-slot="blog-list-featured"
        >
          <a
            aria-label={`Read: ${featured.title}`}
            className="group/cover block focus-ring-inset @3xl:col-span-3"
            href={featured.href}
          >
            <AspectRatio className="overflow-hidden bg-muted" ratio={16 / 9}>
              <Image
                alt=""
                className="size-full transition-transform duration-base ease-standard group-hover/cover:scale-[1.02] motion-reduce:transition-none"
                fit="cover"
                showSkeleton={false}
                src={featured.cover}
              />
            </AspectRatio>
          </a>
          <div className="flex flex-col justify-center gap-4 p-6 @3xl:col-span-2 @3xl:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Featured</Badge>
              <Badge variant="outline">{featured.tag}</Badge>
            </div>
            <h2 className="text-title font-semibold text-balance">
              <a className="rounded-sm focus-ring hover:underline" href={featured.href}>
                {featured.title}
              </a>
            </h2>
            <p className="text-body text-muted-foreground text-pretty">{featured.excerpt}</p>
            <Byline {...byline(featured)} />
            <Button asChild className="self-start" variant="outline">
              <a href={featured.href}>
                Read the post
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
          </div>
        </article>
      ) : null}

      <div className="flex flex-col gap-6" data-slot="blog-list-index">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            aria-label="Filter by topic"
            className="flex-wrap"
            onValueChange={selectTag}
            size="sm"
            type="single"
            value={tag}
            variant="outline"
          >
            {tags.map((name) => (
              <ToggleGroupItem key={name} value={name}>
                {name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p aria-live="polite" className="text-meta text-muted-foreground tabular-nums">
            {matching.length === 1 ? "1 post" : `${matching.length} posts`}
            {tag === allLabel ? "" : ` in ${tag}`}
          </p>
        </div>

        <ul className="grid gap-5 @xl:grid-cols-2 @4xl:grid-cols-3">
          {shown.map((post) => (
            <li className="min-w-0" key={post.id}>
              <Card className="group/card h-full overflow-hidden p-0">
                <a
                  aria-label={`Read: ${post.title}`}
                  className="block focus-ring-inset"
                  href={post.href}
                  tabIndex={-1}
                >
                  <AspectRatio className="overflow-hidden bg-muted" ratio={16 / 9}>
                    <Image
                      alt=""
                      className="size-full transition-transform duration-base ease-standard group-hover/card:scale-[1.03] motion-reduce:transition-none"
                      fit="cover"
                      loading="lazy"
                      showSkeleton={false}
                      src={post.cover}
                    />
                  </AspectRatio>
                </a>
                <CardContent className="flex flex-col gap-3 p-5">
                  <Badge className="self-start" variant="outline">
                    {post.tag}
                  </Badge>
                  <h3 className="text-subtitle font-semibold text-balance">
                    <a className="rounded-sm focus-ring hover:underline" href={post.href}>
                      {post.title}
                    </a>
                  </h3>
                  <p className="line-clamp-3 text-body text-muted-foreground text-pretty">
                    {post.excerpt}
                  </p>
                  <Byline className="mt-auto pt-2" {...byline(post)} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>

        {matching.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-body text-muted-foreground">
            Nothing filed under {tag} yet.
          </p>
        ) : null}

        {remaining > 0 ? (
          <div className="flex justify-center">
            <Button onClick={() => setVisible((v) => v + pageSize)} variant="outline">
              {loadMoreLabel}
              <span className="text-muted-foreground tabular-nums">({remaining} more)</span>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Byline({
  author,
  date,
  dateTime,
  minutes,
  className,
}: {
  author: BlogPost["author"];
  date: string;
  dateTime: string;
  minutes: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-3 text-meta text-muted-foreground", className)}
      data-slot="blog-list-byline"
    >
      <Avatar className="size-8">
        <AvatarFallback className="text-caption">{initials(author.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-foreground">{author.name}</span>
        <span className="flex flex-wrap items-center gap-x-1.5">
          <time dateTime={dateTime}>{date}</time>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1 tabular-nums">
            <Clock aria-hidden="true" className="size-3" />
            {minutes} min read
          </span>
        </span>
      </div>
    </div>
  );
}
