import { Badge, Button, SidebarTrigger, ThemeSwitcher } from "@elabs-ai/components-ui";

export interface TopBarProps {
  /**
   * The current YAML source, used only for the character-count chip.
   * DG-12 moves diagram state into the shared store (verified-apis.md's
   * plain module store); this prop disappears once TopBar reads the count
   * from there instead of being handed it.
   */
  text: string;
}

/**
 * The dashboard shell's top bar (plan §6). Layout/actions/direction/export are
 * placeholders here — DG-05/DG-09/DG-17 wire them up; DG-02 only proves the
 * frame, so every action button is disabled.
 */
export function TopBar({ text }: TopBarProps) {
  return (
    <header className="flex h-header items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <h1 className="text-body font-medium">Untitled diagram</h1>
      <div className="flex-1" />
      <Button variant="outline" size="sm" disabled>
        LR / TB
      </Button>
      <Button variant="outline" size="sm" disabled>
        Auto layout
      </Button>
      <Button variant="outline" size="sm" disabled>
        Export
      </Button>
      {/*
       * StatusBadge (ui) requires one of the 7 canonical statuses, or a
       * CustomStatus { label, tone, icon } — there is no plain-count
       * variant with no status tone attached. A character count carries no
       * status meaning, so it renders as an outline Badge instead
       * (orchestrator ruling, DG-02).
       */}
      <Badge variant="outline" className="tabular-nums">
        {text.length} chars
      </Badge>
      <ThemeSwitcher mode="dropdown" variant="ghost" size="sm" />
    </header>
  );
}
