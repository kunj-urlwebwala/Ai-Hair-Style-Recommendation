import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Keep Node's experimental built-in modules out of Vitest's transform pipeline.
    server: {
      deps: {
        external: [/^node:/, "sqlite"],
      },
    },
  },
});
