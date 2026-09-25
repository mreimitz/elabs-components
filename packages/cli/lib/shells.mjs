/**
 * shells.mjs — the APP SHELL half of `brand-ui scaffold`.
 *
 * An archetype template (dashboard, data-app, …) is a SCREEN wrapped in the
 * plainest possible frame: a bare `SidebarProvider` + `Sidebar` + `SidebarInset`
 * with a one-line header. That frame is the Storybook story's stand-in, not a
 * finished app shell — and for a long time it was what every scaffolded (and
 * every migrated) app shipped with, because nothing in the flow ever asked
 * which of the library's own shells (Storybook `Layout/App Shell/*`) the app
 * should live in.
 *
 * This module is the fix. `app-spec.shell` names one of the five shells; the
 * scaffold copies the shell's registry block into `src/components/<block>/`
 * (copy-own, exactly as `npx shadcn add <block>` would), then rewrites the
 * template's root component so its screen renders INSIDE that shell instead of
 * the bare frame. `minimal` keeps the bare frame — explicitly, as a choice.
 *
 * Everything here is pure string work on the template source plus reads of
 * the registry block files; nothing touches the target directory (the emitter
 * owns that).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where the shell blocks ship INSIDE the installed CLI — copied by `prepack`
 * (`scripts/bundle-assets.mjs`) from `registry/blocks/<block>`, so
 * `brand-ui scaffold --write` can lay a shell down in a project with no
 * brand-ui checkout. Absent in a dev checkout, where the repo copy wins.
 */
export const BUNDLED_SHELL_DIR = join(CLI_ROOT, "shells");

/** The shell a spec gets when it names none — the library's own flagship frame. */
export const DEFAULT_SHELL = "flagship";

/**
 * The five app shells — one per Storybook `Layout/App Shell/*` entry. `block` is
 * the copy-own registry item (`registry/blocks/<block>`), `entry` the file
 * inside it that exports the shell component, `component` how the emitted
 * `App.tsx` imports it. Only the files the entry file reaches through relative
 * imports are copied (so `workspace-shell` does not drag in its optional
 * `workspace-assistant`, which would pull the whole AI package into a dashboard).
 */
export const SHELLS = {
  flagship: {
    block: "workspace-shell",
    story: "Layout/App Shell/Flagship",
    storyId: "layout-app-shell-flagship--default",
    entry: "workspace-shell.tsx",
    component: "WorkspaceShell",
    defaultExport: false,
    summary:
      "nav rail + top bar with a breadcrumb trail + a SUMMONED right-hand dock; the frame every full-screen template sits in",
  },
  dashboard: {
    block: "sidebar-02",
    story: "Layout/App Shell/Dashboard",
    storyId: "layout-app-shell-dashboard--default",
    entry: "dashboard-shell.tsx",
    component: "DashboardShell",
    defaultExport: true,
    summary:
      "collapsible nav rail with a tenant switcher, an inset content card, and a PERMANENT details rail on the right",
  },
  mail: {
    block: "sidebar-04",
    story: "Layout/App Shell/Mail",
    storyId: "layout-app-shell-mail--default",
    entry: "mail-shell.tsx",
    component: "MailShell",
    defaultExport: true,
    summary: "three-zone list-and-reading shell: icon rail, searchable list, reading pane",
  },
  "double-sided": {
    block: "sidebar-05",
    story: "Layout/App Shell/Double-Sided",
    storyId: "layout-app-shell-double-sided--default",
    entry: "settings-shell.tsx",
    component: "SettingsShell",
    defaultExport: true,
    summary:
      "two navigation levels (icon rail + section panel) and a summoned history dock — for nested navigation",
  },
  minimal: {
    block: null,
    story: "Layout/App Shell/Minimal",
    storyId: "layout-app-shell-minimal--default",
    entry: null,
    component: null,
    defaultExport: false,
    summary:
      "the template's own bare SidebarProvider + Sidebar + SidebarInset frame — a starting point, not a finished shell",
  },
};

export const SHELL_IDS = Object.keys(SHELLS);

/** Archetypes whose screen owns its edges (a canvas, a transcript) — the shell goes flush. */
const FLUSH_ARCHETYPES = new Set(["flow-workspace", "ai-assistant"]);

/** The archetype that has no app shell at all (top nav, single scroll). */
const NO_SHELL_ARCHETYPES = new Set(["marketing"]);

