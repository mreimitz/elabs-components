/**
 * Sign In page — for the sign-in route of a product website.
 *
 * What it shows a copier: The sign-in page: the split login (form beside the brand aside) between the site's navbar and footer, with the sign-in link hidden from the navbar because you are already there.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { LoginSplit } from "@/components/login-02/login-split";

export interface SignInPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function SignInPage({ productName = "Harbourline" }: SignInPageProps) {
  return (
    <SiteFrame productName={productName} hideSignIn>
      <LoginSplit productName={productName} />
    </SiteFrame>
  );
}
