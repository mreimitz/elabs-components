"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Building2, CircleAlert, KeyRound } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  Label,
  Spinner,
} from "@elabs-ai/components-ui";
import {
  AuthCard,
  AuthDivider,
  AuthLink,
  isEmail,
  PasswordInput,
} from "@/components/auth-parts/auth-card";
import { useAuthSubmit, type AuthSubmitResult } from "@/components/auth-parts/use-auth-submit";

export interface LoginValues {
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginProvider {
  id: string;
  label: string;
  icon: ReactNode;
}

/** Brand-neutral by default; pass your identity providers with their own marks. */
export const DEFAULT_LOGIN_PROVIDERS: LoginProvider[] = [
  { id: "sso", label: "Continue with single sign-on", icon: <Building2 aria-hidden="true" /> },
  { id: "passkey", label: "Continue with a passkey", icon: <KeyRound aria-hidden="true" /> },
];

export interface LoginFormProps {
  /** Return a message to show it as the form error; return nothing on success. */
  onSubmit?: (values: LoginValues) => AuthSubmitResult;
  onProvider?: (provider: LoginProvider) => void;
  providers?: LoginProvider[];
  forgotHref?: string;
  registerHref?: string;
  productName?: string;
  /** Without the card frame — for a split layout that brings its own. */
  bare?: boolean;
}

/** The fields alone, so the card and the split layout share one form. */
export function LoginFields({
  onSubmit,
  onProvider,
  providers = DEFAULT_LOGIN_PROVIDERS,
  forgotHref = "#forgot",
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [tried, setTried] = useState(false);
  const submit = useAuthSubmit();

  const emailError = !email.trim()
    ? "Enter your work email."
    : !isEmail(email)
      ? "That does not look like an email address."
      : null;
  const passwordError = password ? null : "Enter your password.";

  function handle(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (emailError || passwordError) return;
    void submit.run(() => onSubmit?.({ email: email.trim(), password, remember }));
  }

  return (
    <>
      {submit.error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>We could not sign you in</AlertTitle>
          <AlertDescription>{submit.error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="flex flex-col gap-4" noValidate onSubmit={handle}>
        <FieldRoot invalid={tried && emailError !== null} required>
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
          {tried && emailError ? <FieldError>{emailError}</FieldError> : null}
        </FieldRoot>

        <FieldRoot invalid={tried && passwordError !== null} required>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel>Password</FieldLabel>
            <a
              className="rounded-sm text-meta text-muted-foreground underline-offset-4 hover:underline focus-ring"
              href={forgotHref}
            >
              Forgot it?
            </a>
          </div>
          <FieldControl>
            <PasswordInput
              autoComplete="current-password"
              onValueChange={setPassword}
              value={password}
            />
          </FieldControl>
          {tried && passwordError ? <FieldError>{passwordError}</FieldError> : null}
        </FieldRoot>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={remember}
            id="login-remember"
            onCheckedChange={(checked) => setRemember(checked === true)}
          />
          <Label className="font-normal" htmlFor="login-remember">
            Keep me signed in on this device
          </Label>
        </div>

        <Button disabled={submit.pending} type="submit">
          {submit.pending ? <Spinner label="Signing in" /> : null}
          {submit.pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {providers.length > 0 ? (
        <>
          <AuthDivider />
          <div className="flex flex-col gap-2">
            {providers.map((provider) => (
              <Button key={provider.id} onClick={() => onProvider?.(provider)} variant="outline">
                {provider.icon}
                {provider.label}
              </Button>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

/**
 * Sign in — email and password, the two other ways in, and every state a real form has:
 * field errors after the first attempt, a pending button, and the server's answer as an alert.
 */
export function LoginForm({
  registerHref = "#register",
  productName,
  bare = false,
  ...fields
}: LoginFormProps) {
  if (bare) return <LoginFields {...fields} />;
  return (
    <AuthCard
      description="Sign in to pick up where you left off."
      footer={
        <>
          New here? <AuthLink href={registerHref}>Create an account</AuthLink>
        </>
      }
      productName={productName}
      title="Welcome back"
    >
      <LoginFields {...fields} />
    </AuthCard>
  );
}