/** The bare specifiers a shell block may import that are NOT a package the app adds. */
const IGNORED_SPECIFIERS = new Set(["react", "react-dom", "lucide-react"]);

/**
 * Third-party ranges a shell block may need, read from the monorepo when a
 * checkout is there and falling back to the range the library ships otherwise.
 */
const NPM_FALLBACK_RANGES = { "@visx/curve": "^3.12.0" };

/** Normalize a spec's `shell`, `{ error }` on an unknown one. */
export function resolveShell(spec = {}) {
  const shell = spec.shell ?? DEFAULT_SHELL;
  if (!SHELLS[shell]) {
    return { error: `spec.shell must be one of: ${SHELL_IDS.join(", ")} (got "${shell}")` };
  }
  return { shell };
}

/** Whether this archetype × shell combination copies a block at all. */
export function shellApplies(shell, archetype) {
  return shell !== "minimal" && !NO_SHELL_ARCHETYPES.has(archetype);
}

/** Resolve a shell block's directory: the checkout first, then the bundled copy. */
export function resolveShellDir(shell, { root, bundledDir = BUNDLED_SHELL_DIR } = {}) {
  const def = SHELLS[shell];
  if (!def?.block) return null;
  const candidates = [];
  if (root) candidates.push(join(root, "registry", "blocks", def.block));
  if (bundledDir) candidates.push(join(bundledDir, def.block));
  return candidates.find((d) => existsSync(join(d, def.entry))) ?? null;
}

const importSpecifiers = (src) =>
  [...src.matchAll(/^import\s[\s\S]*?from\s+["']([^"']+)["'];?\s*$/gm)].map((m) => m[1]);

/**
 * The files a shell copies into the app and the bare specifiers they import —
 * the transitive closure of the entry file's RELATIVE imports, so a block's
 * optional extras stay behind. `{ error }` when the block is reachable from
 * neither the checkout nor the bundled copy (never a silent empty shell).
 *
 * @returns {{ files: {rel:string, content:string}[], specifiers: string[] } | { error: string }}
 */
