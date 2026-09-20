"use client";

import { useEffect, useState } from "react";
import { MailOpen } from "lucide-react";
import { Button } from "@elabs-ai/components-ui";
import { AuthCard, AuthLink } from "@/components/auth-parts/auth-card";

export interface VerifyEmailProps {
  email?: string;
  onResend?: () => void;
  /** Seconds before the email may be sent again. */
  resendAfter?: number;
  changeEmailHref?: string;
  productName?: string;
}

/**
 * Verify your email — the waiting room after sign-up: which address, what to do, a resend
 * that counts down, and the way back when the address was mistyped.
 */
export function VerifyEmail({
  email = "ada@acme.example",
  onResend,
  resendAfter = 45,
  changeEmailHref = "#register",
  productName,
}: VerifyEmailProps) {
  const [wait, setWait] = useState(0);
  const [sent, setSent] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  return (
    <AuthCard
      description={
        <>
          We sent a link to <strong className="text-foreground">{email}</strong>. Open it on this
          device to finish.
        </>
      }
      footer={
        <>
          Wrong address? <AuthLink href={changeEmailHref}>Change it</AuthLink>
        </>
      }
      productName={productName}
      title="Confirm your email"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <MailOpen aria-hidden="true" className="size-10 text-primary" />
        <p aria-live="polite" className="text-body text-muted-foreground">
          {sent === 0
            ? "The link works for 24 hours. It can take a minute to arrive."
            : `Sent again${sent > 1 ? ` (${sent} times)` : ""}. Check spam if it is still missing.`}
        </p>
        <Button
          className="w-full"
          disabled={wait > 0}
          onClick={() => {
            setSent((count) => count + 1);
            setWait(resendAfter);
            onResend?.();
          }}
          variant="outline"
        >
          {wait > 0 ? `Send again in ${wait} s` : "Send the email again"}
        </Button>
      </div>
    </AuthCard>
  );
}
