"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { CalendarCheck, Check, CircleAlert, Clock } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  cn,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";

export interface DemoHost {
  name: string;
  role: string;
}

export interface DemoSlot {
  id: string;
  /** The day, as the reader should see it ("Tue 6 Oct"). */
  day: string;
  /** The time, with its zone ("10:00 CET"). */
  time: string;
  /** A slot someone else took; shown, not selectable. */
  taken?: boolean;
}

export interface DemoRequest {
  name: string;
  email: string;
  companySize: string;
  useCase: string;
  slot: DemoSlot;
}

export interface MarketingBookDemoProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Length of the call, in words ("30 minutes"). */
  duration?: string;
  /** What happens on the call. */
  agenda?: string[];
  hosts?: DemoHost[];
  companySizes?: string[];
  slots?: DemoSlot[];
  /** Return a message to show as the error; return nothing on success. */
  onBook?: (request: DemoRequest) => string | void | Promise<string | void>;
}

const DEFAULT_AGENDA = [
  "Your network on a map, with last week’s orders, in the first five minutes.",
  "The three things teams like yours changed first, and what they got back.",
  "Pricing, rollout and who does what, with nothing to sign afterwards.",
];

const DEFAULT_HOSTS: DemoHost[] = [
  { name: "Priya Raman", role: "Solutions engineer" },
  { name: "Jonas Weber", role: "Former depot manager, now onboarding" },
];

const DEFAULT_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "More than 1,000"];

const DEFAULT_SLOTS: DemoSlot[] = [
  { id: "tue-10", day: "Tue 6 Oct", time: "10:00 CET" },
  { id: "tue-15", day: "Tue 6 Oct", time: "15:00 CET", taken: true },
  { id: "wed-09", day: "Wed 7 Oct", time: "09:30 CET" },
  { id: "wed-14", day: "Wed 7 Oct", time: "14:00 CET" },
  { id: "thu-11", day: "Thu 8 Oct", time: "11:00 CET" },
  { id: "thu-16", day: "Thu 8 Oct", time: "16:30 CET" },
];

type Errors = Partial<Record<"name" | "email" | "companySize" | "slot" | "form", string>>;

/**
 * Book a demo — on the left what the half hour covers and who runs it, on the right a form
 * that validates on submit (name, work email, company size, use case, and a slot chosen
 * from a row of time chips). Taken slots stay visible but cannot be picked. Booking ends in
 * a confirmation that repeats the slot and the address.
 */
