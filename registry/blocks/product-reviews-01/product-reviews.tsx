"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BadgeCheck, CheckCircle2, MessageSquarePlus, ThumbsUp } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  Label,
  Meter,
  Rating,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatePanel,
  Switch,
  Textarea,
} from "@elabs-ai/components-ui";

export interface Review {
  id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  author: string;
  /** ISO date. */
  date: string;
  verified: boolean;
  helpful: number;
  /** What the reviewer bought, when it matters (size, colour). */
  variant?: string;
}

export interface ReviewDraft {
  rating: number;
  title: string;
  body: string;
}

export interface ProductReviewsProps {
  productName?: string;
  title?: ReactNode;
  defaultReviews?: Review[];
  /** Fires with the validated draft; the block also adds it to the list. */
  onSubmit?: (draft: ReviewDraft) => void;
  onHelpfulChange?: (review: Review, helpful: boolean) => void;
  /** Name shown on a review the visitor writes. */
  viewerName?: string;
  /** ISO date stamped on a review the visitor writes; defaults to the sample clock. */
  today?: string;
  locale?: string;
  className?: string;
}

type Sort = "recent" | "helpful" | "highest" | "lowest";

const SORTS: { id: Sort; label: string }[] = [
  { id: "recent", label: "Most recent" },
  { id: "helpful", label: "Most helpful" },
  { id: "highest", label: "Highest rated" },
  { id: "lowest", label: "Lowest rated" },
];

const DEFAULT_REVIEWS: Review[] = [
  {
    id: "r1",
    rating: 5,
    title: "Carried it 600 km on the Kungsleden",
    body: "The hip belt does the work, the lid comes off as a day bag exactly as promised and after three weeks of rain nothing inside got wet. The only thing I would change is a second hip-belt pocket.",
    author: "Lena Sørensen",
    date: "2026-09-12",
    verified: true,
    helpful: 48,
    variant: "Moss",
  },
  {
    id: "r2",
    rating: 4,
    title: "Great pack, runs a little small",
    body: "Forty litres is honest but the sleeping-bag compartment eats a chunk of it. Comfortable up to about 14 kg; above that the shoulder straps start to bite. Build quality is excellent.",
    author: "Marcus Adeyemi",
    date: "2026-08-30",
    verified: true,
    helpful: 31,
    variant: "Slate",
  },
  {
    id: "r3",
    rating: 5,
    title: "Replaced a pack twice the price",
    body: "Lighter than my old one, better organised and the rain cover lives in its own pocket so I actually bring it. Zips are chunky and easy with gloves.",
    author: "Aiko Tanaka",
    date: "2026-08-21",
    verified: true,
    helpful: 19,
    variant: "Rust",
  },
  {
    id: "r4",
    rating: 3,
    title: "Fine for weekends, not for me",
    body: "Nothing wrong with it, I just prefer a stiffer frame for scrambling. Returned it without any fuss, which counts for something.",
    author: "Jonas Weber",
    date: "2026-07-28",
    verified: true,
    helpful: 7,
  },
  {
    id: "r5",
    rating: 2,
    title: "Buckle broke in the first month",
    body: "The sternum strap buckle cracked in cold weather. Support sent a replacement in four days, so two stars for the buckle and full marks for the people.",
    author: "Priya Raman",
    date: "2026-07-03",
    verified: false,
    helpful: 12,
  },
  {
    id: "r6",
    rating: 4,
    title: "Solid, quiet, well thought out",
    body: "No rattling buckles, the side pockets reach from the front and the colour matches the photos. Took one star because the price crept up since I first looked.",
    author: "Sam O’Connell",
    date: "2026-06-15",
    verified: false,
    helpful: 4,
  },
];

/**
 * Product reviews — the average with the distribution behind it (five meters with real
 * counts), sort and “verified only” that filter the list, review cards with a helpful
 * button that toggles, and a “Write a review” dialog that validates before it thanks you.
 */
