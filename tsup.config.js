import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/app.ts"],
  publicDir: false,
  clean: true,
  minify: true,
  format: ["esm"], // Changed to ESM
  banner: {
    js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
  },
});
