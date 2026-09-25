/**
 * Account page — for a signed-in account page of a store or community.
 *
 * What it shows a copier: The account page: the public profile with its stats and contribution strip, and the order history with track, reorder and invoice actions — a signed-in route inside the site frame.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { SiteFrame } from "@/components/site-frame/site-frame";
import { OrderHistory } from "@/components/order-history-01/order-history";
import { UserProfile } from "@/components/user-profile-01/user-profile";

export interface AccountPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function AccountPage({ productName = "Harbourline" }: AccountPageProps) {
  return (
    <SiteFrame productName={productName}>
      <div className="mx-auto w-full max-w-5xl px-4 py-16 flex flex-col gap-16">
        <UserProfile />
        <OrderHistory titleAs="h2" />
      </div>
    </SiteFrame>
  );
}
