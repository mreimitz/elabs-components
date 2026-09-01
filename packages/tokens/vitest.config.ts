import { defineConfig } from "vitest/config";

// Most tokens tests are pure CSS parsing + color math, so `node` is the default
// environment. The one exception (`theme-provider.test.tsx`, which renders the
// provider to prove no disallowed theme is ever written to `data-theme`) opts in
// per file with a `// @vitest-environment jsdom` docblock — keeping the fast
// path fast instead of booting a DOM for 240+ pure assertions.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    css: false,
    testTimeout: 12_000,
  },
});
