/**
 * Locks two `WorksWith` data bugs (both were wrong VALUES, not rendering bugs, so these test the
 * exported builder functions directly rather than the rendered `IntegrationMatrix`):
 *
 * - #559: the plugin row's "gives" text hard-coded "11 skills" instead of deriving the count
 *   from the generated `install.plugin.skillCount` (already sourced from the real
 *   `.claude-plugin/plugin.json`, which has 9 skills today).
 * - #565: the Codex host's "Hosted MCP" copy value fell through to the exact same bare-URL
 *   string as "Other", implying first-class support Codex didn't actually get.
 */
import { describe, expect, it } from "vitest";
import { buildRows, hostedMcpCommands } from "./works-with";
import { install } from "../../lib/content";

describe("buildRows", () => {
  it("derives the plugin row's copy from the generated skill count, not a hard-coded literal", () => {
    const rows = buildRows();
    const plugin = rows.find((row) => row.id === "plugin");
    expect(plugin?.gives).toContain(String(install.plugin.skillCount));
    expect(plugin?.gives).not.toContain("11");
  });
});

describe("hostedMcpCommands", () => {
  it("gives Codex its own config value, distinct from the generic Other fallback", () => {
    const commands = hostedMcpCommands();
    expect(commands.codex).not.toBe(commands.other);
    // Codex's real config shape (a `[mcp_servers.<name>]` TOML table), formatting the same
    // generated url — not a new command.
    expect(commands.codex).toContain("mcp_servers.brand-ui");
    expect(commands.codex).toContain(install.hostedMcp.url);
  });
});
