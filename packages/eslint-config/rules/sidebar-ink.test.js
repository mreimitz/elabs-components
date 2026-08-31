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
      // PR #87 review finding — slot-content blind spot. Chrome-tuned ink
      // passed through AppSidebar's `header` slot via a same-file identifier
      // is correct and must stay silent.
      {
        code: 'const header = <span className="text-sidebar-foreground" />;\nconst a = <AppSidebar header={header} />;',
      },
      // A slot prop NOT in CHROME_SLOT_PROPS (`children`) is not chrome —
      // canvas ink there is unaffected, even on the same AppSidebar element.
      {
        code: 'const content = <span className="text-foreground" />;\nconst a = <AppSidebar children={content} />;',
      },
      // A same-named prop on a DIFFERENT component is not a chrome slot —
      // CHROME_SLOT_PROPS is keyed by component tag name, not prop name alone.
      {
        code: 'const a = <OtherComponent header={<span className="text-foreground" />} />;',
      },
      // A portaled component passed as slot content: its OWN className would
      // still be checked (none set here), but content inside it is exempt —
      // matches the ancestor walk's PORTAL_BOUNDARY semantics.
      {
        code: 'const header = <DropdownMenuContent><span className="text-foreground" /></DropdownMenuContent>;\nconst a = <AppSidebar header={header} />;',
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
      // PR #87 review finding (the exact sidebar-02 app-sidebar.tsx:136 shape)
      // — canvas ink inside a same-file `const header = (…)` passed as
      // `<AppSidebar header={header}>` is real runtime chrome ink even though
      // it is never a JSX ancestor of the `<span>` in the authored tree.
      {
        code: 'const header = (\n  <div>\n    <span className="font-semibold text-foreground">Acme</span>\n  </div>\n);\nconst a = <AppSidebar header={header} />;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // Inline JSX (no intermediate identifier) passed directly to a chrome
      // slot prop is caught the same way.
      {
        code: 'const a = <AppSidebar footer={<span className="text-muted-foreground" />} />;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
      // A conditionally-rendered element inside the slot JSX (the real
      // `{!isCollapsed && <span className="text-foreground">Acme</span>}`
      // shape) is still walked.
      {
        code: 'const header = (\n  <div>\n    {isCollapsed || <span className="text-foreground">Acme</span>}\n  </div>\n);\nconst a = <AppSidebar header={header} />;',
        errors: [{ messageId: "canvasInkInChrome" }],
      },
    ],
  });
});
