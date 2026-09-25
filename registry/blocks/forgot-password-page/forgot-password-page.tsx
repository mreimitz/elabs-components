/**
 * Forgot Password page — for the password-reset route.
 *
 * What it shows a copier: The forgot-password page: the reset card (email in, confirmation out) centred in the site frame — the same route shape as sign-in and sign-up.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { ForgotPassword } from "@/components/forgot-password-01/forgot-password";

export interface ForgotPasswordPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function ForgotPasswordPage({
  productName = "Harbourline",
}: ForgotPasswordPageProps) {
  return (
    <SiteFrame productName={productName}>
      <h1 className="sr-only">Reset your password</h1>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-16">
        <ForgotPassword productName={productName} />
      </div>
    </SiteFrame>
  );
}