export function shellSources(shell, { root, bundledDir } = {}) {
  const def = SHELLS[shell];
  if (!def?.block) return { files: [], specifiers: [] };
  const dir = resolveShellDir(shell, { root, bundledDir });
  if (!dir) {
    return {
      error:
        `cannot lay down the "${shell}" app shell — registry/blocks/${def.block} is unreachable ` +
        `(looked in the repo root${root ? ` \`${root}\`` : " (none found)"} and in the shells ` +
        `bundled with the CLI). Run from a brand-ui checkout or reinstall @elabs-ai/components-cli.`,
    };
  }
  const files = [];
  const specifiers = new Set();
  const seen = new Set();
  const queue = [def.entry];
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const abs = join(dir, name);
    if (!existsSync(abs)) return { error: `shell "${shell}": ${def.block}/${name} is missing` };
    const content = readFileSync(abs, "utf8");
    files.push({ rel: `src/components/${def.block}/${name}`, content });
    for (const spec of importSpecifiers(content)) {
      if (spec.startsWith("./")) {
        const base = spec.slice(2);
        const candidate = [`${base}.tsx`, `${base}.ts`].find((f) => existsSync(join(dir, f)));
        if (!candidate) return { error: `shell "${shell}": ${def.block}/${spec} does not resolve` };
        queue.push(candidate);
      } else if (!spec.startsWith(".")) {
        specifiers.add(spec);
      }
    }
  }
  return { files, specifiers: [...specifiers].sort((a, b) => a.localeCompare(b)) };
}

/** The `@elabs-ai/components-*` packages a shell's copied files import. */
export function shellPackages(shell, scope, opts) {
  const s = shellSources(shell, opts);
  if (s.error) return s;
  return { packages: s.specifiers.filter((x) => x.startsWith(scope)) };
}

/**
 * Third-party dependencies a shell's copied files import (beyond the brand-ui
 * packages, React and Lucide) with the range to pin — e.g. `@visx/curve` for
 * the dashboard shell's revenue trend.
 */
export function shellNpmDeps(shell, scope, { root, bundledDir } = {}) {
  const s = shellSources(shell, { root, bundledDir });
  if (s.error) return {};
  const out = {};
  for (const spec of s.specifiers) {
    if (spec.startsWith(scope) || IGNORED_SPECIFIERS.has(spec)) continue;
    const pkgName = spec.startsWith("@")
      ? spec.split("/").slice(0, 2).join("/")
      : spec.split("/")[0];
    out[pkgName] = rangeFromRepo(pkgName, root) ?? NPM_FALLBACK_RANGES[pkgName] ?? "latest";
  }
  return out;
}

function rangeFromRepo(pkgName, root) {
  if (!root) return null;
  for (const pkg of ["charts", "ui", "data", "ai"]) {
    const file = join(root, "packages", pkg, "package.json");
    if (!existsSync(file)) continue;
    try {
      const json = JSON.parse(readFileSync(file, "utf8"));
      const range = json.dependencies?.[pkgName] ?? json.peerDependencies?.[pkgName];
      if (range) return range;
    } catch {
      /* unreadable — try the next one */
    }
  }
  return null;
}

// ---- the App.tsx rewrite ----------------------------------------------------

/** Index just past the `>` that closes the JSX open tag starting at `from`. */
function openTagEnd(src, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i + 1;
  }
  return -1;
}

/** `{ open, inner, close }` offsets of the first `<Tag …>…</Tag>` element at/after `from`. */
function element(src, tag, from = 0) {
  const start = src.indexOf(`<${tag}`, from);
  if (start < 0) return null;
  const innerStart = openTagEnd(src, start);
  const endTag = `</${tag}>`;
  const innerEnd = src.indexOf(endTag, innerStart);
  if (innerStart < 0 || innerEnd < 0) return null;
  return { start, innerStart, innerEnd, end: innerEnd + endTag.length };
}

/** Drop the names no longer referenced from one `import { … } from "<spec>"` clause. */
function pruneNamedImport(src, spec) {
  // `[^}]*` — a named-import clause holds no `}`, so this cannot run across the
  // statements that sit between two imports. The trailing `\n?` takes the line
  // with it when the whole import goes.
  const re = new RegExp(`^import\\s+\\{([^}]*)\\}\\s+from\\s+["']${spec}["'];?[ \\t]*\\n?`, "m");
  const m = src.match(re);
  if (!m) return src;
  const rest = src.replace(m[0], "");
  // Code references only — the preamble comment mentions `AppIcon`, and a
  // comment must not keep an import alive.
  const code = rest.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const kept = m[1]
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .filter((n) => {
      const name = n
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop();
      return new RegExp(`\\b${name}\\b`).test(code);
    });
  if (!kept.length) return rest;
  const clause = kept.length > 3 ? `{\n  ${kept.join(",\n  ")},\n}` : `{ ${kept.join(", ")} }`;
  return src.replace(m[0], `import ${clause} from "${spec}";\n`);
}

/** Re-indent a JSX block: strip its common leading whitespace, then indent every line by `n`. */
function reindent(block, n) {
  const lines = block.replace(/\s+$/, "").split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length);
  const common = indents.length ? Math.min(...indents) : 0;
  const pad = " ".repeat(n);
  return lines.map((l) => (l.trim() ? pad + l.slice(common) : "")).join("\n");
}

/** The object literal the template hands its `NavUser` (`user={{ … }}`), if any. */
function templateUser(src) {
  return src.match(/<NavUser\s[^>]*user=\{(\{[^}]*\})\}/)?.[1] ?? null;
}

/**
 * Wrap the template's screen in the chosen app shell.
 *
 * The template's root component returns `<SidebarProvider>…<SidebarInset>
 * <header>…</header> SCREEN </SidebarInset> [SIBLINGS] </SidebarProvider>`
 * (sometimes inside an outer provider). This keeps the outer wrapper, lifts
 * SCREEN (and any SIBLINGS, e.g. an AI context panel) into the shell's content
 * slot, hands the header's extra controls to the shell where it has a slot for
 * them, and prunes the sidebar primitives the bare frame needed.
 *
 * @returns {{ src: string, changed: boolean }}
 */