export function ProductReviews({
  productName = "Trail 40 backpack",
  title = "Reviews",
  defaultReviews = DEFAULT_REVIEWS,
  onSubmit,
  onHelpfulChange,
  viewerName = "You",
  today = "2026-09-25",
  locale = "en-US",
  className,
}: ProductReviewsProps) {
  const id = useId();
  const [reviews, setReviews] = useState(defaultReviews);
  const [sort, setSort] = useState<Sort>("recent");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>({ rating: 0, title: "", body: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof ReviewDraft, string>>>({});
  const [thanked, setThanked] = useState(false);

  const number = new Intl.NumberFormat(locale);
  const decimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  // `review.date` is a calendar day (`YYYY-MM-DD`), which `new Date()` reads as UTC
  // midnight — format it in UTC too, or it shows the day before west of Greenwich.
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));
  const recommend = reviews.length
    ? reviews.filter((r) => r.rating >= 4).length / reviews.length
    : 0;

  const shown = useMemo(() => {
    const list = reviews.filter((r) => !verifiedOnly || r.verified);
    if (sort === "recent") list.sort((a, b) => b.date.localeCompare(a.date));
    if (sort === "helpful") list.sort((a, b) => b.helpful - a.helpful);
    if (sort === "highest")
      list.sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
    if (sort === "lowest") list.sort((a, b) => a.rating - b.rating || b.date.localeCompare(a.date));
    return list;
  }, [reviews, sort, verifiedOnly]);

  function toggleHelpful(review: Review) {
    const next = new Set(voted);
    const now = !next.has(review.id);
    if (now) next.add(review.id);
    else next.delete(review.id);
    setVoted(next);
    setReviews((prev) =>
      prev.map((r) => (r.id === review.id ? { ...r, helpful: r.helpful + (now ? 1 : -1) } : r)),
    );
    onHelpfulChange?.(review, now);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (draft.rating < 1) next.rating = "Pick a star rating.";
    if (draft.title.trim().length < 3)
      next.title = "Give the review a title of at least three characters.";
    if (draft.body.trim().length < 20)
      next.body = "Say a little more — twenty characters at least.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const review: Review = {
      id: `${id}-${reviews.length + 1}`,
      rating: draft.rating as Review["rating"],
      title: draft.title.trim(),
      body: draft.body.trim(),
      author: viewerName,
      date: today,
      verified: true,
      helpful: 0,
    };
    setReviews((prev) => [review, ...prev]);
    onSubmit?.(draft);
    setDraft({ rating: 0, title: "", body: "" });
    setOpen(false);
    setThanked(true);
    setSort("recent");
  }

  return (
    <section
      className={cn("@container mx-auto flex w-full max-w-5xl flex-col gap-6", className)}
      data-slot="product-reviews"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-title font-semibold">{title}</h2>
          <p className="text-body text-muted-foreground">
            What people who bought the {productName} say.
          </p>
        </div>
        <Dialog
          onOpenChange={(next) => {
            setOpen(next);
            if (next) setThanked(false);
          }}
          open={open}
        >
          <DialogTrigger asChild>
            <Button>
              <MessageSquarePlus aria-hidden="true" />
              Write a review
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" data-slot="product-reviews-compose">
            <form className="contents" noValidate onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>Review the {productName}</DialogTitle>
                <DialogDescription>
                  Honest and specific helps the next person most. We publish every review that is
                  about the product.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-5">
                <FieldRoot invalid={errors.rating !== undefined} required>
                  <FieldLabel>Your rating</FieldLabel>
                  <FieldControl>
                    <Rating
                      aria-label="Your rating"
                      onValueChange={(value) => {
                        setDraft((d) => ({ ...d, rating: value }));
                        setErrors((e) => ({ ...e, rating: undefined }));
                      }}
                      size="lg"
                      value={draft.rating}
                    />
                  </FieldControl>
                  {errors.rating ? <FieldError>{errors.rating}</FieldError> : null}
                </FieldRoot>
                <FieldRoot invalid={errors.title !== undefined} required>
                  <FieldLabel>Title</FieldLabel>
                  <FieldControl>
                    <Input
                      maxLength={80}
                      onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                      placeholder="Sum it up in a line"
                      value={draft.title}
                    />
                  </FieldControl>
                  {errors.title ? <FieldError>{errors.title}</FieldError> : null}
                </FieldRoot>
                <FieldRoot invalid={errors.body !== undefined} required>
                  <FieldLabel>Review</FieldLabel>
                  <FieldControl>
                    <Textarea
                      onChange={(event) => setDraft((d) => ({ ...d, body: event.target.value }))}
                      placeholder="How did it hold up? What would you change?"
                      rows={5}
                      value={draft.body}
                    />
                  </FieldControl>
                  <FieldDescription className="tabular-nums">
                    {draft.body.trim().length < 20
                      ? `${20 - draft.body.trim().length} more characters to go.`
                      : `${number.format(draft.body.trim().length)} characters.`}
                  </FieldDescription>
                  {errors.body ? <FieldError>{errors.body}</FieldError> : null}
                </FieldRoot>
              </DialogBody>
              <DialogFooter>
                <Button onClick={() => setOpen(false)} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button type="submit">Publish review</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {thanked ? (
        <Alert role="status" variant="success">
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>Thanks, your review is live</AlertTitle>
          <AlertDescription>
            It is at the top of the list. You can edit it from your account for the next 30 days.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @3xl:items-start">
        <Card className="@3xl:sticky @3xl:top-4" data-slot="product-reviews-summary">
          <CardContent className="flex flex-col gap-5 p-5">
            <div className="flex items-center gap-4">
              <span className="text-display font-semibold tabular-nums">
                {decimal.format(average)}
              </span>
              <div className="flex flex-col gap-1">
                <Rating
                  allowHalf
                  aria-label={`${decimal.format(average)} out of 5`}
                  readOnly
                  value={Math.round(average * 2) / 2}
                />
                <span className="text-caption text-muted-foreground tabular-nums">
                  {number.format(reviews.length)} {reviews.length === 1 ? "review" : "reviews"} ·{" "}
                  {percent.format(recommend)} gave 4 stars or more
                </span>
              </div>
            </div>
            <ol className="flex flex-col gap-2" data-slot="product-reviews-distribution">
              {distribution.map(({ stars, count }) => (
                <li
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
                  key={stars}
                >
                  <span className="w-12 text-caption tabular-nums">
                    {stars} {stars === 1 ? "star" : "stars"}
                  </span>
                  <Meter
                    aria-label={`${count} of ${reviews.length} reviews gave ${stars} stars`}
                    max={Math.max(reviews.length, 1)}
                    size="sm"
                    value={count}
                  />
                  <span className="w-8 text-end text-caption text-muted-foreground tabular-nums">
                    {number.format(count)}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <div
            className="flex flex-wrap items-center justify-between gap-3"
            data-slot="product-reviews-controls"
          >
            <div className="flex items-center gap-2">
              <Switch
                checked={verifiedOnly}
                id={`${id}-verified`}
                onCheckedChange={setVerifiedOnly}
              />
              <Label htmlFor={`${id}-verified`}>Verified purchases only</Label>
            </div>
            <Select onValueChange={(value) => setSort(value as Sort)} value={sort}>
              <SelectTrigger aria-label="Sort reviews" className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p aria-live="polite" className="sr-only">
            {shown.length} {shown.length === 1 ? "review" : "reviews"} shown.
          </p>

          {shown.length === 0 ? (
            <Card className="py-4">
              <StatePanel
                actions={
                  <Button onClick={() => setVerifiedOnly(false)} variant="outline">
                    Show every review
                  </Button>
                }
                description="None of the reviews so far comes from a verified purchase."
                kind="empty"
                title="No verified reviews yet"
                titleAs="h3"
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3" data-slot="product-reviews-list">
              {shown.map((review) => {
                const found = voted.has(review.id);
                return (
                  <li key={review.id}>
                    <Card>
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Rating
                            aria-label={`${review.rating} out of 5`}
                            readOnly
                            size="sm"
                            value={review.rating}
                          />
                          <span className="text-meta text-muted-foreground">
                            {date.format(new Date(review.date))}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-body font-semibold">{review.title}</h3>
                          <p className="text-body text-muted-foreground text-pretty">
                            {review.body}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Avatar className="size-7">
                            <AvatarFallback className="text-meta" name={review.author} />
                          </Avatar>
                          <span className="text-caption font-medium">{review.author}</span>
                          {review.variant ? (
                            <span className="text-caption text-muted-foreground">
                              Bought {review.variant}
                            </span>
                          ) : null}
                          {review.verified ? (
                            <Badge variant="success">
                              <BadgeCheck aria-hidden="true" />
                              Verified purchase
                            </Badge>
                          ) : null}
                          <Button
                            aria-pressed={found}
                            className="ms-auto tabular-nums"
                            onClick={() => toggleHelpful(review)}
                            size="sm"
                            variant={found ? "secondary" : "ghost"}
                          >
                            <ThumbsUp aria-hidden="true" />
                            {found ? "Helpful" : "Helpful?"}
                            <span className="text-muted-foreground">
                              {number.format(review.helpful)}
                            </span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
