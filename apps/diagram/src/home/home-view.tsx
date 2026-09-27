/**
 * DG-23 — Home (R1 scope box, binding): recents with thumbnails, the folder tree, the
 * components panel, and start-from ("New diagram", "New from template") plus "Connect an LLM".
 * Cut from the original plan: health tiles and the search index/search trigger — a filter on
 * the sidebar's own tree (a sibling slice) replaces search; Home has none of its own.
 */
import { useEffect } from "react";
import { Heading, StatePanel } from "@elabs-ai/components-ui";
import { ConnectDialog } from "./connect-dialog";
import { ComponentsPanel } from "./components-panel";
import { FolderList } from "./folder-list";
import { RecentCard } from "./recent-card";
import { NewDiagramButton, TemplatePicker } from "./start-from";
import { fileTitle } from "../shell/mode-store";
import type { WorkspaceFile } from "../workspace/client";
import { useWorkspace, workspaceActions } from "../workspace/workspace-store";

/** Home's strings, in one place (`conventions/i18n-strings`). The top bar already says "Home". */
const HOME_LABELS = {
  title: "Home",
  recent: "Recent",
  recentEmpty: "No diagrams yet",
  recentEmptyHint: "Start a new diagram or copy a template.",
  folders: "Folders",
  components: "Components",
} as const;

/** Up to 8 recent diagrams shown; the store keeps more (`RECENTS_LIMIT`, 12) for its own use. */
const RECENTS_SHOWN = 8;

/** DG-21's recents (paths that resolve in the tree), else the newest diagrams by mtime. */
export function recentFiles(
  recents: readonly string[],
  files: readonly WorkspaceFile[] | undefined,
): WorkspaceFile[] {
  if (!files) return [];
  const byPath = new Map(files.map((file) => [file.path, file]));
  const fromRecents = recents
    .map((path) => byPath.get(path))
    .filter((file): file is WorkspaceFile => file !== undefined);
  if (fromRecents.length > 0) return fromRecents.slice(0, RECENTS_SHOWN);
  return [...files]
    .filter((file) => file.kind === "diagram")
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, RECENTS_SHOWN);
}

/** Home (`#` and `#home`, DG-22): the first screen. */
export function HomeView() {
  const tree = useWorkspace((s) => s.tree);
  const recents = useWorkspace((s) => s.recents);

  useEffect(() => {
    if (tree === null) void workspaceActions.refreshTree().catch(() => undefined);
  }, [tree]);

  const recent = recentFiles(recents, tree?.files);

  return (
    // The shell's own workspace region does not scroll (`diagram-shell.tsx`); Home's content
    // can run taller than the viewport, so it owns its own scroll region.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-8">
        {/* The top bar already renders "Home"; this is the page's own outline anchor only. */}
        <h1 className="sr-only">{HOME_LABELS.title}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <NewDiagramButton />
          <TemplatePicker files={tree?.files} />
          <ConnectDialog />
        </div>

        <section aria-labelledby="home-recent" className="flex flex-col gap-4">
          <Heading id="home-recent" level={2} size="subtitle">
            {HOME_LABELS.recent}
          </Heading>
          {tree === null ? (
            <StatePanel kind="loading" titleAs="h3" />
          ) : recent.length === 0 ? (
            <StatePanel
              kind="empty"
              titleAs="h3"
              title={HOME_LABELS.recentEmpty}
              description={HOME_LABELS.recentEmptyHint}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {recent.map((file) => (
                <li key={file.path} className="flex">
                  <RecentCard
                    path={file.path}
                    title={file.title?.trim() || fileTitle(file.path)}
                    mtime={file.mtime}
                    hasThumb={file.hasThumb}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <section aria-labelledby="home-folders" className="flex min-w-0 flex-col gap-4">
            <Heading id="home-folders" level={2} size="subtitle">
              {HOME_LABELS.folders}
            </Heading>
            {tree === null ? (
              <StatePanel kind="loading" titleAs="h3" />
            ) : (
              <FolderList tree={tree} />
            )}
          </section>
          <section aria-labelledby="home-components" className="flex min-w-0 flex-col gap-4">
            <Heading id="home-components" level={2} size="subtitle">
              {HOME_LABELS.components}
            </Heading>
            <ComponentsPanel />
          </section>
        </div>
      </div>
    </div>
  );
}