export function MarketingBookDemo({
  eyebrow = "Book a demo",
  title = "See your own routes in it, not ours",
  description = "Bring last week’s orders. We import them live and plan them in front of you.",
  duration = "30 minutes",
  agenda = DEFAULT_AGENDA,
  hosts = DEFAULT_HOSTS,
  companySizes = DEFAULT_SIZES,
  slots = DEFAULT_SLOTS,
  onBook,
}: MarketingBookDemoProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [useCase, setUseCase] = useState("");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const slotErrorId = useId();
  const chosen = slots.find((slot) => slot.id === slotId) ?? null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = "Tell us who to expect.";
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) next.email = "Enter your work email.";
    else if (/@(gmail|yahoo|hotmail|outlook)\./.test(address))
      next.email = "A work address, please — the demo is set up for your company.";
    if (!companySize) next.companySize = "Pick the closest size.";
    if (!chosen) next.slot = "Choose a time.";
    setErrors(next);
    if (Object.keys(next).length || !chosen) return;
    setState("pending");
    const message = await onBook?.({
      name: name.trim(),
      email: address,
      companySize,
      useCase: useCase.trim(),
      slot: chosen,
    });
    if (message) {
      setErrors({ form: message });
      return setState("idle");
    }
    setState("done");
  }

  return (
    <section
      className="@container mx-auto w-full max-w-7xl px-4 py-16"
      data-slot="marketing-book-demo"
    >
      <div className="grid grid-cols-1 gap-10 @3xl:grid-cols-[2fr_3fr] @3xl:gap-16">
        <div className="flex flex-col gap-8" data-slot="marketing-book-demo-expect">
          <div className="flex flex-col gap-3">
            {eyebrow ? (
              <p className="text-eyebrow uppercase text-muted-foreground">{eyebrow}</p>
            ) : null}
            <h2 className="text-display font-semibold text-balance">{title}</h2>
            <p className="text-body text-muted-foreground text-pretty">{description}</p>
          </div>
          <p className="flex items-center gap-2 text-body">
            <Clock aria-hidden="true" className="size-4 text-muted-foreground" />
            {duration}, on a video call. No slides.
          </p>
          <ol className="flex flex-col gap-3">
            {agenda.map((item, i) => (
              <li className="flex items-start gap-3 text-body" key={item}>
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-semibold tabular-nums text-primary-text"
                >
                  {i + 1}
                </span>
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3">
            <h3 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Who you’ll meet
            </h3>
            <ul className="flex flex-col gap-3">
              {hosts.map((host) => (
                <li className="flex items-center gap-3" key={host.name}>
                  <Avatar className="size-10">
                    <AvatarFallback className="text-caption" name={host.name} />
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body font-medium">{host.name}</span>
                    <span className="truncate text-meta text-muted-foreground">{host.role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Card data-slot="marketing-book-demo-form">
          <CardContent className="p-6">
            {state === "done" && chosen ? (
              <Alert
                aria-live="polite"
                className="p-5"
                data-slot="marketing-book-demo-booked"
                role="status"
                variant="success"
              >
                <CalendarCheck aria-hidden="true" />
                <AlertTitle as="h3" className="text-title">
                  You’re booked
                </AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <p>
                    <strong className="font-medium text-foreground">
                      {chosen.day}, {chosen.time}
                    </strong>{" "}
                    — {duration} with {hosts.map((host) => host.name).join(" and ")}. The invite is
                    on its way to{" "}
                    <strong className="font-medium text-foreground">
                      {email.trim().toLowerCase()}
                    </strong>
                    .
                  </p>
                  <p className="text-meta">
                    Need to move it? The invite has a link to pick another time.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
                <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
                  <FieldRoot invalid={Boolean(errors.name)} required>
                    <FieldLabel>Name</FieldLabel>
                    <FieldControl>
                      <Input
                        autoComplete="name"
                        onChange={(event) => setName(event.target.value)}
                        value={name}
                      />
                    </FieldControl>
                    {errors.name ? <FieldError>{errors.name}</FieldError> : null}
                  </FieldRoot>
                  <FieldRoot invalid={Boolean(errors.email)} required>
                    <FieldLabel>Work email</FieldLabel>
                    <FieldControl>
                      <Input
                        autoComplete="email"
                        inputMode="email"
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@company.com"
                        type="email"
                        value={email}
                      />
                    </FieldControl>
                    {errors.email ? <FieldError>{errors.email}</FieldError> : null}
                  </FieldRoot>
                </div>
                <FieldRoot invalid={Boolean(errors.companySize)} required>
                  <FieldLabel>Company size</FieldLabel>
                  <FieldControl>
                    <Select onValueChange={setCompanySize} value={companySize}>
                      <SelectTrigger aria-label="Company size">
                        <SelectValue placeholder="How many people?" />
                      </SelectTrigger>
                      <SelectContent>
                        {companySizes.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size} people
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldControl>
                  {errors.companySize ? <FieldError>{errors.companySize}</FieldError> : null}
                </FieldRoot>
                <FieldRoot>
                  <FieldLabel>What would you like to see?</FieldLabel>
                  <FieldControl>
                    <Textarea
                      onChange={(event) => setUseCase(event.target.value)}
                      placeholder="Three depots, a lot of returns, and a carrier that keeps missing the afternoon cut-off…"
                      rows={3}
                      value={useCase}
                    />
                  </FieldControl>
                  <FieldDescription>
                    Optional. It helps us bring the right example.
                  </FieldDescription>
                </FieldRoot>

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-body font-medium">
                    Preferred time
                    <span aria-hidden="true" className="text-destructive-text">
                      {" "}
                      *
                    </span>
                  </legend>
                  <ToggleGroup
                    aria-describedby={errors.slot ? slotErrorId : undefined}
                    aria-invalid={errors.slot ? true : undefined}
                    className="flex-wrap justify-start gap-2"
                    data-slot="marketing-book-demo-slots"
                    onValueChange={(value) => {
                      // Radix reports "" when the pressed item is pressed again; a booking
                      // keeps its time until another one is chosen.
                      if (!value) return;
                      setSlotId(value);
                      setErrors((prev) => ({ ...prev, slot: undefined }));
                    }}
                    type="single"
                    value={slotId ?? ""}
                    variant="outline"
                  >
                    {slots.map((slot) => {
                      const pressed = slot.id === slotId;
                      return (
                        <ToggleGroupItem
                          className={cn(
                            "h-auto flex-col items-start px-3 py-2 text-start",
                            slot.taken && "line-through",
                          )}
                          disabled={slot.taken}
                          key={slot.id}
                          value={slot.id}
                        >
                          <span className="text-meta">{slot.day}</span>
                          <span className="flex items-center gap-1 text-body font-medium tabular-nums">
                            {pressed ? <Check aria-hidden="true" className="size-3.5" /> : null}
                            {slot.time}
                          </span>
                          {slot.taken ? <span className="sr-only">, taken</span> : null}
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                  {/*
                    A group error, not a field error: the slots are a `fieldset`/`legend` (a
                    label can't name a group), which `FieldRoot`/`FieldError` don't model — so
                    this is `FieldError`'s own markup, written out for the one group.
                  */}
                  {errors.slot ? (
                    <p
                      className="text-body font-medium text-destructive-text"
                      id={slotErrorId}
                      role="alert"
                    >
                      {errors.slot}
                    </p>
                  ) : (
                    <p className="text-meta text-muted-foreground">
                      Times are in Central European Time. We will confirm within the hour.
                    </p>
                  )}
                </fieldset>

                {errors.form ? (
                  <Alert role="alert" variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  className="self-start"
                  disabled={state === "pending"}
                  size="lg"
                  type="submit"
                >
                  {state === "pending" ? "Booking…" : "Book the demo"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
