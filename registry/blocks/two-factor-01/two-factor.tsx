"use client";

import { useEffect, useState } from "react";
import {
  Button,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  Spinner,
} from "@elabs-ai/components-ui";
import { AuthCard, AuthLink } from "@/components/auth-parts/auth-card";
import { useAuthSubmit, type AuthSubmitResult } from "@/components/auth-parts/use-auth-submit";

export interface TwoFactorProps {
  /** Called as soon as six digits are in. Return a message when the code is wrong. */
  onVerify?: (code: string) => AuthSubmitResult;
  onResend?: () => void;
  /** Where the code went, masked. */
  destination?: string;
  /** Seconds before another code may be requested. */
  resendAfter?: number;
  recoveryHref?: string;
  productName?: string;
}

/**
 * Two-factor — six digits in one input that submits itself when full, a resend that counts
 * down instead of failing silently, and a way out for someone without their phone.
 */
export function TwoFactor({
  onVerify,
  onResend,
  destination = "an authenticator app",
  resendAfter = 30,
  recoveryHref = "#recovery",
  productName,
}: TwoFactorProps) {
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(resendAfter);
  const submit = useAuthSubmit();

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const verify = (value: string) => void submit.run(() => onVerify?.(value));

  return (
    <AuthCard
      description={`Enter the six-digit code from ${destination}.`}
      footer={
        <>
          No access to your codes? <AuthLink href={recoveryHref}>Use a recovery code</AuthLink>
        </>
      }
      productName={productName}
      title="Two-step verification"
    >
      <div className="flex flex-col items-center gap-4">
        <InputOTP
          aria-invalid={submit.error !== null}
          aria-label="Six-digit verification code"
          disabled={submit.pending}
          maxLength={6}
          onChange={(value) => {
            setCode(value);
            if (value.length === 6) verify(value);
          }}
          value={code}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        {submit.error ? (
          <p className="text-center text-meta text-destructive-text" role="alert">
            {submit.error}
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={code.length < 6 || submit.pending}
          onClick={() => verify(code)}
        >
          {submit.pending ? <Spinner label="Checking the code" /> : null}
          {submit.pending ? "Checking…" : "Verify"}
        </Button>
        <Button
          disabled={wait > 0}
          onClick={() => {
            setWait(resendAfter);
            setCode("");
            onResend?.();
          }}
          variant="ghost"
        >
          {wait > 0 ? `Send a new code in ${wait} s` : "Send a new code"}
        </Button>
      </div>
    </AuthCard>
  );
}
