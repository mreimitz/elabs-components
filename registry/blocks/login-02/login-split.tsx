"use client";

import type { ReactNode } from "react";
import { Quote } from "lucide-react";
import { AppIcon } from "@elabs-ai/components-icons";
import { AuthLink } from "@/components/auth-parts/auth-card";
import { LoginFields, type LoginFormProps } from "@/components/login-01/login-form";

export interface LoginSplitProps extends Omit<LoginFormProps, "bare"> {
  /** What the brand panel says. Defaults to a customer quote. */
  aside?: ReactNode;
}

const DEFAULT_ASIDE = (
  <figure className="flex max-w-md flex-col gap-4">
    <Quote aria-hidden="true" className="size-8 opacity-60" />
    <blockquote className="text-subtitle font-medium text-balance">
      We moved dispatch planning onto it in a quarter. The team stopped asking where a shipment is
      and started asking what to do about it.
    </blockquote>
    <figcaption className="text-body opacity-80">
      Ingrid Solberg, Chief Operating Officer at Northwind Retail
    </figcaption>
  </figure>
);

/**
 * Sign in, split: the form on one side, a brand panel on the other that stands down on a
 * phone. The panel is painted with the primary pair, so it follows the theme.
 */
export function LoginSplit({
  aside = DEFAULT_ASIDE,
  registerHref = "#register",
  productName = "Acme",
  ...fields
}: LoginSplitProps) {
  return (
    <div className="@container h-full min-h-144" data-slot="login-split">
      <div className="grid h-full min-h-144 grid-cols-1 @3xl:grid-cols-2">
        <div className="flex flex-col justify-center gap-8 p-6 @3xl:p-12">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
            <AppIcon height={26} title={productName} />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-title font-semibold">Sign in to {productName}</h1>
              <p className="text-body text-muted-foreground">
                New here? <AuthLink href={registerHref}>Create an account</AuthLink>
              </p>
            </div>
            <div className="flex flex-col gap-5">
              <LoginFields {...fields} />
            </div>
          </div>
        </div>
        <aside className="hidden flex-col justify-end bg-primary p-12 text-primary-foreground @3xl:flex">
          {aside}
        </aside>
      </div>
    </div>
  );
}
