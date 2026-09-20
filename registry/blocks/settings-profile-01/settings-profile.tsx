"use client";

import { useState, type FormEvent } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
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
} from "@elabs-ai/components-ui";

export interface ProfileValues {
  name: string;
  email: string;
  title: string;
  timezone: string;
  bio: string;
}

export interface SettingsProfileProps {
  defaultValues?: ProfileValues;
  timezones?: string[];
  onSave?: (values: ProfileValues) => void;
  onDeleteAccount?: () => void;
}

const DEFAULTS: ProfileValues = {
  name: "Ada Okonkwo",
  email: "ada@acme-logistics.example",
  title: "Head of Operations",
  timezone: "Europe/Amsterdam",
  bio: "Runs the Rotterdam network. Ask me about cut-off times.",
};

const BIO_LIMIT = 160;

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Profile settings — a form that knows whether it is dirty (the save bar appears only then,
 * and Discard puts everything back), validates on save, counts the bio down, and keeps the
 * irreversible action in its own zone behind a confirmation that names what is lost.
 */
export function SettingsProfile({
  defaultValues = DEFAULTS,
  timezones = ["Europe/Amsterdam", "Europe/Lisbon", "America/New_York", "Asia/Singapore"],
  onSave,
  onDeleteAccount,
}: SettingsProfileProps) {
  const [saved, setSaved] = useState(defaultValues);
  const [values, setValues] = useState(defaultValues);
  const [tried, setTried] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = (key: keyof ProfileValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  const dirty = (Object.keys(values) as (keyof ProfileValues)[]).some(
    (key) => values[key] !== saved[key],
  );

  const errors = {
    name: values.name.trim() ? null : "Your name cannot be empty.",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
      ? null
      : "Enter a valid email address.",
    bio: values.bio.length <= BIO_LIMIT ? null : `Keep it under ${BIO_LIMIT} characters.`,
  };

  function handle(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaved(values);
    setTried(false);
    onSave?.(values);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-slot="settings-profile">
      <form noValidate onSubmit={handle}>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How you appear to the people you work with.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback className="text-subtitle">
                  {initials(values.name || "?")}
                </AvatarFallback>
              </Avatar>
              <p className="text-meta text-muted-foreground">
                Your initials are used until you add a photo.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldRoot invalid={tried && errors.name !== null} required>
                <FieldLabel>Full name</FieldLabel>
                <FieldControl>
                  <Input
                    autoComplete="name"
                    onChange={(e) => set("name")(e.target.value)}
                    value={values.name}
                  />
                </FieldControl>
                {tried && errors.name ? <FieldError>{errors.name}</FieldError> : null}
              </FieldRoot>
              <FieldRoot>
                <FieldLabel>Job title</FieldLabel>
                <FieldControl>
                  <Input
                    autoComplete="organization-title"
                    onChange={(e) => set("title")(e.target.value)}
                    value={values.title}
                  />
                </FieldControl>
              </FieldRoot>
            </div>
            <FieldRoot invalid={tried && errors.email !== null} required>
              <FieldLabel>Email</FieldLabel>
              <FieldControl>
                <Input
                  autoComplete="email"
                  inputMode="email"
                  onChange={(e) => set("email")(e.target.value)}
                  type="email"
                  value={values.email}
                />
              </FieldControl>
              <FieldDescription>
                Changing it sends a confirmation to the new address first.
              </FieldDescription>
              {tried && errors.email ? <FieldError>{errors.email}</FieldError> : null}
            </FieldRoot>
            <FieldRoot>
              <FieldLabel>Time zone</FieldLabel>
              <FieldControl>
                <Select onValueChange={set("timezone")} value={values.timezone}>
                  {/* A `role="combobox"` button is never named by its contents — that text is
                      the VALUE — and a `<label for>` cannot name a button. */}
                  <SelectTrigger aria-label="Time zone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldControl>
              <FieldDescription>Cut-off times and reports use this zone.</FieldDescription>
            </FieldRoot>
            <FieldRoot invalid={errors.bio !== null}>
              <FieldLabel>About</FieldLabel>
              <FieldControl>
                <Textarea
                  onChange={(e) => set("bio")(e.target.value)}
                  rows={3}
                  value={values.bio}
                />
              </FieldControl>
              <FieldDescription>
                {BIO_LIMIT - values.bio.length >= 0
                  ? `${BIO_LIMIT - values.bio.length} characters left`
                  : `${values.bio.length - BIO_LIMIT} characters over`}
              </FieldDescription>
              {errors.bio ? <FieldError>{errors.bio}</FieldError> : null}
            </FieldRoot>
            {dirty ? (
              <div
                aria-live="polite"
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3"
                data-slot="settings-save-bar"
              >
                <span className="text-body">You have unsaved changes.</span>
                <span className="flex gap-2">
                  <Button
                    onClick={() => {
                      setValues(saved);
                      setTried(false);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    Discard
                  </Button>
                  <Button type="submit">Save changes</Button>
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </form>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Removes your profile, your saved views and your API keys. Shipments you created stay
            with the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setConfirming(true)} variant="destructive">
            Delete my account
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        confirmLabel="Delete my account"
        description={`This cannot be undone. ${saved.email} will be signed out everywhere and removed from every workspace.`}
        onConfirm={() => {
          setConfirming(false);
          onDeleteAccount?.();
        }}
        onOpenChange={setConfirming}
        open={confirming}
        title="Delete your account?"
        tone="destructive"
      />
    </div>
  );
}
