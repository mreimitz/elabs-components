import { beforeAll } from "vitest";

// Every story file runs in its own iframe, and each browser tab runs its share of the files one
// after another. Chromium frees a finished file's iframe lazily, so with few tabs (a 4-core CI
// runner gets 3, each running ~140 files) a tab piles up gigabytes that a full collection would
// free, and dies: "Browser connection was closed while running tests". Collect before each file
// starts, while only the new file's iframe is attached. `gc` exists because the storybook
// project's Chromium launch flags expose it (`vitest.config.ts`).
beforeAll(() => {
  (globalThis as { gc?: () => void }).gc?.();
});
