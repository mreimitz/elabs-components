/**
 * Self-test for the sidebar-ink ESLint rule (node --test), #66/#50 Rung 2.
 * Plants valid + invalid fixtures and asserts the rule fires exactly where
 * expected — so the gate can't silently rot. Run: `pnpm --filter @elabs-ai/components-eslint-config test`.
 */
import test from "node:test";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { noCanvasInkInSidebar } from "./sidebar-ink.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

test("no-canvas-ink-in-sidebar", () => {
  ruleTester.run("no-canvas-ink-in-sidebar", noCanvasInkInSidebar, {
    valid: [
      // The brief's own negative fixture: chrome-tuned ink inside <Sidebar>.
      { code: 'const a = <Sidebar><span className="text-sidebar-foreground" /></Sidebar>;' },
      // Canvas ink is fine OUTSIDE any sidebar chrome.
      { code: 'const a = <div><span className="text-foreground" /></div>;' },
      // SidebarInset is the CANVAS, not chrome — canvas ink there is correct.
      { code: 'const a = <SidebarInset><span className="text-foreground" /></SidebarInset>;' },
      // A plain div with an unrelated background is not chrome.
      { code: 'const a = <div className="bg-card"><span className="text-foreground" /></div>;' },
      // Sidebar-tuned muted ink inside the chrome family.
      {
        code: 'const a = <SidebarHeader><span className="text-sidebar-muted-foreground" /></SidebarHeader>;',
      },
      // Non-ink classes inside chrome are unaffected.
      { code: 'const a = <SidebarContent><span className="p-4 text-body" /></SidebarContent>;' },
      // A Radix *Content portals to document.body at runtime — canvas ink
      // nested inside one, even though it's JSX-nested under <SidebarMenu>
      // in the authored tree, is NOT painted on bg-sidebar (team-switcher.tsx
      // shape: a DropdownMenuContent hanging off a sidebar menu button).
      {
        code: 'const a = <SidebarMenu><DropdownMenuContent><span className="text-muted-foreground" /></DropdownMenuContent></SidebarMenu>;',
      },
      {
        code: 'const a = <Sidebar><PopoverContent><div className="text-foreground" /></PopoverContent></Sidebar>;',
      },
    ],
    invalid: [
      // The brief's own positive fixture.
      {
        code: 'const a = <Sidebar><span className="text-foreground" /></Sidebar>;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // text-muted-foreground inside the chrome family (#50's exact bug shape).
      {
        code: 'const a = <SidebarMenuButton><span className="text-muted-foreground" /></SidebarMenuButton>;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // text-card-foreground inside chrome.
      {
        code: 'const a = <SidebarFooter><span className="text-card-foreground" /></SidebarFooter>;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // Deeply nested — SidebarGroup/SidebarGroupContent aren't in the family
      // regex themselves, but the ancestor walk still reaches the enclosing
      // <Sidebar>/<SidebarContent> (#66's actual "No results" shape).
      {
        code: 'const a = <Sidebar><SidebarContent><SidebarGroup><SidebarGroupContent><div className="text-muted-foreground" /></SidebarGroupContent></SidebarGroup></SidebarContent></Sidebar>;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // Own `bg-sidebar` className marks a PLAIN element (no Sidebar component
      // name) as chrome too.
      {
        code: 'const a = <div className="bg-sidebar text-foreground" />;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // Via cn().
      {
        code: 'const a = <SidebarHeader><span className={cn("truncate", "text-muted-foreground")} /></SidebarHeader>;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // Two violations in one attribute both report.
      {
        code: 'const a = <Sidebar><span className="text-foreground text-card-foreground" /></Sidebar>;',
        errors: [{ messageId: "canvasInkInChrome" }, { messageId: "canvasInkInChrome" }],
      },
    ],
  });
});