export function applyShell(src, spec, { shell, archetype, scope, todos }) {
  const def = SHELLS[shell];
  if (!shellApplies(shell, archetype)) {
    if (shell !== "minimal" && NO_SHELL_ARCHETYPES.has(archetype)) {
      todos.push(
        `shell: "${shell}" ignored — the ${archetype} archetype has no app shell (top nav + single scroll)`,
      );
    }
    return { src, changed: false };
  }

  const provider = element(src, "SidebarProvider");
  const inset = provider && element(src, "SidebarInset", provider.innerStart);
  if (!provider || !inset || inset.end > provider.innerEnd) {
    todos.push(
      `shell: this template has no SidebarProvider/SidebarInset frame to replace — wrap its screen in \`${def.component}\` (src/components/${def.block}/) yourself`,
    );
    return { src, changed: false };
  }

  const insetInner = src.slice(inset.innerStart, inset.innerEnd);
  const header = element(insetInner, "header");
  let screen = header
    ? insetInner.slice(0, header.start) + insetInner.slice(header.end)
    : insetInner;
  // Keep the first line's indentation (only blank lines go), so `reindent` can
  // measure the block's common indent.
  screen = screen.replace(/^\s*\n/, "").replace(/\s+$/, "");

  // The header's own controls, minus the two the shell replaces (its trigger and
  // the page title) — e.g. `<ContextPanelTrigger />`, which the flagship's top
  // bar has an `actions` slot for.
  const headerExtras = header
    ? insetInner
        .slice(header.innerStart, header.innerEnd)
        .replace(/<SidebarTrigger\s*\/>/g, "")
        .replace(/<h1[\s\S]*?<\/h1>/g, "")
        .trim()
    : "";

  // Whatever sat beside the inset (the AI assistant's `<ContextPanel>`): it
  // stays beside the screen, inside the shell's content slot.
  const siblings = src
    .slice(inset.end, provider.innerEnd)
    .replace(/^\s*\n/, "")
    .replace(/\s+$/, "");

  // A `<main>` inside the shell would be a second main landmark (the shell's
  // `SidebarInset` already renders one) — and the shell pads its slot, so the
  // template's own page padding goes too.
  const lead = screen.match(/^[ \t]*/)[0];
  let inner = screen.slice(lead.length);
  if (/^<main\b/.test(inner) && /<\/main>\s*$/.test(inner)) {
    inner = inner.replace(/^<main\b/, "<div").replace(/<\/main>\s*$/, "</div>");
    inner = inner.replace(/^(<div[^>]*className=")([^"]*)"/, (_, open, cls) => {
      const kept = cls
        .split(/\s+/)
        .filter((c) => c && c !== "p-6")
        .join(" ");
      return kept ? `${open}${kept}"` : open.replace(/ className="$/, "");
    });
    screen = lead + inner;
  }
  // The template sized its canvas against the viewport minus its own header;
  // inside a shell the content slot is the box to fill.
  screen = screen.replace(/h-\[calc\(100vh-3\.5rem\)\]/g, "h-full");

  const title = JSON.stringify(String(spec.title ?? archetype).replace(/[{}<>]/g, ""));
  const hasActive = /const \[active, setActive\] = useState\(/.test(src);
  const navBlock = src.match(/^const nav = \[\n([\s\S]*?)\n\];$/m);
  const hasNav = Boolean(navBlock);
  // A template whose nav carries no icons (data-app, flow-workspace) gets a
  // neutral one per item — the flagship rail collapses to icons, so every item
  // needs one; the TODO says to pick real ones.
  const navHasIcons = hasNav && /icon:\s*[A-Za-z0-9_]+/.test(navBlock[1]);
  const flush = FLUSH_ARCHETYPES.has(archetype);
  const user = templateUser(src);

  let body = screen;
  if (siblings) {
    body =
      `<div className="flex h-full min-h-0">\n` +
      `  <div className="flex min-h-0 min-w-0 flex-1 flex-col">\n${reindent(screen, 4)}\n  </div>\n` +
      `${reindent(siblings, 2)}\n</div>`;
  } else if (flush) {
    body = `<div className="flex h-full min-h-0 flex-col">\n${reindent(screen, 2)}\n</div>`;
  }
  body = reindent(body, 6);

  let wrapped;
  let navExported = false;
  let dropSetActive = false;
  if (shell === "flagship") {
    const props = [
      `productName={${title}}`,
      // The rail shows the product mark (titled `productName`) and, beside it,
      // the tenant — a spec has no tenant, so a neutral word and a TODO.
      `orgName="Workspace"`,
      `user={${user ?? `{ name: "Signed-in user", email: "user@example.com" }`}}`,
      hasNav
        ? navHasIcons
          ? `nav={[{ label: "Navigate", items: nav.map((n) => ({ ...n, href: \`#\${n.id}\` })) }]}`
          : `nav={[{ label: "Navigate", items: nav.map((n) => ({ icon: Circle, ...n, href: \`#\${n.id}\` })) }]}`
        : `nav={[]}`,
      hasActive ? `activeId={active}` : hasNav ? `activeId={nav[0]?.id ?? ""}` : `activeId=""`,
      ...(hasActive ? [`onNavigate={(item) => setActive(item.id)}`] : []),
      hasActive && hasNav
        ? `trail={[{ href: "#", label: ${title} }, { href: \`#\${active}\`, label: nav.find((n) => n.id === active)?.label ?? active }]}`
        : `trail={[{ href: "#", label: ${title} }]}`,
      ...(headerExtras ? [`actions={<>${headerExtras}</>}`] : []),
      ...(flush ? [`inset="flush"`] : []),
    ];
    wrapped = `<WorkspaceShell\n${props.map((p) => `      ${p}`).join("\n")}\n    >\n${body}\n    </WorkspaceShell>`;
    if (!user) {
      todos.push(
        "shell: the signed-in user in the nav rail is a placeholder — hand `WorkspaceShell` your session's user",
      );
    }
    if (hasNav && !navHasIcons) {
      todos.push(
        "shell: every nav item carries the placeholder `Circle` icon — give each surface its own Lucide glyph in the `nav` list",
      );
    }
    todos.push(
      'shell: `orgName` beside the brand mark is the placeholder "Workspace" — set the tenant/organisation name',
    );
  } else {
    const active = hasActive ? "activePath={`/${active}`}" : "";
    wrapped = `<${def.component}${active ? ` ${active}` : ""}>\n${body}\n    </${def.component}>`;
    // These shells navigate from their own `nav-items.ts`, so the template's
    // `nav` list and `setActive` have no caller left. The list is exported (it
    // is the spec's surfaces — the material for the block's nav groups, see the
    // TODO below) and the setter dropped, so the scaffolded lint stays green.
    navExported = hasNav;
    dropSetActive = hasActive;
    todos.push(
      `shell: \`${def.component}\` navigates by href from its own src/components/${def.block}/nav-items.ts — rewrite those groups from the \`nav\` list at the top of App.tsx (or your router) and drop the list`,
    );
    if (headerExtras) {
      todos.push(
        `shell: the template's header controls (${headerExtras.replace(/\s+/g, " ").slice(0, 60)}…) have no slot in \`${def.component}\` — place them in its top bar`,
      );
    }
  }

  let out = src.slice(0, provider.start) + wrapped + src.slice(provider.end);
  if (navExported) {
    out = out.replace(
      /^const nav = \[/m,
      "// The spec's surfaces — carry them into the shell's nav groups (TODO(spec) below).\nexport const nav = [",
    );
  }
  if (dropSetActive && !/\bsetActive\b/.test(out.replace(/const \[active, setActive\]/, ""))) {
    out = out.replace("const [active, setActive] = useState(", "const [active] = useState(");
  }

  // Import the shell, then drop the sidebar primitives the bare frame needed and
  // nothing else references any more (the icons import can go entirely).
  const importLine = def.defaultExport
    ? `import ${def.component} from "./components/${def.block}/${def.entry.replace(/\.tsx?$/, "")}";`
    : `import { ${def.component} } from "./components/${def.block}/${def.entry.replace(/\.tsx?$/, "")}";`;
  out = out.replace(/^import .*$/m, (first) => `${importLine}\n${first}`);
  if (shell === "flagship" && hasNav && !navHasIcons) {
    out = /^import \{[^}]*\} from "lucide-react";/m.test(out)
      ? out.replace(/^import \{([^}]*)\} from "lucide-react";/m, (_, names) =>
          /\bCircle\b/.test(names)
            ? `import {${names}} from "lucide-react";`
            : `import { Circle,${names} } from "lucide-react";`,
        )
      : out.replace(/^import .*$/m, (first) => `import { Circle } from "lucide-react";\n${first}`);
  }
  out = pruneNamedImport(out, `${scope}ui`);
  out = pruneNamedImport(out, `${scope}icons`);

  return { src: out, changed: true };
}
