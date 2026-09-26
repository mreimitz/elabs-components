import { useRef, useState } from "react";
import { Network, Package } from "lucide-react";
import {
  ConfirmDialog,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@elabs-ai/components-ui";
// DG-13: the example gallery (src/examples/*.yaml).
import { EXAMPLES, type DiagramExample } from "../examples";
import { diagramActions, useDiagram } from "../state/diagram-store";
// DG-04: the vendored icon packs (public/icons/index.json), per-pack counts.
import { ICON_PACKS } from "../icons/register-packs";
import { iconSheetHash, iconSheetVendor } from "../icons/icon-sheet";
import { useHash } from "../routes/use-hash";

/** DG-13's strings, in one place (`conventions/i18n-strings`). */
const SIDEBAR_LABELS = {
  replaceTitle: (label: string) => `Open “${label}”?`,
  replaceDescription: "Your edits to the current diagram will be replaced. This cannot be undone.",
  replaceConfirm: "Replace my edits",
  keepEditing: "Keep editing",
} as const;

/** Load an example and, from a dev route (`#icons`, `#nodes`, …), return to the editor. */
function openExample(example: DiagramExample) {
  diagramActions.loadText(example.text);
  if (window.location.hash !== "") window.location.hash = "";
}

/**
 * Left-nav sections for the diagram app shell. "Examples" (DG-13) loads a YAML example
 * into the editor, asking first when the text has unsaved edits. "Icon packs"
 * (DG-04) lists every vendored pack with its icon count; clicking one
 * navigates to the "#icons" dev route (app.tsx's hash router) filtered to
 * that vendor. The pack the hash names is marked active (`isActive` paints the row,
 * `aria-current` names it for assistive technology) — wave-1 review M4.
 */
export function SidebarNav() {
  const activePack = iconSheetVendor(useHash());
  const loadedText = useDiagram((s) => s.loadedText);
  const edited = useDiagram((s) => s.text !== s.loadedText);
  const [pending, setPending] = useState<DiagramExample | null>(null);
  // P4: library gap — ConfirmDialog has no trigger, and Radix returns focus to the
  // trigger it knows (none), so a cancelled dialog drops focus on <body>. Return it to the
  // example button by hand, after the dialog has released its focus trap.
  // docs/findings/DG-13-examples-review.md.
  const returnFocusTo = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Examples</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {EXAMPLES.map((example) => {
              const active = example.text === loadedText;
              return (
                <SidebarMenuItem key={example.id}>
                  {/* A button, not a link: it replaces the editor text (an action). */}
                  <SidebarMenuButton
                    isActive={active}
                    aria-current={active ? "true" : undefined}
                    tooltip={example.description}
                    onClick={(event) => {
                      if (!edited) return openExample(example);
                      returnFocusTo.current = event.currentTarget;
                      setPending(example);
                    }}
                  >
                    <Network aria-hidden="true" />
                    <span>{example.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Icon packs</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {ICON_PACKS.map(({ pack, count }) => (
              <SidebarMenuItem key={pack}>
                {/* A link, not a button: it navigates (wave-0 review, DG-04 note). */}
                <SidebarMenuButton
                  asChild
                  isActive={activePack === pack}
                  tooltip={`${pack} (${count} icons)`}
                >
                  <a
                    href={iconSheetHash(pack)}
                    aria-current={activePack === pack ? "page" : undefined}
                  >
                    <Package aria-hidden="true" />
                    <span>{pack}</span>
                  </a>
                </SidebarMenuButton>
                <SidebarMenuBadge>{count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {/* Destructive-action rule: replacing edited text confirms first. */}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPending(null);
          setTimeout(() => returnFocusTo.current?.focus());
        }}
        tone="destructive"
        title={pending ? SIDEBAR_LABELS.replaceTitle(pending.label) : ""}
        description={SIDEBAR_LABELS.replaceDescription}
        confirmLabel={SIDEBAR_LABELS.replaceConfirm}
        cancelLabel={SIDEBAR_LABELS.keepEditing}
        onConfirm={() => {
          // ConfirmDialog keeps itself open on confirm; the app closes it.
          if (pending) openExample(pending);
          setPending(null);
          setTimeout(() => returnFocusTo.current?.focus());
        }}
      />
    </>
  );
}
