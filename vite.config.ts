import { defineConfig, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { buildSync } from 'esbuild';
import electron from 'electron';
import type { AddressInfo } from 'node:net'
import { spawn } from 'node:child_process';
import { cpSync } from 'node:fs';
import { join } from 'node:path';

export let devPlugin = () => {
  return {
    name: "dev-plugin",
    configureServer(server: ViteDevServer) {
      buildSync({
        entryPoints: ["./src/main/mainEntry.ts"],
        bundle: true,
        platform: "node",
        outfile: "./dist/mainEntry.js",
        external: ["electron"],
      });
      buildSync({
        entryPoints: ["./src/preload/preload.ts"],
        bundle: true,
        platform: "node",
        outfile: "./dist/preload.js",
        external: ["electron"],
      });

      cpSync(join(__dirname, 'public'), join(__dirname, 'dist'), {
        recursive: true,
        errorOnExist: false,
        force: true
      });
      server.httpServer?.once("listening", () => {
        const addressInfo = server.httpServer?.address() as AddressInfo
        let httpAddress = `http://localhost:${addressInfo?.port}`;
        const electronPath = (electron as any).path || (electron as unknown as string);
        let electronProcess = spawn(electronPath, ["./dist/mainEntry.js", httpAddress], {
          cwd: process.cwd(),
          stdio: "inherit",
        });
        electronProcess.on("close", () => {
          server.close();
          process.exit();
        });
      });
    },
  };
};


// https://vite.dev/config/
export default defineConfig({
  plugins: [devPlugin(), vue()],
})
