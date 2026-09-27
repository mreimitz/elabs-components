/**
 * DG-23 — what "Connect an LLM" shows. The source of these strings is `mcp/README.md` (DG-35);
 * this file copies them so Home renders exactly what the README promises. Re-hardened
 * 2026-09-28 against `mcp/README.md` and `mcp/prompts/*.md` (R1: only the prompts the server
 * actually serves — `write-story` arrives with DG-31, not yet). React-free.
 */

/** `mcp/README.md` — the app's fixed dev port. */
export const ATLAS_MCP_URL = "http://localhost:5180/mcp";

/** The server name every snippet registers. */
export const ATLAS_MCP_NAME = "atlas";

/** Claude Code: one command (`mcp/README.md`). */
export const CLAUDE_CODE_COMMAND = `claude mcp add --transport http ${ATLAS_MCP_NAME} ${ATLAS_MCP_URL}`;

/**
 * Claude Desktop: the `mcpServers` entry for `claude_desktop_config.json`. Claude Desktop only
 * starts local commands, so this is the `mcp-remote` bridge form (`mcp/README.md`), not a bare
 * `url` entry.
 */
export const CLAUDE_DESKTOP_CONFIG = JSON.stringify(
  {
    mcpServers: {
      [ATLAS_MCP_NAME]: { command: "npx", args: ["-y", "mcp-remote", ATLAS_MCP_URL] },
    },
  },
  null,
  2,
);

export interface AtlasPromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface AtlasPrompt {
  /** The MCP prompt name (`prompts/get`). */
  name: string;
  /** One line: what it does (`mcp/prompts/<name>.md` frontmatter). */
  description: string;
  arguments: readonly AtlasPromptArgument[];
}

/**
 * The prompts DG-35's server actually lists (`mcp/prompts/*.md`, read from their frontmatter).
 * `write-story` is DG-31's and is not served yet — it is not listed here until it exists.
 */
export const ATLAS_PROMPTS: readonly AtlasPrompt[] = [
  {
    name: "author-diagram",
    description:
      "Draw an architecture diagram in Atlas from a prose description — validate, write, look in the open tab, fix.",
    arguments: [
      {
        name: "description",
        description: "What to draw, in plain words (systems, who owns them, what flows where).",
        required: true,
      },
      {
        name: "path",
        description: 'Workspace path for the new file, e.g. "acme/landscape.yaml". Optional.',
        required: false,
      },
    ],
  },
  {
    name: "fill-catalog",
    description: "Write names, descriptions and docs links for one vendor's catalog entries.",
    arguments: [
      {
        name: "vendor",
        description:
          "An icon pack: aws, azure, gcp, k8s, qlik, snowflake, databricks, clickhouse, salesforce, sap, microsoft or oracle.",
        required: true,
      },
    ],
  },
];
