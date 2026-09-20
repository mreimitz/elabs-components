/**
 * Auth parts — what every sign-in screen in this registry shares: the card frame with the
 * brand mark, a password field that can show what was typed, a strength meter that explains
 * itself, and the two validators. The blocks never call a server: they validate, then hand
 * the values to `onSubmit`, which may return an error message to show.
 */
"use client";

import { useId, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AppIcon } from "@elabs-ai/components-icons";
import {
  Card,
  CardContent,
  cn,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  Meter,
} from "@elabs-ai/components-ui";

export interface AuthCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** The line under the card: "No account? Create one". */
  footer?: ReactNode;
  /** Product name for the brand mark. */
  productName?: string;
  children: ReactNode;
  className?: string;
}

/** The centred card every auth step sits in. One `h1` per screen: the title. */
export function AuthCard({
  title,
  description,
  footer,
  productName = "Acme",
  children,
  className,
}: AuthCardProps) {
  return (
    <div
      className={cn("mx-auto flex w-full max-w-sm flex-col gap-6", className)}
      data-slot="auth-card"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <AppIcon height={28} title={productName} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title font-semibold text-balance">{title}</h1>
          {description ? (
            <p className="text-body text-muted-foreground text-pretty">{description}</p>
          ) : null}
        </div>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">{children}</CardContent>
      </Card>
      {footer ? <p className="text-center text-body text-muted-foreground">{footer}</p> : null}
    </div>
  );
}

/** A link inside auth copy. */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-ring"
      href={href}
    >
      {children}
    </a>
  );
}

/** "or" between two ways in. */
export function AuthDivider({ children = "or" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-caption text-muted-foreground uppercase">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}

export interface PasswordInputProps {
  value: string;
  onValueChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  id?: string;
  name?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}

/** A password input with a show/hide toggle that says what it will do. */
export function PasswordInput({ value, onValueChange, ...props }: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  return (
    <InputGroup>
      <InputGroupInput
        onChange={(event) => onValueChange(event.target.value)}
        type={shown ? "text" : "password"}
        value={value}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
          size="icon-xs"
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

const RULES: { test: (value: string) => boolean; label: string }[] = [
  { test: (value) => value.length >= 12, label: "12 characters or more" },
  { test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value), label: "upper and lower case" },
  { test: (value) => /\d/.test(value), label: "a number" },
  { test: (value) => /[^A-Za-z0-9]/.test(value), label: "a symbol" },
];
const WORDS = ["Too short to judge", "Weak", "Fair", "Good", "Strong"];

/** How many of the four rules a password meets, 0–4. */
export function passwordScore(value: string): number {
  return RULES.filter((rule) => rule.test(value)).length;
}

/** The strength as a word, a meter, and the rules still unmet — never colour alone. */
export function PasswordStrength({ value }: { value: string }) {
  const id = useId();
  const score = passwordScore(value);
  const missing = RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
  return (
    <div className="flex flex-col gap-1.5" data-slot="password-strength">
      <div className="flex items-center gap-2">
        <Meter
          aria-labelledby={id}
          className="flex-1"
          max={4}
          segments={4}
          size="xs"
          value={score}
        />
        <span className="w-32 text-end text-caption text-muted-foreground" id={id}>
          {value ? WORDS[score] : "Not set yet"}
        </span>
      </div>
      {value && missing.length > 0 ? (
        <p className="text-caption text-muted-foreground">Still missing: {missing.join(", ")}.</p>
      ) : null}
    </div>
  );
}

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
