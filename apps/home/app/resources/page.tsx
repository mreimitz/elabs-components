import type { Metadata } from "next";
import { SectionHeader } from "@elabs-ai/components-ui";
import { SiteGround } from "../../components/site-ground";
import { SiteFooter } from "../../components/site-footer";
import { siteShellCopy } from "../../content/copy";
import { PageBand } from "../../components/page-band";

export const metadata: Metadata = {
  title: siteShellCopy.nav.resources,
  description: siteShellCopy.resourcesLead,
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <>
      <SiteGround />
      <PageBand width="6xl">
        <SectionHeader
          as="h1"
          title={siteShellCopy.nav.resources}
          description={siteShellCopy.resourcesLead}
        />
      </PageBand>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <SiteFooter />
      </div>
    </>
  );
}
