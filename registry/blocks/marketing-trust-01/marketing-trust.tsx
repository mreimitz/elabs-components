import type { ComponentType, ReactNode, SVGProps } from "react";
import { ArrowRight, Globe, KeyRound, Lock, ShieldCheck, Activity } from "lucide-react";
import { TrustStrip, type TrustFact } from "@elabs-ai/components-marketing";
import { Badge, Button, Card, CardContent, Meter, SectionHeader } from "@elabs-ai/components-ui";

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

export interface TrustBadge {
  id: string;
  /** The standard, in words ("SOC 2 Type II") — never a certifier’s logo. */
  label: string;
  /** "Certified", "Compliant", "Ready", or the date of the last report. */
  status: string;
}

export interface SecurityFact {
  id: string;
  icon: Glyph;
  title: string;
  body: string;
  /** A measured value shown on a meter — uptime, coverage. */
  meter?: { value: number; min?: number; max?: number; label: string };
}

export interface MarketingTrustProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  badges?: TrustBadge[];
  facts?: SecurityFact[];
  /** Checkable facts under the cards, each linking to its proof. */
  proofs?: TrustFact[];
  trustCentreLabel?: string;
  trustCentreHref?: string;
}

const DEFAULT_BADGES: TrustBadge[] = [
  { id: "soc2", label: "SOC 2 Type II", status: "Report dated March 2026" },
  { id: "iso", label: "ISO 27001", status: "Certified" },
  { id: "gdpr", label: "GDPR", status: "Compliant, EU processing" },
  { id: "hipaa", label: "HIPAA", status: "Ready, BAA on request" },
];

const DEFAULT_FACTS: SecurityFact[] = [
  {
    id: "encryption",
    icon: Lock,
    title: "Encrypted everywhere",
    body: "TLS 1.3 in transit, AES-256 at rest, and keys rotated every ninety days. Bring your own key on Enterprise.",
  },
  {
    id: "sso",
    icon: KeyRound,
    title: "SSO and SCIM",
    body: "SAML 2.0 and OIDC with any identity provider. Seats are created and removed by SCIM, so leavers lose access the hour they leave.",
  },
  {
    id: "residency",
    icon: Globe,
    title: "Data stays in its region",
    body: "Choose the EU, the US or the UK per workspace. Backups, logs and support tooling stay in the same region.",
  },
  {
    id: "uptime",
    icon: Activity,
    title: "Uptime you can check",
    body: "Ninety days of measured availability across every region, published on the status page as it happens.",
    meter: { value: 99.98, min: 99, max: 100, label: "99.98% uptime over the last ninety days" },
  },
];

const DEFAULT_PROOFS: TrustFact[] = [
  { id: "status", label: "Status page", href: "#status" },
  { id: "pentest", label: "Annual penetration test", href: "#pentest" },
  { id: "subprocessors", label: "Sub-processor list", href: "#subprocessors" },
  { id: "dpa", label: "Data processing agreement", href: "#dpa" },
  { id: "disclosure", label: "Responsible disclosure", href: "#disclosure" },
];

/**
 * Compliance and security, stated plainly — the standards as text badges with a shield
 * (no borrowed certifier logos), four facts about how data is handled with the uptime
 * figure on a real meter, and a strip of proofs each linking to the document behind it.
 */
export function MarketingTrust({
  eyebrow = "Security",
  title = "Built for the people who have to sign off",
  description = "Everything on this page has a document behind it. Ask and we send it the same day.",
  badges = DEFAULT_BADGES,
  facts = DEFAULT_FACTS,
  proofs = DEFAULT_PROOFS,
  trustCentreLabel = "Visit the trust centre",
  trustCentreHref = "#trust",
}: MarketingTrustProps) {
  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-trust"
    >
      <SectionHeader
        actions={
          <Button asChild variant="outline">
            <a href={trustCentreHref}>
              {trustCentreLabel}
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
        }
        as="h2"
        description={description}
        eyebrow={eyebrow}
        title={title}
      />

      <ul
        aria-label="Standards"
        className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4"
        data-slot="marketing-trust-badges"
      >
        {badges.map((badge) => (
          <li
            className="flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-3"
            key={badge.id}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body font-semibold">{badge.label}</span>
              <span className="truncate text-meta text-muted-foreground">{badge.status}</span>
            </span>
          </li>
        ))}
      </ul>

      <ul
        className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-4"
        data-slot="marketing-trust-facts"
      >
        {facts.map((fact) => {
          const Icon = fact.icon;
          return (
            <li key={fact.id}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-subtitle font-semibold">{fact.title}</h3>
                    <p className="text-body text-muted-foreground text-pretty">{fact.body}</p>
                  </div>
                  {fact.meter ? (
                    <div className="mt-auto flex flex-col gap-2 pt-2">
                      <p className="flex items-baseline justify-between gap-2">
                        <span className="text-kpi font-semibold tabular-nums">
                          {fact.meter.value}%
                        </span>
                        <Badge variant="success">Measured</Badge>
                      </p>
                      <Meter
                        aria-label={fact.meter.label}
                        max={fact.meter.max ?? 100}
                        min={fact.meter.min ?? 0}
                        size="sm"
                        value={fact.meter.value}
                      />
                      <span className="text-meta text-muted-foreground">
                        Scale from {fact.meter.min ?? 0}% to {fact.meter.max ?? 100}%
                      </span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {proofs.length ? (
        <div className="border-t border-border-strong pt-6" data-slot="marketing-trust-proofs">
          <TrustStrip facts={proofs} />
        </div>
      ) : null}
    </section>
  );
}
