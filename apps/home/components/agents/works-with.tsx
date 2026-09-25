/**
 * WorksWith — the "works with your agent" section (RM-102, concept §2, §4.4).
 *
 * A plain server component: `IntegrationMatrix` and `InstallTabs` (`@elabs-ai/components-ui`)
 * carry their own "use client" boundary, so this file needs none (same shape as
 * `SiteFooter` around `AttributionPanel`). Every string is `worksWithCopy`/`installTabsCopy`/
 * `tourCopy`/`shellCopy` (`content/copy.ts`); every command and count is
 * `install`/`cli`/`blocks`/`countFor` (`content/generated/*.json`, read through
 * `lib/content.ts`) — never typed here, except the JSON-snippet SHAPE for MCP hosts other
 * than Claude Code, which is this site's own formatting of `install.hostedMcp.url` (no new
 * command is invented — the url is the generated one). Same for Codex's `mcp_servers` TOML
 * entry: `url = "..."` is Codex's own documented Streamable-HTTP remote-server form, formatting
 * that same generated url — no bespoke transport is invented for it either.
 */
import {
  IntegrationMatrix,
  InstallTabs,
  type IntegrationMatrixHost,
  type IntegrationMatrixRow,
  type InstallTabsHostTab,
  type InstallTabsSelectOption,
} from "@elabs-ai/components-ui";
import { blocks, cli, countFor, install } from "../../lib/content";
import { installTabsCopy, shellCopy, tourCopy, worksWithCopy } from "../../content/copy";

const HOSTS: IntegrationMatrixHost[] = [...worksWithCopy.hosts];

/**
 * The hosted-MCP row's copy command, per host. Only `install.hostedMcp`'s Claude Code CLI form
 * and bare url are generated; the JSON-snippet SHAPE for the other editors is this site's own
 * formatting of that same url — no new command is invented.
 */
export function hostedMcpCommands(): Record<string, string> {
  const url = install.hostedMcp.url;
  const jsonSnippet = (key: "mcpServers" | "servers") =>
    `{ "${key}": { "brand-ui": { "url": "${url}" } } }`;
  return {
    "claude-code": install.hostedMcp.command,
    cursor: jsonSnippet("mcpServers"),
    vscode: jsonSnippet("servers"),
    // Codex's own remote-server form (Streamable HTTP): a `[mcp_servers.<name>]` table with a
    // bare `url` — no command/args, unlike its stdio form (see `lib/agent-hosts.ts`'s `codex mcp
    // add … -- <command>`, used for the LOCAL row's chip, a different transport).
    codex: `[mcp_servers.brand-ui]\nurl = "${url}"`,
    other: url,
  };
}

function pluginCommands(): Record<string, string> {
  const note = worksWithCopy.rows.plugin.otherHostNote;
  return {
    "claude-code": install.plugin.marketplaceAdd,
    cursor: note,
    vscode: note,
    codex: note,
    other: note,
  };
}

export function buildRows(): IntegrationMatrixRow[] {
  const registryBlocks = countFor("registryBlocks").value;
  return [
    {
      id: "hosted-mcp",
      unit: worksWithCopy.rows.hostedMcp.unit,
      gives: worksWithCopy.rows.hostedMcp.gives,
      actions: [
        { label: worksWithCopy.rows.hostedMcp.action, kind: "copy", value: hostedMcpCommands() },
      ],
    },
    {
      id: "local-mcp",
      unit: worksWithCopy.rows.localMcp.unit,
      gives: worksWithCopy.rows.localMcp.gives,
      actions: [
        {
          label: worksWithCopy.rows.localMcp.action,
          kind: "copy",
          value: install.localMcp.command,
        },
      ],
    },
    {
      id: "plugin",
      unit: worksWithCopy.rows.plugin.unit,
      gives: worksWithCopy.rows.plugin.gives(install.plugin.skillCount),
      actions: [{ label: worksWithCopy.rows.plugin.action, kind: "copy", value: pluginCommands() }],
    },
    {
      id: "llms-txt",
      unit: worksWithCopy.rows.llmsTxt.unit,
      gives: worksWithCopy.rows.llmsTxt.gives,
      actions: [{ label: worksWithCopy.rows.llmsTxt.action, kind: "link", value: "/llms.txt" }],
    },
    {
      id: "registry",
      unit: worksWithCopy.rows.registry.unit,
      gives: worksWithCopy.rows.registry.gives(registryBlocks),
      actions: [
        { label: worksWithCopy.rows.registry.action, kind: "link", value: "/r/registry.json" },
      ],
    },
    {
      id: "manifest",
      unit: worksWithCopy.rows.manifest.unit,
      gives: worksWithCopy.rows.manifest.gives,
      actions: [
        {
          label: worksWithCopy.rows.manifest.action,
          kind: "link",
          value: `${shellCopy.links.github}/blob/main/brand-ui.manifest.json`,
        },
      ],
    },
  ];
}

/** `cli.routine` ("info → search → docs → build → audit") supplies the ORDER; the tooltip
 *  prose is `worksWithCopy.routineDoes`. The last (audit) chip shows the `--strict` form. */
function buildRoutine() {
  const verbs = cli.routine.split(" → ");
  return verbs.map((verb, index) => {
    const does = worksWithCopy.routineDoes[verb as keyof typeof worksWithCopy.routineDoes] ?? "";
    const isLast = index === verbs.length - 1;
    return { verb: isLast ? `${verb} --strict` : verb, does };
  });
}

function buildPackageOptions(): InstallTabsSelectOption[] {
  return install.perArchetype.map((entry) => ({
    id: entry.archetype,
    label: tourCopy.tabs[entry.archetype as keyof typeof tourCopy.tabs]?.label ?? entry.archetype,
    command: entry.command,
  }));
}

function buildBlockOptions(): InstallTabsSelectOption[] {
  return blocks.map((block) => ({
    id: block.name,
    label: block.title,
    command: `npx shadcn@latest add ${install.registryHomepage}/${block.name}.json`,
  }));
}

function buildHostTabs(): InstallTabsHostTab[] {
  return [
    {
      id: "claude-code",
      label: "Claude Code",
      commands: [
        { label: "Add marketplace", command: install.plugin.marketplaceAdd },
        { label: "Install plugin", command: install.plugin.install },
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      commands: [
        {
          label: "Add MCP server",
          command: `{ "mcpServers": { "brand-ui": { "url": "${install.hostedMcp.url}" } } }`,
        },
      ],
    },
  ];
}

export function WorksWith() {
  return (
    <section
      id="works-with"
      data-slot="works-with"
      // #555: matches its real page neighbors on `/agents` — `AgentLoopSection` and
      // `EmitUiSection` both use `max-w-7xl … px-4 py-24 sm:px-6` (this section keeps its own
      // py-16/gap-12 rhythm; only the width + horizontal padding recipe needs to match).
      className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-title text-foreground">{worksWithCopy.heading}</h2>
        <p className="max-w-prose text-body text-muted-foreground">{worksWithCopy.intro}</p>
      </div>
      <IntegrationMatrix
        hosts={HOSTS}
        rows={buildRows()}
        routine={buildRoutine()}
        labels={{ routineHeading: worksWithCopy.routineHeading }}
      />
      <div className="flex flex-col gap-3">
        <h3 className="text-title text-foreground">{installTabsCopy.heading}</h3>
        <InstallTabs
          packageOptions={buildPackageOptions()}
          blockOptions={buildBlockOptions()}
          hostTabs={buildHostTabs()}
          prompt={installTabsCopy.prompt(install.hostedMcp.url, install.llmsTxt)}
        />
      </div>
    </section>
  );
}
