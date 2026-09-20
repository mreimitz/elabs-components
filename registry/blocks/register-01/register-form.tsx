"use client";

import { useState, type FormEvent } from "react";
import { CircleAlert } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  Label,
  Spinner,
} from "@elabs-ai/components-ui";
import {
  AuthCard,
  AuthLink,
  isEmail,
  PasswordInput,
  passwordScore,
  PasswordStrength,
} from "@/components/auth-parts/auth-card";
import { useAuthSubmit, type AuthSubmitResult } from "@/components/auth-parts/use-auth-submit";

export interface RegisterValues {
  name: string;
  email: string;
  password: string;
}

export interface RegisterFormProps {
  /** Return a message to show it as the form error; return nothing on success. */
  onSubmit?: (values: RegisterValues) => AuthSubmitResult;
  loginHref?: string;
  termsHref?: string;
  privacyHref?: string;
  productName?: string;
}

/**
 * Create an account — name, email, a password with a strength meter that says what is still
 * missing, and consent that must be given rather than assumed.
 */
export function RegisterForm({
  onSubmit,
  loginHref = "#login",
  termsHref = "#terms",
  privacyHref = "#privacy",
  productName,
}: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [tried, setTried] = useState(false);
  const submit = useAuthSubmit();

  const errors = {
    name: name.trim() ? null : "Tell us what to call you.",
    email: !email.trim()
      ? "Enter your work email."
      : !isEmail(email)
        ? "That does not look like an email address."
        : null,
    password:
      passwordScore(password) >= 3
        ? null
        : "Choose a stronger password — see what is still missing below.",
    agreed: agreed ? null : "You need to accept the terms to create an account.",
  };

  function handle(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    void submit.run(() => onSubmit?.({ name: name.trim(), email: email.trim(), password }));
  }

  return (
    <AuthCard
      description="Fourteen days free. No card needed."
      footer={
        <>
          Already have an account? <AuthLink href={loginHref}>Sign in</AuthLink>
        </>
      }
      productName={productName}
      title="Create your account"
    >
      {submit.error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>We could not create the account</AlertTitle>
          <AlertDescription>{submit.error}</AlertDescription>
        </Alert>
      ) : null}

      <form className="flex flex-col gap-4" noValidate onSubmit={handle}>
        <FieldRoot invalid={tried && errors.name !== null} required>
          <FieldLabel>Full name</FieldLabel>
          <FieldControl>
            <Input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              value={name}
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
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              value={email}
            />
          </FieldControl>
          <FieldDescription>We send one email to confirm it is yours.</FieldDescription>
          {tried && errors.email ? <FieldError>{errors.email}</FieldError> : null}
        </FieldRoot>

        <FieldRoot invalid={tried && errors.password !== null} required>
          <FieldLabel>Password</FieldLabel>
          <FieldControl>
            <PasswordInput
              autoComplete="new-password"
              onValueChange={setPassword}
              value={password}
            />
          </FieldControl>
          <PasswordStrength value={password} />
          {tried && errors.password ? <FieldError>{errors.password}</FieldError> : null}
        </FieldRoot>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <Checkbox
              aria-invalid={tried && errors.agreed !== null}
              checked={agreed}
              className="mt-0.5"
              id="register-terms"
              onCheckedChange={(checked) => setAgreed(checked === true)}
            />
            <Label className="font-normal text-pretty" htmlFor="register-terms">
              I agree to the <AuthLink href={termsHref}>terms of service</AuthLink> and the{" "}
              <AuthLink href={privacyHref}>privacy policy</AuthLink>.
            </Label>
          </div>
          {tried && errors.agreed ? (
            <p className="text-meta text-destructive-text" role="alert">
              {errors.agreed}
            </p>
          ) : null}
        </div>

        <Button disabled={submit.pending} type="submit">
          {submit.pending ? <Spinner label="Creating your account" /> : null}
          {submit.pending ? "Creating your account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
