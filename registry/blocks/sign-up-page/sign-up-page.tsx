/**
 * Sign Up page — for the sign-up route of a product website.
 *
 * What it shows a copier: The sign-up page: the registration card with password strength and terms, centred in the site frame, with a logo strip below as reassurance.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { MarketingLogos } from "@/components/marketing-logos-01/marketing-logos";
import { RegisterForm } from "@/components/register-01/register-form";

export interface SignUpPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function SignUpPage({ productName = "Harbourline" }: SignUpPageProps) {
  return (
    <SiteFrame productName={productName}>
      <h1 className="sr-only">Create your account</h1>
      <div className="mx-auto w-full max-w-7xl px-4 flex flex-1 flex-col items-center justify-center py-16">
        <RegisterForm productName={productName} />
      </div>
      <MarketingLogos />
    </SiteFrame>
  );
}
