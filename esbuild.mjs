import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const watch = process.argv.includes("--watch");
const cliPkg = path.dirname(require.resolve("@tailwindcss/cli/package.json"));
const tailwindCli = path.join(cliPkg, "dist", "index.mjs");

/** @type {esbuild.BuildOptions} */
const extensionOptions = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
};

/** @type {esbuild.BuildOptions} */
const webviewOptions = {
  entryPoints: ["webview-ui/main.tsx"],
  outfile: "dist/webview.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  sourcemap: true,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
  },
};

function startTailwind() {
  const args = [tailwindCli, "-i", "webview-ui/styles.css", "-o", "dist/webview.css"];
  if (watch) {
    args.push("--watch");
  }
  return spawn(process.execPath, args, { stdio: "inherit" });
}

await mkdir("dist", { recursive: true });

if (watch) {
  const extensionContext = await esbuild.context(extensionOptions);
  const webviewContext = await esbuild.context(webviewOptions);
  await extensionContext.watch();
  await webviewContext.watch();
  const tailwind = startTailwind();

  const shutdown = async () => {
    tailwind.kill();
    await extensionContext.dispose();
    await webviewContext.dispose();
  };

  process.on("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });
} else {
  await Promise.all([esbuild.build(extensionOptions), esbuild.build(webviewOptions)]);
  const exitCode = await new Promise((resolve, reject) => {
    const tailwind = startTailwind();
    tailwind.on("error", reject);
    tailwind.on("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
