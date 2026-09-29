/** Collection, folder and vendor navigation for the Home browser. */
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tree,
  type TreeNode,
} from "@elabs-ai/components-ui";
import { Boxes, Clock3, FileBox, Folder, LayoutTemplate, Library } from "lucide-react";
import { browserParams, type BrowserCollection, type BrowserState } from "./browser-state";

const COLLECTIONS = [
  { id: "recent", label: "Recent", icon: Clock3 },
  { id: "diagrams", label: "Diagrams", icon: FileBox },
  { id: "components", label: "Components", icon: Boxes },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "catalog", label: "Catalog", icon: Library },
] as const;

const LABELS = {
  navigation: "Library navigation",
  breadcrumbs: "Library breadcrumbs",
  ancestorMenu: "Show parent folders",
} as const;

type Destination = { collection: BrowserCollection; folder: string; vendor: string };

/** Browser navigation clears filters tied to the previous place and keeps layout local. */
export function browserNavigationState(
  state: BrowserState,
  destination: Destination,
): BrowserState {
  return {
    ...state,
    ...destination,
    query: "",
    catalogKind: "",
    tag: "",
    page: 1,
    sort: destination.collection === "recent" ? "recent" : "name",
  };
}

function folderPaths(
  folders: readonly string[],
  collection: "diagrams" | "components" | "templates",
) {
  const base = collection === "diagrams" ? "" : collection;
  const paths = new Set<string>();
  for (const folder of folders) {
    if (!folder || folder === "_trash" || folder.startsWith("_trash/")) continue;
    if (collection === "diagrams") {
      if (/^(components|templates)(\/|$)/.test(folder)) continue;
    } else if (!folder.startsWith(`${base}/`)) continue;
    const parts = folder.split("/").filter(Boolean);
    for (let length = base ? 2 : 1; length <= parts.length; length++) {
      paths.add(parts.slice(0, length).join("/"));
    }
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function folderNodes(
  folders: readonly string[],
  collection: "diagrams" | "components" | "templates",
  destinations: Map<string, Destination>,
): TreeNode[] {
  const base = collection === "diagrams" ? "" : collection;
  const nodes = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const path of folderPaths(folders, collection)) {
    const id = `folder:${collection}:${path}`;
    const node: TreeNode = {
      id,
      label: path.split("/").at(-1) ?? path,
      icon: <Folder className="size-4" aria-hidden="true" />,
      children: [],
    };
    nodes.set(path, node);
    destinations.set(id, { collection, folder: path, vendor: "" });
    const separator = path.lastIndexOf("/");
    const parent = separator < 0 ? "" : path.slice(0, separator);
    if (!parent || parent === base) roots.push(node);
    else nodes.get(parent)?.children?.push(node);
  }
  return roots;
}

function selectedId(state: BrowserState): string {
  if (state.collection === "catalog" && state.vendor) return `vendor:${state.vendor}`;
  if (
    (state.collection === "diagrams" ||
      state.collection === "components" ||
      state.collection === "templates") &&
    state.folder
  ) {
    return `folder:${state.collection}:${state.folder}`;
  }
  return `collection:${state.collection}`;
}

function ancestorIds(state: BrowserState): string[] {
  const root = `collection:${state.collection}`;
  if (!state.folder || state.collection === "recent" || state.collection === "catalog")
    return [root];
  const parts = state.folder.split("/");
  const base = state.collection === "diagrams" ? 1 : 2;
  return [
    root,
    ...parts
      .slice(base - 1)
      .map((_, index) => `folder:${state.collection}:${parts.slice(0, base + index).join("/")}`),
  ];
}

export interface BrowserNavigationProps {
  state: BrowserState;
  folders: readonly string[];
  vendors: readonly string[];
  onNavigate: (patch: Partial<BrowserState>) => void;
}

export function BrowserNavigation({ state, folders, vendors, onNavigate }: BrowserNavigationProps) {
  const { nodes, destinations } = useMemo(() => {
    const destinations = new Map<string, Destination>();
    const nodes = COLLECTIONS.map(({ id, label, icon: Icon }): TreeNode => {
      const nodeId = `collection:${id}`;
      destinations.set(nodeId, { collection: id, folder: "", vendor: "" });
      const children =
        id === "diagrams" || id === "components" || id === "templates"
          ? folderNodes(folders, id, destinations)
          : id === "catalog"
            ? [...new Set(vendors)]
                .sort((a, b) => a.localeCompare(b))
                .map((vendor): TreeNode => {
                  const vendorId = `vendor:${vendor}`;
                  destinations.set(vendorId, { collection: "catalog", folder: "", vendor });
                  return { id: vendorId, label: vendor };
                })
            : [];
      return {
        id: nodeId,
        label,
        icon: <Icon className="size-4" aria-hidden="true" />,
        children,
      };
    });
    return { nodes, destinations };
  }, [folders, vendors]);
  const selection = selectedId(state);
  const visibleSelection = destinations.has(selection)
    ? selection
    : `collection:${state.collection}`;
  const [expandedIds, setExpandedIds] = useState<string[]>(() => [
    ...COLLECTIONS.map(({ id }) => `collection:${id}`),
    ...ancestorIds(state),
  ]);

  // A direct link or Back may select a deep folder whose ancestors were collapsed locally.
  useEffect(() => {
    const required = ancestorIds(state);
    setExpandedIds((previous) =>
      required.every((id) => previous.includes(id))
        ? previous
        : [...new Set([...previous, ...required])],
    );
  }, [state]);

  return (
    <Tree
      aria-label={LABELS.navigation}
      nodes={nodes}
      selectedIds={[visibleSelection]}
      onSelectionChange={([id]) => {
        const destination = id ? destinations.get(id) : undefined;
        if (destination) onNavigate(browserNavigationState(state, destination));
      }}
      expandedIds={expandedIds}
      onExpandedChange={setExpandedIds}
      scrollToId={visibleSelection}
      scrollSelectionIntoView
      expandOn="chevron"
      surface="sidebar"
      className="w-full"
    />
  );
}

type Crumb = { label: string; href: string };

function LinkedCrumb({ crumb, className }: { crumb: Crumb; className?: string }) {
  return (
    <BreadcrumbItem className={className}>
      <BreadcrumbLink href={crumb.href} className="block max-w-28 truncate">
        {crumb.label}
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}

function AncestorMenu({ crumbs, className }: { crumbs: readonly Crumb[]; className?: string }) {
  if (crumbs.length === 0) return null;
  return (
    <>
      <BreadcrumbSeparator className={className} />
      <BreadcrumbItem className={className}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={LABELS.ancestorMenu}
              className="focus-ring rounded-sm hover:text-foreground"
            >
              <BreadcrumbEllipsis className="size-7" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {crumbs.map((crumb) => (
              <DropdownMenuItem key={crumb.href} asChild>
                <a href={crumb.href} className="max-w-72 truncate">
                  {crumb.label}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </BreadcrumbItem>
    </>
  );
}

export function BrowserBreadcrumb({ state }: { state: BrowserState }) {
  const collection = COLLECTIONS.find(({ id }) => id === state.collection) ?? COLLECTIONS[0];
  const destinations: { label: string; destination: Destination }[] = [
    { label: "Home", destination: { collection: "recent", folder: "", vendor: "" } },
    {
      label: collection.label,
      destination: { collection: state.collection, folder: "", vendor: "" },
    },
  ];
  if (state.collection === "catalog" && state.vendor) {
    destinations.push({
      label: state.vendor,
      destination: { collection: "catalog", folder: "", vendor: state.vendor },
    });
  } else if (state.folder) {
    const parts = state.folder.split("/").filter(Boolean);
    const base = state.collection === "diagrams" ? 0 : 1;
    for (let index = base; index < parts.length; index++) {
      destinations.push({
        label: parts[index] ?? "",
        destination: {
          collection: state.collection,
          folder: parts.slice(0, index + 1).join("/"),
          vendor: "",
        },
      });
    }
  }

  const crumbs = destinations.map(({ label, destination }) => ({
    label,
    href: `#home${browserParams(browserNavigationState(state, destination))}`,
  }));
  const current = crumbs.at(-1)!;
  const middle = crumbs.slice(1, -1);
  const parent = middle.at(-1);

  return (
    <Breadcrumb aria-label={LABELS.breadcrumbs} className="min-w-0">
      <BreadcrumbList className="min-w-0 flex-nowrap">
        <LinkedCrumb crumb={crumbs[0]!} className="shrink-0" />
        <AncestorMenu crumbs={middle} className="shrink-0 sm:hidden" />
        <AncestorMenu crumbs={middle.slice(0, -1)} className="hidden shrink-0 sm:inline-flex" />
        {parent ? (
          <Fragment>
            <BreadcrumbSeparator className="hidden shrink-0 sm:inline-flex" />
            <LinkedCrumb crumb={parent} className="hidden shrink-0 sm:inline-flex" />
          </Fragment>
        ) : null}
        <BreadcrumbSeparator className="shrink-0" />
        <BreadcrumbItem className="min-w-0 flex-1 overflow-hidden">
          <BreadcrumbPage className="block min-w-0 max-w-full truncate text-body">
            {current.label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
