/**
 * DG-23 — Home's Folders section (R1 scope box, kept). A read-only view of the same tree DG-22's
 * sidebar manages: `buildTree` is reused so the two never disagree, but the row chrome is not —
 * `SidebarMenuSub`/`SidebarMenuSubButton` paint in the `--sidebar-*` tokens, wrong for a page on
 * the canvas surface, and carry file-management actions (rename, move, trash) that belong to the
 * sidebar, not to a launch surface. This list only opens a file; managing the tree stays in the rail.
 */
import { Folder, FileText } from "lucide-react";
import { toHash } from "../routes/use-hash";
import { buildTree, type TreeEntry, type TreeFile } from "../shell/workspace-tree";
import { splitCopySuffix } from "./templates";
import type { WorkspaceTree } from "../workspace/client";

interface FolderRowsProps {
  entries: readonly TreeEntry[];
  level: number;
}

/** A diagram row: the name, clamped to two lines, with its "(copy N)" marker (if any, see
 *  `splitCopySuffix`) on its own non-clamped line below so a long, clamped title never hides it. */
function FileRow({ entry }: { entry: TreeFile }) {
  const { base, marker } = splitCopySuffix(entry.title);
  return (
    <a
      href={toHash({ kind: "doc", path: entry.path })}
      className="flex items-start gap-2 rounded-md py-1 text-body text-foreground hover:text-primary-text focus-ring"
    >
      <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 break-words">{base}</span>
        {marker !== null ? (
          <span className="shrink-0 text-meta text-muted-foreground">{marker}</span>
        ) : null}
      </span>
    </a>
  );
}

function FolderRows({ entries, level }: FolderRowsProps) {
  if (entries.length === 0) return null;
  return (
    <ul
      className={
        level === 0
          ? "flex flex-col gap-0.5"
          : "ms-3 flex flex-col gap-0.5 border-s border-border ps-3"
      }
    >
      {entries.map((entry) =>
        entry.kind === "folder" ? (
          <li key={entry.path}>
            <div className="flex items-start gap-2 py-1 text-body font-medium text-foreground">
              <Folder aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 line-clamp-2 break-words">{entry.name}</span>
            </div>
            <FolderRows entries={entry.children} level={level + 1} />
          </li>
        ) : (
          <li key={entry.path}>
            <FileRow entry={entry} />
          </li>
        ),
      )}
    </ul>
  );
}

/** The workspace tree, read-only: open a file from anywhere in it in one click. */
export function FolderList({ tree }: { tree: WorkspaceTree }) {
  const entries = buildTree(tree);
  return <FolderRows entries={entries} level={0} />;
}
