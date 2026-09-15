import { FileText, Sparkles } from "lucide-react";

/** Sample context rail for the Chat Shell story. */
export function ContextPanelRail() {
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-12 items-center border-b px-4 text-body font-semibold">Context</div>
      <div className="space-y-2 p-3 text-body">
        <div className="flex items-center gap-2 rounded-md border bg-card p-2">
          <FileText className="size-4 text-muted-foreground" /> Deploy log — wk 23
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-card p-2">
          <Sparkles className="size-4 text-muted-foreground" /> Billing runbook
        </div>
      </div>
    </div>
  );
}
