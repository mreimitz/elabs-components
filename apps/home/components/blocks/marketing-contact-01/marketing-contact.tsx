// registry: marketing-contact-01 — copied 2026-09-19
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, Clock, Mail, MapPin } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@elabs-ai/components-ui";

export interface ContactValues {
  name: string;
  email: string;
  topic: string;
  message: string;
}

export interface MarketingContactProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  topics?: string[];
  onSubmit?: (values: ContactValues) => string | void | Promise<string | void>;
}

/** Contact — a short form with a topic, what happens next, and the other ways to reach us. */
export function MarketingContact({
  eyebrow = "Contact",
  title = "Tell us what you are trying to move",
  description = "A person reads every message. You get an answer within one business day.",
  topics = [
    "A walkthrough of the product",
    "Pricing for my network",
    "Support for an existing account",
    "Something else",
  ],
  onSubmit,
}: MarketingContactProps) {
  const [values, setValues] = useState<ContactValues>({
    name: "",
    email: "",
    topic: topics[0] ?? "",
    message: "",
  });
  const [tried, setTried] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const set = (key: keyof ContactValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const errors = {
    name: values.name.trim() ? null : "Tell us your name.",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
      ? null
      : "Enter an email we can reply to.",
    message:
      values.message.trim().length >= 20
        ? null
        : "A sentence or two helps us send the right person.",
  };

  async function handle(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    setState("pending");
    const message = await onSubmit?.(values);
    if (message) {
      setFormError(message);
      return setState("idle");
    }
    setState("done");
  }

  return (
    <section
      className="@container mx-auto w-full max-w-7xl px-4 py-16"
      data-slot="marketing-contact"
    >
      <div className="grid grid-cols-1 gap-10 @4xl:grid-cols-2">
        <div className="flex flex-col gap-8">
          <SectionHeader as="h2" description={description} eyebrow={eyebrow} title={title} />
          <ul className="flex flex-col gap-4 text-body">
            <li className="flex items-center gap-3">
              <Mail aria-hidden="true" className="size-5 text-primary" />
              hello@acme-logistics.example
            </li>
            <li className="flex items-center gap-3">
              <Clock aria-hidden="true" className="size-5 text-primary" />
              Monday to Friday, 08:00–18:00 CET
            </li>
            <li className="flex items-center gap-3">
              <MapPin aria-hidden="true" className="size-5 text-primary" />
              Waalhaven Oostzijde 1, Rotterdam
            </li>
          </ul>
        </div>
        <Card>
          <CardContent className="p-6">
            {state === "done" ? (
              <div aria-live="polite" className="flex flex-col items-start gap-3">
                <CircleCheck aria-hidden="true" className="size-8 text-success-text" />
                <h3 className="text-subtitle font-semibold">
                  Thanks, {values.name.trim().split(" ")[0]}.
                </h3>
                <p className="text-body text-muted-foreground">
                  We will reply to {values.email.trim()} within one business day.
                </p>
              </div>
            ) : (
              <form className="flex flex-col gap-4" noValidate onSubmit={handle}>
                <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                  <FieldRoot invalid={tried && errors.name !== null} required>
                    <FieldLabel>Name</FieldLabel>
                    <FieldControl>
                      <Input
                        autoComplete="name"
                        onChange={(e) => set("name")(e.target.value)}
                        value={values.name}
                      />
                    </FieldControl>
                    {tried && errors.name ? <FieldError>{errors.name}</FieldError> : null}
                  </FieldRoot>
                  <FieldRoot invalid={tried && errors.email !== null} required>
                    <FieldLabel>Work email</FieldLabel>
                    <FieldControl>
                      <Input
                        autoComplete="email"
                        inputMode="email"
                        onChange={(e) => set("email")(e.target.value)}
                        type="email"
                        value={values.email}
                      />
                    </FieldControl>
                    {tried && errors.email ? <FieldError>{errors.email}</FieldError> : null}
                  </FieldRoot>
                </div>
                <FieldRoot>
                  <FieldLabel>What is it about?</FieldLabel>
                  <FieldControl>
                    <Select onValueChange={set("topic")} value={values.topic}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {topics.map((topic) => (
                          <SelectItem key={topic} value={topic}>
                            {topic}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldControl>
                </FieldRoot>
                <FieldRoot invalid={tried && errors.message !== null} required>
                  <FieldLabel>Message</FieldLabel>
                  <FieldControl>
                    <Textarea
                      onChange={(e) => set("message")(e.target.value)}
                      rows={5}
                      value={values.message}
                    />
                  </FieldControl>
                  {tried && errors.message ? <FieldError>{errors.message}</FieldError> : null}
                  {formError ? <FieldError>{formError}</FieldError> : null}
                </FieldRoot>
                <Button className="self-start" disabled={state === "pending"} type="submit">
                  {state === "pending" ? "Sending…" : "Send message"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
