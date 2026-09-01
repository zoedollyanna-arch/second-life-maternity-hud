import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "db/**/*.test.ts"],
    // Integration specs talk to one shared database; running them in parallel
    // would have them tripping over each other's fixtures.
    fileParallelism: false,
  },
});
