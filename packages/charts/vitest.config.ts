import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Pin the clock's zone to CI's (UTC): time-axis ticks fall on LOCAL midnights, so a
// DOM snapshot recorded in CEST differs from one taken on a UTC runner.
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    testTimeout: 12_000,
  },
});
