import { defineConfig } from "tsup";

// Two passes, because the two entries have opposite server/client natures and
// tsup's `banner` applies to every file a pass emits (shared chunks included).
// Entries use the object form so output paths are explicit: tsup derives the
// out-dir from the common base of a pass's entries, so an array would emit
// dist/cn.js here and silently break publishConfig.exports["./lib/cn"].
export default defineConfig([
  {
    // The component surface. esbuild strips the per-module "use client"
    // directives when it bundles, so the 28 in src/ never reach dist/ —
    // without this banner every RSC consumer breaks on the first hook.
    //
    // `form` is a second entry in THIS SAME pass (not a third pass) so it
    // shares the "use client" banner and, more importantly, shares chunks
    // with `index` — `Label`/`cn`/Radix `Slot` land in one common chunk
    // instead of a duplicated copy inside dist/form.js. It is a dedicated
    // subpath (`@elabs-ai/components-ui/form`, ADR 0006) precisely so its
    // sole `react-hook-form`/`@hookform/resolvers` import (issue #26, both
    // optional peers) never reaches `dist/index.js` — a bundler must resolve
    // every static top-level import to build its module graph, even one
    // whose binding is unused, so a consumer who never imports Form must
    // never have that import statement in the file they DO import.
    entry: { index: "src/index.ts", form: "src/components/form/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    // NOTE: neither pass cleans. tsup runs the two configs concurrently, so a
    // `clean: true` here races the other pass's output and non-deterministically
    // wipes its .d.ts. The build script does `rm -rf dist` up front instead.
    clean: false,
    banner: { js: '"use client";' },
    // Dependencies & peerDependencies are externalized by tsup automatically.
    external: ["react", "react-dom"],
  },
  {
    // `cn` is a pure string helper with no React surface. It deliberately does
    // NOT get the directive: marking it "use client" would turn it into a
    // client reference and make it uncallable from a server component, which
    // is precisely the case the ./lib/cn subpath exists to serve.
    entry: { "lib/cn": "src/lib/cn.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false, // see the note above
    external: ["react", "react-dom"],
  },
]);
