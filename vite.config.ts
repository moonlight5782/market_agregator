import { sites } from "@openai/sites-vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const sitesAuthStub = fileURLToPath(new URL("./lib/sites-auth-stub.ts", import.meta.url));
const sitesPrismaStub = fileURLToPath(new URL("./lib/sites-prisma-stub.ts", import.meta.url));
const sitesPrismaClientStub = fileURLToPath(new URL("./lib/sites-prisma-client-stub.ts", import.meta.url));

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    resolve: {
      alias: [
        { find: /^(?:\.\.\/)+auth$/, replacement: sitesAuthStub },
        { find: /^(?:\.\.\/)+lib\/prisma$/, replacement: sitesPrismaStub },
        { find: /^\.\/prisma$/, replacement: sitesPrismaStub },
        { find: "@prisma/client", replacement: sitesPrismaClientStub },
      ],
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
