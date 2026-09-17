/* eslint-disable conventions/i18n-strings -- The Intent block is docs-site chrome for
   elabs-ai.com, not shipped package source: it has no consumer to localize it for, and
   its labels name repo concepts ("Anti-patterns", `brand-ui docs`). */
import { useContext } from "react";
import { DocsContext, Unstyled } from "@storybook/addon-docs/blocks";
import intentIndex from "./intent.generated.json";

/**
 * The Intent block — what the MCP knows, on the page a human reads.
 *
 * The manifest holds purpose, relationships, a state→token map and anti-patterns
 * for ~190 components; `brand-ui docs Button` returns all of it. The Storybook
 * page for the same component showed an H1, a preview and a props table, and 68
 * component pages had nothing at all between the H1 and the first preview
 * (2026-09-17 review §1.7). Two audiences were being served from two sources
 * that never met. This block is the meeting point, in both directions: it
 * renders the manifest record here, and it names `brand-ui docs <Name>` and the
 * hosted MCP so an agent can get the same facts machine-readably.
 *
 * Data comes from `intent.generated.json` (written by `pnpm gen`), keyed by
 * `meta.title` — never from the 1.5 MB manifest, which would land in the preview
 * bundle every visitor downloads.
 */

export const HOSTED_MCP_URL = "https://elabs-ai.com/mcp";

type Relationships = {
  usedInside?: string[];
  pairsWith?: string[];
  avoidNextTo?: string[];
  contains?: string[];
};

type IntentRecord = {
  name?: string;
  package?: string;
  storyId?: string;
  purpose?: string;
  category?: string;
  relationships?: Relationships;
  antiPatterns?: string[];
  stateTokens?: Record<string, string>;
  dataShapes?: string[];
  avoidWhen?: string;
  packages?: string[];
  templateFile?: string;
};

const INTENT: Record<string, IntentRecord> = intentIndex as Record<string, IntentRecord>;

const RELATIONSHIP_LABELS: [keyof Relationships, string][] = [
  ["contains", "Contains"],
  ["usedInside", "Used inside"],
  ["pairsWith", "Pairs with"],
  ["avoidNextTo", "Avoid next to"],
];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <dt className="text-meta shrink-0 uppercase tracking-wide text-muted-foreground sm:w-32">
        {label}
      </dt>
      <dd className="text-body m-0 min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

function Tokens({ values }: { values: string[] }) {
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1">
      {values.map((value) => (
        <code key={value} className="text-code rounded-sm bg-muted px-1.5 py-0.5">
          {value}
        </code>
      ))}
    </span>
  );
}

/**
 * The docs page's own title (`"Core/Button"`), which is the key of the generated
 * index. `storyById()` throws on a docs entry with no primary story, so the
 * lookup is guarded — a page without an entry renders nothing at all rather than
 * an empty frame.
 */
function useDocsTitle(): string {
  const context = useContext(DocsContext);
  try {
    return context.storyById().title ?? "";
  } catch {
    return "";
  }
}

export function Intent() {
  const title = useDocsTitle();
  const record = INTENT[title];
  if (!record) return null;

  const {
    name,
    package: pkg,
    purpose,
    category,
    relationships,
    antiPatterns,
    stateTokens,
    dataShapes,
    avoidWhen,
    packages,
  } = record;
  const importLine = name && pkg ? `import { ${name} } from "${pkg}";` : "";
  const relationshipRows = RELATIONSHIP_LABELS.filter(
    ([key]) => (relationships?.[key]?.length ?? 0) > 0,
  );
  const stateRows = Object.entries(stateTokens ?? {});

  return (
    <Unstyled>
      <section
        data-slot="docs-intent"
        className="my-6 flex flex-col gap-4 rounded-lg border border-border-strong bg-card p-5 text-foreground"
      >
        <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-subtitle m-0 font-semibold">Intent</h2>
          {pkg ? <code className="text-code text-muted-foreground">{pkg}</code> : null}
          {category ? (
            <span className="text-meta rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {category}
            </span>
          ) : null}
        </header>

        {purpose ? <p className="text-body m-0 max-w-prose">{purpose}</p> : null}

        {importLine ? (
          <pre className="text-code m-0 overflow-x-auto rounded-md bg-surface-muted p-3">
            <code>{importLine}</code>
          </pre>
        ) : null}

        {relationshipRows.length || stateRows.length || dataShapes?.length || avoidWhen ? (
          <dl className="m-0 flex flex-col gap-2">
            {dataShapes?.length ? (
              <Row label="Best for">
                <ul className="m-0 list-disc ps-5">
                  {dataShapes.map((shape) => (
                    <li key={shape}>{shape}</li>
                  ))}
                </ul>
              </Row>
            ) : null}
            {avoidWhen ? <Row label="Avoid when">{avoidWhen}</Row> : null}
            {relationshipRows.map(([key, label]) => (
              <Row key={key} label={label}>
                <Tokens values={relationships?.[key] ?? []} />
              </Row>
            ))}
            {packages?.length ? (
              <Row label="Packages">
                <Tokens values={packages} />
              </Row>
            ) : null}
            {stateRows.map(([state, token]) => (
              <Row key={state} label={state}>
                <code className="text-code">{token}</code>
              </Row>
            ))}
          </dl>
        ) : null}

        {antiPatterns?.length ? (
          <div className="flex flex-col gap-1">
            <h3 className="text-meta m-0 uppercase tracking-wide text-muted-foreground">
              Anti-patterns
            </h3>
            <ul className="text-body m-0 flex list-disc flex-col gap-1 ps-5">
              {antiPatterns.map((pattern) => (
                <li key={pattern}>{pattern}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-caption m-0 text-muted-foreground">
          Verify props with{" "}
          <code className="text-code">brand-ui docs {name || title.split("/").pop()}</code> or the
          hosted MCP at{" "}
          <a className="focus-ring underline" href={HOSTED_MCP_URL}>
            {HOSTED_MCP_URL}
          </a>
          .
        </p>
      </section>
    </Unstyled>
  );
}
