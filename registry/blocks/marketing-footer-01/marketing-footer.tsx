import type { HTMLAttributes } from "react";
import { AppIcon } from "@elabs-ai/components-icons";
import { Separator, cn } from "@elabs-ai/components-ui";

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface MarketingFooterProps extends HTMLAttributes<HTMLElement> {
  productName?: string;
  tagline?: string;
  columns?: FooterColumn[];
  /** The legal line's owner. The year is passed in so the block renders the same every time. */
  company?: string;
  year?: number;
}

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Route planning", href: "#routes" },
      { label: "Driver app", href: "#drivers" },
      { label: "Customs", href: "#customs" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Customers", href: "#customers" },
      { label: "Careers", href: "#careers" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#docs" },
      { label: "Changelog", href: "#changelog" },
      { label: "System status", href: "#status" },
      { label: "Security", href: "#security" },
    ],
  },
];

/** The site footer: what it is in one line, where things are, and the legal row. */
export function MarketingFooter({
  productName = "Acme",
  tagline = "Logistics software for the day nothing goes to plan.",
  columns = DEFAULT_COLUMNS,
  company = "Acme Logistics B.V.",
  year = 2026,
  className,
  ...props
}: MarketingFooterProps) {
  return (
    <footer
      className={cn("@container w-full border-t border-border bg-background", className)}
      data-slot="marketing-footer"
      {...props}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-12">
        <div className="grid grid-cols-2 gap-10 @3xl:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-3">
            <AppIcon height={24} title={productName} />
            <p className="max-w-xs text-body text-muted-foreground text-pretty">{tagline}</p>
          </div>
          {columns.map((column) => (
            <nav aria-label={column.title} className="flex flex-col gap-3" key={column.title}>
              <h2 className="text-meta font-semibold">{column.title}</h2>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      className="rounded-sm text-body text-muted-foreground hover:text-foreground hover:underline focus-ring"
                      href={link.href}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 text-meta text-muted-foreground">
          <p>
            © {year} {company}
          </p>
          <ul className="flex flex-wrap gap-4">
            {["Privacy", "Terms", "Cookies"].map((label) => (
              <li key={label}>
                <a
                  className="rounded-sm hover:text-foreground hover:underline focus-ring"
                  href={`#${label.toLowerCase()}`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
