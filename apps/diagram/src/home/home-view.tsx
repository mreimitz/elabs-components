/**
 * DG-23 — Home (R1 scope box, binding): recents with thumbnails, the folder tree, the
 * components panel, and start-from ("New diagram", "New from template") plus "Connect an LLM".
 * Cut from the original plan: health tiles and the search index/search trigger — a filter on
 * the sidebar's own tree (a sibling slice) replaces search; Home has none of its own.
 */
import { Heading, StatePanel } from "@elabs-ai/components-ui";
import { ConnectDialog } from "./connect-dialog";
import { ComponentsPanel } from "./components-panel";
import { FolderList } from "./folder-list";
import { RecentCard } from "./recent-card";
import { recentFiles } from "./recents";
import { NewDiagramButton, TemplatePicker } from "./start-from";
import { TreeErrorPanel } from "./tree-error-panel";
import { fileTitle } from "../shell/mode-store";
import { useWorkspace } from "../workspace/workspace-store";

/**
 * Home's strings, in one place (`conventions/i18n-strings`). The top bar already renders the
 * page's one visible (and only) h1, "Home" (`shell/top-bar.tsx`) — Home does not repeat it.
 */
const HOME_LABELS = {
  recent: "Recent",
  recentEmpty: "No diagrams yet",
  recentEmptyHint: "Start a new diagram or copy a template.",
  folders: "Folders",
  components: "Components",
} as const;

/** Home (`#` and `#home`, DG-22): the first screen. */
export function HomeView() {
  const tree = useWorkspace((s) => s.tree);
  const treeError = useWorkspace((s) => s.treeError);
  const recents = useWorkspace((s) => s.recents);
  const recent = recentFiles(recents, tree?.files);
  // The shell's own live reload (`useLiveReload`, mounted once above Home) already fetches the
  // tree on load; Home only ever reads it, it never re-triggers a fetch of its own.
  // Recent, Folders and Components all read the same tree, so a failed fetch gets exactly one
  // alert and one Retry here, not one per section (R1 review) — the sections themselves render
  // quietly (no heading-less gap, but no repeated alert either) while it is showing.
  const treeFailed = tree === null && treeError !== null;

  return (
    // The shell's own workspace region does not scroll (`diagram-shell.tsx`); Home's content
    // can run taller than the viewport, so it owns its own scroll region.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <NewDiagramButton />
          <TemplatePicker tree={tree} treeError={treeError} />
          <ConnectDialog />
        </div>

        {treeFailed ? <TreeErrorPanel message={treeError} /> : null}

        <section aria-labelledby="home-recent" className="flex flex-col gap-4">
          <Heading id="home-recent" level={2} size="subtitle">
            {HOME_LABELS.recent}
          </Heading>
          {treeFailed ? null : tree === null ? (
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
            {treeFailed ? null : tree === null ? (
              <StatePanel kind="loading" titleAs="h3" />
            ) : (
              <FolderList tree={tree} />
            )}
          </section>
          <section aria-labelledby="home-components" className="flex min-w-0 flex-col gap-4">
            <Heading id="home-components" level={2} size="subtitle">
              {HOME_LABELS.components}
            </Heading>
            <ComponentsPanel tree={tree} treeError={treeError} />
          </section>
        </div>
      </div>
    </div>
  );
}
