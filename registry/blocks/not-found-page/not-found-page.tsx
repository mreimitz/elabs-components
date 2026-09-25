/**
 * Not Found page — for the 404 route of a website.
 *
 * What it shows a copier: The 404 page: an empty-state panel with the two ways out (home, search the help center) inside the site frame, and the resources library so the visit is not wasted.
 * Every block is a copy-own registry item; the frame (`SiteFrame`) is the navbar, one `<main>`
 * landmark and the footer. Swap a block, keep the route.
 */
import { Button, StatePanel } from "@elabs-ai/components-ui";
import { SiteFrame } from "@/components/site-frame/site-frame";
import { Resources } from "@/components/resources-01/resources";

export interface NotFoundPageProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
}

export default function NotFoundPage({ productName = "Harbourline" }: NotFoundPageProps) {
  return (
    <SiteFrame productName={productName}>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-24">
        <StatePanel
          actions={
            <>
              <Button asChild>
                <a href="#home">Back to home</a>
              </Button>
              <Button asChild variant="outline">
                <a href="#help">Search the help center</a>
              </Button>
            </>
          }
          description="The page moved, was renamed or never existed. The address may be misspelled — or the link that sent you here is out of date."
          kind="empty"
          size="lg"
          title="We can’t find that page"
          titleAs="h1"
        />
      </div>
      <Resources titleAs="h2" />
    </SiteFrame>
  );
}
